<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Title;
use App\Models\Period;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GroupController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $membership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->first();

        if (!$membership) {
            return response()->json(['group' => null]);
        }

        $group = Group::with(['members.student', 'title.lecturer', 'period'])->find($membership->group_id);
        return response()->json(['group' => $group]);
    }

    public function listGroups(Request $request)
    {
        $groups = Group::with(['title', 'members.student'])
            ->where('status', 'APPROVED')
            ->get();

        return response()->json(['data' => $groups]);
    }

    /**
     * Create a new group (no title yet). Student becomes leader.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        // Block if student already in a non-rejected group
        $existingMembership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->exists();

        if ($existingMembership) {
            return response()->json(['message' => 'You are already in a group.'], 400);
        }

        $period = Period::whereRaw('is_active = true')->latest()->first();
        if (!$period) {
            $period = Period::latest()->first();
        }
        if (!$period) {
            return response()->json(['message' => 'No active academic period found.'], 400);
        }

        DB::beginTransaction();
        try {
            $group = Group::create([
                'title_id' => null,
                'period_id' => $period->id,
                'status' => 'READY_FOR_BIDDING',
            ]);

            GroupMember::create([
                'group_id' => $group->id,
                'student_id' => $user->id,
                'is_leader' => DB::raw('true'),
            ]);

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
     * Delete/disband a group (leader only, only if no active bid/proposal).
     */
    public function deleteGroup(Request $request)
    {
        $user = $request->user();

        $membership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->first();

        if (!$membership) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        if (!$membership->is_leader) {
            return response()->json(['message' => 'Only the group leader can delete the group.'], 403);
        }

        $group = Group::find($membership->group_id);

        // Only allow deletion when group has no active bid or approved title
        if (in_array($group->status, ['PENDING', 'APPROVED', 'WAITING_SUPERVISOR_APPROVAL'])) {
            return response()->json(['message' => 'Cannot delete group with an active bid or proposal. Wait for it to be resolved first.'], 400);
        }

        DB::beginTransaction();
        try {
            // Delete any rejected/student proposals tied to this group
            Title::where('proposed_by_group_id', $group->id)
                ->where('title_source', 'STUDENT')
                ->delete();

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
     * Bid on a title — assigns a title to the student's existing group.
     */
    public function bidTitle(Request $request)
    {
        $request->validate([
            'title_id' => 'required|exists:titles,id',
        ]);

        $user = $request->user();

        // Must be in a group
        $membership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->first();

        if (!$membership) {
            return response()->json(['message' => 'You must create a group first before bidding.'], 400);
        }

        if (!$membership->is_leader) {
            return response()->json(['message' => 'Only the group leader can bid on titles.'], 403);
        }

        $group = Group::find($membership->group_id);

        // Check minimum 3 members
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        if ($memberCount < 3) {
            return response()->json(['message' => 'Your group must have at least 3 members before bidding.'], 400);
        }

        // Block if group already has an approved title
        if ($group->title_id && $group->status === 'APPROVED') {
            return response()->json(['message' => 'Your group already has an approved title.'], 400);
        }

        // Block if group already has a pending bid
        if ($group->title_id && $group->status === 'PENDING') {
            return response()->json(['message' => 'Your group already has a pending bid.'], 400);
        }

        // Block if group has a pending proposal
        $hasPendingProposal = Title::where('proposed_by_group_id', $group->id)
            ->where('supervisor_approval_status', 'PENDING')
            ->exists();

        if ($hasPendingProposal) {
            return response()->json(['message' => 'You have a pending title proposal. Cannot bid while proposal is pending.'], 400);
        }

        // Check quota (number of non-rejected groups for this title)
        $title = Title::find($request->title_id);
        $currentGroups = Group::where('title_id', $title->id)
            ->where('status', '!=', 'REJECTED')
            ->count();

        if ($currentGroups >= $title->quota) {
            return response()->json(['message' => 'Quota for this title is full.'], 400);
        }

        $group->update([
            'title_id' => $request->title_id,
            'status' => 'PENDING',
            'assignment_type' => 'BIDDING',
        ]);

        return response()->json([
            'message' => 'Bid submitted successfully.',
            'group' => $group->load(['members.student', 'title.lecturer']),
        ]);
    }

    /**
     * Add a member to the current user's group (leader only).
     * Member limit is checked against a fixed max (e.g. 4), not title quota.
     */
    public function addMember(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = $request->user();

        // Find leader's group
        $leaderMembership = GroupMember::where('student_id', $user->id)->first();
        if (!$leaderMembership) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        if (!$leaderMembership->is_leader) {
            return response()->json(['message' => 'Only the group leader can add members.'], 403);
        }

        $group = Group::find($leaderMembership->group_id);

        // Fixed member limit (not tied to title quota)
        $maxMembers = 4;
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        if ($memberCount >= $maxMembers) {
            return response()->json(['message' => 'Group is full. Maximum ' . $maxMembers . ' members allowed.'], 400);
        }

        // Find the student to add
        $student = User::where('email', $request->email)->where('role', 'mahasiswa')->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        if ($student->id === $user->id) {
            return response()->json(['message' => 'You are already in this group.'], 400);
        }

        // Check if student is already in a non-rejected group
        $inActiveGroup = GroupMember::where('student_id', $student->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->exists();
        if ($inActiveGroup) {
            return response()->json(['message' => 'This student is already in a group.'], 400);
        }

        GroupMember::create([
            'group_id' => $group->id,
            'student_id' => $student->id,
            'is_leader' => DB::raw('false'),
        ]);

        return response()->json([
            'message' => 'Member added successfully',
            'group' => $group->load('members.student'),
        ]);
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

        $member->delete();

        $group = Group::with('members.student')->find($leaderMembership->group_id);
        return response()->json(['message' => 'Member removed', 'group' => $group]);
    }

    public function supervisedGroups(Request $request)
    {
        $user = $request->user();
        $groups = Group::with(['title', 'members.student', 'period'])
            ->whereHas('title', function ($query) use ($user) {
                $query->where('lecturer_id', $user->id);
            })
            ->where('status', 'APPROVED')
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
            ->where('status', 'PENDING')
            ->get();

        return response()->json(['data' => $groups]);
    }

    public function approve(Request $request, Group $group)
    {
        if ($group->title->lecturer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $group->update(['status' => 'APPROVED']);
        return response()->json(['message' => 'Group approved', 'group' => $group]);
    }

    public function reject(Request $request, Group $group)
    {
        if ($group->title->lecturer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $group->update([
            'status' => 'REJECTED',
            'title_id' => null,
            'assignment_type' => null,
        ]);
        return response()->json(['message' => 'Group rejected', 'group' => $group]);
    }
}
