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
}
