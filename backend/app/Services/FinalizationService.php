<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Bid;
use App\Models\Group;
use App\Models\Supervision;
use App\Models\Title;
use App\Models\User;
use App\Concerns\RequiresActivePeriod;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class FinalizationService
{
    use RequiresActivePeriod;

    protected GroupStateMachine $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    /**
     * Centralized quota validation with row locking.
     * Throws exception if quota is full.
     */
    private function validateQuota(int $titleId): void
    {
        $title = Title::where('id', $titleId)->lockForUpdate()->first();
        
        if (!$title) {
            throw new InvalidArgumentException('Title not found.');
        }

        $currentAllocations = Group::where('title_id', $titleId)
            ->whereNotIn('status', ['FORMING', 'READY_FOR_BIDDING', 'READY_FOR_FINALIZATION', 'CLOSED'])
            ->count();

        if ($currentAllocations >= $title->quota) {
            throw new InvalidArgumentException("Kuota judul '{$title->title}' sudah penuh ({$title->quota}/{$title->quota}).");
        }
    }

    /**
     * Get supervisor load dashboard data for a period.
     * OPTIMIZED: Single query for all lecturer loads to avoid N+1
     */
    public function getSupervisorLoad(int $periodId, int $maxLoad): array
    {
        // Get all lecturers
        $lecturers = User::where('role', 'dosen')->get();
        $lecturerIds = $lecturers->pluck('id');

        // Single query to get supervision counts for ALL lecturers
        $supervisionCounts = Supervision::whereIn('supervisor_id', $lecturerIds)
            ->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId);
            })
            ->selectRaw('supervisor_id, COUNT(*) as count')
            ->groupBy('supervisor_id')
            ->pluck('count', 'supervisor_id');

        $loadData = [];
        /** @var \App\Models\User $lecturer */
        foreach ($lecturers as $lecturer) {
            $currentLoad = $supervisionCounts[$lecturer->id] ?? 0;
            $loadData[] = [
                'lecturer' => $lecturer,
                'current_load' => $currentLoad,
                'max_load' => $maxLoad,
                'is_overloaded' => $currentLoad >= $maxLoad,
            ];
        }

        return $loadData;
    }

    /**
     * V4: Batch finalize all eligible groups in a period.
     * ⚠ Atomic transaction — all-or-nothing.
     *
     * @param int $periodId Period to finalize
     * @param int $adminId Admin user ID performing this action
     * @param bool $isSimulation If true, preview without committing. Default: false
     * @return array ['allocated' => [...], 'skipped' => [...], 'total_allocated' => int, 'total_skipped' => int, 'simulated' => bool]
     *
     * PATTERN:
     * - Same transaction logic for both simulation and actual execution
     * - If $isSimulation = true, rollback at end (DB::transaction naturally rolls back)
     * - If $isSimulation = false, commit changes and update period.is_finalized
     */
    public function finalizePeriod(int $periodId, int $adminId, bool $isSimulation = false): array
    {
        return DB::transaction(function () use ($periodId, $adminId, $isSimulation) {
            // Lock the period row to prevent concurrent finalization
            $period = \App\Models\Period::lockForUpdate()->findOrFail($periodId);

            $this->ensurePeriodActiveById($periodId);

            // V5: Mandatory Readiness Check before any batch finalization
            $this->validatePeriodReadiness($periodId);

            // Mark period finalized before transitioning groups to PDC1_ACTIVE.
            // This guarantees PDC1_ACTIVE only appears after admin finalization flow begins.
            if (!$isSimulation) {
                $period->update(['is_finalized' => true]);
            }

            // Fetch all ACCEPT bids for this period, grouped by title, ordered by priority
            // V6: Only process groups that are READY_FOR_FINALIZATION (leader clicked button)
            // OPTIMIZATION: Eager load all related data to avoid N+1 queries
            $acceptBids = Bid::where('lecturer_recommendation', 'ACCEPT')
                ->whereHas('group', function ($q) use ($periodId) {
                    $q->where('period_id', $periodId)
                        ->where('status', 'READY_FOR_FINALIZATION');
                })
                ->with(['group', 'proposedSupervisor1', 'proposedSupervisor2', 'title'])
                ->orderBy('priority')
                ->get();

            $allocated = [];
            $skipped = [];
            $titleQuotaUsed = [];
            
            // Pre-load all title quotas in a single query to avoid N+1
            $titleIds = $acceptBids->pluck('title_id')->unique()->values();
            $titleQuotas = Title::whereIn('id', $titleIds)->pluck('quota', 'id');
            
            // Pre-count allocations for all titles in a single query
            $allocationCounts = Group::whereIn('title_id', $titleIds)
                ->whereNotIn('status', ['FORMING', 'READY_FOR_BIDDING', 'READY_FOR_FINALIZATION', 'CLOSED'])
                ->selectRaw('title_id, COUNT(*) as count')
                ->groupBy('title_id')
                ->pluck('count', 'title_id');

            /** @var \App\Models\Bid $bid */
            foreach ($acceptBids as $bid) {
                $titleId = $bid->title_id;
                $group = $bid->group;

                // Skip if group already allocated (by a higher-priority bid)
                if ($group->status !== 'READY_FOR_FINALIZATION') {
                    continue;
                }

                // Check quota using pre-loaded data
                if (!isset($titleQuotaUsed[$titleId])) {
                    $titleQuotaUsed[$titleId] = $allocationCounts[$titleId] ?? 0;
                }

                $titleQuota = $titleQuotas[$titleId] ?? 0;
                if ($titleQuotaUsed[$titleId] >= $titleQuota) {
                    $skipped[] = ['bid_id' => $bid->id, 'reason' => 'Quota full', 'group_id' => $group->id];
                    continue;
                }

                // Use the eager-loaded title
                $title = $bid->title;

                // Allocate: accept bid, reject others
                $bid->update(['status' => 'ACCEPTED']);
                Bid::where('group_id', $group->id)->where('id', '!=', $bid->id)->update(['status' => 'REJECTED']);

                // Assign title
                $group->assignTitleFromFinalization($titleId);
                $group->assignTypeFromFinalization('BIDDING');
                $group->save();

                // Transition READY_FOR_FINALIZATION → KELOMPOK_FINAL
                $this->stateMachine->transition($group, 'KELOMPOK_FINAL');

                // Assign supervisors (use eager-loaded data)
                $sup1Id = $bid->proposed_supervisor_1_id ?? ($title ? $title->lecturer_id : null);
                $sup2Id = $bid->proposed_supervisor_2_id;

                Supervision::updateOrCreate(
                    ['group_id' => $group->id, 'role' => 'SUPERVISOR_1'],
                    ['supervisor_id' => $sup1Id, 'assigned_by' => $adminId]
                );
                $group->supervisor_1_id = $sup1Id;

                if ($sup2Id) {
                    Supervision::updateOrCreate(
                        ['group_id' => $group->id, 'role' => 'SUPERVISOR_2'],
                        ['supervisor_id' => $sup2Id, 'assigned_by' => $adminId]
                    );
                    $group->supervisor_2_id = $sup2Id;
                }
                $group->save();

                // Transition KELOMPOK_FINAL → PDC1_ACTIVE
                $this->stateMachine->transition($group, 'PDC1_ACTIVE');

                // NOTE: refreshReadinessSnapshot moved outside loop for performance
                // Will be done in batch after all allocations

                $titleQuotaUsed[$titleId]++;
                $allocated[] = [
                    'group_id' => $group->id,
                    'title_id' => $titleId,
                    'bid_id' => $bid->id,
                ];
            }
            
            // Batch refresh readiness snapshots after all allocations
            if (!empty($allocated)) {
                $groupIds = array_column($allocated, 'group_id');
                // Dispatch to queue for better performance
                \App\Jobs\RefreshGroupReadinessBatch::dispatch($groupIds);
            }

            // ⚠️ CRITICAL: Only audit period finalization if NOT simulating
            if (!$isSimulation) {
                // Audit log the actual finalization
                AuditLog::create([
                    'user_id' => $adminId,
                    'action' => 'PERIOD_FINALIZED',
                    'target_type' => 'Period',
                    'target_id' => $period->id,
                    'payload' => [
                        'total_allocated' => count($allocated),
                        'total_skipped' => count($skipped),
                    ],
                ]);
            }

            return [
                'allocated' => $allocated,
                'skipped' => $skipped,
                'total_allocated' => count($allocated),
                'total_skipped' => count($skipped),
                'simulated' => $isSimulation,
            ];
        });
    }

    /**
     * V5: Run a "Pre-fly" simulation of the finalization process.
     * Returns a dry-run result without committing any database changes.
     */
    public function validateSimulation(int $periodId): array
    {
        // 1. Get current readiness overview
        $stats = $this->getReadinessStats($periodId);
        
        $actionPreviews = [];
        $canFinalize = $stats['total_invalid_groups'] === 0 && $stats['total_unassigned'] === 0;

        if ($canFinalize) {
            $actionPreviews[] = "Semua grup dan mahasiswa siap. Batch finalisasi akan memproses " . $stats['total_groups'] . " kelompok.";
        } else {
            if ($stats['total_unassigned'] > 0) {
                $actionPreviews[] = "PERLU TINDAKAN: " . $stats['total_unassigned'] . " mahasiswa belum memiliki kelompok.";
            }
            if ($stats['total_invalid_groups'] > 0) {
                $actionPreviews[] = "PERLU TINDAKAN: " . $stats['total_invalid_groups'] . " kelompok memiliki masalah kritis (size/title/supervisor).";
            }
        }

        // 2. Identify potential allocations from accepted bids
        // V6: Only show groups that are READY_FOR_FINALIZATION
        $potentialAllocations = Bid::where('lecturer_recommendation', 'ACCEPT')
            ->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId)->where('status', 'READY_FOR_FINALIZATION');
            })
            ->with(['group', 'title'])
            ->get();

        foreach ($potentialAllocations as $bid) {
            $actionPreviews[] = "ALOKASI: Kelompok #{$bid->group_id} akan dialokasikan ke judul '{$bid->title->title}' via bidding.";
        }

        return [
            'can_finalize' => $canFinalize,
            'summary' => [
                'ready_groups' => $stats['total_groups'] - $stats['total_invalid_groups'],
                'invalid_groups' => $stats['total_invalid_groups'],
                'unassigned_students' => $stats['total_unassigned'],
            ],
            'action_previews' => $actionPreviews,
            'readiness_details' => $stats
        ];
    }

    /**
     * V5: Automated Remediation Engine.
     * SAFE mode: Auto-assign titles/supervisors from bids.
     * AGGRESSIVE mode: Randomly assign missing supervisors and merge unassigned students.
     */
    public function executeAutoFix(int $periodId, string $mode, int $adminId): array
    {
        $this->ensurePeriodActiveById($periodId);

        return DB::transaction(function () use ($periodId, $mode, $adminId) {
            $applied = [];
            
            // 1. SAFE FIX: Auto-populate supervisors from Bids if recommended
            if ($mode === 'SAFE' || $mode === 'AGGRESSIVE') {
                $groupsWithBids = Group::where('period_id', $periodId)
                    ->where(function($q) {
                        $q->whereNull('supervisor_1_id')->orWhereNull('supervisor_2_id');
                    })
                    ->with(['bids' => fn($q) => $q->where('lecturer_recommendation', 'ACCEPT')])
                    ->get();
                
                /** @var \App\Models\Group $group */
                foreach ($groupsWithBids as $group) {
                    $winningBid = $group->bids->first();
                    if ($winningBid && $winningBid->proposed_supervisor_1_id) {
                        $group->update([
                            'supervisor_1_id' => $winningBid->proposed_supervisor_1_id,
                            'supervisor_2_id' => $winningBid->proposed_supervisor_2_id,
                        ]);
                        $applied[] = "Grup #{$group->id}: Supervisor diisi otomatis dari tawaran bidding.";
                    }
                }
            }

            // 2. AGGRESSIVE FIX: Handle unassigned students (Soft Matchmaking)
            if ($mode === 'AGGRESSIVE') {
                $matchmaker = app(AutoMatchmakerService::class);
                $matchmaker->executeMatchmaking($periodId, $adminId); // Forms SOFT_FORMING groups
                $applied[] = "Unassigned students dikelompokkan secara otomatis (Incomplete Teams).";
            }

            return [
                'message' => 'Auto-fix completed in ' . $mode . ' mode.',
                'applied_actions' => $applied,
            ];
        });
    }

    /**
     * V4-CHUNKED: Process finalization in chunks to avoid long-running transactions.
     * Use this for very large periods (>100 groups) to prevent transaction timeouts.
     * 
     * NOTE: This is NOT atomic - if it fails mid-way, some groups may be finalized
     * and others not. Use finalizePeriod() for atomic all-or-nothing behavior.
     * 
     * @param int $periodId Period to finalize
     * @param int $adminId Admin user ID performing this action
     * @param int $chunkSize Number of groups to process per chunk (default: 50)
     * @return array ['allocated' => [...], 'skipped' => [...], 'total_allocated' => int, 'total_skipped' => int]
     */
    public function finalizePeriodChunked(int $periodId, int $adminId, int $chunkSize = 50): array
    {
        $this->ensurePeriodActiveById($periodId);

        $period = \App\Models\Period::findOrFail($periodId);

        // V5: Mandatory Readiness Check before any batch finalization
        $this->validatePeriodReadiness($periodId);

        // Mark period finalized
        $period->update(['is_finalized' => true]);

        $allocated = [];
        $skipped = [];
        $titleQuotaUsed = [];

        // Process bids in chunks to avoid long-running transactions
        Bid::where('lecturer_recommendation', 'ACCEPT')
            ->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId)
                    ->where('status', 'READY_FOR_FINALIZATION');
            })
            ->with(['group', 'proposedSupervisor1', 'proposedSupervisor2', 'title'])
            ->orderBy('priority')
            ->chunk($chunkSize, function ($bids) use ($adminId, &$allocated, &$skipped, &$titleQuotaUsed) {
                // Each chunk is processed in its own transaction
                DB::transaction(function () use ($bids, $adminId, &$allocated, &$skipped, &$titleQuotaUsed) {
                    foreach ($bids as $bid) {
                        $titleId = $bid->title_id;
                        $group = $bid->group;

                        // Skip if group already allocated (by a higher-priority bid)
                        if ($group->status !== 'READY_FOR_FINALIZATION') {
                            continue;
                        }

                        // Check quota using accumulated data
                        if (!isset($titleQuotaUsed[$titleId])) {
                            $titleQuotaUsed[$titleId] = Group::where('title_id', $titleId)
                                ->whereNotIn('status', ['FORMING', 'READY_FOR_BIDDING', 'READY_FOR_FINALIZATION', 'CLOSED'])
                                ->count();
                        }

                        $title = $bid->title;
                        if (!$title || $titleQuotaUsed[$titleId] >= $title->quota) {
                            $skipped[] = ['bid_id' => $bid->id, 'reason' => 'Quota full', 'group_id' => $group->id];
                            continue;
                        }

                        // Allocate: accept bid, reject others
                        $bid->update(['status' => 'ACCEPTED']);
                        Bid::where('group_id', $group->id)->where('id', '!=', $bid->id)->update(['status' => 'REJECTED']);

                        // Assign title
                        $group->assignTitleFromFinalization($titleId);
                        $group->assignTypeFromFinalization('BIDDING');
                        $group->save();

                        // Transition READY_FOR_FINALIZATION → KELOMPOK_FINAL
                        $this->stateMachine->transition($group, 'KELOMPOK_FINAL');

                        // Assign supervisors
                        $sup1Id = $bid->proposed_supervisor_1_id ?? ($title ? $title->lecturer_id : null);
                        $sup2Id = $bid->proposed_supervisor_2_id;

                        Supervision::updateOrCreate(
                            ['group_id' => $group->id, 'role' => 'SUPERVISOR_1'],
                            ['supervisor_id' => $sup1Id, 'assigned_by' => $adminId]
                        );
                        $group->supervisor_1_id = $sup1Id;

                        if ($sup2Id) {
                            Supervision::updateOrCreate(
                                ['group_id' => $group->id, 'role' => 'SUPERVISOR_2'],
                                ['supervisor_id' => $sup2Id, 'assigned_by' => $adminId]
                            );
                            $group->supervisor_2_id = $sup2Id;
                        }
                        $group->save();

                        // Transition KELOMPOK_FINAL → PDC1_ACTIVE
                        $this->stateMachine->transition($group, 'PDC1_ACTIVE');

                        $titleQuotaUsed[$titleId]++;
                        $allocated[] = [
                            'group_id' => $group->id,
                            'title_id' => $titleId,
                            'bid_id' => $bid->id,
                        ];
                    }
                });
            });

        // Batch refresh readiness snapshots after all allocations
        if (!empty($allocated)) {
            $groupIds = array_column($allocated, 'group_id');
            \App\Jobs\RefreshGroupReadinessBatch::dispatch($groupIds);
        }

        // Audit log the finalization
        AuditLog::create([
            'user_id' => $adminId,
            'action' => 'PERIOD_FINALIZED',
            'target_type' => 'Period',
            'target_id' => $period->id,
            'payload' => [
                'total_allocated' => count($allocated),
                'total_skipped' => count($skipped),
                'chunked' => true,
                'chunk_size' => $chunkSize,
            ],
        ]);

        return [
            'allocated' => $allocated,
            'skipped' => $skipped,
            'total_allocated' => count($allocated),
            'total_skipped' => count($skipped),
            'chunked' => true,
        ];
    }

    /**
     * V5: Validate that all groups and students in a period are ready for finalization.
     * Enforces the 4 strict rules requested by admin.
     * 
     * @param int $periodId
     * @throws InvalidArgumentException
     */
    public function validatePeriodReadiness(int $periodId): void
    {
        // ─── Pre-check period-level blockers ───
        $period = \App\Models\Period::findOrFail($periodId);
        
        // Check document requirements
        $docReqExists = \App\Models\PhaseDocumentRequirement::where('period_id', $periodId)->exists();
        if (!$docReqExists) {
            throw new InvalidArgumentException("Dokumen requirement belum dikonfigurasi untuk periode ini. Konfigurasi di Periode > Document Requirements.");
        }

        // Check period config
        if ($period->min_group_size === null || $period->max_group_size === null) {
            throw new InvalidArgumentException("Konfigurasi periode belum lengkap. Isi min/max group size di edit periode.");
        }

        // Check peer review
        if ($period->peerReviewIndicators()->count() === 0) {
            throw new InvalidArgumentException("Peer review belum dikonfigurasi. Atur indikator peer review di menu Assessment.");
        }

        // Check grade config
        if ($period->grade_configuration === null || empty($period->grade_configuration)) {
            throw new InvalidArgumentException("Konfigurasi nilai belum diatur. Isi grade configuration di edit periode.");
        }

        // Check for groups ready for finalization
        $rfCount = Group::where('period_id', $periodId)->where('status', 'READY_FOR_FINALIZATION')->count();
        if ($rfCount > 0) {
            throw new InvalidArgumentException("Ada {$rfCount} grup belum ditandai Kelompok Final. Tandai semua grup sebagai Kelompok Final terlebih dahulu.");
        }

        $blockers = $this->collectPeriodReadinessBlockers($periodId);

        if (!$blockers['has_blockers']) {
            return;
        }

        $errors = [];

        if (!empty($blockers['unassigned_students'])) {
            $names = array_map(fn($s) => $s['name'], $blockers['unassigned_students']);
            $errors[] = "Terdapat " . count($blockers['unassigned_students']) . " mahasiswa terdaftar yang belum memiliki kelompok: " . implode(', ', $names);
        }

        foreach ($blockers['group_errors'] as $groupError) {
            $errors[] = "Kelompok #{$groupError['group_id']}: " . implode(', ', $groupError['issues']);
        }

        throw new InvalidArgumentException("Finalisasi Gagal! Mohon lengkapi data berikut:\n- " . implode("\n- ", $errors));
    }

    /**
     * V6: Collect structured readiness blockers for admin-facing diagnostics.
     */
    public function collectPeriodReadinessBlockers(int $periodId): array
    {
        $period = \App\Models\Period::findOrFail($periodId);
        $minSize = $period->min_group_size ?? 3;
        $maxSize = $period->max_group_size ?? 4;

        $blockers = [
            'unassigned_students' => [],
            'groups_invalid_size' => [],
            'groups_without_title' => [],
            'groups_without_supervisor_1' => [],
            'groups_without_supervisor_2' => [],
            'group_errors' => [],
            'rules' => [
                'min_group_size' => $minSize,
                'max_group_size' => $maxSize,
                'require_all_students_grouped' => (bool) ($period->require_all_students_grouped ?? true),
            ],
        ];

        $registeredStudentIds = \App\Models\PeriodRegistration::where('period_id', $periodId)
            ->pluck('user_id');

        $assignedStudentIds = \App\Models\GroupMember::where('period_id', $periodId)
            ->pluck('student_id')
            ->unique();

        if (($period->require_all_students_grouped ?? true) === true) {
            $unassignedIds = $registeredStudentIds->diff($assignedStudentIds)->values();
            if ($unassignedIds->isNotEmpty()) {
                $blockers['unassigned_students'] = User::whereIn('id', $unassignedIds)
                    ->get(['id', 'name', 'email'])
                    ->map(fn($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email])
                    ->values()
                    ->toArray();
            }
        }

        $groups = Group::where('period_id', $periodId)
            ->whereNotIn('status', ['CLOSED'])
            ->withCount('members')
            ->get();

        foreach ($groups as $group) {
            $groupErrors = [];

            if ($group->members_count < $minSize || $group->members_count > $maxSize) {
                $groupErrors[] = "Jumlah anggota {$group->members_count} (harus {$minSize}-{$maxSize})";
                $blockers['groups_invalid_size'][] = [
                    'group_id' => $group->id,
                    'members_count' => $group->members_count,
                ];
            }

            $hasTitle = $group->title_id || Bid::where('group_id', $group->id)
                ->where('lecturer_recommendation', 'ACCEPT')
                ->exists();

            if (!$hasTitle) {
                $groupErrors[] = 'Belum memiliki judul (bursa ide/proposal)';
                $blockers['groups_without_title'][] = $group->id;
            }

            $winningBid = Bid::where('group_id', $group->id)
                ->where('lecturer_recommendation', 'ACCEPT')
                ->first();

            $titleLecturerId = null;
            if ($winningBid) {
                $titleLecturerId = Title::where('id', $winningBid->title_id)->value('lecturer_id');
            }

            $hasSup1 = $group->supervisor_1_id
                || ($winningBid && $winningBid->proposed_supervisor_1_id)
                || $titleLecturerId;

            $hasSup2 = $group->supervisor_2_id
                || ($winningBid && $winningBid->proposed_supervisor_2_id);

            if (!$hasSup1) {
                $groupErrors[] = 'Belum memiliki Pembimbing 1';
                $blockers['groups_without_supervisor_1'][] = $group->id;
            }

            if (!$hasSup2) {
                $groupErrors[] = 'Belum memiliki Pembimbing 2';
                $blockers['groups_without_supervisor_2'][] = $group->id;
            }

            if (!empty($groupErrors)) {
                $blockers['group_errors'][] = [
                    'group_id' => $group->id,
                    'issues' => $groupErrors,
                ];
            }
        }

        foreach (['groups_without_title', 'groups_without_supervisor_1', 'groups_without_supervisor_2'] as $key) {
            $blockers[$key] = array_values(array_unique($blockers[$key]));
        }

        $blockers['has_blockers'] =
            !empty($blockers['unassigned_students'])
            || !empty($blockers['groups_invalid_size'])
            || !empty($blockers['groups_without_title'])
            || !empty($blockers['groups_without_supervisor_1'])
            || !empty($blockers['groups_without_supervisor_2']);

        return $blockers;
    }

    /**
     * V5: Get comprehensive readiness statistics for a period.
     * Returns counts and details of registrations and potential validation failures.
     */
    public function getReadinessStats(int $periodId): array
    {
        // 1. Student Registration Stats (always real-time)
        $registeredStudentIds = \App\Models\PeriodRegistration::where('period_id', $periodId)
            ->pluck('user_id');
        
        $assignedStudentIds = \App\Models\GroupMember::where('period_id', $periodId)
            ->pluck('student_id')
            ->unique();

        $unassignedIds = $registeredStudentIds->diff($assignedStudentIds);
        $unassignedStudents = User::whereIn('id', $unassignedIds)->get(['id', 'name', 'email']);

        // 2. Group Readiness Stats (Snapshot-Powered for Performance)
        $groups = Group::where('period_id', $periodId)
            ->whereNotIn('status', ['CLOSED'])
            ->get();

        $invalidGroups = [];
        $totalProgress = 0;
        
        foreach ($groups as $group) {
            $status = $group->readiness_status ?? $group->calculateReadiness();
            $progress = $status['progress'] ?? null;

            // Backward compatibility: newer readiness snapshots may omit progress.
            if ($progress === null) {
                $period = $group->period;
                $minSize = $period->min_group_size ?? 3;
                $maxSize = $period->max_group_size ?? 4;
                $memberCount = $status['member_count'] ?? $group->members()->count();

                $metWeight = 0;
                if ($memberCount >= $minSize && $memberCount <= $maxSize) {
                    $metWeight++;
                }
                if (($status['title_assigned'] ?? false) === true) {
                    $metWeight++;
                }
                if (($group->supervisor_1_id !== null)) {
                    $metWeight++;
                }
                if (($group->supervisor_2_id !== null)) {
                    $metWeight++;
                }

                $progress = (int) round(($metWeight / 4) * 100);
            }
            
            if (!$status['is_ready']) {
                $invalidGroups[] = [
                    'id' => $group->id,
                    'status' => $group->status,
                    'progress' => $progress,
                    'issues' => $status['issues']['critical'] ?? []
                ];
            }
            $totalProgress += $progress;
        }

        $averageProgress = $groups->count() > 0 ? round($totalProgress / $groups->count()) : 0;

        return [
            'total_registered' => $registeredStudentIds->count(),
            'total_assigned' => $assignedStudentIds->count(),
            'total_unassigned' => $unassignedIds->count(),
            'total_groups' => $groups->count(),
            'total_invalid_groups' => count($invalidGroups),
            'global_progress' => $averageProgress,
            'unassigned_students' => $unassignedStudents,
            'invalid_groups' => $invalidGroups,
        ];
    }
}

