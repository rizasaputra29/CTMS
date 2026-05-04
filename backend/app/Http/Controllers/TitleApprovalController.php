<?php

namespace App\Http\Controllers;

use App\Models\Title;
use App\Models\Group;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use App\Services\GroupStateMachine;

class TitleApprovalController extends Controller
{
    protected $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    /**
     * List pending proposals for the authenticated lecturer.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $periodId = $request->query('period_id');

        $selectedPeriod = null;
        if ($periodId) {
            $selectedPeriod = \App\Models\Period::find($periodId);
        }

        $query = Title::where('proposed_supervisor_id', $user->id)
            ->where('title_source', 'STUDENT')
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW'])
            ->with(['proposedByGroup.members.student', 'proposedSupervisor', 'stakeholders', 'period']);

        if ($periodId) {
            $query->where('period_id', $periodId);
        } else {
            // Default to current active period if no period_id provided
            $query->whereHas('period', function($q) {
                $q->where('is_active', true);
            });
        }

        $proposals = $query->orderBy('created_at', 'desc')
            ->get();

        $proposals = $proposals->map(function (Title $proposal) {
            $proposal->setAttribute('allowed_actions', $this->resolveLecturerProposalActions($proposal));
            return $proposal;
        });

        return response()->json([
            'data' => $proposals,
            'flow' => $this->buildLecturerProposalFlowPayload($selectedPeriod),
        ]);
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
            ->with(['proposedByGroup.members.student', 'proposedByGroup.period', 'proposedSupervisor', 'stakeholders'])
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
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW'])
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
            $memberCount = $group->members()->count();
            $minSize = $group->period->min_group_size ?? 3;
            
            // Determine approval type based on member count and group type
            $newStatus = ($memberCount < $minSize && !$group->is_solo) ? 'UNDER_REVIEW' : 'APPROVED';

            // Approve the title (or Pre-Approve if lacking members)
            $title->update([
                'supervisor_approval_status' => $newStatus,
                'status' => 'open',
            ]);

            $group->update([
                'has_active_proposal' => $newStatus !== 'APPROVED',
            ]);

            // If Approved, link title_id to the group and handle status transition
            if ($newStatus === 'APPROVED') {
                $group->update(['title_id' => $title->id]);
                
                // Both solo seeker AND normal group → TITLE_APPROVED
                if ($this->stateMachine->canTransition($group->status, 'TITLE_APPROVED')) {
                    $this->stateMachine->transition($group, 'TITLE_APPROVED');
                } else {
                    // Fallback if state machine doesn't allow transition
                    $group->status = 'TITLE_APPROVED';
                    $group->save();
                }
            }

            // Notify all group members
            $verb = $newStatus === 'APPROVED' ? 'Approved' : 'Under Review';
            $msgPart = $newStatus === 'APPROVED'
                ? "await admin finalization."
                : "complete your team members first.";

            // Batch insert notifications for better performance
            $notifications = [];
            $now = now();
            foreach ($group->members()->with('student')->get() as $member) {
                $notifications[] = [
                    'user_id' => $member->student_id,
                    'type' => 'PROPOSAL_APPROVED',
                    'title' => "Title Proposal {$verb}",
                    'message' => "Your title proposal \"{$title->title}\" has been {$verb} by the supervisor! Please {$msgPart}",
                    'related_type' => 'Title',
                    'related_id' => $title->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            if (!empty($notifications)) {
                Notification::insert($notifications);
            }

            DB::commit();

            return response()->json([
                'message' => "Proposal {$verb} successfully.",
                'title' => $title->load(['proposedByGroup.members.student', 'stakeholders']),
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
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW'])
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
            $group->update(['has_active_proposal' => false]);

            // Reject proposal - do NOT hardcode status. 
            // Use determineStatus() to recalculate based on member count ONLY.
            // This follows the principle: cancel/reject/withdraw NEVER changes group status.
            $group->status = $group->determineStatus();
            $group->save();

            // Notify all group members
            $notifications = [];
            $now = now();
            foreach ($group->members()->with('student')->get() as $member) {
                $notifications[] = [
                    'user_id' => $member->student_id,
                    'type' => 'PROPOSAL_REJECTED',
                    'title' => 'Title Proposal Rejected',
                    'message' => "Your title proposal \"{$title->title}\" was rejected. Reason: {$validated['rejection_reason']}",
                    'related_type' => 'Title',
                    'related_id' => $title->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            if (!empty($notifications)) {
                Notification::insert($notifications);
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

    private function buildLecturerProposalFlowPayload($period): array
    {
        if ($period && $period->is_finalized) {
            return [
                'can_approve_proposal' => false,
                'can_reject_proposal' => false,
                'reason' => 'PERIOD_FINALIZED',
            ];
        }

        return [
            'can_approve_proposal' => true,
            'can_reject_proposal' => true,
            'reason' => null,
        ];
    }

    private function resolveLecturerProposalActions(Title $proposal): array
    {
        if (!in_array($proposal->supervisor_approval_status, ['PENDING', 'UNDER_REVIEW'], true)) {
            return [
                'can_approve' => false,
                'can_reject' => false,
                'reason' => 'PROPOSAL_ALREADY_PROCESSED',
            ];
        }

        if ($proposal->period && $proposal->period->is_finalized) {
            return [
                'can_approve' => false,
                'can_reject' => false,
                'reason' => 'PERIOD_FINALIZED',
            ];
        }

        return [
            'can_approve' => true,
            'can_reject' => true,
            'reason' => null,
        ];
    }
}
