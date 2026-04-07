<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\GroupSupervisorProposal;
use App\Models\Supervision;
use App\Models\Title;
use App\Models\Period;
use App\Models\User;
use App\Models\Notification;
use App\Models\GroupInvitation;
use App\Services\GroupStateMachine;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GroupController extends Controller
{
    protected GroupStateMachine $stateMachine;
    protected \App\Services\GroupService $groupService;
    protected NotificationService $notificationService;

    public function __construct(GroupStateMachine $stateMachine, \App\Services\GroupService $groupService, NotificationService $notificationService)
    {
        $this->stateMachine = $stateMachine;
        $this->groupService = $groupService;
        $this->notificationService = $notificationService;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        
        // Get current active period to scope the query
        $currentPeriod = Period::where('is_active', true)
            ->orderBy('created_at', 'desc')
            ->first();

        $membership = GroupMember::where('student_id', $user->id)
            ->where('period_id', $currentPeriod?->id)
            ->whereHas('group', function ($q) {
                $q->whereNotIn('status', ['CLOSED']);
            })
            ->first();

        if (!$membership || !$currentPeriod) {
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
        $query = Group::with(['title', 'members.student', 'period', 'supervisions.supervisor']);

        if ($request->has('period_id')) {
            $query->where('period_id', $request->period_id);
        }

        $groups = $query->latest()->get();
        return response()->json(['data' => $groups]);
    }

    /**
     * List all available periods for student registration.
     * Criteria: Active and NOT Finalized.
     */
    public function availablePeriods()
    {
        $periods = Period::where('is_active', true)
            ->where('is_finalized', false)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['periods' => $periods]);
    }

    /**
     * Create a new group. Student becomes leader. Status = FORMING.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        // V5: Use provided period_id OR auto-resolve to the latest active, non-finalized period
        if ($request->has('period_id')) {
            $period = Period::where('id', $request->period_id)
                ->where('is_finalized', false)
                ->first();
        } else {
            $period = Period::where('is_active', true)
                ->where('is_finalized', false)
                ->orderBy('created_at', 'desc')
                ->first();
        }

        if (!$period) {
            return response()->json(['message' => 'Periode pendaftaran tidak ditemukan atau sudah ditutup.'], 400);
        }

        // ⚠ V4: Check student not already in a group for this specific period
        $existingMembership = GroupMember::where('student_id', $user->id)
            ->where('period_id', $period->id)
            ->exists();

        if ($existingMembership) {
            return response()->json(['message' => 'Anda sudah terdaftar di kelompok lain pada periode ini. Keluar dari kelompok lama terlebih dahulu.'], 400);
        }

        DB::beginTransaction();
        try {
            $group = Group::create([
                'title_id' => null,
                'period_id' => $period->id,
                'status' => 'FORMING',
                'group_mode' => $request->input('group_mode', 'GROUP'),
                'has_existing_group' => $request->boolean('has_existing_group', false),
            ])->refresh();

            GroupMember::create([
                'group_id' => $group->id,
                'student_id' => $user->id,
                'is_leader' => DB::raw('true'),
                'period_id' => $period->id, // V4: denormalized for unique constraint
            ]);

            // Auto-transition if 1 member meets min_group_size (unlikely but handle)
            $this->groupService->evaluateGroupReadiness($group);

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
     * Create a new group as a Solo Seeker. Status = FORMING.
     */
    public function storeSolo(Request $request)
    {
        $user = $request->user();

        // V5: Use provided period_id OR auto-resolve to the latest active, non-finalized period
        if ($request->has('period_id')) {
            $period = Period::where('id', $request->period_id)
                ->where('is_finalized', false)
                ->first();
        } else {
            $period = Period::where('is_active', true)
                ->where('is_finalized', false)
                ->orderBy('created_at', 'desc')
                ->first();
        }

        if (!$period) {
            return response()->json(['message' => 'Periode pendaftaran tidak ditemukan atau sudah ditutup.'], 400);
        }

        $existingMembership = GroupMember::where('student_id', $user->id)
            ->where('period_id', $period->id)
            ->exists();

        if ($existingMembership) {
            return response()->json(['message' => 'Anda sudah terdaftar di kelompok lain pada periode ini. Keluar dari kelompok lama terlebih dahulu.'], 400);
        }

        DB::beginTransaction();
        try {
            $group = Group::create([
                'title_id' => null,
                'period_id' => $period->id,
                'status' => 'FORMING_SOLO', // Fixed: Solo seekers should start as FORMING_SOLO
                'group_mode' => 'GROUP',
                'has_existing_group' => false,
                'is_solo' => true,
            ])->refresh();

            GroupMember::create([
                'group_id' => $group->id,
                'student_id' => $user->id,
                'is_leader' => DB::raw('true'),
                'period_id' => $period->id,
            ]);

            DB::commit();
            return response()->json([
                'message' => 'Solo group created successfully.',
                'group' => $group->load('members.student'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create solo group: ' . $e->getMessage()], 500);
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
            return response()->json(['message' => 'Anda belum memiliki kelompok. Buat atau bergabung dengan kelompok terlebih dahulu.'], 400);
        }

        if (!$membership->is_leader) {
            return response()->json(['message' => 'Hanya ketua kelompok yang dapat membubarkan kelompok.'], 403);
        }

        $group = Group::find($membership->group_id);

        $memberCount = GroupMember::where('group_id', $group->id)->count();
        if ($memberCount > 1) {
            return response()->json(['message' => 'Tidak dapat membubarkan kelompok dengan anggota lain. Keluarankan anggota terlebih dahulu.'], 400);
        }

        // Only allow deletion before KELOMPOK_FINAL
        if ($this->stateMachine->isAtLeast($group, 'KELOMPOK_FINAL')) {
            return response()->json(['message' => 'Kelompok sudah difinalisasi dan tidak dapat dibubarkan. Hubungi admin jika ada kebutuhan khusus.'], 400);
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
            return response()->json(['message' => 'Anda belum memiliki kelompok. Buat atau bergabung dengan kelompok terlebih dahulu.'], 400);
        }

        if (!$leaderMembership->is_leader) {
            return response()->json(['message' => 'Hanya ketua kelompok yang dapat menambahkan anggota.'], 403);
        }

        $group = Group::with('period')->find($leaderMembership->group_id);

        // Only allow adding members before KELOMPOK_FINAL
        if ($this->stateMachine->isAtLeast($group, 'KELOMPOK_FINAL')) {
            return response()->json(['message' => 'Kelompok sudah difinalisasi dan tidak dapat menambahkan anggota. Hubungi admin jika ada kebutuhan khusus.'], 400);
        }

        // Member limit from period config
        $maxMembers = $group->period->max_group_size ?? 4;
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        if ($memberCount >= $maxMembers) {
            return response()->json(['message' => "Kelompok sudah penuh. Maksimal {$maxMembers} anggota diperbolehkan."], 400);
        }

        // Find the student to add
        $student = User::where('email', $request->email)->where('role', 'mahasiswa')->first();
        if (!$student) {
            return response()->json(['message' => 'Mahasiswa tidak ditemukan.'], 404);
        }

        if ($student->id === $user->id) {
            return response()->json(['message' => 'Anda sudah berada di kelompok ini.'], 400);
        }

        // V4: Check if student is already in a STANDARD group for THIS period
        // We allow inviting students who are currently in Solo Seeker groups (FORMING or WAITING_APPROVAL)
        $inStandardGroup = GroupMember::where('student_id', $student->id)
            ->where('period_id', $group->period_id)
            ->whereHas('group', function ($q) {
                $q->whereNotIn('status', ['FORMING', 'WAITING_SUPERVISOR_APPROVAL']);
            })
            ->exists();

        if ($inStandardGroup) {
            return response()->json(['message' => 'Mahasiswa ini sudah terdaftar di kelompok lain pada periode ini.'], 400);
        }

        // Check if there's already a pending invitation
        $existingInvite = GroupInvitation::where('group_id', $group->id)
            ->where('student_id', $student->id)
            ->where('status', 'PENDING')
            ->exists();
        if ($existingInvite) {
            return response()->json(['message' => 'Undangan sudah dikirim sebelumnya. Tunggu mahasiswa tersebut merespon.'], 400);
        }

        DB::beginTransaction();
        try {
            $invitation = GroupInvitation::updateOrCreate(
                ['group_id' => $group->id, 'student_id' => $student->id],
                ['inviter_id' => $user->id, 'status' => 'PENDING']
            );

            // Send notification to student
            app(\App\Services\NotificationService::class)->send(
                $student->id,
                'GROUP_INVITATION',
                'Group Invitation',
                "{$user->name} invited you to join their capstone group.",
                'group_invitations',
                $invitation->id
            );

            DB::commit();
            return response()->json([
                'message' => 'Invitation sent successfully',
                'group' => $group->fresh()->load('members.student'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to send invitation: ' . $e->getMessage()], 500);
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

        if (!$invitation) {
            return response()->json(['message' => 'Undangan tidak ditemukan atau sudah diproses.'], 404);
        }

        $group = Group::with('period')->find($invitation->group_id);

        if (!$group || $group->status === 'CLOSED') {
            return response()->json(['message' => 'Kelompok tidak tersedia lagi.'], 400);
        }

        if ($this->stateMachine->isAtLeast($group, 'KELOMPOK_FINAL')) {
            return response()->json(['message' => 'Kelompok sudah difinalisasi dan tidak dapat bergabung. Hubungi admin jika ada kebutuhan khusus.'], 400);
        }

        // Check if user is in a STANDARD group
        $inStandardGroup = GroupMember::where('student_id', $user->id)
            ->where('period_id', $group->period_id)
            ->whereHas('group', function ($q) {
                $q->whereNotIn('status', ['FORMING', 'WAITING_SUPERVISOR_APPROVAL']);
            })
            ->exists();

        if ($inStandardGroup) {
            return response()->json(['message' => 'Anda sudah terdaftar di kelompok lain pada periode ini. Keluar dari kelompok lama terlebih dahulu.'], 400);
        }

        $maxMembers = $group->period->max_group_size ?? 4;
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        if ($memberCount >= $maxMembers) {
            return response()->json(['message' => 'Kelompok sudah penuh. Cari kelompok lain atau buat kelompok baru.'], 400);
        }

        DB::beginTransaction();
        try {
            $this->groupService->handleJoinGroup($user, $group);
            
            DB::commit();
            return response()->json(['message' => 'Invitation accepted.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to accept invitation: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Reject a group invitation.
     */
    public function rejectInvite(Request $request, $id)
    {
        $user = $request->user();
        $invitation = \App\Models\GroupInvitation::where('id', $id)
            ->where('student_id', $user->id)
            ->where('status', 'PENDING')
            ->first();

        if (!$invitation) {
            return response()->json(['message' => 'Undangan tidak ditemukan atau sudah diproses.'], 404);
        }

        $invitation->update(['status' => 'REJECTED']);

        app(\App\Services\NotificationService::class)->send(
            $invitation->inviter_id,
            'INVITE_REJECTED',
            'Invitation Rejected',
            "{$user->name} declined your group invitation.",
            'groups',
            $invitation->group_id
        );

        // Mark invitation notification as read
        Notification::where('user_id', $user->id)
            ->where('type', 'GROUP_INVITATION')
            ->where('related_id', $invitation->id)
            ->update(['is_read' => DB::raw('true')]);

        return response()->json(['message' => 'Invitation rejected.']);
    }

    /**
     * Remove a member from the group (leader only).
     */
    public function removeMember(Request $request, $memberId)
    {
        $user = $request->user();

        $leaderMembership = GroupMember::where('student_id', $user->id)->first();
        if (!$leaderMembership) {
            return response()->json(['message' => 'Anda belum memiliki kelompok.'], 400);
        }

        if (!$leaderMembership->is_leader) {
            return response()->json(['message' => 'Hanya ketua kelompok yang dapat mengeluarkan anggota.'], 403);
        }

        $member = GroupMember::where('id', $memberId)
            ->where('group_id', $leaderMembership->group_id)
            ->first();

        if (!$member) {
            return response()->json(['message' => 'Anggota tidak ditemukan di kelompok Anda.'], 404);
        }

        if ($member->student_id === $user->id) {
            return response()->json(['message' => 'Anda tidak dapat mengeluarkan diri sendiri.'], 400);
        }

        $group = Group::with('period')->find($leaderMembership->group_id);

        // After KELOMPOK_FINAL: require admin approval (handled separately)
        if ($this->stateMachine->isAtLeast($group, 'KELOMPOK_FINAL')) {
            return response()->json([
                'message' => 'Kelompok sudah difinalisasi dan tidak dapat mengeluarkan anggota. Hubungi admin jika ada kebutuhan khusus.',
            ], 400);
        }

        DB::beginTransaction();
        try {
            $memberStudent = User::find($member->student_id);
            $this->groupService->handleLeaveGroup($memberStudent);

            DB::commit();

            $group = Group::with('members.student')->find($leaderMembership->group_id);
            return response()->json(['message' => 'Member removed', 'group' => $group]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to remove member: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Leave the group (non-leader only).
     */
    public function leaveGroup(Request $request)
    {
        $user = $request->user();

        $membership = GroupMember::where('student_id', $user->id)->first();
        if (!$membership) {
            return response()->json(['message' => 'Anda belum memiliki kelompok.'], 400);
        }

        if ($membership->is_leader) {
            return response()->json(['message' => 'Ketua kelompok tidak dapat keluar. Bubarkan kelompok terlebih dahulu.'], 400);
        }

        $group = Group::with('period')->find($membership->group_id);

        if ($this->stateMachine->isAtLeast($group, 'KELOMPOK_FINAL')) {
            return response()->json(['message' => 'Kelompok sudah difinalisasi dan tidak dapat keluar. Hubungi admin jika ada kebutuhan khusus.'], 400);
        }

        DB::beginTransaction();
        try {
            $this->groupService->handleLeaveGroup($user);

            DB::commit();
            return response()->json(['message' => 'You have left the group.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to leave group: ' . $e->getMessage()], 500);
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
            ->first();

        if (!$leaderMembership || !$leaderMembership->is_leader) {
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
        if (!$sup1 || !$sup1->hasRole('dosen')) {
            return response()->json(['message' => 'Proposed supervisor 1 must be a lecturer.'], 400);
        }
        if ($request->proposed_supervisor_2_id) {
            $sup2 = User::find($request->proposed_supervisor_2_id);
            if (!$sup2 || !$sup2->hasRole('dosen')) {
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
        $query = Group::with(['title', 'members.student', 'period', 'supervisions.supervisor'])
            ->whereHas('supervisions', function ($query) use ($user) {
                $query->where('supervisor_id', $user->id)
                    ->whereIn('role', ['SUPERVISOR_1', 'SUPERVISOR_2']);
            });

        if ($request->has('period_id')) {
            $query->where('period_id', $request->period_id);
        }

        $groups = $query->get();

        $groups = $groups->map(function ($group) use ($user) {
            $supervision = $group->supervisions->firstWhere('supervisor_id', $user->id);
            $dosbing1 = $group->supervisions->firstWhere('role', 'SUPERVISOR_1');
            $dosbing2 = $group->supervisions->firstWhere('role', 'SUPERVISOR_2');

            $group->dosbing_1_name = $dosbing1?->supervisor?->name;
            $group->dosbing_2_name = $dosbing2?->supervisor?->name;
            $group->is_dosbing_1 = $supervision?->role === 'SUPERVISOR_1';
            $group->is_dosbing_2 = $supervision?->role === 'SUPERVISOR_2';

            return $group;
        });

        return response()->json(['data' => $groups]);
    }

    public function pendingGroups(Request $request)
    {
        $user = $request->user();
        $periodId = $request->query('period_id');

        // Use provided period_id or default to current active period
        if (!$periodId) {
            $currentPeriod = Period::where('is_active', true)
                ->orderBy('created_at', 'desc')
                ->first();
            $periodId = $currentPeriod?->id;
        }

        $groups = Group::with(['title', 'members.student'])
            ->whereHas('title', function ($query) use ($user) {
                $query->where('lecturer_id', $user->id);
            })
            ->where('status', 'READY_FOR_BIDDING');

        if ($periodId) {
            $groups->where('period_id', $periodId);
        }

        return response()->json(['data' => $groups->get()]);
    }

    /**
     * [Admin] Assign Supervisor 2 (Dosbing 2) to a group. Admin exclusive.
     */
    public function assignSupervisor2(Request $request, Group $group)
    {
        $request->validate([
            'supervisor_2_id' => 'required|exists:users,id',
        ]);

        $supervisor = User::findOrFail($request->supervisor_2_id);

        if (!$supervisor->hasRole('dosen')) {
            return response()->json(['message' => 'Supervisor 2 must be a lecturer.'], 400);
        }

        // Check not same as Supervisor 1
        if ($group->supervisor_1_id && $group->supervisor_1_id === $supervisor->id) {
            return response()->json(['message' => 'Supervisor 2 cannot be the same as Supervisor 1.'], 400);
        }

        DB::beginTransaction();
        try {
            // Update supervisions table
            Supervision::updateOrCreate(
                ['group_id' => $group->id, 'role' => 'SUPERVISOR_2'],
                [
                    'supervisor_id' => $supervisor->id,
                    'assigned_by' => $request->user()->id,
                ]
            );

            // Update cache on groups table
            $group->update(['supervisor_2_id' => $supervisor->id]);

            DB::commit();

            return response()->json([
                'message' => 'Supervisor 2 assigned successfully.',
                'group' => $group->fresh()->load(['supervisor1', 'supervisor2', 'supervisions.supervisor']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed: ' . $e->getMessage()], 500);
        }
    }

     /**
      * Leader marks group as ready for finalization.
      * Prerequisites:
      * - User must be group leader
      * - Group status must be FORMING_SOLO, READY_FOR_BIDDING, or TITLE_APPROVED
      * - Group must meet member count requirements (min & max from period)
      * - Group must have at least one accepted bid or approved proposal
      */
    public function markReadyForFinalization(Request $request, Group $group)
    {
        $user = $request->user();

        // Get user's membership
        $membership = GroupMember::where('student_id', $user->id)
            ->where('group_id', $group->id)
            ->first();

        if (!$membership) {
            return response()->json(['message' => 'Anda bukan anggota kelompok ini.'], 403);
        }

        if (!$membership->is_leader) {
            return response()->json(['message' => 'Hanya ketua kelompok yang dapat menandai siap finalisasi.'], 403);
        }

        // Check current status - now includes FORMING_SOLO
        if (!in_array($group->status, ['FORMING_SOLO', 'READY_FOR_BIDDING', 'TITLE_APPROVED'])) {
            return response()->json([
                'message' => 'Grup tidak dalam status yang dapat ditandai siap finalisasi. Status saat ini: ' . $group->status
            ], 400);
        }

        // Check period is active
        $period = $group->period;
        if (!$period || !$period->is_active) {
            return response()->json(['message' => 'Periode tidak aktif.'], 400);
        }

        // Check member count requirements
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        $minSize = $period->min_group_size ?? 3;
        $maxSize = $period->max_group_size ?? 4;

        if ($memberCount < $minSize) {
            return response()->json([
                'message' => "Anggota kurang dari batas minimum ({$memberCount}/{$minSize}). Tambahkan anggota terlebih dahulu."
            ], 400);
        }

        // Require exactly maximum members (must be full)
        if ($memberCount !== $maxSize) {
            return response()->json([
                'message' => "Anggota harus mencapai jumlah maksimal ({$memberCount}/{$maxSize}). Tambahkan atau kurangi anggota."
            ], 400);
        }

        // Check if group has at least one accepted bid or approved proposal
        $hasAcceptedBid = $group->bids()
            ->where('lecturer_recommendation', 'ACCEPT')
            ->exists();

        $hasApprovedProposal = \App\Models\Title::where('proposed_by_group_id', $group->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'APPROVED')
            ->exists();

        if (!$hasAcceptedBid && !$hasApprovedProposal) {
            return response()->json([
                'message' => 'Grup belum memiliki bid yang diterima atau proposal yang disetujui oleh dosen.'
            ], 400);
        }

        // Transition to READY_FOR_FINALIZATION
        try {
            $this->stateMachine->transition($group, 'READY_FOR_FINALIZATION');

            // Notify all members
            $this->notificationService->notifyGroupMembersOfFinalization($group);

            return response()->json([
                'message' => 'Grup berhasil ditandai siap untuk finalisasi. Tunggu admin untuk finalisasi.',
                'group' => $group->fresh(['members.student', 'title', 'period'])
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Cancel ready for finalization - revert from READY_FOR_FINALIZATION to READY_FOR_BIDDING
     */
    public function cancelReadyForFinalization(Request $request, Group $group)
    {
        $user = $request->user();

        // Get user's membership
        $membership = GroupMember::where('student_id', $user->id)
            ->where('group_id', $group->id)
            ->first();

        if (!$membership) {
            return response()->json(['message' => 'Anda bukan anggota kelompok ini.'], 403);
        }

        if (!$membership->is_leader) {
            return response()->json(['message' => 'Hanya ketua kelompok yang dapat membatalkan finalisasi.'], 403);
        }

        // Check current status
        if ($group->status !== 'READY_FOR_FINALIZATION') {
            return response()->json([
                'message' => 'Grup tidak dalam status siap finalisasi. Status saat ini: ' . $group->status
            ], 400);
        }

        // Check period is still active
        $period = $group->period;
        if (!$period || !$period->is_active) {
            return response()->json(['message' => 'Periode tidak aktif. Tidak dapat membatalkan finalisasi.'], 400);
        }

        // Transition back to READY_FOR_BIDDING
        try {
            $this->stateMachine->transition($group, 'READY_FOR_BIDDING');

            // Notify all members
            $this->notificationService->notifyGroupMembersOfCancellation($group);

            return response()->json([
                'message' => 'Finalisasi berhasil dibatalkan. Kelompok kembali ke status siap bidding.',
                'group' => $group->fresh(['members.student', 'title', 'period'])
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }
}
