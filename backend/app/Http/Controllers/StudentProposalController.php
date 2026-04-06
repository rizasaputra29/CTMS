<?php

namespace App\Http\Controllers;

use App\Models\Title;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use App\Services\GroupStateMachine;

class StudentProposalController extends Controller
{
    protected $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    /**
     * List active lecturers for supervisor selection.
     */
    public function lecturers()
    {
        $lecturers = \App\Models\User::whereHas('roles', function ($q) {
            $q->where('slug', 'dosen');
        })
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
            'stakeholder_ids' => 'sometimes|array',
            'stakeholder_ids.*' => 'integer|exists:stakeholders,id',
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

        // Check minimum 3 members (unless Solo Seeker)
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        $minSize = $group->period->min_group_size ?? 3;
        if (!in_array($group->status, ['FORMING', 'FORMING_SOLO', 'READY_FOR_BIDDING']) && $memberCount < $minSize) {
            return response()->json(['message' => "Your group must have at least {$minSize} members before proposing a title."], 400);
        }

        // Check if group already has a title assigned
        if ($group->title_id && $group->status === 'APPROVED') {
            return response()->json(['message' => 'Your group already has an approved title.'], 400);
        }

        // Check for pending proposal
        $pendingProposal = Title::where('proposed_by_group_id', $group->id)
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW'])
            ->exists();

        if ($pendingProposal) {
            return response()->json(['message' => 'You already have a pending proposal. Wait for supervisor response.'], 400);
        }

        // Check group status allows proposing
        if (!in_array($group->status, ['PENDING', 'READY_FOR_BIDDING', 'REJECTED', 'FORMING', 'FORMING_SOLO'])) {
            return response()->json(['message' => 'Your group is not eligible to propose a title at this time.'], 400);
        }

        // Combined limit: bids + student proposals <= 3
        $bidCount = \App\Models\Bid::where('group_id', $group->id)->count();
        $proposalCount = Title::where('proposed_by_group_id', $group->id)
            ->where('title_source', 'STUDENT')
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW', 'APPROVED'])
            ->count();

        if (($bidCount + $proposalCount) >= 3) {
            return response()->json(['message' => 'Maximum 3 titles allowed (bids + proposals combined).'], 400);
        }

        // V4: Resolve period through student's group
        $period = $group->period;
        if (!$period || !$period->is_active) {
            return response()->json(['message' => 'No active academic period for your group.'], 400);
        }

        // Verify supervisor is a valid lecturer
        $supervisor = \App\Models\User::where('id', $validated['proposed_supervisor_id'])
            ->first();

        if (!$supervisor || !$supervisor->hasRole('dosen')) {
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
                'period_id' => $period->id,
            ]);

            if (!empty($validated['stakeholder_ids'])) {
                $title->stakeholders()->sync($validated['stakeholder_ids']);
            }

            $group->update(['has_active_proposal' => true]);

            // Notify the supervisor
            Notification::create([
                'user_id' => $validated['proposed_supervisor_id'],
                'type' => 'PROPOSAL_SUBMITTED',
                'title' => 'New Title Proposal',
                'message' => "New title proposal from group #{$group->id}: \"{$validated['title']}\"",
                'related_type' => 'Title',
                'related_id' => $title->id,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Proposal submitted successfully.',
                'title' => $title->load(['proposedByGroup.members.student', 'proposedSupervisor', 'stakeholders']),
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
            ->with(['proposedSupervisor', 'stakeholders'])
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
            'stakeholder_ids' => 'sometimes|array',
            'stakeholder_ids.*' => 'integer|exists:stakeholders,id',
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
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW'])
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

            if (array_key_exists('stakeholder_ids', $validated)) {
                $title->stakeholders()->sync($validated['stakeholder_ids'] ?? []);
            }

            $group = Group::find($membership->group_id);
            $group->update(['has_active_proposal' => true]);

            // Notify supervisor
            Notification::create([
                'user_id' => $supervisorId,
                'type' => 'PROPOSAL_RESUBMITTED',
                'title' => 'Resubmitted Title Proposal',
                'message' => "Resubmitted title proposal from group #{$group->id}: \"{$validated['title']}\"",
                'related_type' => 'Title',
                'related_id' => $title->id,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Proposal resubmitted successfully.',
                'title' => $title->load(['proposedByGroup.members.student', 'proposedSupervisor', 'stakeholders']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to resubmit: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Cancel/delete a proposal.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        // Get active period
        $activePeriod = \App\Models\Period::where('is_active', true)->first();
        
        // Check if user is leader in current period
        $membership = GroupMember::where('student_id', $user->id)
            ->where('is_leader', true)
            ->where('period_id', $activePeriod?->id)
            ->whereHas('group', function ($q) use ($activePeriod) {
                $q->where('period_id', $activePeriod?->id)
                  ->where('status', '!=', 'REJECTED');
            })
            ->first();

        if (!$membership) {
            return response()->json(['message' => 'Hanya ketua kelompok yang dapat membatalkan proposal.'], 403);
        }

        // Find proposal
        $title = Title::where('id', $id)
            ->where('proposed_by_group_id', $membership->group_id)
            ->where('title_source', 'STUDENT')
            ->first();

        if (!$title) {
            return response()->json(['message' => 'Proposal tidak ditemukan.'], 404);
        }

        // Only PENDING or REJECTED proposals can be cancelled
        if (!in_array($title->supervisor_approval_status, ['PENDING', 'REJECTED'])) {
            return response()->json(['message' => 'Proposal sudah disetujui dan tidak dapat dibatalkan. Hubungi admin jika ada kebutuhan khusus.'], 400);
        }

        DB::beginTransaction();
        try {
            $group = Group::with('period', 'members')->find($membership->group_id);

            // Delete the title (this will cascade any notifications if set)
            $title->delete();
            $group->update(['has_active_proposal' => false]);

            // DO NOT change group status - only proposal status changes to CANCELLED
            // Group status is determined solely by member count via determineStatus()
            // This is handled by GroupMemberObserver when member changes occur

            DB::commit();

            return response()->json(['message' => 'Proposal berhasil dibatalkan.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal membatalkan proposal: ' . $e->getMessage()], 500);
        }
    }
}
