<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\GroupSupervisorProposal;
use App\Models\Supervision;
use App\Models\Title;
use App\Models\Period;
use App\Models\User;
use App\Models\Notification;
use App\Models\GroupInvitation;
use App\Models\PeriodRegistration;
use App\Services\GroupStateMachine;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GroupController extends Controller
{
    use RequiresActivePeriod;

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
        
        // Determine which period to use
        $period = null;
        
        // 1. If period_id is provided in request, use it
        if ($request->has('period_id')) {
            $period = Period::find($request->period_id);
        }
        
        // 2. If no period_id, find the period the user is registered in
        if (!$period) {
            $registration = \App\Models\PeriodRegistration::where('user_id', $user->id)
                ->first();
            if ($registration) {
                $period = Period::find($registration->period_id);
            }
        }
        
        // 3. Fallback to current active period (backward compatibility)
        if (!$period) {
            $period = Period::where('is_active', true)
                ->orderBy('created_at', 'desc')
                ->first();
        }

        $membership = GroupMember::where('student_id', $user->id)
            ->where('period_id', $period?->id)
            ->whereHas('group', function ($q) {
                $q->whereNotIn('status', ['CLOSED']);
            })
            ->first();

        if (!$membership || !$period) {
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

        return response()->json(['group' => $this->buildCanonicalGroupPayload($group, $user)]);
    }

    public function listGroups(Request $request)
    {
        $query = Group::with(['title', 'members.student', 'period', 'supervisions.supervisor']);

        if ($request->has('period_id')) {
            $query->where('period_id', $request->period_id);
        }

        $groups = $query->latest()->get()->map(function (Group $group) {
            $groupArray = $group->toArray();
            $groupArray['name'] = $this->resolveAdminGroupName($group);
            $groupArray['status_label'] = $this->resolveAdminStatusLabel($group->status);
            $groupArray['allowed_actions'] = [
                'can_manage_finalization' => in_array($group->status, ['READY_FOR_FINALIZATION', 'KELOMPOK_FINAL', 'TITLE_APPROVED', 'READY_FOR_BIDDING'], true)
                    && !($group->period?->is_finalized),
                'reason' => $group->period?->is_finalized ? 'PERIOD_FINALIZED' : null,
            ];

            return $groupArray;
        });

        return response()->json(['data' => $groups]);
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

        // Apply period filter
        if ($periodId && $periodId !== 'all') {
            $query->where('period_id', $periodId);
        }

        // Apply status filter
        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        // Apply search filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('title', function ($titleQuery) use ($search) {
                    $titleQuery->where('title', 'like', "%{$search}%");
                })
                ->orWhereHas('members.student', function ($studentQuery) use ($search) {
                    $studentQuery->where('name', 'like', "%{$search}%")
                        ->orWhere('nim', 'like', "%{$search}%");
                });
            });
        }

        // Get paginated results
        $groups = $query->paginate($perPage, ['*'], 'page', $page);

        // Get all periods for the groups
        $periodIds = $groups->pluck('period_id')->unique()->filter();
        $allRequirements = \App\Models\PhaseDocumentRequirement::whereIn('period_id', $periodIds)
            ->where('is_required', true)
            ->get();

        // Transform the data with progress information
        $workflowService = app(\App\Services\WorkflowService::class);
        $stateMachine = app(\App\Services\GroupStateMachine::class);

        $transformedData = $groups->getCollection()->map(function (Group $group) use ($workflowService, $allRequirements, $stateMachine) {
            // Get documents for this group
            $documents = $group->documents ?? collect();
            $periodRequirements = $allRequirements->where('period_id', $group->period_id);

            // Calculate workflow data
            $progressData = null;
            if ($documents->isNotEmpty() || $periodRequirements->isNotEmpty()) {
                try {
                    $progressData = $workflowService->getWorkflowData($group, $documents, $periodRequirements);
                } catch (\Exception $e) {
                    // If workflow service fails, continue without progress data
                    \Illuminate\Support\Facades\Log::error('Failed to get workflow data', ['group_id' => $group->id, 'error' => $e->getMessage()]);
                }
            }

            // Calculate progress percentage based on status
            $statusOrder = [
                'FORMING', 'FORMING_SOLO', 'READY_FOR_BIDDING', 'TITLE_PROPOSED', 'TITLE_APPROVED',
                'READY_FOR_FINALIZATION', 'KELOMPOK_FINAL', 'PDC1_ACTIVE', 'READY_FOR_SEMPRO', 'SEMPRO_DONE',
                'PDC2_ACTIVE', 'PDC2_READY_FOR_EXPO', 'EXPO_REGISTERED', 'EXPO_DONE', 'READY_FOR_TA_INDIVIDUAL',
                'TA_IN_PROGRESS', 'CLOSED', 'DISSOLVED'
            ];
            $statusIndex = array_search($group->status, $statusOrder);
            $progressPercentage = $statusIndex !== false
                ? min(round((($statusIndex + 1) / count($statusOrder)) * 100), 100)
                : 0;

            // Count members
            $membersCount = $group->members?->count() ?? 0;

            return [
                'id' => $group->id,
                'name' => null, // Calculated on frontend or added if needed
                'status' => $group->status,
                'period_id' => $group->period_id,
                'period' => $group->period ? [
                    'id' => $group->period->id,
                    'name' => $group->period->name,
                    'is_active' => $group->period->is_active,
                ] : null,
                'title' => $group->title ? [
                    'id' => $group->title->id,
                    'title' => $group->title->title,
                ] : null,
                'supervisor1' => $group->supervisor1 ? [
                    'id' => $group->supervisor1->id,
                    'name' => $group->supervisor1->name,
                ] : null,
                'supervisor2' => $group->supervisor2 ? [
                    'id' => $group->supervisor2->id,
                    'name' => $group->supervisor2->name,
                ] : null,
                'members' => $group->members?->map(function ($member) {
                    return [
                        'id' => $member->id,
                        'student' => [
                            'id' => $member->student?->id,
                            'name' => $member->student?->name,
                            'nim' => $member->student?->nim,
                        ],
                    ];
                })->toArray() ?? [],
                'members_count' => $membersCount,
                'progress' => $progressData,
                'progress_percentage' => $progressPercentage,
            ];
        });

        // Create response with pagination meta
        return response()->json([
            'data' => $transformedData,
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
        $group->load([
            'title.lecturer',
            'members.student',
            'period',
            'supervisions.supervisor',
        ]);

        return response()->json(['data' => $group]);
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

        // ⚠ STRICT: Check student not already in ANY active group across all periods
        $anyExistingMembership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->whereNotIn('status', ['CLOSED', 'DISSOLVED']);
            })
            ->exists();

        if ($anyExistingMembership) {
            return response()->json(['message' => 'Anda sudah memiliki kelompok aktif. Hanya boleh 1 kelompok per mahasiswa.'], 400);
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
                'group' => $this->buildCanonicalGroupPayload($group->load('members.student', 'period'), $user),
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

        // ⚠ STRICT: Check student not already in ANY active group across all periods
        $anyExistingMembership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->whereNotIn('status', ['CLOSED', 'DISSOLVED']);
            })
            ->exists();

        if ($anyExistingMembership) {
            return response()->json(['message' => 'Anda sudah memiliki kelompok aktif. Hanya boleh 1 kelompok per mahasiswa.'], 400);
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
                'group' => $this->buildCanonicalGroupPayload($group->load('members.student', 'period'), $user),
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

        $this->ensurePeriodIsActive($group);

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

        $this->ensurePeriodIsActive($group);

        // LOCKED: After READY_FOR_FINALIZATION, cannot send invitations
        if ($this->stateMachine->isAtLeast($group, 'READY_FOR_FINALIZATION')) {
            return response()->json(['message' => 'Kelompok sudah terkunci (Ready for Finalization). Batalkan finalisasi terlebih dahulu untuk mengundang anggota.'], 400);
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
                'group' => $this->buildCanonicalGroupPayload($group->fresh()->load('members.student', 'period'), $user),
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

        $this->ensurePeriodIsActive($group);

        if (!$group || $group->status === 'CLOSED') {
            return response()->json(['message' => 'Kelompok tidak tersedia lagi.'], 400);
        }

        // Guard: finalized periods are closed for membership changes
        if ($group->period && $group->period->is_finalized) {
            return response()->json(['message' => 'Pendaftaran untuk periode ini sudah ditutup.'], 400);
        }

        // LOCKED: After READY_FOR_FINALIZATION, cannot accept new members
        if ($this->stateMachine->isAtLeast($group, 'READY_FOR_FINALIZATION')) {
            return response()->json(['message' => 'Kelompok sudah terkunci (Ready for Finalization) dan tidak menerima anggota baru.'], 400);
        }

        // SECURITY FIX: For solo seeker groups, check if title is still APPROVED
        // Prevent joining if the title has been withdrawn by lecturer
        if ($group->is_solo && $group->title_id) {
            $title = \App\Models\Title::find($group->title_id);
            if (!$title || $title->supervisor_approval_status !== 'APPROVED') {
                return response()->json(['message' => 'Judul kelompok ini telah dibatalkan oleh dosen. Tidak dapat bergabung.'], 400);
            }
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

        // Check if user is registered for the group's period
        // If not, auto-register them to maintain data consistency
        $isRegistered = PeriodRegistration::where('user_id', $user->id)
            ->where('period_id', $group->period_id)
            ->exists();

        $autoRegistered = false;
        if (!$isRegistered) {
            PeriodRegistration::create([
                'user_id' => $user->id,
                'period_id' => $group->period_id,
            ]);
            $autoRegistered = true;
        }

        DB::beginTransaction();
        try {
            $this->groupService->handleJoinGroup($user, $group);
            
            DB::commit();

            $response = [
                'message' => 'Invitation accepted.',
                'auto_registered' => $autoRegistered,
            ];

            if ($autoRegistered) {
                $response['message'] = "You have been automatically registered for {$group->period->name} and added to the group.";
            }

            return response()->json($response);
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

        $this->ensurePeriodIsActive($group);

        // LOCKED: After READY_FOR_FINALIZATION, cannot modify members (admin can bypass)
        if ($this->stateMachine->isAtLeast($group, 'READY_FOR_FINALIZATION') && !$user->hasRole('admin')) {
            return response()->json([
                'message' => 'Kelompok sudah terkunci (Ready for Finalization). Batalkan finalisasi terlebih dahulu untuk mengubah anggota.',
            ], 400);
        }

        DB::beginTransaction();
        try {
            $removedStudentId = $member->student_id;

            // 1. Hapus membership dari grup (tanpa membuat grup solo baru)
            $member->delete();

            // 2. Handle grup lama - update status sesuai jumlah anggota yang tersisa
            $remainingMembers = GroupMember::where('group_id', $group->id)->count();
            if ($remainingMembers === 0) {
                // Arsipkan grup jika kosong
                $group->update(['status' => 'DISSOLVED']);
                Log::info('group.lifecycle.dissolved', ['group_id' => $group->id]);
            } else {
                // Evaluasi ulang status grup (FORMING, READY_FOR_BIDDING, dll)
                $this->groupService->evaluateGroupReadiness($group);
            }

            // 3. Kirim notifikasi ke member yang di-kick
            Notification::create([
                'user_id' => $removedStudentId,
                'type' => 'REMOVED_FROM_GROUP',
                'title' => 'Dikeluarkan dari Grup',
                'message' => 'Anda telah dikeluarkan dari grup oleh ketua grup.',
                'related_type' => 'Group',
                'related_id' => $group->id,
            ]);

            DB::commit();

            $group = Group::with('members.student')->find($leaderMembership->group_id);
            return response()->json([
                'message' => 'Member removed',
                'group' => $this->buildCanonicalGroupPayload($group->load('period'), $user),
            ]);
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

        $this->ensurePeriodIsActive($group);

        if (!in_array($group->status, ['FORMING', 'FORMING_SOLO', 'WAITING_SUPERVISOR_APPROVAL'])) {
            return response()->json([
                'message' => 'Hanya dapat keluar sepenuhnya dari grup dengan status FORMING.',
                'current_status' => $group->status,
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Delete the membership completely (no solo group created)
            $membership->delete();

            // Handle old group
            $remainingMembers = GroupMember::where('group_id', $group->id)->count();
            if ($remainingMembers === 0) {
                // Archive the group by setting status to DISSOLVED
                $group->update(['status' => 'DISSOLVED']);
                Log::info('group.lifecycle.dissolved', ['group_id' => $group->id]);
            } else {
                $this->groupService->evaluateGroupReadiness($group);
            }

            DB::commit();
            return response()->json([
                'message' => 'Anda telah keluar dari grup dan tidak memiliki kelompok aktif.',
                'group_dissolved' => $remainingMembers === 0,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal keluar dari grup: ' . $e->getMessage()], 500);
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

        $this->ensurePeriodIsActive($group);

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
        $this->ensurePeriodIsActive($group);

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
    public function markReadyForFinalization(Request $request)
    {
        $user = $request->user();

        $group = Group::findOrFail($request->input('group_id'));

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

        // Require minimum members met (between min and max)
        if ($memberCount < $minSize || $memberCount > $maxSize) {
            return response()->json([
                'message' => "Jumlah anggota harus antara {$minSize}-{$maxSize} orang (saat ini: {$memberCount})."
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
                'group' => $this->buildCanonicalGroupPayload($group->fresh(['members.student', 'title', 'period']), $user),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Cancel ready for finalization - revert from READY_FOR_FINALIZATION to READY_FOR_BIDDING
     */
    public function cancelReadyForFinalization(Request $request)
    {
        $user = $request->user();

        $group = Group::findOrFail($request->input('group_id'));

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

        // Determine target status based on group's title ownership
        // If group has their own approved proposal (solo seeker), revert to TITLE_APPROVED
        // Otherwise, revert to READY_FOR_BIDDING
        
        // SECURITY FIX: Check the actual title's approval status, not just ownership
        $hasOwnApprovedTitle = false;
        if ($group->title_id) {
            $title = \App\Models\Title::find($group->title_id);
            // Title must be APPROVED and either be student-proposed by this group OR assigned to them
            if ($title && $title->supervisor_approval_status === 'APPROVED') {
                $hasOwnApprovedTitle = true;
            }
        }

        $targetStatus = $hasOwnApprovedTitle ? 'TITLE_APPROVED' : 'READY_FOR_BIDDING';

        // Transition back to previous status
        try {
            $this->stateMachine->transition($group, $targetStatus);

            // Notify all members
            $this->notificationService->notifyGroupMembersOfCancellation($group);

            $statusLabel = $targetStatus === 'TITLE_APPROVED' ? 'Title Approved' : 'Ready for Bidding';

            return response()->json([
                'message' => "Finalisasi berhasil dibatalkan. Kelompok kembali ke status {$statusLabel}.",
                'group' => $this->buildCanonicalGroupPayload($group->fresh(['members.student', 'title', 'period']), $user),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    private function buildCanonicalGroupPayload(Group $group, User $user): array
    {
        $groupArray = $group->toArray();
        $groupArray['status_label'] = $this->resolveStatusLabel($group);
        $groupArray['allowed_actions'] = $this->resolveAllowedActions($group, $user);

        return $groupArray;
    }

    private function resolveStatusLabel(Group $group): string
    {
        if ($group->status === 'READY_FOR_BIDDING') {
            return $group->title_id ? 'Ready for Finalization' : 'Ready for Bidding';
        }

        return match ($group->status) {
            'FORMING' => 'Incomplete Group',
            'FORMING_SOLO' => 'Solo Seeker',
            'WAITING_SUPERVISOR_APPROVAL' => 'Waiting Supervisor Approval',
            'TITLE_APPROVED' => 'Title Approved',
            'READY_FOR_FINALIZATION' => 'Ready for Finalization',
            default => str_replace('_', ' ', $group->status),
        };
    }

    private function resolveAdminStatusLabel(string $status): string
    {
        return match ($status) {
            'FORMING' => 'Incomplete Group',
            'FORMING_SOLO' => 'Solo Seeker',
            'READY_FOR_BIDDING' => 'Ready for Bidding',
            'WAITING_SUPERVISOR_APPROVAL' => 'Waiting Supervisor Approval',
            'TITLE_APPROVED' => 'Title Approved',
            'READY_FOR_FINALIZATION' => 'Ready for Finalization',
            'KELOMPOK_FINAL' => 'Kelompok Final',
            'PDC1_ACTIVE' => 'PDC1 Active',
            'PDC2_ACTIVE' => 'PDC2 Active',
            default => str_replace('_', ' ', $status),
        };
    }

    private function resolveAdminGroupName(Group $group): string
    {
        $name = trim((string) ($group->name ?? ''));

        if ($name !== '') {
            return $name;
        }

        return $group->code ?? "Kelompok #{$group->id}";
    }

    private function resolveAllowedActions(Group $group, User $user): array
    {
        $period = $group->period;
        $memberCount = $group->members()->count();
        $minSize = $period?->min_group_size ?? 3;
        $maxSize = $period?->max_group_size ?? 4;
        $isLocked = $this->stateMachine->isAtLeast($group, 'READY_FOR_FINALIZATION');
        $isLeader = GroupMember::where('student_id', $user->id)
            ->where('group_id', $group->id)
            ->where('is_leader', true)
            ->exists();

        $hasAcceptedBid = $group->bids()
            ->where('lecturer_recommendation', 'ACCEPT')
            ->exists();

        $hasApprovedProposal = Title::where('proposed_by_group_id', $group->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'APPROVED')
            ->exists();

        $canMarkReady = $isLeader
            && in_array($group->status, ['FORMING_SOLO', 'READY_FOR_BIDDING', 'TITLE_APPROVED'])
            && $period?->is_active
            && $memberCount >= $minSize
            && $memberCount <= $maxSize
            && ($hasAcceptedBid || $hasApprovedProposal);

        return [
            'can_add_member' => $isLeader && !$isLocked && $memberCount < $maxSize,
            'can_remove_member' => $isLeader && !$isLocked && $memberCount > 1,
            'can_leave_group' => !$isLeader && !$isLocked,
            'can_delete_group' => $isLeader
                && in_array($group->status, ['FORMING', 'FORMING_SOLO', 'READY_FOR_BIDDING', 'TITLE_APPROVED'])
                && $memberCount <= 1,
            'can_mark_ready_for_finalization' => $canMarkReady,
            'can_cancel_ready_for_finalization' => $isLeader
                && $group->status === 'READY_FOR_FINALIZATION'
                && (bool) ($period?->is_active),
        ];
    }
}
