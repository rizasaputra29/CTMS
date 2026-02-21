<?php

namespace App\Http\Controllers;

use App\Models\Title;
use App\Models\Group;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TitleApprovalController extends Controller
{
    /**
     * List pending proposals for the authenticated lecturer.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $proposals = Title::where('proposed_supervisor_id', $user->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'PENDING')
            ->with(['proposedByGroup.members.student', 'proposedSupervisor'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $proposals]);
    }

    /**
     * View a specific proposal detail.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();

        $proposal = Title::where('id', $id)
            ->where('proposed_supervisor_id', $user->id)
            ->where('title_source', 'STUDENT')
            ->with(['proposedByGroup.members.student', 'proposedByGroup.period', 'proposedSupervisor'])
            ->first();

        if (!$proposal) {
            return response()->json(['message' => 'Proposal not found.'], 404);
        }

        return response()->json(['data' => $proposal]);
    }

    /**
     * Approve a student title proposal.
     */
    public function approve(Request $request, $id)
    {
        $user = $request->user();

        $title = Title::where('id', $id)
            ->where('proposed_supervisor_id', $user->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'PENDING')
            ->first();

        if (!$title) {
            return response()->json(['message' => 'Proposal not found or already processed.'], 404);
        }

        $group = Group::find($title->proposed_by_group_id);

        if (!$group) {
            return response()->json(['message' => 'Associated group not found.'], 404);
        }

        // Check lecturer quota: count existing supervised groups
        $existingSupervised = Group::whereHas('title', function ($q) use ($user) {
            $q->where('lecturer_id', $user->id);
        })->where('status', 'APPROVED')->count();

        // If you want a quota limit, you can add it here. For now, we proceed.

        DB::beginTransaction();
        try {
            // Approve the title
            $title->update([
                'supervisor_approval_status' => 'APPROVED',
                'status' => 'open',
            ]);

            // Set group to final
            $group->update([
                'title_id' => $title->id,
                'status' => 'APPROVED',
                'assignment_type' => 'STUDENT_PROPOSAL',
            ]);

            // Cancel all other active bids (PENDING groups) for this group's members
            $memberIds = $group->members()->pluck('student_id');

            // Find other groups these members are in (shouldn't happen normally, but safety)
            $otherGroupIds = \App\Models\GroupMember::whereIn('student_id', $memberIds)
                ->where('group_id', '!=', $group->id)
                ->pluck('group_id')
                ->unique();

            if ($otherGroupIds->isNotEmpty()) {
                Group::whereIn('id', $otherGroupIds)
                    ->where('status', 'PENDING')
                    ->update(['status' => 'REJECTED']);
            }

            // Notify all group members
            foreach ($group->members()->with('student')->get() as $member) {
                Notification::create([
                    'user_id' => $member->student_id,
                    'message' => "Your title proposal \"{$title->title}\" has been approved!",
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Proposal approved successfully.',
                'title' => $title->load('proposedByGroup.members.student'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to approve: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Reject a student title proposal.
     */
    public function reject(Request $request, $id)
    {
        $validated = $request->validate([
            'rejection_reason' => 'required|string|max:1000',
        ]);

        $user = $request->user();

        $title = Title::where('id', $id)
            ->where('proposed_supervisor_id', $user->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'PENDING')
            ->first();

        if (!$title) {
            return response()->json(['message' => 'Proposal not found or already processed.'], 404);
        }

        $group = Group::find($title->proposed_by_group_id);

        if (!$group) {
            return response()->json(['message' => 'Associated group not found.'], 404);
        }

        DB::beginTransaction();
        try {
            $title->update([
                'supervisor_approval_status' => 'REJECTED',
                'rejection_reason' => $validated['rejection_reason'],
            ]);

            $group->update([
                'status' => 'READY_FOR_BIDDING',
            ]);

            // Notify all group members
            foreach ($group->members()->with('student')->get() as $member) {
                Notification::create([
                    'user_id' => $member->student_id,
                    'message' => "Your title proposal \"{$title->title}\" was rejected. Reason: {$validated['rejection_reason']}",
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Proposal rejected.',
                'title' => $title,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to reject: ' . $e->getMessage()], 500);
        }
    }
}
