<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Http\Requests\Group\AddMemberRequest;
use App\Http\Requests\Group\AssignSupervisor2Request;
use App\Http\Requests\Group\ProposeSupervisorsRequest;
use App\Models\Group;
use App\Models\GroupInvitation;
use App\Models\GroupMember;
use App\Models\Period;
use App\Services\GroupService;
use App\Services\GroupStateMachine;
use App\Services\NotificationService;
use App\Services\StudentFlagService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class GroupController extends Controller
{
    use ApiResponseTrait, RequiresActivePeriod;

    protected GroupStateMachine $stateMachine;

    protected GroupService $groupService;

    protected NotificationService $notificationService;

    public function __construct(GroupStateMachine $stateMachine, GroupService $groupService, NotificationService $notificationService)
    {
        $this->stateMachine = $stateMachine;
        $this->groupService = $groupService;
        $this->notificationService = $notificationService;
    }

    // ======================================================================
    // Read-only / Query Endpoints
    // ======================================================================

    public function index(Request $request)
    {
        $user = $request->user();
        $periodId = $request->input('period_id', 'current');
        $cacheKey = "user:{$user->id}:group:{$periodId}";

        $result = Cache::remember($cacheKey, 60, fn () => $this->groupService->getUserGroupData(
            $user,
            $request->has('period_id') ? $request->period_id : null
        ));

        return $this->successResponse($result);
    }

    public function listGroups(Request $request)
    {
        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 10);

        $query = Group::with(['title', 'members.student', 'period', 'supervisor1', 'supervisor2', 'supervisions.supervisor']);

        if ($request->has('period_id') && $request->period_id !== 'all') {
            $query->where('period_id', $request->period_id);
        }

        $paginatedGroups = $query->latest()->paginate($perPage, ['*'], 'page', $page);

        $transformedGroups = $paginatedGroups->getCollection()
            ->map(fn (Group $group) => $this->groupService->transformGroupForAdminList($group));

        return $this->envelopeResponse($transformedGroups, [
            'current_page' => $paginatedGroups->currentPage(),
            'last_page' => $paginatedGroups->lastPage(),
            'per_page' => $paginatedGroups->perPage(),
            'total' => $paginatedGroups->total(),
        ]);
    }

    /**
     * Get group progress data with workflow status for all groups.
     */
    public function progress(Request $request)
    {
        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 25);
        $periodId = $request->input('period_id');
        $status = $request->input('status');
        $search = $request->input('search');

        $query = Group::with(['title', 'members.student', 'period', 'supervisor1', 'supervisor2', 'documents']);

        if ($periodId && $periodId !== 'all') {
            $query->where('period_id', $periodId);
        }

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('title', fn ($titleQuery) => $titleQuery->where('title', 'like', "%{$search}%"))
                    ->orWhereHas('members.student', fn ($studentQuery) => $studentQuery->where('name', 'like', "%{$search}%")
                        ->orWhere('nim', 'like', "%{$search}%"));
            });
        }

        $groups = $query->paginate($perPage, ['*'], 'page', $page);

        $periodIds = $groups->pluck('period_id')->unique()->filter();
        $allRequirements = \App\Models\PhaseDocumentRequirement::whereIn('period_id', $periodIds)
            ->where('is_required', true)
            ->get();

        $transformedData = $groups->getCollection()->map(function (Group $group) use ($allRequirements) {
            $documents = $group->documents ?? collect();
            $periodRequirements = $allRequirements->where('period_id', $group->period_id);

            return $this->groupService->transformGroupForProgress($group, $documents, $periodRequirements);
        });

        return $this->envelopeResponse($transformedData, [
            'meta' => [
                'current_page' => $groups->currentPage(),
                'last_page' => $groups->lastPage(),
                'per_page' => $groups->perPage(),
                'total' => $groups->total(),
            ],
        ]);
    }

    /**
     * Display a single group with full details.
     */
    public function show(Group $group)
    {
        $group->load(['title.lecturer', 'members.student', 'period', 'supervisions.supervisor']);

        return $this->successResponse($group);
    }

    /**
     * List all available periods for student registration.
     */
    public function availablePeriods()
    {
        $periods = Period::where('is_active', true)
            ->where('is_finalized', false)
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse(['periods' => $periods]);
    }

    public function supervisedGroups(Request $request)
    {
        $user = $request->user();
        $query = Group::with(['title', 'members.student', 'period', 'supervisions.supervisor'])
            ->whereHas('supervisions', function ($query) use ($user) {
                $query->where('supervisor_id', $user->id)
                    ->whereIn('role', ['SUPERVISOR_1', 'SUPERVISOR_2']);
            });

        $periodId = $request->get('period_id') ?? $request->get('period');
        if ($periodId && $periodId !== 'all') {
            $query->where('period_id', $periodId);
        }

        $groups = $query->get();

        return $this->successResponse($this->groupService->enrichSupervisedGroups($groups, $user));
    }

    public function pendingGroups(Request $request)
    {
        $user = $request->user();
        $periodId = $request->query('period_id');

        if (! $periodId) {
            $currentPeriod = Period::where('is_active', true)
                ->orderBy('created_at', 'desc')
                ->first();
            $periodId = $currentPeriod?->id;
        }

        $groups = Group::with(['title', 'members.student'])
            ->whereHas('title', fn ($q) => $q->where('lecturer_id', $user->id))
            ->where('status', 'READY_FOR_BIDDING');

        if ($periodId) {
            $groups->where('period_id', $periodId);
        }

        return $this->successResponse($groups->get());
    }

    // ======================================================================
    // Mutation Endpoints (Group CRUD)
    // ======================================================================

    /**
     * Create a new group. Student becomes leader. Status = FORMING.
     */
    public function store(Request $request)
    {
        try {
            $group = $this->groupService->createGroup(
                $request->user(),
                $request->input('period_id'),
                $request->input('group_mode', 'GROUP'),
                $request->boolean('has_existing_group', false)
            );

            return $this->createdResponse([
                'message' => 'Group created successfully.',
                'group' => $this->groupService->buildCanonicalGroupPayload($group, $request->user()),
            ]);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to create group: '.$e->getMessage(), 500);
        }
    }

    /**
     * Create a new group as a Solo Seeker. Status = FORMING_SOLO.
     */
    public function storeSolo(Request $request)
    {
        try {
            $group = $this->groupService->createSoloGroup(
                $request->user(),
                $request->input('period_id')
            );

            return $this->createdResponse([
                'message' => 'Solo group created successfully.',
                'group' => $this->groupService->buildCanonicalGroupPayload($group, $request->user()),
            ]);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to create solo group: '.$e->getMessage(), 500);
        }
    }

    /**
     * Delete/disband a group (leader only, only before finalization).
     */
    public function deleteGroup(Request $request)
    {
        try {
            $user = $request->user();

            $membership = GroupMember::where('student_id', $user->id)
                ->whereHas('group', fn ($q) => $q->whereNotIn('status', ['CLOSED']))
                ->first();

            if (! $membership) {
                return $this->errorResponse('Anda belum memiliki kelompok. Buat atau bergabung dengan kelompok terlebih dahulu.', 400);
            }

            $group = Group::find($membership->group_id);
            $this->groupService->deleteGroup($group, $user);

            return $this->successResponse(null, 'Group deleted successfully.');
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to delete group: '.$e->getMessage(), 500);
        }
    }

    /**
     * Admin: Force delete a group and all associated data.
     */
    public function adminDeleteGroup(Request $request, Group $group)
    {
        try {
            $affectedCount = $this->groupService->adminDeleteGroup($group, $request->user());

            return $this->successResponse([
                'message' => 'Group deleted successfully. Affected students have been notified and can now register for new periods.',
                'affected_students_count' => $affectedCount,
            ]);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->unauthorizedResponse($e->getMessage());
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to delete group: '.$e->getMessage(), 500);
        }
    }

    // ======================================================================
    // Member Management
    // ======================================================================

    /**
     * Add a member to the current user's group (leader only).
     */
    public function addMember(AddMemberRequest $request)
    {
        try {
            $user = $request->user();

            $leaderMembership = GroupMember::where('student_id', $user->id)->first();
            if (! $leaderMembership) {
                return $this->errorResponse('Anda belum memiliki kelompok. Buat atau bergabung dengan kelompok terlebih dahulu.', 400);
            }

            if (! $leaderMembership->is_leader) {
                return $this->unauthorizedResponse('Hanya ketua kelompok yang dapat menambahkan anggota.');
            }

            $group = Group::with('period')->find($leaderMembership->group_id);
            $this->groupService->sendInvitation($group, $user, $request->email);

            return $this->successResponse([
                'message' => 'Invitation sent successfully',
                'group' => $this->groupService->buildCanonicalGroupPayload($group->fresh()->load('members.student', 'period'), $user),
            ]);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to send invitation: '.$e->getMessage(), 500);
        }
    }

    /**
     * Accept a group invitation.
     */
    public function acceptInvite(Request $request, $id)
    {
        $user = $request->user();
        $invitation = GroupInvitation::where('id', $id)
            ->where('student_id', $user->id)
            ->where('status', 'PENDING')
            ->first();

        if (! $invitation) {
            return $this->notFoundResponse('Undangan tidak ditemukan atau sudah diproses.');
        }

        try {
            ['group' => $group, 'auto_registered' => $autoRegistered] = $this->groupService->validateInvitationAcceptance($invitation, $user);

            DB::beginTransaction();
            $this->groupService->handleJoinGroup($user, $group);
            DB::commit();

            $response = [
                'message' => 'Invitation accepted.',
                'auto_registered' => $autoRegistered,
            ];

            if ($autoRegistered) {
                $response['message'] = "You have been automatically registered for {$group->period->name} and added to the group.";
            }

            return $this->successResponse($response);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->errorResponse('Failed to accept invitation: '.$e->getMessage(), 500);
        }
    }

    /**
     * Reject a group invitation.
     */
    public function rejectInvite(Request $request, $id)
    {
        $user = $request->user();
        $invitation = GroupInvitation::where('id', $id)
            ->where('student_id', $user->id)
            ->where('status', 'PENDING')
            ->first();

        if (! $invitation) {
            return $this->notFoundResponse('Undangan tidak ditemukan atau sudah diproses.');
        }

        $this->groupService->rejectInvitation($invitation, $user);

        return $this->successResponse(null, 'Invitation rejected.');
    }

    /**
     * Remove a member from the group (leader only).
     */
    public function removeMember(Request $request, $memberId)
    {
        try {
            $user = $request->user();

            $leaderMembership = GroupMember::where('student_id', $user->id)->first();
            if (! $leaderMembership) {
                return $this->errorResponse('Anda belum memiliki kelompok.', 400);
            }

            $group = Group::with('period')->find($leaderMembership->group_id);
            $this->groupService->removeMember($group, $user, $memberId);

            $group = Group::with('members.student')->find($leaderMembership->group_id);

            return $this->successResponse([
                'message' => 'Member removed',
                'group' => $this->groupService->buildCanonicalGroupPayload($group->load('period'), $user),
            ]);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to remove member: '.$e->getMessage(), 500);
        }
    }

    /**
     * Leave the group (non-leader only).
     */
    public function leaveGroup(Request $request)
    {
        try {
            $user = $request->user();

            $membership = GroupMember::where('student_id', $user->id)->first();

            if (! $membership) {
                return $this->errorResponse('Anda belum memiliki kelompok.', 400);
            }

            $group = Group::with('period')->find($membership->group_id);
            $groupDissolved = $this->groupService->leaveGroup($group, $user);

            return $this->successResponse([
                'message' => 'Anda telah keluar dari grup dan tidak memiliki kelompok aktif.',
                'group_dissolved' => $groupDissolved,
            ]);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->errorResponse('Gagal keluar dari grup: '.$e->getMessage(), 500);
        }
    }

    // ======================================================================
    // Supervisor Management
    // ======================================================================

    /**
     * Propose preferred supervisors (group leader only, when READY_FOR_BIDDING).
     */
    public function proposeSupervisors(ProposeSupervisorsRequest $request)
    {
        try {
            $user = $request->user();

            $leaderMembership = GroupMember::where('student_id', $user->id)->first();

            if (! $leaderMembership || ! $leaderMembership->is_leader) {
                return $this->unauthorizedResponse('Only the group leader can propose supervisors.');
            }

            $group = Group::with('period')->find($leaderMembership->group_id);
            $proposal = $this->groupService->proposeSupervisors(
                $group,
                $request->proposed_supervisor_1_id,
                $request->proposed_supervisor_2_id
            );

            return $this->successResponse([
                'message' => 'Supervisor proposal submitted.',
                'proposal' => $proposal->load(['supervisor1', 'supervisor2']),
            ]);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * [Admin] Assign Supervisor 2 (Dosbing 2) to a group. Admin exclusive.
     */
    public function assignSupervisor2(AssignSupervisor2Request $request, Group $group)
    {
        try {
            $group = $this->groupService->assignSupervisor2(
                $group,
                $request->supervisor_2_id,
                $request->user()
            );

            return $this->successResponse([
                'message' => 'Supervisor 2 assigned successfully.',
                'group' => $group,
            ]);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed: '.$e->getMessage(), 500);
        }
    }

    // ======================================================================
    // Finalization
    // ======================================================================

    /**
     * Leader marks group as ready for finalization.
     */
    public function markReadyForFinalization(Request $request)
    {
        try {
            $user = $request->user();
            $group = Group::findOrFail($request->input('group_id'));
            $this->groupService->markReadyForFinalization($group, $user);

            return $this->successResponse([
                'message' => 'Grup berhasil ditandai siap untuk finalisasi. Tunggu admin untuk finalisasi.',
                'group' => $this->groupService->buildCanonicalGroupPayload($group->fresh(['members.student', 'title', 'period']), $user),
            ]);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Cancel ready for finalization - revert from READY_FOR_FINALIZATION.
     */
    public function cancelReadyForFinalization(Request $request)
    {
        try {
            $user = $request->user();
            $group = Group::findOrFail($request->input('group_id'));
            $targetStatus = $this->groupService->cancelReadyForFinalization($group, $user);

            $statusLabel = $targetStatus === 'TITLE_APPROVED' ? 'Title Approved' : 'Ready for Bidding';

            return $this->successResponse([
                'message' => "Finalisasi berhasil dibatalkan. Kelompok kembali ke status {$statusLabel}.",
                'group' => $this->groupService->buildCanonicalGroupPayload($group->fresh(['members.student', 'title', 'period']), $user),
            ]);
        } catch (\App\Exceptions\DomainRuleException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    // ======================================================================
    // Supervisor Actions
    // ======================================================================

    /**
     * Flag a student from the group's period.
     */
    public function flagStudent(Request $request, Group $group): JsonResponse
    {
        $user = Auth::user();

        if (! $user->hasRole('dosen')) {
            return $this->unauthorizedResponse('Only lecturers can flag students.');
        }

        $isSupervisor = $group->supervisor_1_id === $user->id || $group->supervisor_2_id === $user->id;
        if (! $isSupervisor) {
            return $this->unauthorizedResponse('You are not a supervisor of this group.');
        }

        $validated = $request->validate([
            'student_id' => ['required', 'exists:users,id'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $student = \App\Models\User::findOrFail($validated['student_id']);
        $period = $group->period;

        if (! $period) {
            return $this->errorResponse('Group is not associated with a period.', 400);
        }

        app(StudentFlagService::class)->flagStudent(
            $period,
            $student,
            $user,
            $validated['reason'] ?? 'Flagged by supervisor'
        );

        return $this->successResponse([
            'message' => 'Student flagged successfully.',
            'student_id' => $student->id,
            'period_id' => $period->id,
        ]);
    }
}
