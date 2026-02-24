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
     * Title-centric finalization dashboard.
     */
    public function index(Request $request)
    {
        $period = Period::where('is_active', true)->latest()->first();
        if (!$period) {
            return response()->json(['message' => 'No active period.'], 400);
        }

        // 2-LEVEL GOVERNANCE: Only show titles ready for admin finalization
        // - Student-proposed: supervisor must have approved
        // - Bidding: at least one bid must be lecturer-recommended ACCEPT
        // NOTE: Titles don't have period_id. We scope through bids→groups→period.
        $titles = Title::with([
            'lecturer',
            'bids' => function ($q) use ($period) {
                // Only load ACCEPT-recommended bids for the active period
                $q->where('lecturer_recommendation', 'ACCEPT')
                    ->whereHas('group', function ($gq) use ($period) {
                    $gq->where('period_id', $period->id);
                })
                    ->with(['group.members.student', 'proposedSupervisor1', 'proposedSupervisor2'])
                    ->orderBy('priority');
            },
        ])
            ->where(function ($q) use ($period) {
                // Student-proposed: only if supervisor approved
                $q->where(function ($sub) {
                    $sub->where('title_source', 'STUDENT')
                        ->where('supervisor_approval_status', 'APPROVED');
                })
                    // Bidding titles: only if at least one ACCEPT bid exists in this period
                    ->orWhereHas('bids', function ($bq) use ($period) {
                    $bq->where('lecturer_recommendation', 'ACCEPT')
                        ->whereHas('group', function ($gq) use ($period) {
                            $gq->where('period_id', $period->id);
                        });
                });
            })
            ->get();

        // Current allocation counts per title
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
        $period = Period::where('is_active', true)->latest()->first();
        if (!$period) {
            return response()->json(['message' => 'No active period.'], 400);
        }

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
     * Manually lock bidding.
     */
    public function lock(Request $request)
    {
        $period = Period::where('is_active', true)->latest()->first();
        if (!$period) {
            return response()->json(['message' => 'No active period.'], 400);
        }

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
