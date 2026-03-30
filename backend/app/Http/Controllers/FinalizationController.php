<?php

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\Group;
use App\Models\Period;
use App\Models\Title;
use App\Services\BiddingService;
use App\Services\FinalizationService;
use Illuminate\Http\Request;

class FinalizationController extends Controller
{
    protected FinalizationService $finalizationService;
    protected BiddingService $biddingService;

    public function __construct(FinalizationService $finalizationService, BiddingService $biddingService)
    {
        $this->finalizationService = $finalizationService;
        $this->biddingService = $biddingService;
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
                $q->where(function ($sub) {
                    $sub->where('title_source', 'STUDENT')
                        ->where('supervisor_approval_status', 'APPROVED');
                })
                    ->orWhereHas('bids', function ($bq) use ($period) {
                        $bq->where('lecturer_recommendation', 'ACCEPT')
                            ->whereHas('group', function ($gq) use ($period) {
                                $gq->where('period_id', $period->id);
                            });
                    });
            })
            ->get();

        $titles->each(function ($title) {
            $title->current_allocations = Group::where('title_id', $title->id)
                ->whereNotIn('status', ['FORMING', 'READY_FOR_BIDDING', 'CLOSED'])
                ->count();
            $title->remaining_quota = $title->quota - $title->current_allocations;
        });

        return response()->json([
            'data' => $titles,
            'period' => $period,
            'is_locked' => $period->isBiddingLocked(),
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
     * Allocate a group via bid acceptance.
     */
    public function allocate(Request $request)
    {
        $request->validate([
            'bid_id' => 'required|exists:bids,id',
            'supervisor_1_id' => 'required|exists:users,id',
            'supervisor_2_id' => 'nullable|exists:users,id|different:supervisor_1_id',
        ]);

        try {
            $result = $this->finalizationService->allocateGroup(
                $request->bid_id,
                $request->supervisor_1_id,
                $request->supervisor_2_id,
                $request->user()->id
            );

            return response()->json([
                'message' => 'Group allocated successfully.',
                'data' => $result,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Allocation failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Allocate a student-proposed title.
     */
    public function allocateStudentProposed(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'title_id' => 'required|exists:titles,id',
            'supervisor_1_id' => 'required|exists:users,id',
            'supervisor_2_id' => 'nullable|exists:users,id|different:supervisor_1_id',
        ]);

        try {
            $result = $this->finalizationService->allocateStudentProposed(
                $request->group_id,
                $request->title_id,
                $request->supervisor_1_id,
                $request->supervisor_2_id,
                $request->user()->id
            );

            return response()->json([
                'message' => 'Student-proposed title allocated successfully.',
                'data' => $result,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Allocation failed: ' . $e->getMessage()], 500);
        }
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
}
