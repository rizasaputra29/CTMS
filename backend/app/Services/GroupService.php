<?php

namespace App\Services;

use App\Concerns\RequiresActivePeriod;
use App\Exceptions\ConflictRuleException;
use App\Exceptions\DomainRuleException;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\GroupInvitation;
use App\Models\GroupMember;
use App\Models\GroupSupervisorProposal;
use App\Models\JoinRequest;
use App\Models\Notification;
use App\Models\Period;
use App\Models\PeriodRegistration;
use App\Models\Supervision;
use App\Models\Title;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class GroupService
{
    use RequiresActivePeriod;

    // Status Constants
    public const STATUS_FORMING = 'FORMING';

    public const STATUS_FORMING_SOLO = 'FORMING_SOLO';

    public const STATUS_WAITING_SUPERVISOR_APPROVAL = 'WAITING_SUPERVISOR_APPROVAL';

    public const STATUS_READY_FOR_TITLE_BIDDING = 'READY_FOR_BIDDING';

    public const STATUS_KELOMPOK_FINAL = 'KELOMPOK_FINAL';

    public const STATUS_DISSOLVED = 'DISSOLVED';

    protected GroupStateMachine $stateMachine;

    protected NotificationService $notificationService;

    public function __construct(GroupStateMachine $stateMachine, NotificationService $notificationService)
    {
        $this->stateMachine = $stateMachine;
        $this->notificationService = $notificationService;
    }

    /**
     * Enterprise Entry Point: Handle a student joining a group.
     * Guaranteed atomic and concurrency-safe.
     */
    public function handleJoinGroup(User $student, Group $targetGroup): void
    {
        $startTime = microtime(true);

        // 1. Unified Logging Context (Tracing)
        Log::shareContext([
            'request_id' => Str::uuid(),
            'student_id' => $student->id,
            'group_id' => $targetGroup->id,
        ]);

        Log::info('group.join.attempt');

        // SAFETY CHECK: Locked groups cannot accept new members
        if ($this->stateMachine->isAtLeast($targetGroup, 'READY_FOR_FINALIZATION')) {
            throw new DomainRuleException('Kelompok sudah terkunci (Ready for Finalization) dan tidak menerima anggota baru.');
        }

        $this->ensurePeriodIsActive($targetGroup);

        // 2. Pre-validation & Idempotency (Fast Path)
        $this->validateJoinRequest($student, $targetGroup);

        $isAlreadyMember = GroupMember::where('student_id', $student->id)
            ->where('group_id', $targetGroup->id)
            ->exists();

        if ($isAlreadyMember) {
            throw new ConflictRuleException('Anda sudah terdaftar di kelompok ini. Hubungi ketua kelompok jika ada masalah.');
        }

        // 3. Selective Retry with Exponential Backoff
        try {
            retry(3, function () use ($student, $targetGroup) {
                DB::transaction(function () use ($student, $targetGroup) {
                    // A. Global Lock Order (User -> Group -> Pivot)
                    $lockedStudent = User::where('id', $student->id)->lockForUpdate()->first();
                    $lockedGroup = Group::where('id', $targetGroup->id)->lockForUpdate()->first();

                    // Re-check idempotency inside transaction (Hard Guarantee)
                    if (GroupMember::where('student_id', $lockedStudent->id)->where('group_id', $lockedGroup->id)->exists()) {
                        throw new ConflictRuleException('Anda sudah terdaftar di kelompok ini. Hubungi ketua kelompok jika ada masalah.');
                    }

                    // B. Validate Capacity (Source Team + Target Team)
                    $sourceMembership = GroupMember::where('student_id', $lockedStudent->id)
                        ->where('period_id', $lockedGroup->period_id)
                        ->first();

                    $sourceMemberCount = $sourceMembership ? GroupMember::where('group_id', $sourceMembership->group_id)->count() : 1;
                    $targetMemberCount = GroupMember::where('group_id', $lockedGroup->id)->count();

                    $maxMembers = $lockedGroup->period->max_group_size ?? 4;
                    if (($sourceMemberCount + $targetMemberCount) > $maxMembers) {
                        throw new DomainRuleException('Kelompok penuh. Total anggota akan melebihi batas maksimal ('.($maxMembers).' orang). Kurangi anggota yang dibawa atau cari kelompok lain.');
                    }

                    // C. Migrate & Attach
                    $this->migrateStudentAndTeam($lockedStudent, $lockedGroup);
                    $this->attachToGroup($lockedStudent, $lockedGroup);
                    $this->evaluateGroupReadiness($lockedGroup);
                });
            }, fn ($attempt) => 100 * $attempt, function ($e) {
                return $e instanceof QueryException;
            });

            $durationMs = (microtime(true) - $startTime) * 1000;
            DB::afterCommit(fn () => Log::info('group.join.success', ['duration_ms' => round($durationMs, 2)]));

        } catch (Throwable $e) {
            Log::error('group.join.failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    /**
     * Enterprise Entry Point: Handle a student leaving a group.
     */
    public function handleLeaveGroup(User $student): void
    {
        $startTime = microtime(true);
        Log::shareContext([
            'request_id' => Str::uuid(),
            'student_id' => $student->id,
        ]);

        Log::info('group.leave.attempt');

        try {
            retry(3, function () use ($student) {
                DB::transaction(function () use ($student) {
                    $lockedStudent = User::where('id', $student->id)->lockForUpdate()->first();

                    $membership = GroupMember::where('student_id', $lockedStudent->id)
                        ->whereHas('group', fn ($q) => $q->where('status', '!=', 'CLOSED'))
                        ->lockForUpdate()
                        ->first();

                    if (! $membership) {
                        return; // Idempotency
                    }

                    $oldGroup = Group::where('id', $membership->group_id)->lockForUpdate()->first();

                    $this->ensurePeriodIsActive($oldGroup);

                    // LOCKED: After READY_FOR_FINALIZATION, cannot leave group
                    if ($this->stateMachine->isAtLeast($oldGroup, 'READY_FOR_FINALIZATION')) {
                        throw new DomainRuleException('Kelompok sudah terkunci (Ready for Finalization). Tidak dapat keluar dari kelompok.');
                    }

                    $periodId = $oldGroup->period_id;

                    // A. Detach from current group
                    $membership->delete();

                    // B. Create new solo group (Automigration to Solo Seeker)
                    $newSoloGroup = Group::create([
                        'period_id' => $periodId,
                        'status' => self::STATUS_FORMING,
                        'group_mode' => 'GROUP',
                        'has_existing_group' => true,
                    ]);

                    GroupMember::create([
                        'group_id' => $newSoloGroup->id,
                        'student_id' => $lockedStudent->id,
                        'is_leader' => true,
                        'period_id' => $periodId,
                    ]);

                    // C. Handle Old Group
                    $remainingMembers = GroupMember::where('group_id', $oldGroup->id)->count();
                    if ($remainingMembers === 0) {
                        $this->archiveGroup($oldGroup);
                    } else {
                        $this->evaluateGroupReadiness($oldGroup);
                    }
                });
            }, fn ($attempt) => 100 * $attempt, function ($e) {
                return $e instanceof QueryException;
            });

            $durationMs = (microtime(true) - $startTime) * 1000;
            DB::afterCommit(fn () => Log::info('group.leave.success', ['duration_ms' => round($durationMs, 2)]));

        } catch (Throwable $e) {
            Log::error('group.leave.failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    /**
     * Validate if a student can join a target group.
     */
    public function validateJoinRequest(User $student, Group $group): void
    {
        if ($student->role !== 'mahasiswa') {
            throw new DomainRuleException('Hanya mahasiswa yang dapat bergabung ke dalam kelompok. Login sebagai mahasiswa terlebih dahulu.');
        }

        if ($group->period->is_finalized) {
            throw new DomainRuleException('Periode pendaftaran ini sudah ditutup. Hubungi admin jika ada kebutuhan khusus.');
        }

        if (! $group->period->is_active) {
            throw new DomainRuleException('Periode tidak aktif. Operasi tidak diizinkan.');
        }

        if ($this->stateMachine->isAtLeast($group, self::STATUS_KELOMPOK_FINAL)) {
            throw new DomainRuleException('Kelompok sudah difinalisasi dan tidak menerima anggota baru. Hubungi admin jika ada kebutuhan khusus.');
        }

        // 4. Already In Group (Idempotency)
        $existingMembership = GroupMember::where('student_id', $student->id)
            ->where('period_id', $group->period_id)
            ->first();

        if ($existingMembership && $existingMembership->group_id === $group->id) {
            return; // Idempotent success
        }

        if ($existingMembership && ! in_array($existingMembership->group->status, [self::STATUS_FORMING, self::STATUS_FORMING_SOLO, self::STATUS_WAITING_SUPERVISOR_APPROVAL])) {
            throw new DomainRuleException('Anda sudah terdaftar di kelompok lain pada periode ini. Keluar dari kelompok lama terlebih dahulu.');
        }

        // If they have a "FORMING" group but it's not a solo group (more than 1 member), they can't leave easily by joining another
        if ($existingMembership && $existingMembership->group->status === self::STATUS_FORMING) {
            $memberCount = GroupMember::where('group_id', $existingMembership->group_id)->count();
            if ($memberCount > 1 && ! $existingMembership->is_leader) {
                throw new DomainRuleException('Hanya ketua kelompok yang dapat memindahkan seluruh anggota ke kelompok lain.');
            }
        }
    }

    /**
     * Migrate a student (and their entire team if they are the leader) to a new group.
     */
    private function migrateStudentAndTeam(User $student, Group $targetGroup): void
    {
        $membership = GroupMember::where('student_id', $student->id)
            ->where('period_id', $targetGroup->period_id)
            ->first();

        if (! $membership) {
            return;
        }

        $sourceGroup = Group::with('members')->find($membership->group_id);
        if (! $sourceGroup) {
            return;
        }

        // Cleanup Data (Source Group)
        $this->cleanupSoloGroupData($sourceGroup, $student);

        $members = $sourceGroup->members;

        foreach ($members as $m) {
            if ($m->student_id === $student->id) {
                // Requester: will be attached in next step of handleJoinGroup
                $m->delete();
            } else {
                // Team members: Bulk move to target group
                $m->update([
                    'group_id' => $targetGroup->id,
                    'is_leader' => false, // Hard rule: Target idea owner remains leader
                ]);
            }
        }

        // Delete Source Group
        $sourceGroup->delete();

        Log::info('group.migration.merged', [
            'student_id' => $student->id,
            'source_group_id' => $sourceGroup->id,
            'target_group_id' => $targetGroup->id,
            'member_count' => $members->count(),
        ]);
    }

    private function cleanupSoloGroupData(Group $group, User $student): void
    {
        // Cancel Associated Titles
        $titles = Title::where('proposed_by_group_id', $group->id)->get();
        foreach ($titles as $title) {
            /** @var \App\Models\Title $title */
            $this->cancelAssociatedTitle($title, $student);
        }

        // Remove Bids & Proposals
        $group->bids()->delete();
        $group->supervisorProposals()->delete();

        // Invalidate Join Requests
        JoinRequest::where('group_id', $group->id)->update(['status' => 'INVALIDATED']);
    }

    private function cancelAssociatedTitle(Title $title, User $student): void
    {
        $oldStatus = $title->supervisor_approval_status;
        $title->update([
            'proposed_by_group_id' => null,
            'supervisor_approval_status' => 'CANCELED',
        ]);

        // Notify Lecturer (Isolate side-effect via afterCommit)
        if ($title->proposed_supervisor_id && $oldStatus === 'UNDER_REVIEW') {
            DB::afterCommit(function () use ($title, $student) {
                $this->notificationService->send(
                    $title->proposed_supervisor_id,
                    'PROPOSAL_CANCELED',
                    'Solo Proposal Canceled',
                    "Proposal dari {$student->name} dibatalkan karena yang bersangkutan bergabung ke grup lain.",
                    'titles',
                    $title->id
                );
            });
        }
    }

    /**
     * Link student to the target group.
     */
    private function attachToGroup(User $student, Group $group): void
    {
        GroupMember::create([
            'group_id' => $group->id,
            'student_id' => $student->id,
            'is_leader' => false,
            'period_id' => $group->period_id,
        ]);

        // Cleanup other pending invites/requests for this student
        JoinRequest::where('requester_id', $student->id)
            ->where('status', 'PENDING')
            ->update(['status' => 'INVALIDATED']);

        GroupInvitation::where('student_id', $student->id)
            ->where('status', 'PENDING')
            ->whereHas('group', fn ($q) => $q->where('period_id', $group->period_id))
            ->update(['status' => 'REJECTED']);

        Log::info('group.attach.success', ['student_id' => $student->id, 'group_id' => $group->id]);
    }

    /**
     * Strict State Transition: Evaluate if group is ready for bidding.
     */
    public function evaluateGroupReadiness(Group $group): void
    {
        $this->ensurePeriodIsActive($group);

        // IMPORTANT: Refresh to get latest status from DB (avoid stale data from eager loading)
        $group->refresh();

        // Guard: Skip if already finalized, dissolved, or has approved title (solo seeker waiting for leader to finalize)
        if ($this->stateMachine->isAtLeast($group, self::STATUS_KELOMPOK_FINAL) || $group->status === 'TITLE_APPROVED' || $group->status === self::STATUS_DISSOLVED) {
            return;
        }

        if ($this->canBecomeReady($group)) {
            $this->transitionToReady($group);
        } else {
            // Case: group was READY but member left -> demote back to FORMING or FORMING_SOLO based on is_solo flag
            $memberCount = GroupMember::where('group_id', $group->id)->count();
            $revertStatus = ($memberCount === 1 && $group->is_solo) ? self::STATUS_FORMING_SOLO : self::STATUS_FORMING;
            $group->update(['status' => $revertStatus]);
        }
    }

    private function canBecomeReady(Group $group): bool
    {
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        $period = $group->period;
        $minSize = $group->group_mode === 'INDIVIDUAL' ? 1 : ($period->min_group_size ?? 3);

        if ($memberCount < $minSize) {
            return false;
        }

        // SECURITY FIX: For solo seeker groups, verify title is still APPROVED
        // Prevent transition to READY if title has been withdrawn
        if ($group->is_solo && $group->title_id) {
            $title = Title::find($group->title_id);
            if (! $title || $title->supervisor_approval_status !== 'APPROVED') {
                return false; // Title not approved, cannot become ready
            }
        }

        // Atomic Validation: Check Quota if title exists
        $preApprovedTitle = Title::where('proposed_by_group_id', $group->id)
            ->where('supervisor_approval_status', 'UNDER_REVIEW')
            ->first();

        if ($preApprovedTitle) {
            $lecturerId = $preApprovedTitle->proposed_supervisor_id;
            $maxLoad = $period->supervisorLoadLimit(8);

            $currentLoad = Supervision::where('supervisor_id', $lecturerId)
                ->whereHas('group', fn ($q) => $q->where('period_id', $period->id))
                ->count();

            $approvedProposals = Title::where('proposed_supervisor_id', $lecturerId)
                ->where('supervisor_approval_status', 'APPROVED')
                ->whereHas('proposedByGroup', fn ($q) => $q->where('period_id', $period->id))
                ->count();

            if (($currentLoad + $approvedProposals) >= $maxLoad) {
                return false; // Quota full, cannot become READY with this title
            }
        }

        return true;
    }

    private function transitionToReady(Group $group): void
    {
        // Guard: Skip if already at target status (avoid same-state transition error)
        if ($group->status === self::STATUS_READY_FOR_TITLE_BIDDING) {
            Log::info('group.readiness.skipped', ['group_id' => $group->id, 'reason' => 'already_ready']);

            return;
        }

        $preApprovedTitle = Title::where('proposed_by_group_id', $group->id)
            ->where('supervisor_approval_status', 'UNDER_REVIEW')
            ->first();

        if ($preApprovedTitle) {
            $preApprovedTitle->update(['supervisor_approval_status' => 'APPROVED']);
            $group->update(['title_id' => $preApprovedTitle->id]);
        }

        $this->stateMachine->transition($group, self::STATUS_READY_FOR_TITLE_BIDDING);

        Log::info('group.readiness.transitioned', ['group_id' => $group->id, 'status' => self::STATUS_READY_FOR_TITLE_BIDDING]);
    }

    /**
     * Mark a group as dissolved (audit trail preserved).
     */
    private function archiveGroup(Group $group): void
    {
        $group->update(['status' => self::STATUS_DISSOLVED]);
        Log::info('group.lifecycle.dissolved', ['group_id' => $group->id]);
    }

    // ======================================================================
    // Period Resolution
    // ======================================================================

    /**
     * Resolve the active, non-finalized period for group operations.
     */
    public function resolvePeriod(?int $periodId): Period
    {
        if ($periodId) {
            $period = Period::where('id', $periodId)->where('is_finalized', false)->first();
        } else {
            $period = Period::where('is_active', true)
                ->where('is_finalized', false)
                ->orderBy('created_at', 'desc')
                ->first();
        }

        if (! $period) {
            throw new DomainRuleException('Periode pendaftaran tidak ditemukan atau sudah ditutup.');
        }

        return $period;
    }

    /**
     * Resolve the period for the user's group context (with registration fallback).
     */
    public function resolveUserGroupPeriod(int $userId, ?int $periodId): ?Period
    {
        $period = null;

        if ($periodId) {
            $period = Period::find($periodId);
        }

        if (! $period) {
            $registration = PeriodRegistration::where('user_id', $userId)->first();
            if ($registration) {
                $period = Period::find($registration->period_id);
            }
        }

        if (! $period) {
            $period = Period::where('is_active', true)
                ->orderBy('created_at', 'desc')
                ->first();
        }

        return $period;
    }

    // ======================================================================
    // Status Resolution
    // ======================================================================

    /**
     * Resolve human-readable status label for student view.
     */
    public function resolveStatusLabel(Group $group): string
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

    /**
     * Resolve human-readable status label for admin view.
     */
    public function resolveAdminStatusLabel(string $status): string
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

    /**
     * Resolve group name for admin view.
     */
    public function resolveAdminGroupName(Group $group): string
    {
        $name = trim((string) ($group->name ?? ''));

        if ($name !== '') {
            return $name;
        }

        return $group->code ?? "Kelompok #{$group->id}";
    }

    /**
     * Build canonical group payload with status label and allowed actions.
     */
    public function buildCanonicalGroupPayload(Group $group, User $user): array
    {
        $groupArray = $group->toArray();
        $groupArray['status_label'] = $this->resolveStatusLabel($group);
        $groupArray['allowed_actions'] = $this->resolveAllowedActions($group, $user);

        return $groupArray;
    }

    /**
     * Resolve allowed actions based on group state, membership, and period.
     */
    public function resolveAllowedActions(Group $group, User $user): array
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
            'can_add_member' => $isLeader && ! $isLocked && $memberCount < $maxSize,
            'can_remove_member' => $isLeader && ! $isLocked && $memberCount > 1,
            'can_leave_group' => ! $isLeader && ! $isLocked,
            'can_delete_group' => $isLeader
                && in_array($group->status, ['FORMING', 'FORMING_SOLO', 'READY_FOR_BIDDING', 'TITLE_APPROVED'])
                && $memberCount <= 1,
            'can_mark_ready_for_finalization' => $canMarkReady,
            'can_cancel_ready_for_finalization' => $isLeader
                && $group->status === 'READY_FOR_FINALIZATION'
                && (bool) ($period?->is_active),
        ];
    }

    // ======================================================================
    // Group CRUD
    // ======================================================================

    /**
     * Ensure student has no existing active membership.
     */
    private function ensureNoExistingMembership(User $user, int $periodId): void
    {
        $existingMembership = GroupMember::where('student_id', $user->id)
            ->where('period_id', $periodId)
            ->exists();

        if ($existingMembership) {
            throw new DomainRuleException('Anda sudah terdaftar di kelompok lain pada periode ini. Keluar dari kelompok lama terlebih dahulu.');
        }

        $anyExistingMembership = GroupMember::where('student_id', $user->id)
            ->whereHas('group', fn ($q) => $q->whereNotIn('status', ['CLOSED', 'DISSOLVED']))
            ->exists();

        if ($anyExistingMembership) {
            throw new DomainRuleException('Anda sudah memiliki kelompok aktif. Hanya boleh 1 kelompok per mahasiswa.');
        }
    }

    /**
     * Create a new group. Student becomes leader. Status = FORMING.
     */
    public function createGroup(User $user, ?int $periodId, string $groupMode, bool $hasExistingGroup): Group
    {
        return DB::transaction(function () use ($user, $periodId, $groupMode, $hasExistingGroup) {
            $period = $this->resolvePeriod($periodId);

            $this->ensureNoExistingMembership($user, $period->id);

            $group = Group::create([
                'title_id' => null,
                'period_id' => $period->id,
                'status' => 'FORMING',
                'group_mode' => $groupMode,
                'has_existing_group' => $hasExistingGroup,
            ])->refresh();

            GroupMember::create([
                'group_id' => $group->id,
                'student_id' => $user->id,
                'is_leader' => true,
                'period_id' => $period->id,
            ]);

            $this->evaluateGroupReadiness($group);

            return $group->load('members.student', 'period');
        });
    }

    /**
     * Create a new solo seeker group. Status = FORMING_SOLO.
     */
    public function createSoloGroup(User $user, ?int $periodId): Group
    {
        return DB::transaction(function () use ($user, $periodId) {
            $period = $this->resolvePeriod($periodId);

            $this->ensureNoExistingMembership($user, $period->id);

            $group = Group::create([
                'title_id' => null,
                'period_id' => $period->id,
                'status' => 'FORMING_SOLO',
                'group_mode' => 'GROUP',
                'has_existing_group' => false,
                'is_solo' => true,
            ])->refresh();

            GroupMember::create([
                'group_id' => $group->id,
                'student_id' => $user->id,
                'is_leader' => true,
                'period_id' => $period->id,
            ]);

            return $group->load('members.student', 'period');
        });
    }

    /**
     * Delete a group (leader only, before finalization).
     */
    public function deleteGroup(Group $group, User $user): void
    {
        $membership = GroupMember::where('student_id', $user->id)
            ->where('group_id', $group->id)
            ->first();

        if (! $membership) {
            throw new DomainRuleException('Anda belum memiliki kelompok. Buat atau bergabung dengan kelompok terlebih dahulu.');
        }

        if (! $membership->is_leader) {
            throw new DomainRuleException('Hanya ketua kelompok yang dapat membubarkan kelompok.');
        }

        $this->ensurePeriodIsActive($group);

        $memberCount = GroupMember::where('group_id', $group->id)->count();
        if ($memberCount > 1) {
            throw new DomainRuleException('Tidak dapat membubarkan kelompok dengan anggota lain. Keluarankan anggota terlebih dahulu.');
        }

        if ($this->stateMachine->isAtLeast($group, self::STATUS_KELOMPOK_FINAL)) {
            throw new DomainRuleException('Kelompok sudah difinalisasi dan tidak dapat dibubarkan. Hubungi admin jika ada kebutuhan khusus.');
        }

        DB::transaction(function () use ($group) {
            Title::where('proposed_by_group_id', $group->id)
                ->where('title_source', 'STUDENT')
                ->delete();

            $group->bids()->delete();
            $group->supervisorProposals()->delete();
            GroupMember::where('group_id', $group->id)->delete();
            $group->delete();
        });
    }

    /**
     * Admin force-delete a group with full cascade and audit logging.
     *
     * @return int Number of affected students
     */
    public function adminDeleteGroup(Group $group, User $admin): int
    {
        $period = $group->period;
        $canDelete = false;

        if (! $period) {
            $canDelete = true;
        } elseif (! $period->is_active) {
            $canDelete = true;
        } elseif (in_array($group->status, ['FORMING', 'FORMING_SOLO'])) {
            $canDelete = true;
        }

        if (! $canDelete) {
            throw new DomainRuleException('Cannot delete group: must be inactive period or group in FORMING/FORMING_SOLO status. Current status: '.$group->status);
        }

        $affectedStudents = $group->members()->pluck('student_id')->toArray();

        DB::transaction(function () use ($group, $admin, $period, $affectedStudents) {
            Title::where('proposed_by_group_id', $group->id)
                ->where('title_source', 'STUDENT')
                ->delete();

            $group->bids()->delete();
            $group->supervisorProposals()->delete();
            $group->supervisions()->delete();
            $group->taSubmissions()->delete();
            $group->documents()->delete();
            $group->evaluations()->delete();
            $group->schedules()->delete();
            $group->seminarSchedules()->delete();
            $group->taDefenseSchedules()->delete();
            $group->approvalAudits()->delete();
            $group->members()->delete();
            GroupInvitation::where('group_id', $group->id)->delete();
            JoinRequest::where('group_id', $group->id)->delete();

            AuditLog::create([
                'user_id' => $admin->id,
                'action' => 'GROUP_DELETED_BY_ADMIN',
                'target_type' => 'Group',
                'target_id' => $group->id,
                'payload' => [
                    'group_id' => $group->id,
                    'period_id' => $group->period_id,
                    'status' => $group->status,
                    'affected_students' => $affectedStudents,
                ],
            ]);

            $group->delete();

            foreach ($affectedStudents as $studentId) {
                Notification::create([
                    'user_id' => $studentId,
                    'type' => 'GROUP_DELETED_BY_ADMIN',
                    'title' => 'Kelompok Dihapus oleh Admin',
                    'message' => 'Kelompok Anda telah dihapus oleh admin. Anda sekarang dapat mendaftar kembali ke periode yang aktif.',
                    'related_type' => 'Period',
                    'related_id' => $period?->id,
                ]);
            }
        });

        return count($affectedStudents);
    }

    // ======================================================================
    // Member Management
    // ======================================================================

    /**
     * Send a group invitation to a student.
     */
    public function sendInvitation(Group $group, User $leader, string $email): GroupInvitation
    {
        $this->ensurePeriodIsActive($group);

        if ($this->stateMachine->isAtLeast($group, 'READY_FOR_FINALIZATION')) {
            throw new DomainRuleException('Kelompok sudah terkunci (Ready for Finalization). Batalkan finalisasi terlebih dahulu untuk mengundang anggota.');
        }

        $maxMembers = $group->period->max_group_size ?? 4;
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        if ($memberCount >= $maxMembers) {
            throw new DomainRuleException("Kelompok sudah penuh. Maksimal {$maxMembers} anggota diperbolehkan.");
        }

        $student = User::where('email', $email)->where('role', 'mahasiswa')->first();
        if (! $student) {
            throw new DomainRuleException('Mahasiswa tidak ditemukan.');
        }

        if ($student->id === $leader->id) {
            throw new DomainRuleException('Anda sudah berada di kelompok ini.');
        }

        $inStandardGroup = GroupMember::where('student_id', $student->id)
            ->where('period_id', $group->period_id)
            ->whereHas('group', fn ($q) => $q->whereNotIn('status', ['FORMING', 'WAITING_SUPERVISOR_APPROVAL']))
            ->exists();

        if ($inStandardGroup) {
            throw new DomainRuleException('Mahasiswa ini sudah terdaftar di kelompok lain pada periode ini.');
        }

        $existingInvite = GroupInvitation::where('group_id', $group->id)
            ->where('student_id', $student->id)
            ->where('status', 'PENDING')
            ->exists();

        if ($existingInvite) {
            throw new DomainRuleException('Undangan sudah dikirim sebelumnya. Tunggu mahasiswa tersebut merespon.');
        }

        return DB::transaction(function () use ($group, $leader, $student) {
            $invitation = GroupInvitation::updateOrCreate(
                ['group_id' => $group->id, 'student_id' => $student->id],
                ['inviter_id' => $leader->id, 'status' => 'PENDING']
            );

            $this->notificationService->send(
                $student->id,
                'GROUP_INVITATION',
                'Group Invitation',
                "{$leader->name} invited you to join their capstone group.",
                'group_invitations',
                $invitation->id
            );

            return $invitation;
        });
    }

    /**
     * Reject a group invitation.
     */
    public function rejectInvitation(GroupInvitation $invitation, User $user): void
    {
        $invitation->update(['status' => 'REJECTED']);

        $this->notificationService->send(
            $invitation->inviter_id,
            'INVITE_REJECTED',
            'Invitation Rejected',
            "{$user->name} declined your group invitation.",
            'groups',
            $invitation->group_id
        );

        Notification::where('user_id', $user->id)
            ->where('type', 'GROUP_INVITATION')
            ->where('related_id', $invitation->id)
            ->update(['is_read' => true]);
    }

    /**
     * Remove a member from the group (leader only).
     */
    public function removeMember(Group $group, User $leader, int $memberId): Group
    {
        $leaderMembership = GroupMember::where('student_id', $leader->id)
            ->where('group_id', $group->id)
            ->first();

        if (! $leaderMembership) {
            throw new DomainRuleException('Anda belum memiliki kelompok.');
        }

        if (! $leaderMembership->is_leader) {
            throw new DomainRuleException('Hanya ketua kelompok yang dapat mengeluarkan anggota.');
        }

        $member = GroupMember::where('id', $memberId)
            ->where('group_id', $group->id)
            ->first();

        if (! $member) {
            throw new DomainRuleException('Anggota tidak ditemukan di kelompok Anda.');
        }

        if ($member->student_id === $leader->id) {
            throw new DomainRuleException('Anda tidak dapat mengeluarkan diri sendiri.');
        }

        $this->ensurePeriodIsActive($group);

        if ($this->stateMachine->isAtLeast($group, 'READY_FOR_FINALIZATION') && ! $leader->hasRole('admin')) {
            throw new DomainRuleException('Kelompok sudah terkunci (Ready for Finalization). Batalkan finalisasi terlebih dahulu untuk mengubah anggota.');
        }

        DB::transaction(function () use ($group, $member) {
            $removedStudentId = $member->student_id;
            $member->delete();

            $remainingMembers = GroupMember::where('group_id', $group->id)->count();
            if ($remainingMembers === 0) {
                $group->update(['status' => 'DISSOLVED']);
                Log::info('group.lifecycle.dissolved', ['group_id' => $group->id]);
            } else {
                $this->evaluateGroupReadiness($group);
            }

            Notification::create([
                'user_id' => $removedStudentId,
                'type' => 'REMOVED_FROM_GROUP',
                'title' => 'Dikeluarkan dari Grup',
                'message' => 'Anda telah dikeluarkan dari grup oleh ketua grup.',
                'related_type' => 'Group',
                'related_id' => $group->id,
            ]);
        });

        return $group->load('members.student', 'period');
    }

    /**
     * Leave a group (non-leader only).
     *
     * @return bool True if the group was dissolved
     */
    public function leaveGroup(Group $group, User $user): bool
    {
        $membership = GroupMember::where('student_id', $user->id)
            ->where('group_id', $group->id)
            ->first();

        if (! $membership) {
            throw new DomainRuleException('Anda belum memiliki kelompok.');
        }

        if ($membership->is_leader) {
            throw new DomainRuleException('Ketua kelompok tidak dapat keluar. Bubarkan kelompok terlebih dahulu.');
        }

        $this->ensurePeriodIsActive($group);

        if (! in_array($group->status, ['FORMING', 'FORMING_SOLO', 'WAITING_SUPERVISOR_APPROVAL'])) {
            throw new DomainRuleException('Hanya dapat keluar sepenuhnya dari grup dengan status FORMING.');
        }

        $groupDissolved = false;

        DB::transaction(function () use ($group, $membership, &$groupDissolved) {
            $membership->delete();

            $remainingMembers = GroupMember::where('group_id', $group->id)->count();
            if ($remainingMembers === 0) {
                $group->update(['status' => 'DISSOLVED']);
                Log::info('group.lifecycle.dissolved', ['group_id' => $group->id]);
                $groupDissolved = true;
            } else {
                $this->evaluateGroupReadiness($group);
            }
        });

        return $groupDissolved;
    }

    // ======================================================================
    // Supervisor Management
    // ======================================================================

    /**
     * Propose supervisors for a group.
     */
    public function proposeSupervisors(Group $group, int $supervisor1Id, ?int $supervisor2Id): GroupSupervisorProposal
    {
        $this->ensurePeriodIsActive($group);

        if ($group->status !== 'READY_FOR_BIDDING') {
            throw new DomainRuleException('Supervisors can only be proposed when group is READY_FOR_BIDDING.');
        }

        if ($group->period->isBiddingLocked()) {
            throw new DomainRuleException('Bidding is locked. Cannot propose supervisors.');
        }

        $sup1 = User::find($supervisor1Id);
        if (! $sup1 || ! $sup1->hasRole('dosen')) {
            throw new DomainRuleException('Proposed supervisor 1 must be a lecturer.');
        }

        if ($supervisor2Id) {
            $sup2 = User::find($supervisor2Id);
            if (! $sup2 || ! $sup2->hasRole('dosen')) {
                throw new DomainRuleException('Proposed supervisor 2 must be a lecturer.');
            }
        }

        return GroupSupervisorProposal::updateOrCreate(
            ['group_id' => $group->id],
            [
                'proposed_supervisor_1_id' => $supervisor1Id,
                'proposed_supervisor_2_id' => $supervisor2Id,
                'status' => 'PENDING',
            ]
        );
    }

    /**
     * Assign Supervisor 2 to a group (admin only).
     */
    public function assignSupervisor2(Group $group, int $supervisor2Id, User $admin): Group
    {
        $this->ensurePeriodIsActive($group);

        $supervisor = User::findOrFail($supervisor2Id);

        if (! $supervisor->hasRole('dosen')) {
            throw new DomainRuleException('Supervisor 2 must be a lecturer.');
        }

        if ($group->supervisor_1_id && $group->supervisor_1_id === $supervisor->id) {
            throw new DomainRuleException('Supervisor 2 cannot be the same as Supervisor 1.');
        }

        DB::transaction(function () use ($group, $supervisor, $admin) {
            Supervision::updateOrCreate(
                ['group_id' => $group->id, 'role' => 'SUPERVISOR_2'],
                [
                    'supervisor_id' => $supervisor->id,
                    'assigned_by' => $admin->id,
                ]
            );

            $group->update(['supervisor_2_id' => $supervisor->id]);
        });

        return $group->fresh()->load(['supervisor1', 'supervisor2', 'supervisions.supervisor']);
    }

    // ======================================================================
    // Finalization
    // ======================================================================

    /**
     * Mark group as ready for finalization.
     */
    public function markReadyForFinalization(Group $group, User $leader): void
    {
        $membership = GroupMember::where('student_id', $leader->id)
            ->where('group_id', $group->id)
            ->first();

        if (! $membership) {
            throw new DomainRuleException('Anda bukan anggota kelompok ini.');
        }

        if (! $membership->is_leader) {
            throw new DomainRuleException('Hanya ketua kelompok yang dapat menandai siap finalisasi.');
        }

        if (! in_array($group->status, ['FORMING_SOLO', 'READY_FOR_BIDDING', 'TITLE_APPROVED'])) {
            throw new DomainRuleException('Grup tidak dalam status yang dapat ditandai siap finalisasi. Status saat ini: '.$group->status);
        }

        $period = $group->period;
        if (! $period || ! $period->is_active) {
            throw new DomainRuleException('Periode tidak aktif.');
        }

        $memberCount = GroupMember::where('group_id', $group->id)->count();
        $minSize = $period->min_group_size ?? 3;
        $maxSize = $period->max_group_size ?? 4;

        if ($memberCount < $minSize || $memberCount > $maxSize) {
            throw new DomainRuleException("Jumlah anggota harus antara {$minSize}-{$maxSize} orang (saat ini: {$memberCount}).");
        }

        $hasAcceptedBid = $group->bids()
            ->where('lecturer_recommendation', 'ACCEPT')
            ->exists();

        $hasApprovedProposal = Title::where('proposed_by_group_id', $group->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'APPROVED')
            ->exists();

        if (! $hasAcceptedBid && ! $hasApprovedProposal) {
            throw new DomainRuleException('Grup belum memiliki bid yang diterima atau proposal yang disetujui oleh dosen.');
        }

        $this->stateMachine->transition($group, 'READY_FOR_FINALIZATION');
        $this->notificationService->notifyGroupMembersOfFinalization($group);
    }

    /**
     * Cancel finalization and revert to previous status.
     *
     * @return string The target status reverted to
     */
    public function cancelReadyForFinalization(Group $group, User $leader): string
    {
        $membership = GroupMember::where('student_id', $leader->id)
            ->where('group_id', $group->id)
            ->first();

        if (! $membership) {
            throw new DomainRuleException('Anda bukan anggota kelompok ini.');
        }

        if (! $membership->is_leader) {
            throw new DomainRuleException('Hanya ketua kelompok yang dapat membatalkan finalisasi.');
        }

        if ($group->status !== 'READY_FOR_FINALIZATION') {
            throw new DomainRuleException('Grup tidak dalam status siap finalisasi. Status saat ini: '.$group->status);
        }

        $period = $group->period;
        if (! $period || ! $period->is_active) {
            throw new DomainRuleException('Periode tidak aktif. Tidak dapat membatalkan finalisasi.');
        }

        $hasOwnApprovedTitle = false;
        if ($group->title_id) {
            $title = Title::find($group->title_id);
            if ($title && $title->supervisor_approval_status === 'APPROVED') {
                $hasOwnApprovedTitle = true;
            }
        }

        $targetStatus = $hasOwnApprovedTitle ? 'TITLE_APPROVED' : 'READY_FOR_BIDDING';

        $this->stateMachine->transition($group, $targetStatus);
        $this->notificationService->notifyGroupMembersOfCancellation($group);

        return $targetStatus;
    }

    // ======================================================================
    // Query Helpers
    // ======================================================================

    /**
     * Resolve user's group data for the index endpoint.
     */
    public function getUserGroupData(User $user, ?int $periodId): array
    {
        $period = $this->resolveUserGroupPeriod($user->id, $periodId);

        $membership = GroupMember::where('student_id', $user->id)
            ->where('period_id', $period?->id)
            ->whereHas('group', fn ($q) => $q->whereNotIn('status', ['CLOSED']))
            ->first();

        if (! $membership || ! $period) {
            return ['group' => null];
        }

        $group = Group::with([
            'members.student', 'title.lecturer', 'period', 'bids.title',
            'supervisorProposals.supervisor1', 'supervisorProposals.supervisor2',
            'supervisions.supervisor', 'supervisor1', 'supervisor2',
        ])->find($membership->group_id);

        return ['group' => $this->buildCanonicalGroupPayload($group, $user)];
    }

    /**
     * Transform a group for the admin list endpoint.
     */
    public function transformGroupForAdminList(Group $group): array
    {
        $groupArray = $group->toArray();
        $groupArray['name'] = $this->resolveAdminGroupName($group);
        $groupArray['status_label'] = $this->resolveAdminStatusLabel($group->status);
        $groupArray['allowed_actions'] = [
            'can_manage_finalization' => in_array($group->status, ['READY_FOR_FINALIZATION', 'KELOMPOK_FINAL', 'TITLE_APPROVED', 'READY_FOR_BIDDING'], true)
                && ! ($group->period?->is_finalized),
            'reason' => $group->period?->is_finalized ? 'PERIOD_FINALIZED' : null,
        ];

        return $groupArray;
    }

    /**
     * Transform a group for the progress endpoint.
     */
    public function transformGroupForProgress(Group $group, $documents, $periodRequirements): array
    {
        $progressData = null;
        if ($documents->isNotEmpty() || $periodRequirements->isNotEmpty()) {
            try {
                $workflowService = app(WorkflowService::class);
                $progressData = $workflowService->getWorkflowData($group, $documents, $periodRequirements);
            } catch (\Exception $e) {
                Log::error('Failed to get workflow data', ['group_id' => $group->id, 'error' => $e->getMessage()]);
            }
        }

        $statusOrder = [
            'FORMING', 'FORMING_SOLO', 'READY_FOR_BIDDING', 'TITLE_PROPOSED', 'TITLE_APPROVED',
            'READY_FOR_FINALIZATION', 'KELOMPOK_FINAL', 'PDC1_ACTIVE', 'READY_FOR_SEMPRO', 'SEMPRO_DONE',
            'PDC2_ACTIVE', 'PDC2_READY_FOR_EXPO', 'EXPO_REGISTERED', 'EXPO_DONE', 'READY_FOR_TA_INDIVIDUAL',
            'TA_IN_PROGRESS', 'CLOSED', 'DISSOLVED',
        ];
        $statusIndex = array_search($group->status, $statusOrder);
        $progressPercentage = $statusIndex !== false
            ? min(round((($statusIndex + 1) / count($statusOrder)) * 100), 100)
            : 0;

        return [
            'id' => $group->id,
            'name' => null,
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
            'members' => $group->members?->map(fn ($m) => [
                'id' => $m->id,
                'student' => [
                    'id' => $m->student?->id,
                    'name' => $m->student?->name,
                    'nim' => $m->student?->nim,
                ],
            ])->toArray() ?? [],
            'members_count' => $group->members?->count() ?? 0,
            'progress' => $progressData,
            'progress_percentage' => $progressPercentage,
        ];
    }

    /**
     * Validate invitation acceptance and prepare membership context.
     */
    public function validateInvitationAcceptance(GroupInvitation $invitation, User $user): array
    {
        $group = Group::with('period')->find($invitation->group_id);

        $this->ensurePeriodIsActive($group);

        if (! $group || $group->status === 'CLOSED') {
            throw new DomainRuleException('Kelompok tidak tersedia lagi.');
        }

        if ($group->period && $group->period->is_finalized) {
            throw new DomainRuleException('Pendaftaran untuk periode ini sudah ditutup.');
        }

        if ($this->stateMachine->isAtLeast($group, 'READY_FOR_FINALIZATION')) {
            throw new DomainRuleException('Kelompok sudah terkunci (Ready for Finalization) dan tidak menerima anggota baru.');
        }

        if ($group->is_solo && $group->title_id) {
            $title = Title::find($group->title_id);
            if (! $title || $title->supervisor_approval_status !== 'APPROVED') {
                throw new DomainRuleException('Judul kelompok ini telah dibatalkan oleh dosen. Tidak dapat bergabung.');
            }
        }

        $inStandardGroup = GroupMember::where('student_id', $user->id)
            ->where('period_id', $group->period_id)
            ->whereHas('group', fn ($q) => $q->whereNotIn('status', ['FORMING', 'WAITING_SUPERVISOR_APPROVAL']))
            ->exists();

        if ($inStandardGroup) {
            throw new DomainRuleException('Anda sudah terdaftar di kelompok lain pada periode ini. Keluar dari kelompok lama terlebih dahulu.');
        }

        $maxMembers = $group->period->max_group_size ?? 4;
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        if ($memberCount >= $maxMembers) {
            throw new DomainRuleException('Kelompok sudah penuh. Cari kelompok lain atau buat kelompok baru.');
        }

        $isRegistered = PeriodRegistration::where('user_id', $user->id)
            ->where('period_id', $group->period_id)
            ->exists();

        $autoRegistered = false;
        if (! $isRegistered) {
            PeriodRegistration::create([
                'user_id' => $user->id,
                'period_id' => $group->period_id,
            ]);
            $autoRegistered = true;
        }

        return ['group' => $group, 'auto_registered' => $autoRegistered];
    }

    /**
     * Enrich supervised groups with supervisor role data.
     *
     * @param  \Illuminate\Database\Eloquent\Collection  $groups
     */
    public function enrichSupervisedGroups($groups, User $user): \Illuminate\Database\Eloquent\Collection
    {
        return $groups->map(function ($group) use ($user) {
            $supervision = $group->supervisions->firstWhere('supervisor_id', $user->id);
            $dosbing1 = $group->supervisions->firstWhere('role', 'SUPERVISOR_1');
            $dosbing2 = $group->supervisions->firstWhere('role', 'SUPERVISOR_2');

            $group->dosbing_1_name = $dosbing1?->supervisor?->name;
            $group->dosbing_2_name = $dosbing2?->supervisor?->name;
            $group->is_dosbing_1 = $supervision?->role === 'SUPERVISOR_1';
            $group->is_dosbing_2 = $supervision?->role === 'SUPERVISOR_2';

            return $group;
        });
    }
}
