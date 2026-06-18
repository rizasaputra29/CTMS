<?php

namespace App\Services;

use App\Exceptions\DomainRuleException;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\GroupInvitation;
use App\Models\GroupMember;
use App\Models\JoinRequest;
use App\Models\Period;
use App\Models\PeriodRegistration;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Service for handling student flagging operations.
 *
 * This service manages the process of flagging students from periods,
 * which soft-removes them from groups while preserving their scores.
 * It also handles restoration (unflagging) and provides utility methods
 * for checking scoring eligibility and period membership.
 */
class StudentFlagService
{
    protected GroupService $groupService;

    protected NotificationService $notificationService;

    public function __construct(
        GroupService $groupService,
        NotificationService $notificationService
    ) {
        $this->groupService = $groupService;
        $this->notificationService = $notificationService;
    }

    /**
     * Flag a student from a period.
     *
     * This operation:
     * - Soft deletes the student's GroupMember row(s) (preserves scores)
     * - Updates PeriodRegistration status to 'flagged'
     * - Invalidates pending invitations and join requests
     * - Dissolves groups with no remaining active members
     * - Logs the action to AuditLog
     * - Sends notification to the student
     *
     * @param  Period  $period  The period to flag the student from
     * @param  User  $student  The student being flagged
     * @param  User  $flaggedBy  The user performing the flagging action
     * @param  string  $reason  The reason for flagging
     *
     * @throws DomainRuleException If the student cannot be flagged
     * @throws QueryException If a database error occurs
     */
    public function flagStudent(
        Period $period,
        User $student,
        User $flaggedBy,
        string $reason
    ): void {
        $startTime = microtime(true);

        Log::shareContext([
            'request_id' => Str::uuid(),
            'period_id' => $period->id,
            'student_id' => $student->id,
            'flagged_by' => $flaggedBy->id,
        ]);

        Log::info('student.flag.attempt', [
            'reason' => $reason,
        ]);

        try {
            retry(3, function () use ($period, $student, $flaggedBy, $reason) {
                DB::transaction(function () use ($period, $student, $flaggedBy, $reason) {
                    // Lock student and period records for concurrency safety
                    $lockedStudent = User::where('id', $student->id)->lockForUpdate()->first();
                    $lockedPeriod = Period::where('id', $period->id)->lockForUpdate()->first();

                    // Verify student is registered for this period
                    $registration = PeriodRegistration::where('user_id', $lockedStudent->id)
                        ->where('period_id', $lockedPeriod->id)
                        ->lockForUpdate()
                        ->first();

                    if (! $registration) {
                        throw new DomainRuleException('Student is not registered for this period.');
                    }

                    // Check if already flagged
                    if ($registration->status === 'flagged') {
                        throw new DomainRuleException('Student is already flagged for this period.');
                    }

                    // Mark PeriodRegistration as flagged (student is removed from active participation)
                    $registration->update([
                        'status' => 'flagged',
                        'flagged_at' => now(),
                        'flagged_by' => $flaggedBy->id,
                    ]);

                    // Find and soft delete GroupMember records
                    $memberships = GroupMember::where('student_id', $lockedStudent->id)
                        ->where('period_id', $lockedPeriod->id)
                        ->lockForUpdate()
                        ->get();

                    foreach ($memberships as $membership) {
                        $groupId = $membership->group_id;

                        // Soft delete the membership with reason
                        $membership->update([
                            'status' => 'flagged',
                            'removed_by' => $flaggedBy->id,
                            'removal_reason' => $reason,
                        ]);
                        $membership->delete();

                        // Check if group has remaining active members
                        $this->handleEmptyGroup($groupId, $lockedPeriod->id);
                    }

                    // Invalidate pending invitations and join requests
                    $this->invalidatePendingRequests($lockedStudent->id, $lockedPeriod->id);

                    // Log to AuditLog
                    AuditLog::create([
                        'user_id' => $flaggedBy->id,
                        'action' => 'STUDENT_FLAGGED',
                        'target_type' => User::class,
                        'target_id' => $lockedStudent->id,
                        'payload' => [
                            'period_id' => $lockedPeriod->id,
                            'reason' => $reason,
                            'memberships_count' => $memberships->count(),
                        ],
                    ]);

                    // Send notification to student (after commit)
                    DB::afterCommit(function () use ($lockedStudent, $lockedPeriod, $reason) {
                        $this->notificationService->send(
                            $lockedStudent->id,
                            'STUDENT_FLAGGED',
                            'Akun Ditandai (Flagged)',
                            "Akun Anda telah ditandai oleh admin dari periode {$lockedPeriod->name}. Alasan: {$reason}. Hubungi admin untuk informasi lebih lanjut.",
                            'Period',
                            $lockedPeriod->id
                        );
                    });
                });
            }, fn ($attempt) => 100 * $attempt, function ($e) {
                return $e instanceof QueryException;
            });

            $durationMs = (microtime(true) - $startTime) * 1000;
            DB::afterCommit(fn () => Log::info('student.flag.success', ['duration_ms' => round($durationMs, 2)]));
        } catch (Throwable $e) {
            Log::error('student.flag.failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    /**
     * Unflag (restore) a student to a period.
     *
     * This operation:
     * - Restores soft-deleted GroupMember records if any exist
     * - Updates PeriodRegistration status to 'active'
     * - Logs the action to AuditLog
     * - Sends notification to the student
     *
     * Note: Group restoration is manual - student will need to rejoin groups.
     *
     * @param  Period  $period  The period to unflag the student from
     * @param  User  $student  The student being unflagged
     * @param  User  $unflaggedBy  The user performing the unflagging action
     *
     * @throws DomainRuleException If the student cannot be unflagged
     * @throws QueryException If a database error occurs
     */
    public function unflagStudent(
        Period $period,
        User $student,
        User $unflaggedBy
    ): void {
        $startTime = microtime(true);

        Log::shareContext([
            'request_id' => Str::uuid(),
            'period_id' => $period->id,
            'student_id' => $student->id,
            'unflagged_by' => $unflaggedBy->id,
        ]);

        Log::info('student.unflag.attempt');

        try {
            retry(3, function () use ($period, $student, $unflaggedBy) {
                DB::transaction(function () use ($period, $student, $unflaggedBy) {
                    // Lock student and period records for concurrency safety
                    $lockedStudent = User::where('id', $student->id)->lockForUpdate()->first();
                    $lockedPeriod = Period::where('id', $period->id)->lockForUpdate()->first();

                    // Check if student is currently flagged in this period
                    // Primary signal: PeriodRegistration status is flagged
                    $flaggedRegistration = PeriodRegistration::where('user_id', $lockedStudent->id)
                        ->where('period_id', $lockedPeriod->id)
                        ->where('status', 'flagged')
                        ->lockForUpdate()
                        ->first();

                    if (! $flaggedRegistration) {
                        throw new DomainRuleException('Student is not flagged for this period.');
                    }

                    // Restore PeriodRegistration to active
                    $flaggedRegistration->update([
                        'status' => 'active',
                        'flagged_at' => null,
                        'flagged_by' => null,
                    ]);

                    // Restore soft-deleted GroupMember records
                    GroupMember::withTrashed()
                        ->where('student_id', $lockedStudent->id)
                        ->where('period_id', $lockedPeriod->id)
                        ->where('status', 'flagged')
                        ->whereNotNull('deleted_at')
                        ->update([
                            'status' => 'active',
                            'deleted_at' => null,
                        ]);

                    // Log to AuditLog
                    AuditLog::create([
                        'user_id' => $unflaggedBy->id,
                        'action' => 'STUDENT_UNFLAGGED',
                        'target_type' => User::class,
                        'target_id' => $lockedStudent->id,
                        'payload' => [
                            'period_id' => $lockedPeriod->id,
                            'previous_status' => 'flagged',
                        ],
                    ]);

                    // Send notification to student (after commit)
                    DB::afterCommit(function () use ($lockedStudent, $lockedPeriod) {
                        $this->notificationService->send(
                            $lockedStudent->id,
                            'STUDENT_UNFLAGGED',
                            'Akun Dikembalikan (Unflagged)',
                            "Akun Anda telah dikembalikan ke status aktif untuk periode {$lockedPeriod->name}. Anda dapat kembali bergabung dengan kelompok.",
                            'Period',
                            $lockedPeriod->id
                        );
                    });
                });
            }, fn ($attempt) => 100 * $attempt, function ($e) {
                return $e instanceof QueryException;
            });

            $durationMs = (microtime(true) - $startTime) * 1000;
            DB::afterCommit(fn () => Log::info('student.unflag.success', ['duration_ms' => round($durationMs, 2)]));
        } catch (Throwable $e) {
            Log::error('student.unflag.failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    /**
     * Request a flag for a student from a period (admin/dosen action).
     *
     * This operation:
     * - Updates PeriodRegistration status to 'pending_flag'
     * - Sends a notification to the student asking them to confirm
     * - Logs the action to AuditLog
     *
     * The student is not actually removed from the group/period until they
     * click the confirmation button in the notification.
     *
     * @param  Period  $period  The period to flag the student from
     * @param  User  $student  The student being flagged
     * @param  User  $flaggedBy  The user performing the flagging action
     * @param  string  $reason  The reason for flagging
     */
    public function requestFlag(
        Period $period,
        User $student,
        User $flaggedBy,
        string $reason
    ): void {
        $startTime = microtime(true);

        Log::shareContext([
            'request_id' => Str::uuid(),
            'period_id' => $period->id,
            'student_id' => $student->id,
            'flagged_by' => $flaggedBy->id,
        ]);

        Log::info('student.flag_request.attempt', [
            'reason' => $reason,
        ]);

        try {
            retry(3, function () use ($period, $student, $flaggedBy, $reason) {
                DB::transaction(function () use ($period, $student, $flaggedBy, $reason) {
                    $lockedStudent = User::where('id', $student->id)->lockForUpdate()->first();
                    $lockedPeriod = Period::where('id', $period->id)->lockForUpdate()->first();

                    $registration = PeriodRegistration::where('user_id', $lockedStudent->id)
                        ->where('period_id', $lockedPeriod->id)
                        ->lockForUpdate()
                        ->first();

                    if (! $registration) {
                        throw new DomainRuleException('Student is not registered for this period.');
                    }

                    if (in_array($registration->status, ['flagged', 'pending_flag'], true)) {
                        throw new DomainRuleException('Student is already flagged or pending flag for this period.');
                    }

                    $registration->update([
                        'status' => 'pending_flag',
                        'flagged_at' => now(),
                        'flagged_by' => $flaggedBy->id,
                    ]);

                    AuditLog::create([
                        'user_id' => $flaggedBy->id,
                        'action' => 'STUDENT_FLAG_REQUESTED',
                        'target_type' => User::class,
                        'target_id' => $lockedStudent->id,
                        'payload' => [
                            'period_id' => $lockedPeriod->id,
                            'reason' => $reason,
                        ],
                    ]);

                    DB::afterCommit(function () use ($lockedStudent, $lockedPeriod, $reason, $flaggedBy) {
                        $this->notificationService->send(
                            $lockedStudent->id,
                            'STUDENT_FLAG_REQUESTED',
                            'Akun Anda Akan Dikeluarkan',
                            "Admin {$flaggedBy->name} meminta untuk mengeluarkan akun Anda dari periode {$lockedPeriod->name}. Alasan: {$reason}. Klik tombol Konfirmasi Keluar untuk menyetujui.",
                            'Period',
                            $lockedPeriod->id
                        );
                    });
                });
            }, fn ($attempt) => 100 * $attempt, function ($e) {
                return $e instanceof QueryException;
            });

            $durationMs = (microtime(true) - $startTime) * 1000;
            DB::afterCommit(fn () => Log::info('student.flag_request.success', ['duration_ms' => round($durationMs, 2)]));
        } catch (Throwable $e) {
            Log::error('student.flag_request.failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    /**
     * Confirm a pending flag for a student from a period (student action).
     *
     * This operation:
     * - Soft deletes the student's GroupMember row(s) (preserves scores)
     * - Updates PeriodRegistration status from 'pending_flag' to 'flagged'
     * - Invalidates pending invitations and join requests
     * - Dissolves groups with no remaining active members
     * - Logs the action to AuditLog
     * - Sends notification to the student
     */
    public function confirmFlag(
        Period $period,
        User $student
    ): void {
        $startTime = microtime(true);

        Log::shareContext([
            'request_id' => Str::uuid(),
            'period_id' => $period->id,
            'student_id' => $student->id,
        ]);

        Log::info('student.flag_confirm.attempt');

        try {
            retry(3, function () use ($period, $student) {
                DB::transaction(function () use ($period, $student) {
                    $lockedStudent = User::where('id', $student->id)->lockForUpdate()->first();
                    $lockedPeriod = Period::where('id', $period->id)->lockForUpdate()->first();

                    $registration = PeriodRegistration::where('user_id', $lockedStudent->id)
                        ->where('period_id', $lockedPeriod->id)
                        ->lockForUpdate()
                        ->first();

                    if (! $registration) {
                        throw new DomainRuleException('Student is not registered for this period.');
                    }

                    if ($registration->status !== 'pending_flag') {
                        throw new DomainRuleException('No pending flag request found for this period.');
                    }

                    $registration->update([
                        'status' => 'flagged',
                    ]);

                    $memberships = GroupMember::where('student_id', $lockedStudent->id)
                        ->where('period_id', $lockedPeriod->id)
                        ->lockForUpdate()
                        ->get();

                    foreach ($memberships as $membership) {
                        $groupId = $membership->group_id;

                        $membership->update([
                            'status' => 'flagged',
                            'removed_by' => $registration->flagged_by,
                            'removal_reason' => $registration->removal_reason ?? 'Student confirmed flag',
                        ]);
                        $membership->delete();

                        $this->handleEmptyGroup($groupId, $lockedPeriod->id);
                    }

                    $this->invalidatePendingRequests($lockedStudent->id, $lockedPeriod->id);

                    AuditLog::create([
                        'user_id' => $lockedStudent->id,
                        'action' => 'STUDENT_FLAG_CONFIRMED',
                        'target_type' => User::class,
                        'target_id' => $lockedStudent->id,
                        'payload' => [
                            'period_id' => $lockedPeriod->id,
                            'memberships_count' => $memberships->count(),
                        ],
                    ]);

                    DB::afterCommit(function () use ($lockedStudent, $lockedPeriod) {
                        $this->notificationService->send(
                            $lockedStudent->id,
                            'STUDENT_FLAG_CONFIRMED',
                            'Akun Dikeluarkan',
                            "Anda telah mengkonfirmasi pengeluaran akun dari periode {$lockedPeriod->name}. Anda tidak lagi aktif dalam kelompok di periode ini.",
                            'Period',
                            $lockedPeriod->id
                        );
                    });
                });
            }, fn ($attempt) => 100 * $attempt, function ($e) {
                return $e instanceof QueryException;
            });

            $durationMs = (microtime(true) - $startTime) * 1000;
            DB::afterCommit(fn () => Log::info('student.flag_confirm.success', ['duration_ms' => round($durationMs, 2)]));
        } catch (Throwable $e) {
            Log::error('student.flag_confirm.failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    /**
     * Check if a student can receive new scores.
     *
     * A student cannot be scored if:
     * - They are flagged from the period
     * - They have no active membership in the group
     *
     * @param  int  $studentId  The student ID to check
     * @param  int  $groupId  The group ID where scoring would occur
     * @return bool True if the student can receive scores, false otherwise
     */
    public function canBeScored(int $studentId, int $groupId): bool
    {
        // Check if student has active membership in the group
        $hasActiveMembership = GroupMember::where('student_id', $studentId)
            ->where('group_id', $groupId)
            ->whereNull('deleted_at')
            ->exists();

        if (! $hasActiveMembership) {
            return false;
        }

        // Get the group to find the period
        $group = Group::find($groupId);
        if (! $group) {
            return false;
        }

        // Check if student has an active (not flagged) period registration
        $hasActiveRegistration = PeriodRegistration::where('user_id', $studentId)
            ->where('period_id', $group->period_id)
            ->whereIn('status', ['active', 'pending_flag'])
            ->exists();

        if (! $hasActiveRegistration) {
            return false;
        }

        return true;
    }

    /**
     * Get the latest active period ID for a student.
     *
     * This is used for grade reporting to determine which period
     * to show grades for when a student has been flagged from multiple periods.
     *
     * Returns the most recent period where the student is either:
     * - Active (not flagged)
     * - Or was flagged (for historical grade access)
     *
     * @param  int  $studentId  The student ID
     * @return int|null The period ID, or null if no registration found
     */
    public function getLatestPeriodIdForStudent(int $studentId): ?int
    {
        $registration = PeriodRegistration::where('user_id', $studentId)
            ->whereIn('status', ['active', 'flagged'])
            ->join('periods', 'period_registrations.period_id', '=', 'periods.id')
            ->orderByDesc('periods.start_date')
            ->orderByDesc('period_registrations.created_at')
            ->select('period_registrations.period_id')
            ->first();

        return $registration?->period_id;
    }

    /**
     * Check if a student is flagged in a specific period.
     *
     * A student is considered flagged if they have no active period_registration
     * but have soft-deleted group_members in that period.
     *
     * @param  int  $studentId  The student ID
     * @param  int  $periodId  The period ID
     * @return bool True if flagged, false otherwise
     */
    public function isFlaggedInPeriod(int $studentId, int $periodId): bool
    {
        return PeriodRegistration::where('user_id', $studentId)
            ->where('period_id', $periodId)
            ->where('status', 'flagged')
            ->exists();
    }

    /**
     * Get all flagged periods for a student.
     *
     * Returns periods where the student has soft-deleted group_members
     * but no active period_registration.
     *
     * @param  int  $studentId  The student ID
     * @return \Illuminate\Support\Collection Collection of Period models
     */
    public function getFlaggedRegistrations(int $studentId): \Illuminate\Support\Collection
    {
        $flaggedPeriodIds = PeriodRegistration::where('user_id', $studentId)
            ->where('status', 'flagged')
            ->pluck('period_id');

        return \App\Models\Period::whereIn('id', $flaggedPeriodIds)->get();
    }

    /**
     * Handle a group that may have become empty after member removal.
     *
     * If no active members remain, the group is dissolved.
     *
     * @param  int  $groupId  The group ID to check
     * @param  int  $periodId  The period ID for context
     */
    private function handleEmptyGroup(int $groupId, int $periodId): void
    {
        $activeMembersCount = GroupMember::where('group_id', $groupId)
            ->whereNull('deleted_at')
            ->count();

        if ($activeMembersCount === 0) {
            $group = Group::where('id', $groupId)->lockForUpdate()->first();

            if ($group && $group->status !== 'DISSOLVED') {
                // Dissolve the group
                $group->update(['status' => 'DISSOLVED']);

                // Cancel pending invitations for this group
                GroupInvitation::where('group_id', $groupId)
                    ->where('status', 'PENDING')
                    ->update(['status' => 'INVALIDATED']);

                // Cancel pending join requests for this group
                JoinRequest::where('group_id', $groupId)
                    ->where('status', 'PENDING')
                    ->update(['status' => 'INVALIDATED']);

                Log::info('group.lifecycle.dissolved', [
                    'group_id' => $groupId,
                    'reason' => 'last_member_flagged',
                ]);

                // Log to AuditLog
                AuditLog::create([
                    'user_id' => null,
                    'action' => 'GROUP_DISSOLVED',
                    'target_type' => Group::class,
                    'target_id' => $groupId,
                    'payload' => [
                        'reason' => 'last_member_flagged',
                        'period_id' => $periodId,
                    ],
                ]);
            }
        }
    }

    /**
     * Invalidate pending invitations and join requests for a student.
     *
     * @param  int  $studentId  The student ID
     * @param  int  $periodId  The period ID
     */
    private function invalidatePendingRequests(int $studentId, int $periodId): void
    {
        // Invalidate pending invitations
        GroupInvitation::where('student_id', $studentId)
            ->where('status', 'PENDING')
            ->whereHas('group', function ($query) use ($periodId) {
                $query->where('period_id', $periodId);
            })
            ->update(['status' => 'INVALIDATED']);

        // Invalidate pending join requests
        JoinRequest::where('requester_id', $studentId)
            ->where('status', 'PENDING')
            ->whereHas('group', function ($query) use ($periodId) {
                $query->where('period_id', $periodId);
            })
            ->update(['status' => 'INVALIDATED']);

        Log::info('student.requests.invalidated', [
            'student_id' => $studentId,
            'period_id' => $periodId,
        ]);
    }
}
