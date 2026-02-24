<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\GroupSupervisorProposal;
use App\Models\Title;
use App\Models\Period;
use App\Models\User;
use App\Services\GroupStateMachine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GroupController extends Controller
{
    protected GroupStateMachine $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $membership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->whereNotIn('status', ['CLOSED']);
            })
            ->first();

        if (!$membership) {
            return response()->json(['group' => null]);
        }

        $group = Group::with([
            'members.student',
            'title.lecturer',
            'period',
            'bids.title',
            'supervisorProposals.supervisor1',
            'supervisorProposals.supervisor2',
            'supervisions.supervisor',
            'supervisor1',
            'supervisor2',
        ])->find($membership->group_id);

        return response()->json(['group' => $group]);
    }

    public function listGroups(Request $request)
    {
        $groups = Group::with(['title', 'members.student', 'supervisor1', 'supervisor2'])
            ->whereNotIn('status', ['FORMING', 'CLOSED'])
            ->get();

        return response()->json(['data' => $groups]);
    }

    /**
     * Create a new group. Student becomes leader. Status = FORMING.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        // Block if student already in an active group in the current period
        $existingMembership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->whereNotIn('status', ['CLOSED']);
            })
            ->exists();

        if ($existingMembership) {
            return response()->json(['message' => 'You are already in a group.'], 400);
        }

        $period = Period::where('is_active', true)->latest()->first();
        if (!$period) {
            return response()->json(['message' => 'No active academic period found.'], 400);
        }

        DB::beginTransaction();
        try {
            $group = Group::create([
                'title_id' => null,
                'period_id' => $period->id,
                'status' => 'FORMING',
            ]);

            GroupMember::create([
                'group_id' => $group->id,
                'student_id' => $user->id,
                'is_leader' => true,
            ]);

            // Auto-transition if 1 member meets min_group_size (unlikely but handle)
            $this->checkAndTransitionToReady($group, $period);

            DB::commit();
            return response()->json([
                'message' => 'Group created successfully.',
                'group' => $group->load('members.student'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create group: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Delete/disband a group (leader only, only before finalization).
     */
    public function deleteGroup(Request $request)
    {
        $user = $request->user();

        $membership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->whereNotIn('status', ['CLOSED']);
            })
            ->first();

        if (!$membership) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        if (!$membership->is_leader) {
            return response()->json(['message' => 'Only the group leader can delete the group.'], 403);
        }

        $group = Group::find($membership->group_id);

        // Only allow deletion before KELOMPOK_FINAL
        if ($this->stateMachine->isAtLeast($group, 'KELOMPOK_FINAL')) {
            return response()->json(['message' => 'Cannot delete group after finalization.'], 400);
        }

        DB::beginTransaction();
        try {
            // Delete any student proposals tied to this group
            Title::where('proposed_by_group_id', $group->id)
                ->where('title_source', 'STUDENT')
                ->delete();

            // Delete bids
            $group->bids()->delete();

            // Delete supervisor proposals
            $group->supervisorProposals()->delete();

            // Delete all members
            GroupMember::where('group_id', $group->id)->delete();

            // Delete the group
            $group->delete();

            DB::commit();
            return response()->json(['message' => 'Group deleted successfully.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to delete group: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Add a member to the current user's group (leader only).
     */
    public function addMember(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = $request->user();

        $leaderMembership = GroupMember::where('student_id', $user->id)->first();
        if (!$leaderMembership) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        if (!$leaderMembership->is_leader) {
            return response()->json(['message' => 'Only the group leader can add members.'], 403);
        }

        $group = Group::with('period')->find($leaderMembership->group_id);

        // Only allow adding members before KELOMPOK_FINAL
        if ($this->stateMachine->isAtLeast($group, 'KELOMPOK_FINAL')) {
            return response()->json(['message' => 'Cannot add members after finalization.'], 400);
        }

        // Member limit from period config
        $maxMembers = $group->period->max_group_size ?? 4;
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        if ($memberCount >= $maxMembers) {
            return response()->json(['message' => "Group is full. Maximum {$maxMembers} members allowed."], 400);
        }

        // Find the student to add
        $student = User::where('email', $request->email)->where('role', 'mahasiswa')->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        if ($student->id === $user->id) {
            return response()->json(['message' => 'You are already in this group.'], 400);
        }

        // Check if student is already in an active group
        $inActiveGroup = GroupMember::where('student_id', $student->id)
            ->whereHas('group', function ($q) {
                $q->whereNotIn('status', ['CLOSED']);
            })
            ->exists();
        if ($inActiveGroup) {
            return response()->json(['message' => 'This student is already in a group.'], 400);
        }

        DB::beginTransaction();
        try {
            GroupMember::create([
                'group_id' => $group->id,
                'student_id' => $student->id,
                'is_leader' => false,
            ]);

            // Auto-transition FORMING → READY_FOR_BIDDING if member count >= min size
            $this->checkAndTransitionToReady($group, $group->period);

            DB::commit();
            return response()->json([
                'message' => 'Member added successfully',
                'group' => $group->fresh()->load('members.student'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to add member: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Remove a member from the group (leader only).
     */
    public function removeMember(Request $request, $memberId)
    {
        $user = $request->user();

        $leaderMembership = GroupMember::where('student_id', $user->id)->first();
        if (!$leaderMembership) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        if (!$leaderMembership->is_leader) {
            return response()->json(['message' => 'Only the group leader can remove members.'], 403);
        }

        $member = GroupMember::where('id', $memberId)
            ->where('group_id', $leaderMembership->group_id)
            ->first();

        if (!$member) {
            return response()->json(['message' => 'Member not found in your group.'], 404);
        }

        if ($member->student_id === $user->id) {
            return response()->json(['message' => 'You cannot remove yourself.'], 400);
        }

        $group = Group::with('period')->find($leaderMembership->group_id);

        // After KELOMPOK_FINAL: require admin approval (handled separately)
        if ($this->stateMachine->isAtLeast($group, 'KELOMPOK_FINAL')) {
            return response()->json([
                'message' => 'Cannot remove members after finalization. Request admin approval.',
            ], 400);
        }

        DB::beginTransaction();
        try {
            $member->delete();

            // If members drop below min size, revert to FORMING
            $memberCount = GroupMember::where('group_id', $group->id)->count();
            $minSize = $group->period->min_group_size ?? 2;

            if ($memberCount < $minSize && $group->status === 'READY_FOR_BIDDING') {
                $this->stateMachine->transition($group, 'FORMING');
            }

            DB::commit();

            $group = Group::with('members.student')->find($leaderMembership->group_id);
            return response()->json(['message' => 'Member removed', 'group' => $group]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to remove member: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Propose preferred supervisors (group leader only, when READY_FOR_BIDDING).
     */
    public function proposeSupervisors(Request $request)
    {
        $request->validate([
            'proposed_supervisor_1_id' => 'required|exists:users,id',
            'proposed_supervisor_2_id' => 'nullable|exists:users,id|different:proposed_supervisor_1_id',
        ]);

        $user = $request->user();

        $leaderMembership = GroupMember::where('student_id', $user->id)
            ->where('is_leader', true)
            ->first();

        if (!$leaderMembership) {
            return response()->json(['message' => 'Only the group leader can propose supervisors.'], 403);
        }

        $group = Group::with('period')->find($leaderMembership->group_id);

        if ($group->status !== 'READY_FOR_BIDDING') {
            return response()->json(['message' => 'Supervisors can only be proposed when group is READY_FOR_BIDDING.'], 400);
        }

        // Check bidding lock
        if ($group->period->isBiddingLocked()) {
            return response()->json(['message' => 'Bidding is locked. Cannot propose supervisors.'], 400);
        }

        // Validate supervisors are dosen
        $sup1 = User::find($request->proposed_supervisor_1_id);
        if ($sup1->role !== 'dosen') {
            return response()->json(['message' => 'Proposed supervisor 1 must be a lecturer.'], 400);
        }
        if ($request->proposed_supervisor_2_id) {
            $sup2 = User::find($request->proposed_supervisor_2_id);
            if ($sup2->role !== 'dosen') {
                return response()->json(['message' => 'Proposed supervisor 2 must be a lecturer.'], 400);
            }
        }

        // Upsert proposal
        $proposal = GroupSupervisorProposal::updateOrCreate(
            ['group_id' => $group->id],
            [
                'proposed_supervisor_1_id' => $request->proposed_supervisor_1_id,
                'proposed_supervisor_2_id' => $request->proposed_supervisor_2_id,
                'status' => 'PENDING',
            ]
        );

        return response()->json([
            'message' => 'Supervisor proposal submitted.',
            'proposal' => $proposal->load(['supervisor1', 'supervisor2']),
        ]);
    }

    public function supervisedGroups(Request $request)
    {
        $user = $request->user();
        $groups = Group::with(['title', 'members.student', 'period', 'supervisions.supervisor'])
            ->whereHas('supervisions', function ($query) use ($user) {
                $query->where('supervisor_id', $user->id);
            })
            ->get();

        return response()->json(['data' => $groups]);
    }

    public function pendingGroups(Request $request)
    {
        $user = $request->user();
        $groups = Group::with(['title', 'members.student'])
            ->whereHas('title', function ($query) use ($user) {
                $query->where('lecturer_id', $user->id);
            })
            ->where('status', 'READY_FOR_BIDDING')
            ->get();

        return response()->json(['data' => $groups]);
    }

    /**
     * Auto-transition FORMING → READY_FOR_BIDDING if member count >= min_group_size.
     */
    private function checkAndTransitionToReady(Group $group, Period $period): void
    {
        if ($group->status !== 'FORMING') {
            return;
        }

        $memberCount = GroupMember::where('group_id', $group->id)->count();
        $minSize = $period->min_group_size ?? 2;

        if ($memberCount >= $minSize) {
            $this->stateMachine->transition($group, 'READY_FOR_BIDDING');
        }
    }
}
