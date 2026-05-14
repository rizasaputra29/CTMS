<?php

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Title;
use App\Concerns\RequiresActivePeriod;
use App\Services\BiddingService;
use App\Services\FinalizationService;
use App\Services\AutoMatchmakerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FinalizationController extends Controller
{
    protected FinalizationService $finalizationService;
    protected BiddingService $biddingService;
    protected AutoMatchmakerService $autoMatchmakerService;

    use RequiresActivePeriod;

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
        // If period_id provided in request, use it
        if ($request->has('period_id')) {
            $period = Period::find($request->input('period_id'));
            if (!$period) {
                abort(404, 'Period not found');
            }
            if (!$period->is_active) {
                abort(400, 'Period is not active');
            }
            return $period;
        }

        // Backward compatibility: if no period_id, try to resolve single active period
        $activePeriods = Period::where('is_active', true)->get();

        if ($activePeriods->isEmpty()) {
            abort(400, 'No active periods found');
        }

        if ($activePeriods->count() === 1) {
            return $activePeriods->first();
        }

        // Multiple active periods but no period_id specified
        abort(400, 'Multiple active periods exist. Please specify period_id');
    }

    /**
     * Title-centric finalization dashboard.
     */
    public function index(Request $request)
    {
        $period = $this->resolvePeriod($request);

        // Get all active periods for selector
        $activePeriods = Period::where('is_active', true)
            ->select('id', 'name', 'is_active', 'is_finalized')
            ->get();

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

        // Pre-load all allocation counts in a single query to avoid N+1
        $titleIds = $titles->pluck('id')->toArray();
        $allocationCounts = Group::whereIn('title_id', $titleIds)
            ->whereNotIn('status', ['FORMING', 'READY_FOR_BIDDING', 'CLOSED'])
            ->groupBy('title_id')
            ->selectRaw('title_id, COUNT(*) as count')
            ->pluck('count', 'title_id')
            ->toArray();

        $titles->each(function ($title) use ($allocationCounts) {
            $title->current_allocations = $allocationCounts[$title->id] ?? 0;
            $title->remaining_quota = $title->quota - $title->current_allocations;
        });

        $readinessStats = $this->finalizationService->getReadinessStats($period->id);

        return response()->json([
            'periods' => $activePeriods, // All active periods for selector
            'current_period' => [
                'id' => $period->id,
                'name' => $period->name,
                'is_active' => $period->is_active,
                'is_finalized' => $period->is_finalized,
            ],
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
            $period->supervisorLoadLimit(8)
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

        $this->ensurePeriodIsActive($group);

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

        // Check for all groups that have been finalized (PDC1_ACTIVE and beyond)
        $finalizedStatuses = [
            'PDC1_ACTIVE',
            'READY_FOR_SEMPRO',
            'SEMPRO_DONE',
            'PDC2_ACTIVE',
            'PDC2_READY_FOR_EXPO',
            'EXPO_REGISTERED',
            'EXPO_DONE',
            'READY_FOR_TA_INDIVIDUAL',
        ];

        $hasFinalizedGroups = Group::where('period_id', $period->id)
            ->whereIn('status', $finalizedStatuses)
            ->exists();

        if (!$period->is_finalized && !$hasFinalizedGroups) {
            return response()->json(['message' => 'Period is not finalized and has no executed finalization groups.'], 400);
        }

        DB::beginTransaction();
        try {
            // Re-open period registration
            $period->update(['is_finalized' => false]);

            // Revert only groups that are still in PDC1_ACTIVE back to KELOMPOK_FINAL
            // Groups that have progressed further (SEMPRO_DONE, PDC2_ACTIVE, etc.) remain in their current status
            $revertedCount = Group::where('period_id', $period->id)
                ->where('status', 'PDC1_ACTIVE')
                ->update([
                    'status' => 'KELOMPOK_FINAL',
                    'finalized_at' => null,
                    'finalized_by' => null,
                ]);

            \App\Models\AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'PERIOD_REOPENED',
                'target_type' => 'Period',
                'target_id' => $period->id,
                'payload' => [
                    'reopened_at' => now()->toISOString(),
                    'reverted_count' => $revertedCount,
                ],
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Period reopened for registration.',
                'period' => $period->fresh(),
                'reverted_count' => $revertedCount,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to reopen period: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Admin Dashboard: View groups ready for finalization and others.
     * Supports server-side pagination for each tab.
     */
    public function adminDashboard(Request $request)
    {
        $period = $this->resolvePeriod($request);

        // Get pagination parameters
        $tab = $request->input('tab', 'ready'); // 'ready', 'final', 'others'
        $perPage = (int) $request->input('per_page', 20);
        $search = $request->input('search', '');

        $response = [
            'period' => $period,
            'tab' => $tab,
            'stats' => $this->getDashboardStats($period),
            'flow' => $this->buildAdminFinalizationFlowPayload($period, $tab, $request->input('sub_tab', 'no_group')),
        ];

        switch ($tab) {
            case 'ready':
                $response['data'] = $this->getReadyForFinalization($period, $perPage, $search);
                break;
            case 'final':
                $response['data'] = $this->getKelompokFinal($period, $perPage, $search);
                break;
            case 'others':
                $response['data'] = $this->getOthers($period, $request, $perPage, $search);
                break;
            default:
                $response['data'] = $this->getReadyForFinalization($period, $perPage, $search);
        }

        return response()->json($response);
    }

    /**
     * Get dashboard stats (lightweight query for all tabs).
     */
    private function getDashboardStats($period): array
    {
        // Check document requirements status
        $docRequirementsStatus = $this->getDocumentRequirementsStatus($period);
        $totalPdc1Active = Group::where('period_id', $period->id)->where('status', 'PDC1_ACTIVE')->count();

        return [
            'total_ready' => Group::where('period_id', $period->id)->where('status', 'READY_FOR_FINALIZATION')->count(),
            'total_kelompok_final' => Group::where('period_id', $period->id)->where('status', 'KELOMPOK_FINAL')->count(),
            'total_pdc1_active' => $totalPdc1Active,
            'total_no_group' => $this->getStudentsWithoutGroupsCount($period),
            'total_no_title' => Group::where('period_id', $period->id)->whereNull('title_id')->whereNotIn('status', ['CLOSED', 'DISSOLVED'])->count(),
            // "Belum Siap" tab is intentionally limited to TITLE_APPROVED only.
            'total_not_ready' => Group::where('period_id', $period->id)->where('status', 'TITLE_APPROVED')->count(),
            'can_finalize' => Group::where('period_id', $period->id)->where('status', 'KELOMPOK_FINAL')->count() > 0 && Group::where('period_id', $period->id)->where('status', 'READY_FOR_FINALIZATION')->count() === 0,
            'can_reopen_finalization' => $period->is_finalized || $totalPdc1Active > 0,
            // Document requirements integration
            'document_requirements' => $docRequirementsStatus,
        ];
    }

    /**
     * Check document requirements configuration status for a period.
     */
    private function getDocumentRequirementsStatus($period): array
    {
        $requirements = \App\Models\PhaseDocumentRequirement::where('period_id', $period->id)->get();

        $phases = ['PDC1', 'SEMPRO', 'PDC2', 'EXPO', 'TA', 'SIDANG'];
        $status = [];

        foreach ($phases as $phase) {
            $phaseRequirements = $requirements->where('phase', $phase);
            $status[$phase] = [
                'configured' => $phaseRequirements->count() > 0,
                'count' => $phaseRequirements->count(),
                'required_count' => $phaseRequirements->where('is_required', true)->count(),
            ];
        }

        $totalConfigured = $requirements->groupBy('phase')->count();
        $allConfigured = $totalConfigured === count($phases);

        return [
            'phases' => $status,
            'all_configured' => $allConfigured,
            'configured_phases' => $totalConfigured,
            'total_phases' => count($phases),
            'total_requirements' => $requirements->count(),
        ];
    }

    /**
     * Get students without groups count.
     */
    private function getStudentsWithoutGroupsCount($period): int
    {
        $studentsWithGroups = GroupMember::whereHas('group', function ($q) use ($period) {
            $q->where('period_id', $period->id);
        })->pluck('student_id');

        // Only count students registered for THIS specific period who don't have groups
        return \App\Models\User::where('role', 'mahasiswa')
            ->whereHas('registeredPeriods', function ($q) use ($period) {
                $q->where('period_id', $period->id);
            })
            ->whereNotIn('id', $studentsWithGroups)
            ->count();
    }

    /**
     * Get READY_FOR_FINALIZATION groups with pagination.
     */
    private function getReadyForFinalization($period, $perPage, $search)
    {
        $query = Group::with(['members.student', 'title.lecturer', 'supervisor1', 'supervisor2', 'period'])
            ->where('period_id', $period->id)
            ->where('status', 'READY_FOR_FINALIZATION');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhereHas('members.student', function ($sq) use ($search) {
                        $sq->where('name', 'ilike', "%{$search}%");
                    })
                    ->orWhereHas('title', function ($tq) use ($search) {
                        $tq->where('title', 'ilike', "%{$search}%");
                    });
            });
        }

        $paginator = $query->orderBy('created_at', 'asc')->paginate($perPage);
        $paginator->getCollection()->transform(fn (Group $group) => $this->buildAdminGroupPayload($group, $period));

        return $paginator;
    }

    /**
     * Get KELOMPOK_FINAL groups with pagination.
     */
    private function getKelompokFinal($period, $perPage, $search)
    {
        $query = Group::with(['members.student', 'title.lecturer', 'supervisor1', 'supervisor2', 'period'])
            ->where('period_id', $period->id)
            ->where('status', 'KELOMPOK_FINAL');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhereHas('members.student', function ($sq) use ($search) {
                        $sq->where('name', 'ilike', "%{$search}%");
                    })
                    ->orWhereHas('title', function ($tq) use ($search) {
                        $tq->where('title', 'ilike', "%{$search}%");
                    })
                    ->orWhereHas('supervisor1', function ($sq) use ($search) {
                        $sq->where('name', 'ilike', "%{$search}%");
                    });
            });
        }

        $paginator = $query->orderBy('created_at', 'asc')->paginate($perPage);
        $paginator->getCollection()->transform(fn (Group $group) => $this->buildAdminGroupPayload($group, $period));

        return $paginator;
    }

    /**
     * Get "Others" data with pagination.
     */
    private function getOthers($period, $request, $perPage, $search)
    {
        $subTab = $request->get('sub_tab', 'no_group'); // 'no_group', 'no_title', 'not_ready'

        switch ($subTab) {
            case 'no_group':
                return $this->getStudentsWithoutGroups($period, $perPage, $search);
            case 'no_title':
                return $this->getGroupsWithoutTitle($period, $perPage, $search);
            case 'not_ready':
                return $this->getGroupsNotReady($period, $perPage, $search);
            default:
                return $this->getStudentsWithoutGroups($period, $perPage, $search);
        }
    }

    /**
     * Get students without groups.
     */
    private function getStudentsWithoutGroups($period, $perPage, $search)
    {
        $studentsWithGroups = GroupMember::whereHas('group', function ($q) use ($period) {
            $q->where('period_id', $period->id);
        })->pluck('student_id');

        // Only show students registered for THIS specific period who don't have groups
        $query = \App\Models\User::where('role', 'mahasiswa')
            ->whereHas('registeredPeriods', function ($q) use ($period) {
                $q->where('period_id', $period->id);
            })
            ->whereNotIn('id', $studentsWithGroups)
            ->select('id', 'name', 'email', 'nim');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('nim', 'ilike', "%{$search}%");
            });
        }

        return $query->orderBy('name', 'asc')->paginate($perPage);
    }

    /**
     * Get groups without title.
     */
    private function getGroupsWithoutTitle($period, $perPage, $search)
    {
        $query = Group::with(['members.student'])
            ->where('period_id', $period->id)
            ->whereNull('title_id')
            ->whereNotIn('status', ['CLOSED', 'DISSOLVED']);

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhereHas('members.student', function ($sq) use ($search) {
                        $sq->where('name', 'ilike', "%{$search}%");
                    });
            });
        }

        $paginator = $query->orderBy('created_at', 'asc')->paginate($perPage);
        $paginator->getCollection()->transform(fn (Group $group) => $this->buildAdminGroupPayload($group, $period));

        return $paginator;
    }

    /**
     * Get groups for "Belum Siap" tab.
     *
     * This tab intentionally shows TITLE_APPROVED only, aligned with
     * total_not_ready stats.
     */
    private function getGroupsNotReady($period, $perPage, $search)
    {
        $query = Group::with(['members.student', 'title'])
            ->where('period_id', $period->id)
            ->where('status', 'TITLE_APPROVED');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhereHas('members.student', function ($sq) use ($search) {
                        $sq->where('name', 'ilike', "%{$search}%");
                    })
                    ->orWhereHas('title', function ($tq) use ($search) {
                        $tq->where('title', 'ilike', "%{$search}%");
                    });
            });
        }

        $paginator = $query->orderBy('created_at', 'asc')->paginate($perPage);
        $paginator->getCollection()->transform(fn (Group $group) => $this->buildAdminGroupPayload($group, $period));

        return $paginator;
    }

    private function buildAdminGroupPayload(Group $group, Period $period): array
    {
        $groupArray = $group->toArray();
        $groupArray['name'] = $this->resolveAdminGroupName($group);
        $groupArray['status_label'] = $this->resolveGroupStatusLabel($group->status);
        $groupArray['allowed_actions'] = $this->resolveAdminAllowedActions($group, $period);

        return $groupArray;
    }

    private function resolveAdminGroupName(Group $group): string
    {
        $name = trim((string) ($group->name ?? ''));

        if ($name !== '') {
            return $name;
        }

        return $group->code ?? "Kelompok #{$group->id}";
    }

    private function resolveGroupStatusLabel(string $status): string
    {
        return match ($status) {
            'FORMING' => 'Incomplete Group',
            'FORMING_SOLO' => 'Solo Seeker',
            'READY_FOR_BIDDING' => 'Ready for Bidding',
            'WAITING_SUPERVISOR_APPROVAL' => 'Waiting Supervisor Approval',
            'TITLE_APPROVED' => 'Title Approved',
            'READY_FOR_FINALIZATION' => 'Ready for Finalization',
            'KELOMPOK_FINAL' => 'Kelompok Final',
            'PDC1_ACTIVE' => 'PDC1 Active',
            'PDC2_ACTIVE' => 'PDC2 Active',
            default => str_replace('_', ' ', $status),
        };
    }

    private function resolveAdminAllowedActions(Group $group, Period $period): array
    {
        $isPeriodFinalized = (bool) $period->is_finalized;
        $canSetSupervisor = !$isPeriodFinalized && $group->status === 'READY_FOR_FINALIZATION';
        $canMarkKelompokFinal = $canSetSupervisor
            && (bool) ($group->supervisor_1_id || $group->title?->lecturer?->id)
            && (bool) $group->supervisor_2_id;

        $reason = null;
        if ($isPeriodFinalized) {
            $reason = 'PERIOD_FINALIZED';
        } elseif ($group->status === 'READY_FOR_FINALIZATION' && !$canMarkKelompokFinal) {
            if (!$group->supervisor_1_id && !$group->title?->lecturer?->id) {
                $reason = 'SUPERVISOR_1_REQUIRED';
            } elseif (!$group->supervisor_2_id) {
                $reason = 'SUPERVISOR_2_REQUIRED';
            }
        }

        return [
            'can_set_supervisor' => $canSetSupervisor,
            'can_mark_kelompok_final' => $canMarkKelompokFinal,
            'can_cancel_kelompok_final' => !$isPeriodFinalized && $group->status === 'KELOMPOK_FINAL',
            'can_assign_title' => !$isPeriodFinalized && $group->status === 'READY_FOR_BIDDING' && !$group->title_id,
            'can_promote_to_ready_for_finalization' => !$isPeriodFinalized && $group->status === 'TITLE_APPROVED',
            'reason' => $reason,
        ];
    }

    private function buildAdminFinalizationFlowPayload(Period $period, string $tab, string $subTab): array
    {
        if ($period->is_finalized) {
            return [
                'can_modify' => false,
                'can_execute_finalization' => false,
                'reason' => 'PERIOD_FINALIZED',
            ];
        }

        $canExecuteFinalization = $tab === 'final'
            ? Group::where('period_id', $period->id)->where('status', 'KELOMPOK_FINAL')->count() > 0
                && Group::where('period_id', $period->id)->where('status', 'READY_FOR_FINALIZATION')->count() === 0
            : false;

        return [
            'can_modify' => true,
            'can_execute_finalization' => $canExecuteFinalization,
            'tab' => $tab,
            'sub_tab' => $subTab,
            'reason' => null,
        ];
    }

    /**
     * Set Supervisor 1 and 2 for a group (Admin only).
     * 
     * When mark_final=true, also promotes group to KELOMPOK_FINAL.
     * When mark_final=false (default), only updates supervisor fields (stays READY_FOR_FINALIZATION).
     */
    public function setSupervisor(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'supervisor_1_id' => 'nullable|exists:users,id',
            'supervisor_2_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string|max:1000',
            'mark_final' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $group = Group::with(['period', 'members'])->findOrFail($request->group_id);

        $this->ensurePeriodIsActive($group);

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

        $markFinal = $request->boolean('mark_final', false);

        // If marking final, supervisor_1 is required
        if ($markFinal && !$request->supervisor_1_id) {
            return response()->json(['message' => 'Supervisor 1 wajib untuk menandai Kelompok Final.'], 400);
        }

        $newStatus = $markFinal ? 'KELOMPOK_FINAL' : 'READY_FOR_FINALIZATION';

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
                'status' => $newStatus,
            ]);

            // Create audit log
            \App\Models\FinalizationAudit::create([
                'period_id' => $group->period_id,
                'group_id' => $group->id,
                'user_id' => $user->id,
                'action' => $markFinal ? 'SUPERVISOR_SET_AND_FINALIZED' : 'SUPERVISOR_SET',
                'old_values' => $oldValues,
                'new_values' => [
                    'supervisor_1_id' => $request->supervisor_1_id,
                    'supervisor_2_id' => $request->supervisor_2_id,
                    'status' => $newStatus,
                ],
                'notes' => $request->notes,
            ]);

            // Notify group members only when marking final
            if ($markFinal) {
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
            }

            DB::commit();

            $statusMsg = $markFinal
                ? 'Supervisor berhasil ditetapkan. Status kelompok: KELOMPOK_FINAL.'
                : 'Supervisor berhasil di-update.';

            return response()->json([
                'message' => $statusMsg,
                'group' => $this->buildAdminGroupPayload(
                    $group->fresh(['supervisor1', 'supervisor2', 'members.student', 'title.lecturer', 'period']),
                    $group->period
                ),
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

        // Validation: ALL groups must be at least KELOMPOK_FINAL or already finalized
        $allowedStatuses = [
            'KELOMPOK_FINAL',
            'PDC1_ACTIVE',
            'READY_FOR_SEMPRO',
            'SEMPRO_DONE',
            'PDC2_ACTIVE',
            'PDC2_READY_FOR_EXPO',
            'EXPO_REGISTERED',
            'EXPO_DONE',
            'READY_FOR_TA_INDIVIDUAL',
            'CLOSED',
            'DISSOLVED',
        ];

        $notReadyGroups = Group::where('period_id', $period->id)
            ->whereNotIn('status', $allowedStatuses)
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
                ->with('members')
                ->get();

            $finalizedCount = 0;
            $supervisionData = [];
            $auditLogs = [];
            $now = now();

            /** @var \App\Models\Group $group */
            foreach ($groups as $group) {
                $group->update([
                    'status' => 'PDC1_ACTIVE',
                    'finalized_at' => $now,
                    'finalized_by' => $user->id,
                ]);

                // Collect supervision records for batch upsert
                if ($group->supervisor_1_id) {
                    $supervisionData[] = [
                        'group_id' => $group->id,
                        'role' => 'SUPERVISOR_1',
                        'supervisor_id' => $group->supervisor_1_id,
                        'assigned_by' => $user->id,
                    ];
                }

                if ($group->supervisor_2_id) {
                    $supervisionData[] = [
                        'group_id' => $group->id,
                        'role' => 'SUPERVISOR_2',
                        'supervisor_id' => $group->supervisor_2_id,
                        'assigned_by' => $user->id,
                    ];
                }

                // Collect audit logs for batch insert
                $auditLogs[] = [
                    'period_id' => $period->id,
                    'group_id' => $group->id,
                    'user_id' => $user->id,
                    'action' => 'FINALIZATION_EXECUTED',
                    'old_values' => json_encode(['status' => 'KELOMPOK_FINAL']),
                    'new_values' => json_encode(['status' => 'PDC1_ACTIVE']),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $finalizedCount++;
            }

            // Batch upsert supervision records
            if (!empty($supervisionData)) {
                \App\Models\Supervision::upsert(
                    $supervisionData,
                    ['group_id', 'role'],
                    ['supervisor_id', 'assigned_by']
                );
            }

            // Batch insert audit logs
            if (!empty($auditLogs)) {
                \App\Models\FinalizationAudit::insert($auditLogs);
            }

            // Mark period as finalized
            $period->update(['is_finalized' => true]);

            DB::commit();

            // Notify all groups and lecturers
            $this->notifyFinalizationCompletion($period, $groups, $user);

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

        $this->ensurePeriodActiveById($period->id);

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

            $groups = $query->with('members')->get();

            if ($groups->isEmpty()) {
                return response()->json(['message' => 'Tidak ada grup yang dapat di-rollback.'], 400);
            }

            $auditLogs = [];
            $notifications = [];
            $now = now();

            /** @var \App\Models\Group $group */
            foreach ($groups as $group) {
                $oldStatus = $group->status;
                $newStatus = $oldStatus === 'PDC1_ACTIVE' ? 'KELOMPOK_FINAL' : 'READY_FOR_FINALIZATION';

                $group->update([
                    'status' => $newStatus,
                    'finalized_at' => $oldStatus === 'PDC1_ACTIVE' ? null : $group->finalized_at,
                    'finalized_by' => $oldStatus === 'PDC1_ACTIVE' ? null : $group->finalized_by,
                ]);

                // Collect audit logs for batch insert
                $auditLogs[] = [
                    'period_id' => $period->id,
                    'group_id' => $group->id,
                    'user_id' => $user->id,
                    'action' => 'FINALIZATION_ROLLBACK',
                    'old_values' => json_encode(['status' => $oldStatus]),
                    'new_values' => json_encode(['status' => $newStatus]),
                    'notes' => $request->reason,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                // Collect notifications for batch insert
                foreach ($group->members as $member) {
                    $notifications[] = [
                        'user_id' => $member->student_id,
                        'type' => 'FINALIZATION_ROLLBACK',
                        'title' => 'Finalisasi Dibatalkan',
                        'message' => "Finalisasi kelompok Anda telah dibatalkan. Alasan: {$request->reason}",
                        'related_type' => 'Group',
                        'related_id' => $group->id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            // Batch insert audit logs
            if (!empty($auditLogs)) {
                \App\Models\FinalizationAudit::insert($auditLogs);
            }

            // Batch insert notifications
            if (!empty($notifications)) {
                \App\Models\Notification::insert($notifications);
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
     * Cancel/Revert KELOMPOK_FINAL: Revert single group back to READY_FOR_FINALIZATION.
     * Only works if period is not finalized.
     */
    public function cancelKelompokFinal(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'group_id' => 'required|exists:groups,id',
            'reason' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();
        $period = Period::findOrFail($request->period_id);

        $this->ensurePeriodActiveById($period->id);

        // Only admin
        if (!$user->hasRole('admin')) {
            return response()->json(['message' => 'Hanya admin yang dapat melakukan cancel.'], 403);
        }

        // Period must not be finalized
        if ($period->is_finalized) {
            return response()->json(['message' => 'Periode sudah difinalisasi. Reopen period terlebih dahulu.'], 400);
        }

        $group = Group::with('members')->findOrFail($request->group_id);

        // Validate group is in KELOMPOK_FINAL status
        if ($group->status !== 'KELOMPOK_FINAL') {
            return response()->json(['message' => 'Grup harus dalam status KELOMPOK_FINAL untuk di-cancel.'], 400);
        }

        // Validate group belongs to this period
        if ($group->period_id !== $period->id) {
            return response()->json(['message' => 'Grup tidak termasuk dalam periode ini.'], 400);
        }

        DB::beginTransaction();
        try {
            $oldStatus = $group->status;
            $newStatus = 'READY_FOR_FINALIZATION';

            $group->update([
                'status' => $newStatus,
                'finalized_at' => null,
                'finalized_by' => null,
            ]);

            // Audit log
            \App\Models\FinalizationAudit::create([
                'period_id' => $period->id,
                'group_id' => $group->id,
                'user_id' => $user->id,
                'action' => 'CANCEL_KELOMPOK_FINAL',
                'old_values' => ['status' => $oldStatus],
                'new_values' => ['status' => $newStatus],
                'notes' => $request->reason,
            ]);

            // Notify group members
            $reasonText = $request->reason ? " Alasan: {$request->reason}" : '';
            foreach ($group->members as $member) {
                \App\Models\Notification::create([
                    'user_id' => $member->student_id,
                    'type' => 'CANCEL_KELOMPOK_FINAL',
                    'title' => 'Status Kelompok Final Dibatalkan',
                    'message' => "Status kelompok final Anda telah dibatalkan.{$reasonText} Silakan konfirmasi ulang supervisor sebelum finalisasi.",
                    'related_type' => 'Group',
                    'related_id' => $group->id,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => "Cancel Kelompok Final berhasil. Grup #{$group->id} dikembalikan ke READY_FOR_FINALIZATION.",
                'group' => $this->buildAdminGroupPayload(
                    $group->fresh(['members.student', 'title.lecturer', 'supervisor1', 'supervisor2', 'period']),
                    $period
                ),
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Cancel Kelompok Final gagal: ' . $e->getMessage()], 500);
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

        if ($request->input('format') === 'excel') {
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
     * Get available lecturers for supervisor assignment.
     */
    public function getAvailableLecturers(Request $request)
    {
        $period = $this->resolvePeriod($request);

        $lecturers = \App\Models\User::whereHas('roles', function ($q) {
                $q->whereIn('slug', ['dosen', 'kaprodi', 'admin']);
            })
            ->select('id', 'name', 'email', 'nip')
            ->orderBy('name', 'asc')
            ->get();

        // Get load data for each lecturer
        $loadService = app(\App\Services\SupervisorLoadService::class);
        $maxLoad = $period->supervisorLoadLimit(8);

        $lecturers->each(function ($lecturer) use ($period, $loadService, $maxLoad) {
            $load = $loadService->getLoad($lecturer->id, $period->id);
            $lecturer->current_load = $load['current_load'] ?? 0;
            $lecturer->max_load = $maxLoad;
            $lecturer->remaining_capacity = max(0, $maxLoad - $lecturer->current_load);
            $lecturer->is_overloaded = $lecturer->current_load >= $maxLoad;
        });

        return response()->json([
            'period' => $period,
            'lecturers' => $lecturers,
        ]);
    }

    /**
     * Batch set supervisor for multiple groups.
     */
    public function batchSetSupervisor(Request $request)
    {
        $request->validate([
            'group_ids' => 'required|array|min:1',
            'group_ids.*' => 'exists:groups,id',
            'supervisor_1_id' => 'required|exists:users,id',
            'supervisor_2_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();

        // Only admin
        if (!$user->hasRole('admin')) {
            return response()->json(['message' => 'Hanya admin yang dapat menetapkan supervisor.'], 403);
        }

        // Prevent same supervisor
        if ($request->supervisor_1_id && $request->supervisor_2_id &&
            $request->supervisor_1_id === $request->supervisor_2_id) {
            return response()->json(['message' => 'Supervisor 1 dan 2 tidak boleh sama.'], 400);
        }

        $this->ensurePeriodActiveById($request->period_id);

        $loadService = app(\App\Services\SupervisorLoadService::class);
        $results = [
            'success' => [],
            'failed' => [],
        ];

        DB::beginTransaction();
        try {
            foreach ($request->group_ids as $groupId) {
                $group = Group::with('period')->find($groupId);

                if (!$group || $group->status !== 'READY_FOR_FINALIZATION') {
                    $results['failed'][] = [
                        'group_id' => $groupId,
                        'reason' => 'Grup tidak ditemukan atau tidak dalam status READY_FOR_FINALIZATION',
                    ];
                    continue;
                }

                // Validate supervisor load
                $validation = $loadService->validateAssignment($request->supervisor_1_id, $group->period_id);
                if (!$validation['valid']) {
                    $results['failed'][] = [
                        'group_id' => $groupId,
                        'reason' => $validation['message'],
                    ];
                    continue;
                }

                if ($request->supervisor_2_id) {
                    $validation2 = $loadService->validateAssignment($request->supervisor_2_id, $group->period_id);
                    if (!$validation2['valid']) {
                        $results['failed'][] = [
                            'group_id' => $groupId,
                            'reason' => 'Supervisor 2: ' . $validation2['message'],
                        ];
                        continue;
                    }
                }

                $oldValues = [
                    'supervisor_1_id' => $group->supervisor_1_id,
                    'supervisor_2_id' => $group->supervisor_2_id,
                    'status' => $group->status,
                ];

                $group->update([
                    'supervisor_1_id' => $request->supervisor_1_id,
                    'supervisor_2_id' => $request->supervisor_2_id,
                    'status' => 'KELOMPOK_FINAL',
                ]);

                // Audit log
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

                $results['success'][] = [
                    'group_id' => $groupId,
                    'name' => $group->name,
                ];
            }

            // Notify members of successful groups
            $successGroupIds = collect($results['success'])->pluck('group_id');
            $successGroups = Group::with('members')->whereIn('id', $successGroupIds)->get();

            foreach ($successGroups as $group) {
                foreach ($group->members as $member) {
                    \App\Models\Notification::create([
                        'user_id' => $member->student_id,
                        'type' => 'SUPERVISOR_ASSIGNED',
                        'title' => 'Supervisor Ditentukan',
                        'message' => 'Admin telah menetapkan supervisor untuk kelompok Anda.',
                        'related_type' => 'Group',
                        'related_id' => $group->id,
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Batch supervisor assignment completed.',
                'results' => $results,
                'success_count' => count($results['success']),
                'failed_count' => count($results['failed']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Batch assignment failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Helper: Notify finalization completion.
     */
    private function notifyFinalizationCompletion($period, $groups, $user)
    {
        // Ensure members are loaded for all groups
        $groups->loadMissing('members');

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

    /**
     * Get available groups that can accept new members for manual grouping.
     */
    public function getAvailableGroupsForManualGrouping(Request $request)
    {
        $period = $this->resolvePeriod($request);
        $maxSize = $period->max_group_size ?? 4;

        // Get groups with available capacity
        // Filter to only show groups with READY_FOR_BIDDING status
        $groups = Group::with(['members.student', 'title.lecturer'])
            ->where('period_id', $period->id)
            ->where('status', 'READY_FOR_BIDDING')  // Only show READY_FOR_BIDDING groups
            ->get()
            ->filter(function ($group) use ($maxSize) {
                return $group->members->count() < $maxSize;
            })
            ->values();

        return response()->json([
            'groups' => $groups,
            'max_group_size' => $maxSize,
        ]);
    }

    /**
     * Create a new group manually with selected students and title options.
     * 
     * Three options:
     * 1. Tanpa Judul (no_title): Members >= min_size → READY_FOR_BIDDING, < min_size → FORMING
     * 2. Assign Judul (assign_title): min_size <= members <= max_size → READY_FOR_FINALIZATION
     * 3. Tambah Judul (add_title): min_size <= members <= max_size → READY_FOR_FINALIZATION, with lecturer as owner
     */
    public function createManualGroup(Request $request)
    {
        $request->validate([
            'student_ids' => 'required|array|min:1',
            'student_ids.*' => 'exists:users,id',
            'period_id' => 'required|exists:periods,id',
            'option' => 'required|in:no_title,assign_title,add_title',
            'title_id' => 'nullable|required_if:option,assign_title|exists:titles,id',
            'new_title' => 'nullable|required_if:option,add_title|array',
            'new_title.title' => 'required_with:new_title|string|max:500',
            'new_title.description' => 'nullable|string',
            'new_title.specializations' => 'required_with:new_title|array|min:1',
            'new_title.specializations.*' => 'string|in:Software,Embedded,Network,Multimedia,AI,Blockchain',
            'new_title.lecturer_id' => 'required_with:new_title|exists:users,id',
        ]);

        $period = Period::findOrFail($request->period_id);

        $this->ensurePeriodActiveById($period->id);

        $user = $request->user();
        $option = $request->option;

        // Only admin can do manual grouping
        if (!$user->hasRole('admin')) {
            return response()->json(['message' => 'Hanya admin yang dapat melakukan grouping manual.'], 403);
        }

        $minSize = $period->min_group_size ?? 3;
        $maxSize = $period->max_group_size ?? 4;
        $studentCount = count($request->student_ids);

        // Validate student count doesn't exceed max
        if ($studentCount > $maxSize) {
            return response()->json([
                'message' => "Jumlah mahasiswa ({$studentCount}) melebihi batas maksimal grup ({$maxSize})."
            ], 400);
        }

        // For assign_title and add_title options, strict validation: min_size <= members <= max_size
        if (in_array($option, ['assign_title', 'add_title'])) {
            if ($studentCount < $minSize || $studentCount > $maxSize) {
                return response()->json([
                    'message' => "Untuk opsi judul, jumlah anggota harus antara {$minSize} dan {$maxSize}."
                ], 400);
            }
        }

        // Validate students are registered for this period and don't have groups
        $studentsWithGroups = GroupMember::whereHas('group', function ($q) use ($period) {
            $q->where('period_id', $period->id)
              ->whereNotIn('status', ['CLOSED', 'DISSOLVED']);
        })->whereIn('student_id', $request->student_ids)
          ->pluck('student_id');

        if ($studentsWithGroups->isNotEmpty()) {
            return response()->json([
                'message' => 'Beberapa mahasiswa sudah memiliki grup.',
                'student_ids_with_groups' => $studentsWithGroups,
            ], 400);
        }

        // Validate students are registered for this period
        $registeredStudentIds = \App\Models\PeriodRegistration::where('period_id', $period->id)
            ->whereIn('user_id', $request->student_ids)
            ->pluck('user_id');

        $unregisteredIds = collect($request->student_ids)->diff($registeredStudentIds);
        if ($unregisteredIds->isNotEmpty()) {
            return response()->json([
                'message' => 'Beberapa mahasiswa belum terdaftar di periode ini.',
                'unregistered_ids' => $unregisteredIds,
            ], 400);
        }

        DB::beginTransaction();
        try {
            $titleId = null;
            $groupStatus = 'FORMING';

            // Determine status based on option and member count
            if ($option === 'no_title') {
                // Tanpa Judul: FORMING if < min_size, READY_FOR_BIDDING if >= min_size
                $groupStatus = $studentCount >= $minSize ? 'READY_FOR_BIDDING' : 'FORMING';
            } elseif ($option === 'assign_title') {
                // Assign Judul: Assign existing title, status READY_FOR_FINALIZATION
                $titleId = $request->title_id;
                $groupStatus = 'READY_FOR_FINALIZATION';
            } elseif ($option === 'add_title') {
                // Tambah Judul: Create new title with lecturer as owner
                $title = Title::create([
                    'title' => $request->new_title['title'],
                    'description' => $request->new_title['description'] ?? null,
                    'specializations' => $request->new_title['specializations'] ?? [],
                    'period_id' => $period->id,
                    'lecturer_id' => $request->new_title['lecturer_id'],
                    'title_source' => 'LECTURER',
                    'quota' => 1,
                    'supervisor_approval_status' => 'APPROVED',
                ]);
                $titleId = $title->id;
                $groupStatus = 'READY_FOR_FINALIZATION';
            }

            // Create the group
            $group = Group::create([
                'period_id' => $period->id,
                'status' => $groupStatus,
                'title_id' => $titleId,
                'group_mode' => 'GROUP',
                'has_existing_group' => false,
            ]);

            // Add members
            $isFirst = true;
            foreach ($request->student_ids as $studentId) {
                GroupMember::create([
                    'group_id' => $group->id,
                    'student_id' => $studentId,
                    'is_leader' => $isFirst,
                    'period_id' => $period->id,
                ]);
                $isFirst = false;
            }

            // Audit log
            \App\Models\FinalizationAudit::create([
                'period_id' => $period->id,
                'group_id' => $group->id,
                'user_id' => $user->id,
                'action' => 'MANUAL_GROUP_CREATED',
                'new_values' => [
                    'student_ids' => $request->student_ids,
                    'option' => $option,
                    'title_id' => $titleId,
                    'status' => $groupStatus,
                ],
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Grup berhasil dibuat.',
                'group' => $group->fresh(['members.student', 'title']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal membuat grup: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Add students to an existing group.
     */
    public function addToExistingGroup(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'student_ids' => 'required|array|min:1',
            'student_ids.*' => 'exists:users,id',
        ]);

        $user = $request->user();
        $group = Group::with(['members', 'period'])->findOrFail($request->group_id);

        $this->ensurePeriodIsActive($group);

        // Only admin
        if (!$user->hasRole('admin')) {
            return response()->json(['message' => 'Hanya admin yang dapat menambahkan anggota.'], 403);
        }

        // Validate group is in valid status
        if (in_array($group->status, ['CLOSED', 'DISSOLVED', 'PDC1_ACTIVE', 'PDC2_ACTIVE'])) {
            return response()->json(['message' => 'Grup tidak dapat menerima anggota baru.'], 400);
        }

        $maxSize = $group->period->max_group_size ?? 4;
        $currentCount = $group->members->count();
        $newCount = count($request->student_ids);

        // Validate capacity
        if ($currentCount + $newCount > $maxSize) {
            return response()->json([
                'message' => "Kapasitas grup tidak cukup. Saat ini: {$currentCount}, ditambah: {$newCount}, maksimal: {$maxSize}."
            ], 400);
        }

        // Validate students don't have groups in this period
        $studentsWithGroups = GroupMember::whereHas('group', function ($q) use ($group) {
            $q->where('period_id', $group->period_id)
              ->whereNotIn('status', ['CLOSED', 'DISSOLVED']);
        })->whereIn('student_id', $request->student_ids)
          ->pluck('student_id');

        if ($studentsWithGroups->isNotEmpty()) {
            return response()->json([
                'message' => 'Beberapa mahasiswa sudah memiliki grup.',
                'student_ids_with_groups' => $studentsWithGroups,
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Add members
            foreach ($request->student_ids as $studentId) {
                GroupMember::create([
                    'group_id' => $group->id,
                    'student_id' => $studentId,
                    'is_leader' => false,
                    'period_id' => $group->period_id,
                ]);
            }

            $oldStatus = $group->status;
            $newStatus = $oldStatus;

            // Auto-promote FORMING to READY_FOR_BIDDING if member count >= min_size
            $minSize = $group->period->min_group_size ?? 3;
            if ($oldStatus === 'FORMING' && ($currentCount + $newCount) >= $minSize) {
                $group->update(['status' => 'READY_FOR_BIDDING']);
                $newStatus = 'READY_FOR_BIDDING';
            }

            // Audit log
            \App\Models\FinalizationAudit::create([
                'period_id' => $group->period_id,
                'group_id' => $group->id,
                'user_id' => $user->id,
                'action' => 'MEMBERS_ADDED_MANUAL',
                'new_values' => [
                    'added_student_ids' => $request->student_ids,
                    'new_member_count' => $currentCount + $newCount,
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus,
                ],
            ]);

            DB::commit();

            $message = 'Anggota berhasil ditambahkan.';
            if ($newStatus !== $oldStatus) {
                $message .= " Status grup otomatis berubah dari {$oldStatus} ke {$newStatus}.";
            }

            return response()->json([
                'message' => $message,
                'group' => $group->fresh(['members.student', 'title']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal menambahkan anggota: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get available titles that can be assigned to groups.
     */
    public function getAvailableTitles(Request $request)
    {
        $period = $this->resolvePeriod($request);

        // Debug logging
        Log::info('getAvailableTitles called', [
            'period_id' => $period->id,
            'total_titles_in_period' => Title::where('period_id', $period->id)->count(),
            'approved_titles' => Title::where('period_id', $period->id)->where('supervisor_approval_status', 'APPROVED')->count(),
            'with_null_proposed_by' => Title::where('period_id', $period->id)->whereNull('proposed_by_group_id')->count(),
        ]);

        // Get titles without assigned groups
        // Include:
        // 1. Titles created by lecturers (period_id matches) - can have NULL or APPROVED status
        // 2. Titles proposed by groups in this period (marketplace titles) - must be APPROVED
        // Only check:
        // - Has remaining quota (not full)
        $emptyTitles = Title::with('lecturer', 'proposedByGroup')
            ->where(function ($query) use ($period) {
                $query->where('period_id', $period->id)
                    ->orWhereHas('proposedByGroup', function ($gq) use ($period) {
                        $gq->where('period_id', $period->id);
                    });
            })
            ->where(function ($query) {
                // Include titles that are APPROVED OR have NULL supervisor_approval_status
                // (lecturer-created titles may have NULL status)
                $query->where('supervisor_approval_status', 'APPROVED')
                    ->orWhereNull('supervisor_approval_status');
            })
            ->get()
            ->filter(function ($title) {
                // Check if title has remaining quota
                $currentAllocations = Group::where('title_id', $title->id)
                    ->whereNotIn('status', ['CLOSED', 'DISSOLVED'])
                    ->count();
                $hasQuota = $currentAllocations < $title->quota;
                
                Log::debug('Title quota check', [
                    'title_id' => $title->id,
                    'title' => $title->title,
                    'current_allocations' => $currentAllocations,
                    'quota' => $title->quota,
                    'has_quota' => $hasQuota,
                ]);
                
                return $hasQuota;
            })
            ->values();

        Log::info('getAvailableTitles result', [
            'count' => $emptyTitles->count(),
            'title_ids' => $emptyTitles->pluck('id')->toArray(),
        ]);

        return response()->json([
            'titles' => $emptyTitles,
        ]);
    }

    /**
     * Assign a title to a group.
     */
    public function assignTitle(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'title_id' => 'required|exists:titles,id',
        ]);

        $user = $request->user();
        $group = Group::with('period')->findOrFail($request->group_id);
        $title = Title::findOrFail($request->title_id);

        $this->ensurePeriodIsActive($group);

        // Only admin
        if (!$user->hasRole('admin')) {
            return response()->json(['message' => 'Hanya admin yang dapat menetapkan judul.'], 403);
        }

        // Validate title is in same period
        if ($title->period_id !== $group->period_id) {
            return response()->json(['message' => 'Judul tidak dalam periode yang sama.'], 400);
        }

        // Validate title has remaining quota
        $currentAllocations = Group::where('title_id', $title->id)
            ->whereNotIn('status', ['CLOSED', 'DISSOLVED'])
            ->count();
        if ($currentAllocations >= $title->quota) {
            return response()->json(['message' => 'Judul sudah penuh.'], 400);
        }

        DB::beginTransaction();
        try {
            $oldTitleId = $group->title_id;
            $oldStatus = $group->status;

            // Determine new status
            // If group was READY_FOR_BIDDING, change to TITLE_APPROVED
            // Otherwise keep current status
            $newStatus = $oldStatus;
            if ($oldStatus === 'READY_FOR_BIDDING') {
                $newStatus = 'TITLE_APPROVED';
            }

            $group->update([
                'title_id' => $title->id,
                'status' => $newStatus,
            ]);

            // Audit log
            \App\Models\FinalizationAudit::create([
                'period_id' => $group->period_id,
                'group_id' => $group->id,
                'user_id' => $user->id,
                'action' => 'TITLE_ASSIGNED',
                'old_values' => [
                    'title_id' => $oldTitleId,
                    'status' => $oldStatus,
                ],
                'new_values' => [
                    'title_id' => $title->id,
                    'status' => $newStatus,
                ],
            ]);

            DB::commit();

            $message = 'Judul berhasil ditetapkan.';
            if ($newStatus !== $oldStatus) {
                $message .= " Status grup berubah dari {$oldStatus} ke {$newStatus}.";
            }

            return response()->json([
                'message' => $message,
                'group' => $group->fresh(['title', 'members.student']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal menetapkan judul: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Promote TITLE_APPROVED group to READY_FOR_FINALIZATION.
     * Admin can do this when group has title and proper member count.
     */
    public function promoteToReadyForFinalization(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
        ]);

        $user = $request->user();
        $group = Group::with(['members', 'period', 'title'])->findOrFail($request->group_id);

        $this->ensurePeriodIsActive($group);

        // Only admin
        if (!$user->hasRole('admin')) {
            return response()->json(['message' => 'Hanya admin yang dapat melakukan ini.'], 403);
        }

        // Validate group is in TITLE_APPROVED status
        if ($group->status !== 'TITLE_APPROVED') {
            return response()->json([
                'message' => 'Grup harus dalam status TITLE_APPROVED untuk dipromosikan.'
            ], 400);
        }

        // Validate group has title assigned
        if (!$group->title_id) {
            return response()->json([
                'message' => 'Grup harus memiliki judul untuk dipromosikan.'
            ], 400);
        }

        // Validate member count is within range
        $minSize = $group->period->min_group_size ?? 3;
        $maxSize = $group->period->max_group_size ?? 4;
        $memberCount = $group->members->count();

        if ($memberCount < $minSize || $memberCount > $maxSize) {
            return response()->json([
                'message' => "Jumlah anggota ({$memberCount}) harus antara {$minSize} dan {$maxSize}."
            ], 400);
        }

        DB::beginTransaction();
        try {
            $oldStatus = $group->status;

            $group->update([
                'status' => 'READY_FOR_FINALIZATION',
            ]);

            // Audit log
            \App\Models\FinalizationAudit::create([
                'period_id' => $group->period_id,
                'group_id' => $group->id,
                'user_id' => $user->id,
                'action' => 'PROMOTED_TO_READY_FOR_FINALIZATION',
                'old_values' => ['status' => $oldStatus],
                'new_values' => ['status' => 'READY_FOR_FINALIZATION'],
            ]);

            // Notify members
            foreach ($group->members as $member) {
                \App\Models\Notification::create([
                    'user_id' => $member->student_id,
                    'type' => 'GROUP_PROMOTED',
                    'title' => 'Grup Siap Finalisasi',
                    'message' => 'Grup Anda telah dipromosikan ke status Ready for Finalization.',
                    'related_type' => 'Group',
                    'related_id' => $group->id,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Grup berhasil dipromosikan ke Ready for Finalization.',
                'group' => $group->fresh(['title', 'members.student']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal mempromosikan grup: ' . $e->getMessage()], 500);
        }
    }
}
