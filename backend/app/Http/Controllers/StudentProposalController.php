<?php

namespace App\Http\Controllers;

use App\Models\Title;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentProposalController extends Controller
{
    /**
     * List active lecturers for supervisor selection.
     */
    public function lecturers()
    {
        $lecturers = \App\Models\User::where('role', 'dosen')
            ->select('id', 'name', 'email')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $lecturers]);
    }

    /**
     * Submit a new title proposal.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'problem_statement' => 'required|string',
            'scope' => 'required|string',
            'specializations' => 'sometimes|array',
            'specializations.*' => 'string|in:Software,Embedded,Network,Multimedia,AI,Blockchain',
            'proposed_supervisor_id' => 'required|exists:users,id',
        ]);

        $user = $request->user();

        // Find user's active group
        $membership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->first();

        if (!$membership) {
            return response()->json(['message' => 'You must be in a group to propose a title.'], 400);
        }

        // Check if user is leader
        if (!$membership->is_leader) {
            return response()->json(['message' => 'Only the group leader can propose a title.'], 403);
        }

        $group = Group::find($membership->group_id);

        // Check minimum 3 members
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        if ($memberCount < 3) {
            return response()->json(['message' => 'Your group must have at least 3 members before proposing a title.'], 400);
        }

        // Check if group already has a title assigned
        if ($group->title_id && $group->status === 'APPROVED') {
            return response()->json(['message' => 'Your group already has an approved title.'], 400);
        }

        // Check for pending proposal
        $pendingProposal = Title::where('proposed_by_group_id', $group->id)
            ->where('supervisor_approval_status', 'PENDING')
            ->exists();

        if ($pendingProposal) {
            return response()->json(['message' => 'You already have a pending proposal. Wait for supervisor response.'], 400);
        }

        // Check group status allows proposing
        if (!in_array($group->status, ['PENDING', 'READY_FOR_BIDDING', 'REJECTED'])) {
            return response()->json(['message' => 'Your group is not eligible to propose a title at this time.'], 400);
        }

        // Verify active period
        $period = Period::whereRaw('is_active = true')->latest()->first();
        if (!$period) {
            return response()->json(['message' => 'No active academic period found.'], 400);
        }

        // Verify supervisor is a valid lecturer
        $supervisor = \App\Models\User::where('id', $validated['proposed_supervisor_id'])
            ->where('role', 'dosen')
            ->first();

        if (!$supervisor) {
            return response()->json(['message' => 'Selected supervisor is not a valid lecturer.'], 400);
        }

        DB::beginTransaction();
        try {
            $title = Title::create([
                'lecturer_id' => $validated['proposed_supervisor_id'],
                'title' => $validated['title'],
                'description' => $validated['description'],
                'problem_statement' => $validated['problem_statement'],
                'scope' => $validated['scope'],
                'specializations' => $validated['specializations'] ?? [],
                'quota' => 1,
                'status' => 'open',
                'title_source' => 'STUDENT',
                'proposed_by_group_id' => $group->id,
                'proposed_supervisor_id' => $validated['proposed_supervisor_id'],
                'supervisor_approval_status' => 'PENDING',
            ]);

            $group->update(['status' => 'WAITING_SUPERVISOR_APPROVAL']);

            // Notify the supervisor
            Notification::create([
                'user_id' => $validated['proposed_supervisor_id'],
                'message' => "New title proposal from group #{$group->id}: \"{$validated['title']}\"",
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Proposal submitted successfully.',
                'title' => $title->load(['proposedByGroup.members.student', 'proposedSupervisor']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to submit proposal: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get current/latest proposal for the student's group.
     */
    public function myProposal(Request $request)
    {
        $user = $request->user();

        $membership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->first();

        if (!$membership) {
            return response()->json(['proposal' => null]);
        }

        $proposals = Title::where('proposed_by_group_id', $membership->group_id)
            ->where('title_source', 'STUDENT')
            ->with(['proposedSupervisor'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['proposals' => $proposals]);
    }

    /**
     * Edit & resubmit a rejected proposal.
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'title_id' => 'required|exists:titles,id',
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'problem_statement' => 'required|string',
            'scope' => 'required|string',
            'proposed_supervisor_id' => 'sometimes|exists:users,id',
        ]);

        $user = $request->user();

        $membership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->first();

        if (!$membership || !$membership->is_leader) {
            return response()->json(['message' => 'Unauthorized. Only group leader can resubmit.'], 403);
        }

        $title = Title::where('id', $validated['title_id'])
            ->where('proposed_by_group_id', $membership->group_id)
            ->where('supervisor_approval_status', 'REJECTED')
            ->first();

        if (!$title) {
            return response()->json(['message' => 'No rejected proposal found to resubmit.'], 404);
        }

        // Check no other pending proposal
        $pendingExists = Title::where('proposed_by_group_id', $membership->group_id)
            ->where('supervisor_approval_status', 'PENDING')
            ->exists();

        if ($pendingExists) {
            return response()->json(['message' => 'You already have a pending proposal.'], 400);
        }

        DB::beginTransaction();
        try {
            $supervisorId = $validated['proposed_supervisor_id'] ?? $title->proposed_supervisor_id;

            $title->update([
                'title' => $validated['title'],
                'description' => $validated['description'],
                'problem_statement' => $validated['problem_statement'],
                'scope' => $validated['scope'],
                'proposed_supervisor_id' => $supervisorId,
                'lecturer_id' => $supervisorId,
                'supervisor_approval_status' => 'PENDING',
                'rejection_reason' => null,
            ]);

            $group = Group::find($membership->group_id);
            $group->update(['status' => 'WAITING_SUPERVISOR_APPROVAL']);

            // Notify supervisor
            Notification::create([
                'user_id' => $supervisorId,
                'message' => "Resubmitted title proposal from group #{$group->id}: \"{$validated['title']}\"",
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Proposal resubmitted successfully.',
                'title' => $title->load(['proposedByGroup.members.student', 'proposedSupervisor']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to resubmit: ' . $e->getMessage()], 500);
        }
    }
}
