<?php

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\Group;
use App\Models\Period;
use App\Models\Title;
use App\Services\BiddingService;
use App\Services\FinalizationService;
use App\Services\AutoMatchmakerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinalizationController extends Controller
{
    protected FinalizationService $finalizationService;
    protected BiddingService $biddingService;
    protected AutoMatchmakerService $autoMatchmakerService;

    public function __construct(
        FinalizationService $finalizationService, 
        BiddingService $biddingService,
        AutoMatchmakerService $autoMatchmakerService
    ) {
        $this->finalizationService = $finalizationService;
        $this->biddingService = $biddingService;
        $this->autoMatchmakerService = $autoMatchmakerService;
    }

    /**
     * Resolve which period to use.
     * V4: accept explicit period_id; fallback to single active period.
     */
    private function resolvePeriod(Request $request): Period
    {
        if ($request->has('period_id')) {
            return Period::findOrFail($request->period_id);
        }

        $activePeriods = Period::where('is_active', true)->get();

        if ($activePeriods->count() === 0) {
            abort(400, 'No active period found.');
        }

        if ($activePeriods->count() > 1) {
            abort(400, 'Multiple active periods exist. Please specify period_id.');
        }

        return $activePeriods->first();
    }

    /**
     * Title-centric finalization dashboard.
     */
    public function index(Request $request)
    {
        $period = $this->resolvePeriod($request);

        // 2-LEVEL GOVERNANCE: Only show titles ready for admin finalization
        $titles = Title::with([
            'lecturer',
            'bids' => function ($q) use ($period) {
                $q->where('lecturer_recommendation', 'ACCEPT')
                    ->whereHas('group', function ($gq) use ($period) {
                        $gq->where('period_id', $period->id);
                    })
                    ->with(['group.members.student', 'proposedSupervisor1', 'proposedSupervisor2'])
                    ->orderBy('priority');
            },
        ])
            ->where(function ($q) use ($period) {
                $q->where(function ($sub) use ($period) {
                    $sub->where('title_source', 'STUDENT')
                        ->where('supervisor_approval_status', 'APPROVED')
                        ->whereHas('proposedByGroup', function ($gq) use ($period) {
                            $gq->where('period_id', $period->id);
                        });
                })
                    ->orWhereHas('bids', function ($bq) use ($period) {
                        $bq->where('lecturer_recommendation', 'ACCEPT')
                            ->whereHas('group', function ($gq) use ($period) {
                                $gq->where('period_id', $period->id);
                            });
                    })
                    ->orWhere(function ($sub) use ($period) {
                        // Lecturer-created titles assigned to this period (may not have bids yet)
                        $sub->where('title_source', 'LECTURER')
                            ->where('period_id', $period->id);
                    });
            })
            ->get();

        $titles->each(function ($title) {
            $title->current_allocations = Group::where('title_id', $title->id)
                ->whereNotIn('status', ['FORMING', 'READY_FOR_BIDDING', 'CLOSED'])
                ->count();
            $title->remaining_quota = $title->quota - $title->current_allocations;
        });

        $readinessStats = $this->finalizationService->getReadinessStats($period->id);

        return response()->json([
            'data' => $titles,
            'period' => $period,
            'is_locked' => $period->isBiddingLocked(),
            'readiness_stats' => $readinessStats,
        ]);
    }

    /**
     * Supervisor load dashboard.
     */
    public function dosenLoad(Request $request)
    {
        $period = $this->resolvePeriod($request);

        $loadData = $this->finalizationService->getSupervisorLoad(
            $period->id,
            $period->max_supervise_load ?? 8
        );

        return response()->json(['data' => $loadData]);
    }

    /**
     * Batch finalize all eligible groups in a period.
     * V4: Atomic transaction — all-or-nothing.
     */
    public function finalizePeriod(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $period = Period::findOrFail($request->period_id);

        // ⚠ Guard: don't finalize archived/inactive period
        if (!$period->is_active) {
            return response()->json(['message' => 'Cannot finalize an inactive period.'], 400);
        }

        try {
            $blockers = $this->finalizationService->collectPeriodReadinessBlockers($period->id);

            if ($blockers['has_blockers']) {
                return response()->json([
                    'message' => 'Finalisasi gagal. Masih ada data yang memblokir proses batch.',
                    'blockers' => $blockers,
                ], 422);
            }
            
            $result = $this->finalizationService->finalizePeriod(
                $period->id,
                $request->user()->id
            );

            return response()->json([
                'message' => 'Period finalized successfully.',
                'data' => $result,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Batch finalization failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * V5: Simulation Mode (Dry-run)
     * Preview exactly what will happen during finalization.
     */
    public function simulate(Request $request)
    {
        $period = $this->resolvePeriod($request);

        try {
            $simulation = $this->finalizationService->validateSimulation($period->id);
            return response()->json(['data' => $simulation]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Simulation failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * V5: Auto-Fix Engine
     * Automatically resolve common blockers (missing supervisors, unassigned students).
     */
    public function autoFix(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'mode' => 'required|in:SAFE,AGGRESSIVE',
        ]);

        try {
            $result = $this->finalizationService->executeAutoFix(
                $request->period_id,
                $request->mode,
                $request->user()->id
            );

            return response()->json(['data' => $result]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Auto-fix failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Manually lock bidding.
     */
    public function lock(Request $request)
    {
        $period = $this->resolvePeriod($request);

        $this->biddingService->lockBidding($period);

        \App\Models\AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'BIDDING_LOCK',
            'target_type' => 'Period',
            'target_id' => $period->id,
            'payload' => ['locked_at' => now()->toISOString()],
        ]);

        return response()->json(['message' => 'Bidding locked successfully.', 'period' => $period->fresh()]);
    }

    /**
     * Manually unlock bidding.
     */
    public function unlock(Request $request)
    {
        $period = $this->resolvePeriod($request);

        $this->biddingService->unlockBidding($period);

        \App\Models\AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'BIDDING_UNLOCK',
            'target_type' => 'Period',
            'target_id' => $period->id,
            'payload' => ['unlocked_at' => now()->toISOString()],
        ]);

        return response()->json(['message' => 'Bidding unlocked successfully.', 'period' => $period->fresh()]);
    }

    /**
     * Run the Auto-Matchmaker bot to form complete groups from isolated/ghost students.
     */
    public function runAutoMatchmaker(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $period = Period::findOrFail($request->period_id);

        if (!$period->is_active) {
            return response()->json(['message' => 'Cannot run matchmaker on an inactive period.'], 400);
        }

        try {
            $stats = $this->autoMatchmakerService->executeMatchmaking(
                $period->id,
                $request->user()->id
            );

            return response()->json([
                'message' => 'Auto-Matchmaker executed successfully.',
                'stats' => $stats,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Auto-Matchmaker failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Force Override Tolerance: Admin manually promotes an incomplete group to READY_FOR_BIDDING.
     * Used for edge cases where mathematical remainders leave groups with < min_size members.
     */
    public function forceReady(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
        ]);

        $group = Group::with('period')->findOrFail($request->group_id);

        if (!in_array($group->status, ['FORMING', 'FORMING_SOLO', 'WAITING_SUPERVISOR_APPROVAL'])) {
            return response()->json([
                'message' => 'Only groups in FORMING, FORMING_SOLO or WAITING_SUPERVISOR_APPROVAL status can be force-promoted.',
            ], 400);
        }

        $memberCount = $group->members()->count();
        if ($memberCount === 0) {
            return response()->json(['message' => 'Cannot force-ready a group with 0 members.'], 400);
        }

        $group->status = 'READY_FOR_BIDDING';
        $group->save();

        // Handle UNDER_REVIEW title if exists  
        $preApprovedTitle = Title::where('proposed_by_group_id', $group->id)
            ->where('supervisor_approval_status', 'UNDER_REVIEW')
            ->first();

        if ($preApprovedTitle) {
            $preApprovedTitle->update(['supervisor_approval_status' => 'APPROVED']);
            $group->update(['title_id' => $preApprovedTitle->id]);
        }

        // Audit
        \App\Models\AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'ADMIN_FORCE_READY',
            'target_type' => 'Group',
            'target_id' => $group->id,
            'payload' => [
                'member_count' => $memberCount,
                'reason' => 'Admin force override tolerance',
            ],
        ]);

        return response()->json([
            'message' => "Group #{$group->id} forced to READY_FOR_BIDDING with {$memberCount} member(s).",
            'group' => $group->fresh()->load('members.student'),
        ]);
    }

    /**
     * V5: Re-open a finalized period for registration.
     * Allows admin to undo accidental finalization.
     */
    public function reopenPeriod(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $period = Period::findOrFail($request->period_id);

        if (!$period->is_active) {
            return response()->json(['message' => 'Cannot reopen an inactive period.'], 400);
        }

        if (!$period->is_finalized) {
            return response()->json(['message' => 'Period is not finalized.'], 400);
        }

        $period->update(['is_finalized' => false]);

        \App\Models\AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'PERIOD_REOPENED',
            'target_type' => 'Period',
            'target_id' => $period->id,
            'payload' => ['reopened_at' => now()->toISOString()],
        ]);

        return response()->json([
            'message' => 'Period reopened for registration.',
            'period' => $period->fresh(),
        ]);
    }

    /**
     * Admin Dashboard: View groups ready for finalization and others.
     */
    public function adminDashboard(Request $request)
    {
        $period = $this->resolvePeriod($request);

        // Tab 1: READY_FOR_FINALIZATION (need supervisor assignment)
        $readyForFinalization = Group::with(['members.student', 'title.lecturer', 'supervisor1', 'supervisor2', 'period'])
            ->where('period_id', $period->id)
            ->where('status', 'READY_FOR_FINALIZATION')
            ->get();

        // Tab 2: KELOMPOK_FINAL (ready to be finalized to PDC1_ACTIVE)
        $kelompokFinal = Group::with(['members.student', 'title.lecturer', 'supervisor1', 'supervisor2', 'period'])
            ->where('period_id', $period->id)
            ->where('status', 'KELOMPOK_FINAL')
            ->get();

        // Tab 3: Others (no group, no title, not ready)
        $others = [
            'no_group' => [], // Mahasiswa tanpa kelompok
            'no_title' => [], // Kelompok tanpa judul
            'not_ready' => [], // Kelompok belum READY_FOR_FINALIZATION
        ];

        // Get students without groups
        $studentsWithGroups = \App\Models\GroupMember::whereHas('group', function ($q) use ($period) {
            $q->where('period_id', $period->id);
        })->pluck('student_id');

        $others['no_group'] = \App\Models\User::where('role', 'mahasiswa')
            ->whereNotIn('id', $studentsWithGroups)
            ->select('id', 'name', 'email', 'nim')
            ->get();

        // Get groups without title
        $others['no_title'] = Group::with(['members.student'])
            ->where('period_id', $period->id)
            ->whereNull('title_id')
            ->whereNotIn('status', ['CLOSED', 'DISSOLVED'])
            ->get();

        // Get groups not ready
        $others['not_ready'] = Group::with(['members.student', 'title'])
            ->where('period_id', $period->id)
            ->whereNotIn('status', ['READY_FOR_FINALIZATION', 'KELOMPOK_FINAL', 'PDC1_ACTIVE', 'PDC2_ACTIVE', 'CLOSED', 'DISSOLVED'])
            ->get();

        // Stats
        $stats = [
            'total_ready' => $readyForFinalization->count(),
            'total_kelompok_final' => $kelompokFinal->count(),
            'total_no_group' => $others['no_group']->count(),
            'total_no_title' => $others['no_title']->count(),
            'total_not_ready' => $others['not_ready']->count(),
            'can_finalize' => $kelompokFinal->count() > 0 && $readyForFinalization->count() === 0,
        ];

        return response()->json([
            'period' => $period,
            'ready_for_finalization' => $readyForFinalization,
            'kelompok_final' => $kelompokFinal,
            'others' => $others,
            'stats' => $stats,
        ]);
    }

    /**
     * Set Supervisor 1 and 2 for a group (Admin only).
     */
    public function setSupervisor(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'supervisor_1_id' => 'nullable|exists:users,id',
            'supervisor_2_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();
        $group = Group::with('period')->findOrFail($request->group_id);

        // Only admin can set supervisors
        if (!$user->hasRole('admin')) {
            return response()->json(['message' => 'Hanya admin yang dapat menetapkan supervisor.'], 403);
        }

        // Group must be READY_FOR_FINALIZATION
        if ($group->status !== 'READY_FOR_FINALIZATION') {
            return response()->json([
                'message' => 'Grup harus dalam status READY_FOR_FINALIZATION untuk menetapkan supervisor.',
                'current_status' => $group->status
            ], 400);
        }

        // Validate supervisors
        $loadService = app(\App\Services\SupervisorLoadService::class);

        if ($request->supervisor_1_id) {
            $validation = $loadService->validateAssignment($request->supervisor_1_id, $group->period_id);
            if (!$validation['valid']) {
                return response()->json(['message' => $validation['message']], 400);
            }
        }

        if ($request->supervisor_2_id) {
            $validation = $loadService->validateAssignment($request->supervisor_2_id, $group->period_id);
            if (!$validation['valid']) {
                return response()->json(['message' => $validation['message']], 400);
            }
        }

        // Prevent same supervisor for both roles
        if ($request->supervisor_1_id && $request->supervisor_2_id &&
            $request->supervisor_1_id === $request->supervisor_2_id) {
            return response()->json(['message' => 'Supervisor 1 dan 2 tidak boleh sama.'], 400);
        }

        DB::beginTransaction();
        try {
            $oldValues = [
                'supervisor_1_id' => $group->supervisor_1_id,
                'supervisor_2_id' => $group->supervisor_2_id,
                'status' => $group->status,
            ];

            // Update group
            $group->update([
                'supervisor_1_id' => $request->supervisor_1_id,
                'supervisor_2_id' => $request->supervisor_2_id,
                'finalization_notes' => $request->notes,
                'status' => 'KELOMPOK_FINAL',
            ]);

            // Create audit log
            \App\Models\FinalizationAudit::create([
                'period_id' => $group->period_id,
                'group_id' => $group->id,
                'user_id' => $user->id,
                'action' => 'SUPERVISOR_SET',
                'old_values' => $oldValues,
                'new_values' => [
                    'supervisor_1_id' => $request->supervisor_1_id,
                    'supervisor_2_id' => $request->supervisor_2_id,
                    'status' => 'KELOMPOK_FINAL',
                ],
                'notes' => $request->notes,
            ]);

            // Notify group members
            foreach ($group->members as $member) {
                \App\Models\Notification::create([
                    'user_id' => $member->student_id,
                    'type' => 'SUPERVISOR_ASSIGNED',
                    'title' => 'Supervisor Ditentukan',
                    'message' => 'Admin telah menetapkan supervisor untuk kelompok Anda. Kelompok siap untuk finalisasi.',
                    'related_type' => 'Group',
                    'related_id' => $group->id,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Supervisor berhasil ditetapkan. Status kelompok: KELOMPOK_FINAL.',
                'group' => $group->fresh(['supervisor1', 'supervisor2', 'members.student', 'title']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal menetapkan supervisor: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Execute Finalization: Change all KELOMPOK_FINAL to PDC1_ACTIVE.
     */
    public function executeFinalization(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'confirmation' => 'required|boolean',
        ]);

        if (!$request->confirmation) {
            return response()->json(['message' => 'Konfirmasi diperlukan untuk mengeksekusi finalisasi.'], 400);
        }

        $user = $request->user();
        $period = Period::findOrFail($request->period_id);

        // Only admin
        if (!$user->hasRole('admin')) {
            return response()->json(['message' => 'Hanya admin yang dapat mengeksekusi finalisasi.'], 403);
        }

        // Check if period is active
        if (!$period->is_active) {
            return response()->json(['message' => 'Periode tidak aktif.'], 400);
        }

        // Validation: ALL groups must be KELOMPOK_FINAL
        $notReadyGroups = Group::where('period_id', $period->id)
            ->whereNotIn('status', ['KELOMPOK_FINAL', 'PDC1_ACTIVE', 'PDC2_ACTIVE', 'CLOSED', 'DISSOLVED'])
            ->count();

        if ($notReadyGroups > 0) {
            return response()->json([
                'message' => "Terdapat {$notReadyGroups} grup yang belum siap finalisasi.",
                'error_code' => 'GROUPS_NOT_READY',
            ], 422);
        }

        // Validation: ALL KELOMPOK_FINAL groups must have supervisor_1
        $noSupervisorGroups = Group::where('period_id', $period->id)
            ->where('status', 'KELOMPOK_FINAL')
            ->whereNull('supervisor_1_id')
            ->count();

        if ($noSupervisorGroups > 0) {
            return response()->json([
                'message' => "Terdapat {$noSupervisorGroups} grup KELOMPOK_FINAL yang belum memiliki Supervisor 1.",
                'error_code' => 'MISSING_SUPERVISOR',
            ], 422);
        }

        DB::beginTransaction();
        try {
            $groups = Group::where('period_id', $period->id)
                ->where('status', 'KELOMPOK_FINAL')
                ->get();

            $finalizedCount = 0;

            foreach ($groups as $group) {
                $group->update([
                    'status' => 'PDC1_ACTIVE',
                    'finalized_at' => now(),
                    'finalized_by' => $user->id,
                ]);

                // Create supervision records
                if ($group->supervisor_1_id) {
                    \App\Models\Supervision::updateOrCreate(
                        ['group_id' => $group->id, 'role' => 'SUPERVISOR_1'],
                        ['supervisor_id' => $group->supervisor_1_id, 'assigned_by' => $user->id]
                    );
                }

                if ($group->supervisor_2_id) {
                    \App\Models\Supervision::updateOrCreate(
                        ['group_id' => $group->id, 'role' => 'SUPERVISOR_2'],
                        ['supervisor_id' => $group->supervisor_2_id, 'assigned_by' => $user->id]
                    );
                }

                // Audit log
                \App\Models\FinalizationAudit::create([
                    'period_id' => $period->id,
                    'group_id' => $group->id,
                    'user_id' => $user->id,
                    'action' => 'FINALIZATION_EXECUTED',
                    'old_values' => ['status' => 'KELOMPOK_FINAL'],
                    'new_values' => ['status' => 'PDC1_ACTIVE'],
                ]);

                $finalizedCount++;
            }

            // Notify all groups and lecturers
            $this->notifyFinalizationCompletion($period, $groups, $user);

            DB::commit();

            return response()->json([
                'message' => "Finalisasi berhasil. {$finalizedCount} grup telah difinalisasi ke PDC1_ACTIVE.",
                'finalized_count' => $finalizedCount,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Finalisasi gagal: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Rollback Finalization: Revert PDC1_ACTIVE or KELOMPOK_FINAL to previous status.
     */
    public function rollbackFinalization(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'group_ids' => 'nullable|array',
            'group_ids.*' => 'exists:groups,id',
            'reason' => 'required|string|max:1000',
        ]);

        $user = $request->user();
        $period = Period::findOrFail($request->period_id);

        // Only admin
        if (!$user->hasRole('admin')) {
            return response()->json(['message' => 'Hanya admin yang dapat melakukan rollback.'], 403);
        }

        DB::beginTransaction();
        try {
            $query = Group::where('period_id', $period->id)
                ->whereIn('status', ['PDC1_ACTIVE', 'KELOMPOK_FINAL']);

            if ($request->group_ids) {
                $query->whereIn('id', $request->group_ids);
            }

            $groups = $query->get();

            if ($groups->isEmpty()) {
                return response()->json(['message' => 'Tidak ada grup yang dapat di-rollback.'], 400);
            }

            foreach ($groups as $group) {
                $oldStatus = $group->status;
                $newStatus = $oldStatus === 'PDC1_ACTIVE' ? 'KELOMPOK_FINAL' : 'READY_FOR_FINALIZATION';

                $group->update([
                    'status' => $newStatus,
                    'finalized_at' => $oldStatus === 'PDC1_ACTIVE' ? null : $group->finalized_at,
                    'finalized_by' => $oldStatus === 'PDC1_ACTIVE' ? null : $group->finalized_by,
                ]);

                // Audit log
                \App\Models\FinalizationAudit::create([
                    'period_id' => $period->id,
                    'group_id' => $group->id,
                    'user_id' => $user->id,
                    'action' => 'FINALIZATION_ROLLBACK',
                    'old_values' => ['status' => $oldStatus],
                    'new_values' => ['status' => $newStatus],
                    'notes' => $request->reason,
                ]);

                // Notify group
                foreach ($group->members as $member) {
                    \App\Models\Notification::create([
                        'user_id' => $member->student_id,
                        'type' => 'FINALIZATION_ROLLBACK',
                        'title' => 'Finalisasi Dibatalkan',
                        'message' => "Finalisasi kelompok Anda telah dibatalkan. Alasan: {$request->reason}",
                        'related_type' => 'Group',
                        'related_id' => $group->id,
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => "Rollback berhasil. {$groups->count()} grup telah dikembalikan.",
                'rolled_back_count' => $groups->count(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Rollback gagal: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Export finalization report.
     */
    public function export(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'format' => 'required|in:excel,pdf',
        ]);

        $period = Period::findOrFail($request->period_id);
        $groups = Group::with(['members.student', 'title', 'supervisor1', 'supervisor2'])
            ->where('period_id', $period->id)
            ->whereIn('status', ['KELOMPOK_FINAL', 'PDC1_ACTIVE', 'PDC2_ACTIVE'])
            ->get();

        if ($request->format === 'excel') {
            return $this->exportExcel($groups, $period);
        } else {
            return $this->exportPdf($groups, $period);
        }
    }

    /**
     * Export to Excel.
     */
    private function exportExcel($groups, $period)
    {
        $data = [];
        foreach ($groups as $index => $group) {
            $data[] = [
                'No' => $index + 1,
                'Group ID' => $group->id,
                'Judul' => $group->title ? $group->title->title : '-',
                'Anggota' => $group->members->map(fn($m) => $m->student->name)->join(', '),
                'Supervisor 1' => $group->supervisor1 ? $group->supervisor1->name : '-',
                'Supervisor 2' => $group->supervisor2 ? $group->supervisor2->name : '-',
                'Status' => $group->status,
            ];
        }

        // Simple CSV export for now
        $filename = "finalisasi_periode_{$period->id}_" . now()->format('Y-m-d') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename={$filename}",
        ];

        $output = fopen('php://temp', 'r+');
        fputcsv($output, array_keys($data[0] ?? []));
        foreach ($data as $row) {
            fputcsv($output, $row);
        }
        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return response($csv, 200, $headers);
    }

    /**
     * Export to PDF.
     */
    private function exportPdf($groups, $period)
    {
        // For now, return simple HTML table as PDF alternative
        $html = '<h1>Laporan Finalisasi</h1>';
        $html .= '<p>Periode: ' . ($period->name ?? $period->id) . '</p>';
        $html .= '<table border="1" cellpadding="5">';
        $html .= '<tr><th>No</th><th>Group ID</th><th>Judul</th><th>Anggota</th><th>Supervisor 1</th><th>Supervisor 2</th><th>Status</th></tr>';

        foreach ($groups as $index => $group) {
            $html .= '<tr>';
            $html .= '<td>' . ($index + 1) . '</td>';
            $html .= '<td>' . $group->id . '</td>';
            $html .= '<td>' . ($group->title ? $group->title->title : '-') . '</td>';
            $html .= '<td>' . $group->members->map(fn($m) => $m->student->name)->join(', ') . '</td>';
            $html .= '<td>' . ($group->supervisor1 ? $group->supervisor1->name : '-') . '</td>';
            $html .= '<td>' . ($group->supervisor2 ? $group->supervisor2->name : '-') . '</td>';
            $html .= '<td>' . $group->status . '</td>';
            $html .= '</tr>';
        }

        $html .= '</table>';

        $filename = "finalisasi_periode_{$period->id}_" . now()->format('Y-m-d') . '.html';

        return response($html, 200, [
            'Content-Type' => 'text/html',
            'Content-Disposition' => "attachment; filename={$filename}",
        ]);
    }

    /**
     * Helper: Notify finalization completion.
     */
    private function notifyFinalizationCompletion($period, $groups, $user)
    {
        // Get all unique lecturers
        $lecturerIds = $groups->pluck('supervisor_1_id')
            ->merge($groups->pluck('supervisor_2_id'))
            ->filter()
            ->unique();

        // Notify lecturers
        foreach ($lecturerIds as $lecturerId) {
            $supervisedGroups = $groups->filter(function ($g) use ($lecturerId) {
                return $g->supervisor_1_id === $lecturerId || $g->supervisor_2_id === $lecturerId;
            });

            \App\Models\Notification::create([
                'user_id' => $lecturerId,
                'type' => 'FINALIZATION_COMPLETED',
                'title' => 'Finalisasi Selesai',
                'message' => "Finalisasi periode telah selesai. Anda menaungi {$supervisedGroups->count()} kelompok.",
                'related_type' => 'Period',
                'related_id' => $period->id,
            ]);
        }

        // Notify all students
        foreach ($groups as $group) {
            foreach ($group->members as $member) {
                \App\Models\Notification::create([
                    'user_id' => $member->student_id,
                    'type' => 'FINALIZATION_COMPLETED',
                    'title' => 'Finalisasi Selesai',
                    'message' => 'Selamat! Kelompok Anda telah difinalisasi dan memasuki tahap PDC1_ACTIVE.',
                    'related_type' => 'Group',
                    'related_id' => $group->id,
                ]);
            }
        }
    }
}
