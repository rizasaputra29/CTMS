<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
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
    use RequiresActivePeriod;

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

        $group = Group::with('period')->find($membership->group_id);

        // Check if period is finalized - block create after finalization
        if ($group->period && $group->period->is_finalized) {
            return response()->json(['message' => 'Periode sudah difinalisasi. Pengajuan judul baru tidak diperbolehkan.'], 403);
        }

        // Check minimum members requirement
        // Solo Seeker (is_solo=true) can propose with any member count
        // Normal groups must have minimum members before proposing
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        $minSize = $group->period->min_group_size ?? 3;
        if (!$group->is_solo && $memberCount < $minSize) {
            return response()->json(['message' => "Kelompok harus memiliki minimal {$minSize} anggota untuk mengajukan judul. Tambahkan anggota terlebih dahulu."], 400);
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

        // Mutual Exclusive: Block proposing if group has active bids (normal groups only)
        if (!$group->is_solo) {
            $hasActiveBid = \App\Models\Bid::where('group_id', $group->id)
                ->where(function($q) {
                    $q->where('status', 'PENDING')
                      ->orWhere('lecturer_recommendation', 'ACCEPT');
                })
                ->exists();
            
            if ($hasActiveBid) {
                return response()->json([
                    'message' => 'Tidak dapat mengajukan proposal karena kelompok sudah memiliki bid yang sedang diproses atau diterima.'
                ], 400);
            }
        }

        // Combined limit: bids + student proposals <= 3
        // Only count active bids (pending or accepted, not rejected)
        $bidCount = \App\Models\Bid::where('group_id', $group->id)
            ->where(function($q) {
                $q->whereNull('lecturer_recommendation')  // PENDING
                  ->orWhere('lecturer_recommendation', 'ACCEPT');  // ACCEPTED
            })
            ->count();
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
            return response()->json([
                'proposals' => [],
                'flow' => $this->denyProposalFlow('NO_GROUP'),
            ]);
        }

        $proposals = Title::where('proposed_by_group_id', $membership->group_id)
            ->where('title_source', 'STUDENT')
            ->with(['proposedSupervisor', 'stakeholders'])
            ->orderBy('created_at', 'desc')
            ->get();

        $group = Group::with(['period', 'members'])->find($membership->group_id);

        return response()->json([
            'proposals' => $proposals,
            'flow' => $this->buildProposalFlowPayload($group, $membership),
        ]);
    }

    /**
     * Edit & resubmit a proposal (REJECTED or PENDING).
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
            return response()->json(['message' => 'Unauthorized. Only group leader can edit proposal.'], 403);
        }

        // Allow editing REJECTED or PENDING proposals
        // Allow editing PENDING, REJECTED, or UNDER_REVIEW proposals
        $title = Title::where('id', $validated['title_id'])
            ->where('proposed_by_group_id', $membership->group_id)
            ->whereIn('supervisor_approval_status', ['PENDING', 'REJECTED', 'UNDER_REVIEW'])
            ->first();

        if (!$title) {
            return response()->json(['message' => 'No editable proposal found. Only PENDING, REJECTED, or UNDER_REVIEW proposals can be edited.'], 404);
        }

        // For REJECTED proposals, check no other pending proposal exists
        if ($title->supervisor_approval_status === 'REJECTED') {
            $pendingExists = Title::where('proposed_by_group_id', $membership->group_id)
                ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW'])
                ->exists();

            if ($pendingExists) {
                return response()->json(['message' => 'You already have a pending proposal.'], 400);
            }
        }

        DB::beginTransaction();
        try {
            $supervisorId = $validated['proposed_supervisor_id'] ?? $title->proposed_supervisor_id;

            // Reset to PENDING status when edited
            $updateData = [
                'title' => $validated['title'],
                'description' => $validated['description'],
                'problem_statement' => $validated['problem_statement'],
                'scope' => $validated['scope'],
                'proposed_supervisor_id' => $supervisorId,
                'lecturer_id' => $supervisorId,
                'rejection_reason' => null,
            ];

            // If was REJECTED, reset to PENDING
            if ($title->supervisor_approval_status === 'REJECTED') {
                $updateData['supervisor_approval_status'] = 'PENDING';
            }

            $title->update($updateData);

            if (array_key_exists('stakeholder_ids', $validated)) {
                $title->stakeholders()->sync($validated['stakeholder_ids'] ?? []);
            }

            $group = Group::with('period')->find($membership->group_id);

            $this->ensurePeriodIsActive($group);

            $group->update(['has_active_proposal' => true]);

            // Notify supervisor
            $notificationType = $title->supervisor_approval_status === 'REJECTED' ? 'PROPOSAL_RESUBMITTED' : 'PROPOSAL_UPDATED';
            $notificationTitle = $title->supervisor_approval_status === 'REJECTED' ? 'Resubmitted Title Proposal' : 'Updated Title Proposal';
            Notification::create([
                'user_id' => $supervisorId,
                'type' => $notificationType,
                'title' => $notificationTitle,
                'message' => "Updated title proposal from group #{$group->id}: \"{$validated['title']}\"",
                'related_type' => 'Title',
                'related_id' => $title->id,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Proposal updated successfully.',
                'title' => $title->load(['proposedByGroup.members.student', 'proposedSupervisor', 'stakeholders']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Cancel/delete a proposal.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        // Get all active period IDs
        $activePeriodIds = \App\Models\Period::where('is_active', true)->pluck('id')->toArray();
        
        // Check if user is leader in any active period
        $membership = GroupMember::where('student_id', $user->id)
            ->where('is_leader', true)
            ->whereHas('group', function ($q) use ($activePeriodIds) {
                $q->whereIn('period_id', $activePeriodIds)
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

        $group = Group::with('period')->find($membership->group_id);

        // Check if period is finalized - block delete after finalization
        if ($group->period && $group->period->is_finalized) {
            return response()->json(['message' => 'Periode sudah difinalisasi. Pembatalan proposal tidak diperbolehkan.'], 403);
        }

        // PENDING, REJECTED, or UNDER_REVIEW proposals can be cancelled
        if (!in_array($title->supervisor_approval_status, ['PENDING', 'REJECTED', 'UNDER_REVIEW'])) {
            return response()->json(['message' => 'Proposal sudah disetujui dan tidak dapat dibatalkan. Hubungi admin jika ada kebutuhan khusus.'], 400);
        }

        DB::beginTransaction();
        try {
            $group = Group::with('period', 'members')->find($membership->group_id);

            $this->ensurePeriodIsActive($group);

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

    private function buildProposalFlowPayload(?Group $group, ?GroupMember $membership): array
    {
        if (!$group || !$membership) {
            return $this->denyProposalFlow('NO_GROUP');
        }

        $isLeader = (bool) $membership->is_leader;
        $memberCount = $group->members->count();
        $minSize = $group->period?->min_group_size ?? 3;

        $pendingProposal = Title::where('proposed_by_group_id', $group->id)
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW'])
            ->exists();

        $hasRejectedProposal = Title::where('proposed_by_group_id', $group->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'REJECTED')
            ->exists();

        $canCreateProposal = true;
        $reason = null;

        if (!$isLeader) {
            $canCreateProposal = false;
            $reason = 'LEADER_ONLY';
        }

        if ($canCreateProposal && !$group->is_solo && $memberCount < $minSize) {
            $canCreateProposal = false;
            $reason = 'INSUFFICIENT_MEMBERS';
        }

        if ($canCreateProposal && $group->title_id && $group->status === 'APPROVED') {
            $canCreateProposal = false;
            $reason = 'TITLE_ALREADY_ASSIGNED';
        }

        if ($canCreateProposal && $pendingProposal) {
            $canCreateProposal = false;
            $reason = 'PENDING_PROPOSAL_EXISTS';
        }

        if ($canCreateProposal && !in_array($group->status, ['PENDING', 'READY_FOR_BIDDING', 'REJECTED', 'FORMING', 'FORMING_SOLO'], true)) {
            $canCreateProposal = false;
            $reason = 'INVALID_GROUP_STATUS';
        }

        if (!$group->is_solo) {
            $hasActiveBid = \App\Models\Bid::where('group_id', $group->id)
                ->where(function ($q) {
                    $q->where('status', 'PENDING')
                      ->orWhere('lecturer_recommendation', 'ACCEPT');
                })
                ->exists();

            if ($canCreateProposal && $hasActiveBid) {
                $canCreateProposal = false;
                $reason = 'ACTIVE_BID_EXISTS';
            }
        }

        $bidCount = \App\Models\Bid::where('group_id', $group->id)
            ->where(function ($q) {
                $q->whereNull('lecturer_recommendation')
                  ->orWhere('lecturer_recommendation', 'ACCEPT');
            })
            ->count();

        $proposalCount = Title::where('proposed_by_group_id', $group->id)
            ->where('title_source', 'STUDENT')
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW', 'APPROVED'])
            ->count();

        if ($canCreateProposal && ($bidCount + $proposalCount) >= 3) {
            $canCreateProposal = false;
            $reason = 'TITLE_LIMIT_REACHED';
        }

        if ($canCreateProposal && (!$group->period || !$group->period->is_active)) {
            $canCreateProposal = false;
            $reason = 'NO_ACTIVE_PERIOD';
        }

        $canUpdateRejected = $isLeader && $hasRejectedProposal && !$pendingProposal;
        $canCancelProposal = $isLeader && Title::where('proposed_by_group_id', $group->id)
            ->where('title_source', 'STUDENT')
            ->whereIn('supervisor_approval_status', ['PENDING', 'REJECTED'])
            ->exists();

        return [
            'can_create_proposal' => $canCreateProposal,
            'can_update_rejected_proposal' => $canUpdateRejected,
            'can_cancel_pending_proposal' => $canCancelProposal,
            'reason' => $reason,
        ];
    }

    private function denyProposalFlow(string $reason): array
    {
        return [
            'can_create_proposal' => false,
            'can_update_rejected_proposal' => false,
            'can_cancel_pending_proposal' => false,
            'reason' => $reason,
        ];
    }
}
