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
     *
     * GOVERNANCE: This method ONLY validates the proposal.
     * It does NOT assign title_id, supervisors, or transition group state.
     * Title assignment and state transitions are EXCLUSIVELY handled by
     * FinalizationService (admin-only).
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

        // Guard: prevent double-approval race condition
        if ($title->supervisor_approval_status === 'APPROVED') {
            return response()->json(['message' => 'Proposal already approved.'], 409);
        }

        $group = Group::find($title->proposed_by_group_id);

        if (!$group) {
            return response()->json(['message' => 'Associated group not found.'], 404);
        }

        DB::beginTransaction();
        try {
            // Approve the title — proposal validation ONLY
            $title->update([
                'supervisor_approval_status' => 'APPROVED',
                'status' => 'open',
            ]);

            // Return group to READY_FOR_BIDDING (from WAITING_SUPERVISOR_APPROVAL)
            // Guard: only transition if currently waiting for approval
            if ($group->status === 'WAITING_SUPERVISOR_APPROVAL') {
                $group->update(['status' => 'READY_FOR_BIDDING']);
            }

            // NO title_id assignment — admin finalization only
            // NO assignment_type write — admin finalization only
            // NO cancel other groups — admin finalization only
            // NO supervisor assignment — admin finalization only

            // Notify all group members
            foreach ($group->members()->with('student')->get() as $member) {
                Notification::create([
                    'user_id' => $member->student_id,
                    'message' => "Your title proposal \"{$title->title}\" has been approved by the supervisor! Await admin finalization.",
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Proposal approved successfully. Awaiting admin finalization.',
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
