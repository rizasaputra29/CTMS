<?php

namespace App\Services;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\GroupInvitation;
use App\Models\Title;
use App\Models\User;
use App\Models\Period;
use App\Models\Supervision;
use App\Models\JoinRequest;
use App\Exceptions\ConflictRuleException;
use App\Exceptions\DomainRuleException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class GroupService
{
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

        // 2. Pre-validation & Idempotency (Fast Path)
        $this->validateJoinRequest($student, $targetGroup);

        $isAlreadyMember = GroupMember::where('student_id', $student->id)
            ->where('group_id', $targetGroup->id)
            ->exists();

        if ($isAlreadyMember) {
            throw new ConflictRuleException("Anda sudah terdaftar di kelompok ini. Hubungi ketua kelompok jika ada masalah.");
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
throw new ConflictRuleException("Anda sudah terdaftar di kelompok ini. Hubungi ketua kelompok jika ada masalah.");
                    }

                    // B. Validate Capacity (Source Team + Target Team)
                    $sourceMembership = GroupMember::where('student_id', $lockedStudent->id)
                        ->where('period_id', $lockedGroup->period_id)
                        ->first();
                    
                    $sourceMemberCount = $sourceMembership ? GroupMember::where('group_id', $sourceMembership->group_id)->count() : 1;
                    $targetMemberCount = GroupMember::where('group_id', $lockedGroup->id)->count();

                    $maxMembers = $lockedGroup->period->max_group_size ?? 4;
                    if (($sourceMemberCount + $targetMemberCount) > $maxMembers) {
                        throw new DomainRuleException("Kelompok penuh. Total anggota akan melebihi batas maksimal (" . ($maxMembers) . " orang). Kurangi anggota yang dibawa atau cari kelompok lain.");
                    }

                    // C. Migrate & Attach
                    $this->migrateStudentAndTeam($lockedStudent, $lockedGroup);
                    $this->attachToGroup($lockedStudent, $lockedGroup);
                    $this->evaluateGroupReadiness($lockedGroup);
                });
            }, fn($attempt) => 100 * $attempt, function ($e) {
                return $e instanceof QueryException;
            });

            $durationMs = (microtime(true) - $startTime) * 1000;
            DB::afterCommit(fn() => Log::info('group.join.success', ['duration_ms' => round($durationMs, 2)]));

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
                        ->whereHas('group', fn($q) => $q->where('status', '!=', 'CLOSED'))
                        ->lockForUpdate()
                        ->first();

                    if (!$membership) {
                        return; // Idempotency
                    }

                    $oldGroup = Group::where('id', $membership->group_id)->lockForUpdate()->first();

                    if ($this->stateMachine->isAtLeast($oldGroup, self::STATUS_KELOMPOK_FINAL)) {
                        throw new DomainRuleException("Kelompok sudah difinalisasi dan tidak dapat diubah. Hubungi admin jika ada kebutuhan khusus.");
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
            }, fn($attempt) => 100 * $attempt, function ($e) {
                return $e instanceof QueryException;
            });

            $durationMs = (microtime(true) - $startTime) * 1000;
            DB::afterCommit(fn() => Log::info('group.leave.success', ['duration_ms' => round($durationMs, 2)]));

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
            throw new DomainRuleException("Hanya mahasiswa yang dapat bergabung ke dalam kelompok. Login sebagai mahasiswa terlebih dahulu.");
        }

        if ($group->period->is_finalized) {
            throw new DomainRuleException("Periode pendaftaran ini sudah ditutup. Hubungi admin jika ada kebutuhan khusus.");
        }

        if ($this->stateMachine->isAtLeast($group, self::STATUS_KELOMPOK_FINAL)) {
            throw new DomainRuleException("Kelompok sudah difinalisasi dan tidak menerima anggota baru. Hubungi admin jika ada kebutuhan khusus.");
        }

        // 4. Already In Group (Idempotency)
        $existingMembership = GroupMember::where('student_id', $student->id)
            ->where('period_id', $group->period_id)
            ->first();

        if ($existingMembership && $existingMembership->group_id === $group->id) {
            return; // Idempotent success
        }

        if ($existingMembership && !in_array($existingMembership->group->status, [self::STATUS_FORMING, self::STATUS_FORMING_SOLO, self::STATUS_WAITING_SUPERVISOR_APPROVAL])) {
            throw new DomainRuleException("Anda sudah terdaftar di kelompok lain pada periode ini. Keluar dari kelompok lama terlebih dahulu.");
        }
        
        // If they have a "FORMING" group but it's not a solo group (more than 1 member), they can't leave easily by joining another
        if ($existingMembership && $existingMembership->group->status === self::STATUS_FORMING) {
            $memberCount = GroupMember::where('group_id', $existingMembership->group_id)->count();
            if ($memberCount > 1 && !$existingMembership->is_leader) {
                throw new DomainRuleException("Hanya ketua kelompok yang dapat memindahkan seluruh anggota ke kelompok lain.");
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

        if (!$membership) return;

        $sourceGroup = Group::with('members')->find($membership->group_id);
        if (!$sourceGroup) return;

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
                    'is_leader' => false // Hard rule: Target idea owner remains leader
                ]);
            }
        }

        // Delete Source Group
        $sourceGroup->delete();

        Log::info('group.migration.merged', [
            'student_id' => $student->id,
            'source_group_id' => $sourceGroup->id,
            'target_group_id' => $targetGroup->id,
            'member_count' => $members->count()
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
            ->whereHas('group', fn($q) => $q->where('period_id', $group->period_id))
            ->update(['status' => 'REJECTED']);

        Log::info('group.attach.success', ['student_id' => $student->id, 'group_id' => $group->id]);
    }

    /**
     * Strict State Transition: Evaluate if group is ready for bidding.
     */
    public function evaluateGroupReadiness(Group $group): void
    {
        // Guard: Skip if already finalized or dissolved
        if ($this->stateMachine->isAtLeast($group, self::STATUS_KELOMPOK_FINAL) || $group->status === self::STATUS_DISSOLVED) {
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

        // Atomic Validation: Check Quota if title exists
        $preApprovedTitle = Title::where('proposed_by_group_id', $group->id)
            ->where('supervisor_approval_status', 'UNDER_REVIEW')
            ->first();

        if ($preApprovedTitle) {
            $lecturerId = $preApprovedTitle->proposed_supervisor_id;
            $maxLoad = $period->max_supervise_load ?? 8;

            $currentLoad = Supervision::where('supervisor_id', $lecturerId)
                ->whereHas('group', fn($q) => $q->where('period_id', $period->id))
                ->count();

            $approvedProposals = Title::where('proposed_supervisor_id', $lecturerId)
                ->where('supervisor_approval_status', 'APPROVED')
                ->whereHas('proposedByGroup', fn($q) => $q->where('period_id', $period->id))
                ->count();

            if (($currentLoad + $approvedProposals) >= $maxLoad) {
                return false; // Quota full, cannot become READY with this title
            }
        }

        return true;
    }

    private function transitionToReady(Group $group): void
    {
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
}
