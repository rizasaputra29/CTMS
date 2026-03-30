<?php

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\User;
use App\Services\BiddingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BidController extends Controller
{
    protected BiddingService $biddingService;

    public function __construct(BiddingService $biddingService)
    {
        $this->biddingService = $biddingService;
    }

    /**
     * List bids for the current student's group.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $membership = GroupMember::where('student_id', $user->id)->first();

        if (!$membership) {
            return response()->json(['data' => []]);
        }

        $bids = Bid::with(['title.lecturer', 'proposedSupervisor1', 'proposedSupervisor2'])
            ->where('group_id', $membership->group_id)
            ->orderBy('priority')
            ->get();

        return response()->json(['data' => $bids]);
    }

    /**
     * Submit a bid on a title (group leader only).
     */
    public function store(Request $request)
    {
        $request->validate([
            'title_id' => 'required|exists:titles,id',
            'priority' => 'required|integer|min:1',
            'proposed_supervisor_1_id' => 'required|exists:users,id',
            'proposed_supervisor_2_id' => 'nullable|exists:users,id|different:proposed_supervisor_1_id',
        ]);

        $user = $request->user();

        $membership = GroupMember::where('student_id', $user->id)
            ->first();

        if (!$membership || !$membership->is_leader) {
            return response()->json(['message' => 'Only the group leader can submit bids.'], 403);
        }

        // Validate supervisors are dosen
        $sup1 = User::find($request->proposed_supervisor_1_id);
        if (!$sup1 || $sup1->role !== 'dosen') {
            return response()->json(['message' => 'Proposed supervisor 1 must be a dosen.'], 400);
        }
        if ($request->proposed_supervisor_2_id) {
            $sup2 = User::find($request->proposed_supervisor_2_id);
            if (!$sup2 || $sup2->role !== 'dosen') {
                return response()->json(['message' => 'Proposed supervisor 2 must be a dosen.'], 400);
            }
        }

        $group = Group::with('period')->find($membership->group_id);

        // Status check
        if ($group->status !== 'READY_FOR_BIDDING') {
            return response()->json(['message' => 'Group must be in READY_FOR_BIDDING status to bid.'], 400);
        }

        // Window check
        if ($this->biddingService->isBiddingLocked($group->period)) {
            return response()->json(['message' => 'Bidding is locked.'], 400);
        }

        if (!$this->biddingService->isWindowOpen($group->period)) {
            return response()->json(['message' => 'Bidding window is not open yet.'], 400);
        }

        // Combined limit: bids + student proposals <= 3
        $bidCount = Bid::where('group_id', $group->id)->count();
        $proposalCount = \App\Models\Title::where('proposed_by_group_id', $group->id)
            ->where('title_source', 'STUDENT')
            ->whereIn('supervisor_approval_status', ['PENDING', 'APPROVED'])
            ->count();

        if (($bidCount + $proposalCount) >= 3) {
            return response()->json(['message' => 'Maximum 3 titles allowed (bids + proposals combined).'], 400);
        }

        // DB unique constraints will enforce (group_id, priority) and (group_id, title_id)
        try {
            $bid = Bid::create([
                'group_id' => $group->id,
                'title_id' => $request->title_id,
                'priority' => $request->priority,
                'status' => 'PENDING',
                'proposed_supervisor_1_id' => $request->proposed_supervisor_1_id,
                'proposed_supervisor_2_id' => $request->proposed_supervisor_2_id,
            ]);

            return response()->json([
                'message' => 'Bid submitted successfully.',
                'data' => $bid->load(['title.lecturer', 'proposedSupervisor1', 'proposedSupervisor2']),
            ], 201);
        } catch (\Illuminate\Database\QueryException $e) {
            if (str_contains($e->getMessage(), 'UNIQUE constraint failed') || str_contains($e->getMessage(), 'Duplicate entry')) {
                return response()->json(['message' => 'Duplicate bid: you already have a bid with this priority or for this title.'], 400);
            }
            throw $e;
        }
    }

    /**
     * Delete a bid (group leader only, before lock).
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        $membership = GroupMember::where('student_id', $user->id)
            ->first();

        if (!$membership || !$membership->is_leader) {
            return response()->json(['message' => 'Only the group leader can delete bids.'], 403);
        }

        $bid = Bid::where('id', $id)
            ->where('group_id', $membership->group_id)
            ->firstOrFail();

        $group = Group::with('period')->find($membership->group_id);

        if ($this->biddingService->isBiddingLocked($group->period)) {
            return response()->json(['message' => 'Bidding is locked. Cannot delete bids.'], 400);
        }

        $bid->delete();
        return response()->json(['message' => 'Bid deleted successfully.']);
    }

    /**
     * List bids on the lecturer's titles.
     */
    public function lecturerBids(Request $request)
    {
        $user = $request->user();

        $bids = Bid::with(['group.members.student', 'title', 'proposedSupervisor1', 'proposedSupervisor2'])
            ->whereHas('title', function ($q) use ($user) {
                $q->where('lecturer_id', $user->id);
            })
            ->orderBy('title_id')
            ->orderBy('priority')
            ->get();

        return response()->json(['data' => $bids]);
    }

    /**
     * Lecturer recommendation on a bid (ACCEPT/REJECT — advisory only).
     */
    public function recommend(Request $request, $id)
    {
        $request->validate([
            'recommendation' => 'required|in:ACCEPT,REJECT',
        ]);

        $user = $request->user();

        $bid = Bid::with('title')->findOrFail($id);

        // Verify lecturer owns the title
        if ($bid->title->lecturer_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Check lock
        $group = Group::with('period')->find($bid->group_id);
        if ($this->biddingService->isBiddingLocked($group->period)) {
            return response()->json(['message' => 'Bidding is locked. Cannot change recommendation.'], 400);
        }

        $bid->update(['lecturer_recommendation' => $request->recommendation]);

        return response()->json([
            'message' => 'Recommendation submitted.',
            'data' => $bid,
        ]);
    }
}
