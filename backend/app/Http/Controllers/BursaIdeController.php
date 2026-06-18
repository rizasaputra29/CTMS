<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\JoinRequest;
use App\Models\Notification;
use App\Models\Title;
use App\Services\GroupStateMachine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BursaIdeController extends Controller
{
    use ApiResponseTrait;

    /**
     * Solo Seeker statuses — FORMING_SOLO and FORMING transitions to WAITING_SUPERVISOR_APPROVAL
     * after proposing a title, then back to FORMING/FORMING_SOLO after Pre-Approval.
     * TITLE_APPROVED is the status after supervisor approves - title is open for recruitment.
     * All statuses represent a "Solo Seeker" in different lifecycle phases.
     */
    private const SOLO_STATUSES = ['FORMING_SOLO', 'FORMING', 'WAITING_SUPERVISOR_APPROVAL', 'TITLE_APPROVED'];

    protected GroupStateMachine $stateMachine;

    protected \App\Services\GroupService $groupService;

    public function __construct(GroupStateMachine $stateMachine, \App\Services\GroupService $groupService)
    {
        $this->stateMachine = $stateMachine;
        $this->groupService = $groupService;
    }

    /**
     * List all UNDER_REVIEW titles available for joining (the "Bursa Ide").
     * Accessible to all mahasiswa, but only Ghost/Solo can request to join.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $periodId = $request->query('period_id');

        $query = Title::where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'UNDER_REVIEW')
            ->with([
                'proposedByGroup.members.student',
                'proposedByGroup.period',
                'proposedSupervisor',
            ]);

        if ($periodId) {
            $query->where('period_id', $periodId);
        } else {
            // Default to current active period if no period_id provided
            $query->whereHas('period', function ($q) {
                $q->where('is_active', true);
            });
        }

        $titles = $query->orderBy('created_at', 'desc')
            ->get();

        // Determine if current user can request to join
        $userMembership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', fn ($q) => $q->whereNotIn('status', ['CLOSED']))
            ->first();

        $canRequestJoin = false;
        if (! $userMembership) {
            // Ghost student — no group at all
            $canRequestJoin = true;
        } elseif ($userMembership) {
            $userGroup = Group::find($userMembership->group_id);
            if ($userGroup && in_array($userGroup->status, self::SOLO_STATUSES) && $userMembership->is_leader) {
                // Leader of a seeker group — can join and merge their team
                $canRequestJoin = true;
            }
        }

        // Get existing pending requests from this user
        $myPendingRequests = JoinRequest::where('requester_id', $user->id)
            ->where('status', 'PENDING')
            ->pluck('group_id')
            ->toArray();

        return $this->envelopeResponse($titles, [
            'can_request_join' => $canRequestJoin,
            'my_pending_requests' => $myPendingRequests,
            'flow' => $this->buildBursaFlowPayload($user),
        ]);
    }

    /**
     * Request to join a solo seeker's group.
     */
    public function requestJoin(Request $request, $groupId)
    {
        $request->validate([
            'message' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $group = Group::with('period')->findOrFail($groupId);

        // Guard: Check if period is finalized
        if ($group->period->is_finalized) {
            return $this->errorResponse('Pendaftaran untuk periode ini sudah ditutup.', 400);
        }

        // Guard: Only solo seekers can receive join requests
        if (! $group->is_solo) {
            return $this->errorResponse('Grup ini tidak menerima permintaan bergabung.', 400);
        }

        // Guard: only Solo Seeker groups can be joined
        if (! in_array($group->status, self::SOLO_STATUSES)) {
            return $this->errorResponse('This group is not accepting join requests.', 400);
        }

        // LOCKED: After READY_FOR_FINALIZATION, cannot request to join
        $stateMachine = app(\App\Services\GroupStateMachine::class);
        if ($stateMachine->isAtLeast($group, 'READY_FOR_FINALIZATION')) {
            return $this->errorResponse('Kelompok sudah terkunci (Ready for Finalization) dan tidak menerima permintaan bergabung.', 400);
        }

        // Guard: Check user eligibility (Ghost or FORMING)
        $userMembership = GroupMember::where('student_id', $user->id)
            ->where('period_id', $group->period_id)
            ->first();

        if ($userMembership) {
            $userGroup = Group::find($userMembership->group_id);
            if (! $userGroup || ! in_array($userGroup->status, self::SOLO_STATUSES)) {
                return $this->errorResponse('Anda sudah terdaftar di grup permanen atau sedang melakukan bidding.', 400);
            }
            if (! $userMembership->is_leader) {
                return $this->errorResponse('Hanya Ketua Kelompok yang dapat mengajukan penggabungan ke ide lain.', 400);
            }
            // Solo seekers can't request to join their own group
            if ($userGroup->id === $group->id) {
                return $this->errorResponse('You cannot request to join your own group.', 400);
            }
        }

        // Guard: Check not already pending
        $existingRequest = JoinRequest::where('group_id', $group->id)
            ->where('requester_id', $user->id)
            ->where('status', 'PENDING')
            ->exists();

        if ($existingRequest) {
            return $this->errorResponse('You already have a pending request for this group.', 400);
        }

        // Guard: Group capacity for merged team
        $sourceMembership = GroupMember::where('student_id', $user->id)
            ->where('period_id', $group->period_id)
            ->first();

        $sourceCount = $sourceMembership ? GroupMember::where('group_id', $sourceMembership->group_id)->count() : 1;
        $targetCount = GroupMember::where('group_id', $group->id)->count();
        $maxMembers = $group->period->max_group_size ?? 4;

        if (($sourceCount + $targetCount) > $maxMembers) {
            return $this->errorResponse("Jumlah anggota gabungan ({$sourceCount} + {$targetCount}) melebihi kuota maksimal {$maxMembers} orang.", 400);
        }

        $joinRequest = JoinRequest::updateOrCreate(
            [
                'group_id' => $group->id,
                'requester_id' => $user->id,
            ],
            [
                'status' => 'PENDING',
                'message' => $request->input('message'),
                'requested_at' => now(),
            ]
        );

        // Notify the group leader
        $leader = GroupMember::where('group_id', $group->id)
            ->where('is_leader', true)
            ->first();

        if ($leader) {
            Notification::create([
                'user_id' => $leader->student_id,
                'type' => 'JOIN_REQUEST',
                'title' => 'New Join Request',
                'message' => "{$user->name} wants to join your group.",
                'related_type' => 'join_requests',
                'related_id' => $joinRequest->id,
            ]);
        }

        return $this->createdResponse([
            'message' => 'Join request sent successfully.',
            'join_request' => $joinRequest,
        ]);
    }

    /**
     * List incoming join requests for the current user's group (Leader only).
     */
    public function myRequests(Request $request)
    {
        $user = $request->user();

        $membership = GroupMember::where('student_id', $user->id)
            ->where('is_leader', true)
            ->whereHas('group', fn ($q) => $q->whereIn('status', self::SOLO_STATUSES))
            ->first();

        if (! $membership) {
            return $this->successResponse([]);
        }

        $requests = JoinRequest::where('group_id', $membership->group_id)
            ->where('status', 'PENDING')
            ->with('requester')
            ->orderBy('created_at', 'asc')
            ->get();

        return $this->successResponse($requests);
    }

    /**
     * Accept a join request.
     * CRITICAL: Uses same protection pattern as GroupController::acceptInvite()
     * - DB Transaction + lockForUpdate()
     * - Auto-cleanup of requester's solo group
     * - Invalidation of other pending requests
     * - Quota validation on UNDER_REVIEW → APPROVED transition
     */
    public function acceptRequest(Request $request, $id)
    {
        $user = $request->user();

        $joinRequest = JoinRequest::where('id', $id)
            ->where('status', 'PENDING')
            ->first();

        if (! $joinRequest) {
            return $this->notFoundResponse('Join request not found or already processed.');
        }

        // Verify current user is leader of the target group
        $leaderMembership = GroupMember::where('student_id', $user->id)
            ->where('group_id', $joinRequest->group_id)
            ->where('is_leader', true)
            ->first();

        if (! $leaderMembership) {
            return $this->unauthorizedResponse('Only the group leader can accept join requests.');
        }

        $group = Group::with('period')->find($joinRequest->group_id);

        if (! $group || ! in_array($group->status, self::SOLO_STATUSES)) {
            return $this->errorResponse('Group is not accepting members.', 400);
        }

        // LOCKED: After READY_FOR_FINALIZATION, cannot accept new members
        $stateMachine = app(\App\Services\GroupStateMachine::class);
        if ($stateMachine->isAtLeast($group, 'READY_FOR_FINALIZATION')) {
            return $this->errorResponse('Kelompok sudah terkunci (Ready for Finalization) dan tidak menerima anggota baru.', 400);
        }

        // SECURITY FIX: For solo seeker groups, check if title is still APPROVED
        // Prevent joining if the title has been withdrawn by lecturer
        if ($group->is_solo && $group->title_id) {
            $title = \App\Models\Title::find($group->title_id);
            if (! $title || $title->supervisor_approval_status !== 'APPROVED') {
                return $this->errorResponse('Judul kelompok ini telah dibatalkan oleh dosen. Tidak dapat menerima anggota baru.', 400);
            }
        }

        $maxMembers = $group->period->max_group_size ?? 4;

        DB::beginTransaction();
        try {
            $this->groupService->handleJoinGroup($joinRequest->requester, $group);

            DB::commit();

            return $this->successResponse([
                'message' => 'Join request accepted. Student has been added to your group.',
                'group' => $group->fresh()->load('members.student'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->errorResponse('Failed to accept: '.$e->getMessage(), 500);
        }
    }

    /**
     * Reject a join request.
     */
    public function rejectRequest(Request $request, $id)
    {
        $user = $request->user();

        $joinRequest = JoinRequest::where('id', $id)
            ->where('status', 'PENDING')
            ->first();

        if (! $joinRequest) {
            return $this->notFoundResponse('Join request not found or already processed.');
        }

        // Verify current user is leader of the target group
        $leaderMembership = GroupMember::where('student_id', $user->id)
            ->where('group_id', $joinRequest->group_id)
            ->where('is_leader', true)
            ->first();

        if (! $leaderMembership) {
            return $this->unauthorizedResponse('Only the group leader can reject join requests.');
        }

        $joinRequest->update(['status' => 'REJECTED']);

        // Notify requester
        Notification::create([
            'user_id' => $joinRequest->requester_id,
            'type' => 'JOIN_REQUEST_REJECTED',
            'title' => 'Join Request Rejected',
            'message' => "Your request to join {$user->name}'s group was declined.",
            'related_type' => 'groups',
            'related_id' => $joinRequest->group_id,
        ]);

        return $this->successResponse(null, 'Join request rejected.');
    }

    private function buildBursaFlowPayload($user): array
    {
        $membership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', fn ($q) => $q->whereNotIn('status', ['CLOSED']))
            ->first();

        if (! $membership) {
            return [
                'can_request_join' => true,
                'can_accept_join_requests' => false,
                'can_reject_join_requests' => false,
                'reason' => null,
            ];
        }

        $group = Group::with('period')->find($membership->group_id);
        if (! $group) {
            return [
                'can_request_join' => false,
                'can_accept_join_requests' => false,
                'can_reject_join_requests' => false,
                'reason' => 'NO_GROUP',
            ];
        }

        $isSoloLeader = $membership->is_leader && in_array($group->status, self::SOLO_STATUSES, true);

        if ($group->period?->is_finalized) {
            return [
                'can_request_join' => false,
                'can_accept_join_requests' => false,
                'can_reject_join_requests' => false,
                'reason' => 'PERIOD_FINALIZED',
            ];
        }

        if ($this->stateMachine->isAtLeast($group, 'READY_FOR_FINALIZATION')) {
            return [
                'can_request_join' => false,
                'can_accept_join_requests' => false,
                'can_reject_join_requests' => false,
                'reason' => 'GROUP_LOCKED',
            ];
        }

        if (! $isSoloLeader) {
            return [
                'can_request_join' => false,
                'can_accept_join_requests' => false,
                'can_reject_join_requests' => false,
                'reason' => 'LEADER_SOLO_ONLY',
            ];
        }

        return [
            'can_request_join' => true,
            'can_accept_join_requests' => true,
            'can_reject_join_requests' => true,
            'reason' => null,
        ];
    }
}
