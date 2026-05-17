<?php

namespace App\Services;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Schedule;
use App\Models\SeminarEvaluation;
use App\Models\SeminarSchedule;
use App\Models\TaDefenseEvaluation;
use App\Models\TaDefenseExaminer;
use App\Models\TaDefenseSchedule;
use App\Models\TaSubmission;
use App\Models\AuditLog;
use App\Models\SemproScore;
use App\Models\SidangTaScore;
use App\Models\BimbinganSemproScore;
use App\Models\BimbinganTaScore;
use App\Repositories\AssessmentScoreRepository;
use App\Concerns\RequiresActivePeriod;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SchedulingService
{
    use RequiresActivePeriod;

    protected GroupStateMachine $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    // ══════════════════════════════════════════
    // Examiner Constraint Validation
    // ══════════════════════════════════════════

    /**
     * Validate examiner constraints for scheduling.
     * - Examiners must be dosen
     * - Examiners must not be supervisors of the group
     * - No duplicate examiners
     * - Minimum 2 examiners
     *
     * @return string|null Error message, or null if valid.
     */
    public function validateExaminerConstraints(Group $group, array $examinerIds): ?string
    {
        // Minimum 2
        if (count($examinerIds) < 2) {
            return 'Minimum 2 examiners required.';
        }

        // No duplicates
        if (count($examinerIds) !== count(array_unique($examinerIds))) {
            return 'Duplicate examiner IDs are not allowed.';
        }

        // All must be dosen
        foreach ($examinerIds as $examinerId) {
            $user = \App\Models\User::find($examinerId);
            if (!$user || $user->role !== 'dosen') {
                return "Examiner ID {$examinerId} must be a dosen.";
            }
        }

        // Examiner ≠ Supervisor
        $supervisorIds = array_filter([
            $group->supervisor_1_id,
            $group->supervisor_2_id,
        ]);
        $overlap = array_intersect($examinerIds, $supervisorIds);
        if (!empty($overlap)) {
            return 'Examiner cannot be the same as the group supervisor.';
        }

        return null;
    }

    /**
     * Check if all supervisors have completed their evaluations for a seminar.
     * For SEMPRO: checks BIMBINGAN_SEMPRO evaluations
     * For EXPO: checks BIMBINGAN_EXPO and MILESTONE evaluations
     *
     * @param SeminarSchedule $schedule
     * @return bool
     */
    public function checkSupervisorEvaluationsComplete(SeminarSchedule $schedule): bool
    {
        $group = Group::find($schedule->group_id);
        if (!$group) {
            return false;
        }

        // Get supervisor IDs
        $supervisorIds = array_filter([
            $group->supervisor_1_id,
            $group->supervisor_2_id,
        ]);

        if (empty($supervisorIds)) {
            return true; // No supervisors, consider complete
        }

        // Determine evaluation type based on seminar type
        $evaluationType = match ($schedule->type) {
            'SEMPRO' => 'BIMBINGAN_SEMPRO',
            'EXPO' => ['BIMBINGAN_EXPO', 'MILESTONE'],
            default => null,
        };

        if (!$evaluationType) {
            return true; // Unknown type, consider complete
        }

        // For EXPO, check both BIMBINGAN_EXPO and MILESTONE
        if (is_array($evaluationType)) {
            foreach ($evaluationType as $type) {
                foreach ($supervisorIds as $supervisorId) {
                    $hasSubmitted = AssessmentScoreRepository::existsForGroupAndEvaluator(
                        $group->id,
                        $supervisorId,
                        $type
                    );

                    if (!$hasSubmitted) {
                        return false; // Supervisor hasn't submitted this evaluation type
                    }
                }
            }
            return true;
        }

        // For SEMPRO (BIMBINGAN_SEMPRO)
        foreach ($supervisorIds as $supervisorId) {
            $hasSubmitted = AssessmentScoreRepository::existsForGroupAndEvaluator(
                $group->id,
                $supervisorId,
                $evaluationType
            );

            if (!$hasSubmitted) {
                return false; // Supervisor hasn't submitted evaluation
            }
        }

        return true;
    }

    // ══════════════════════════════════════════
    // Double-Booking & Room Conflict Checks
    // ══════════════════════════════════════════

    /**
     * Get cached active and finalized period IDs for cross-period conflict checking.
     */
    private function getActiveAndFinalizedPeriodIds(): array
    {
        return Cache::remember('periods:active_and_finalized_ids', now()->addMinutes(5), function () {
            return Period::where('is_active', true)
                ->orWhere('is_finalized', true)
                ->pluck('id')
                ->toArray();
        });
    }

    /**
     * Check if an examiner has an overlapping schedule on the given date/time range.
     * Queries BOTH seminar_schedules and ta_defense_schedules across ALL active and finalized periods.
     * Filtered to non-CANCELLED schedules only.
     *
     * @return array|null  The conflicting schedule info, or null if no conflict.
     */
    public function checkDoubleBooking(
        int $examinerId,
        string $date,
        string $startTime,
        string $endTime,
        ?int $excludeSeminarId = null,
        ?int $excludeTaDefenseId = null
    ): ?array {
        $periodIds = $this->getActiveAndFinalizedPeriodIds();

        // Check seminar_schedules (examiner as examiner_1 or examiner_2) - cross periods
        $seminarConflict = SeminarSchedule::where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->whereHas('group', function ($q) use ($periodIds) {
                $q->whereIn('period_id', $periodIds);
            })
            ->where(function ($q) use ($examinerId) {
                $q->where('examiner_1_id', $examinerId)
                    ->orWhere('examiner_2_id', $examinerId);
            })
            ->when($excludeSeminarId, fn($q) => $q->where('id', '!=', $excludeSeminarId))
            ->first();

        if ($seminarConflict) {
            return [
                'type' => 'seminar',
                'schedule' => $seminarConflict,
                'message' => "Examiner has a conflicting {$seminarConflict->type} schedule on {$date} ({$seminarConflict->start_time}-{$seminarConflict->end_time})",
            ];
        }

        // Check ta_defense_schedules via direct columns and examiners pivot - cross periods
        $taConflict = TaDefenseSchedule::where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->whereHas('group', function ($q) use ($periodIds) {
                $q->whereIn('period_id', $periodIds);
            })
            ->where(function ($q) use ($examinerId) {
                $q->where('examiner_1_id', $examinerId)
                    ->orWhere('examiner_2_id', $examinerId)
                    ->orWhereHas('examiners', fn($sq) => $sq->where('examiner_id', $examinerId));
            })
            ->when($excludeTaDefenseId, fn($q) => $q->where('id', '!=', $excludeTaDefenseId))
            ->first();

        if ($taConflict) {
            return [
                'type' => 'ta_defense',
                'schedule' => $taConflict,
                'message' => "Examiner has a conflicting TA defense schedule on {$date} ({$taConflict->start_time}-{$taConflict->end_time})",
            ];
        }

        // Check BIMBINGAN schedules (dosen as group supervisor) - cross periods
        $bimbinganConflict = Schedule::where('type', 'BIMBINGAN')
            ->whereHas('group', function ($q) use ($periodIds) {
                $q->whereIn('period_id', $periodIds);
            })
            ->whereHas('group.supervisions', fn($q) => $q->where('supervisor_id', $examinerId))
            ->whereRaw('DATE(date) = ?', [$date])
            ->whereRaw('start_time < ?', [$endTime])
            ->whereRaw('end_time > ?', [$startTime])
            ->first();

        if ($bimbinganConflict) {
            $bTime = $bimbinganConflict->start_time->format('H:i');
            $bEndTime = $bimbinganConflict->end_time->format('H:i');
            return [
                'type' => 'bimbingan',
                'schedule' => $bimbinganConflict,
                'message' => "Examiner has a conflicting BIMBINGAN schedule on {$date} ({$bTime}-{$bEndTime})",
            ];
        }

        return null; // No conflict
    }

    /**
     * Check if a room has an overlapping schedule on the given date/time range.
     * Checks across ALL active and finalized periods.
     */
    public function checkRoomConflict(
        string $room,
        string $date,
        string $startTime,
        string $endTime,
        ?int $excludeSeminarId = null,
        ?int $excludeTaDefenseId = null
    ): ?array {
        if (empty($room)) {
            return null;
        }

        $periodIds = $this->getActiveAndFinalizedPeriodIds();

        // Check seminar_schedules - cross periods
        $seminarConflict = SeminarSchedule::where('room', $room)
            ->where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->whereHas('group', function ($q) use ($periodIds) {
                $q->whereIn('period_id', $periodIds);
            })
            ->when($excludeSeminarId, fn($q) => $q->where('id', '!=', $excludeSeminarId))
            ->first();

        if ($seminarConflict) {
            return [
                'type' => 'seminar',
                'message' => "Room '{$room}' is already booked for {$seminarConflict->type} on {$date} ({$seminarConflict->start_time}-{$seminarConflict->end_time})",
            ];
        }

        // Check ta_defense_schedules - cross periods
        $taConflict = TaDefenseSchedule::where('room', $room)
            ->where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->whereHas('group', function ($q) use ($periodIds) {
                $q->whereIn('period_id', $periodIds);
            })
            ->when($excludeTaDefenseId, fn($q) => $q->where('id', '!=', $excludeTaDefenseId))
            ->first();

        if ($taConflict) {
            return [
                'type' => 'ta_defense',
                'message' => "Room '{$room}' is already booked for TA defense on {$date} ({$taConflict->start_time}-{$taConflict->end_time})",
            ];
        }

        // Check BIMBINGAN schedules - cross periods
        $bimbinganRoomConflict = Schedule::where('room', $room)
            ->where('type', 'BIMBINGAN')
            ->whereHas('group', function ($q) use ($periodIds) {
                $q->whereIn('period_id', $periodIds);
            })
            ->whereRaw('DATE(date) = ?', [$date])
            ->whereRaw('start_time < ?', [$endTime])
            ->whereRaw('end_time > ?', [$startTime])
            ->first();

        if ($bimbinganRoomConflict) {
            $bTime = $bimbinganRoomConflict->start_time->format('H:i');
            $bEndTime = $bimbinganRoomConflict->end_time->format('H:i');
            return [
                'type' => 'bimbingan',
                'message' => "Room '{$room}' is already booked for BIMBINGAN on {$date} ({$bTime}-{$bEndTime})",
            ];
        }

        return null;
    }

    /**
     * Validate all examiners for conflicts. Returns array of errors or empty.
     */
    public function validateScheduleConflicts(
        array $examinerIds,
        string $date,
        string $startTime,
        string $endTime,
        ?string $room = null,
        ?int $excludeSeminarId = null,
        ?int $excludeTaDefenseId = null
    ): array {
        $errors = [];

        foreach ($examinerIds as $examinerId) {
            $conflict = $this->checkDoubleBooking($examinerId, $date, $startTime, $endTime, $excludeSeminarId, $excludeTaDefenseId);
            if ($conflict) {
                $errors[] = $conflict['message'];
            }
        }

        if ($room) {
            $roomConflict = $this->checkRoomConflict($room, $date, $startTime, $endTime, $excludeSeminarId, $excludeTaDefenseId);
            if ($roomConflict) {
                $errors[] = $roomConflict['message'];
            }
        }

        return $errors;
    }

    /**
     * Validate BIMBINGAN schedule creation for a dosen.
     * Checks if dosen has conflicts as an examiner in SEMPRO, EXPO, or TA Defense schedules.
     * Also checks for existing BIMBINGAN conflicts for this dosen.
     *
     * @param int $dosenId The dosen creating the BIMBINGAN
     * @param string $date Date in Y-m-d format
     * @param string $startTime Start time in H:i format
     * @param string $endTime End time in H:i format
     * @param int|null $excludeBimbinganId BIMBINGAN schedule ID to exclude (for updates)
     * @return array Array of conflict error messages, empty if no conflicts
     */
    public function validateBimbinganConflicts(
        int $dosenId,
        string $date,
        string $startTime,
        string $endTime,
        ?int $excludeBimbinganId = null
    ): array {
        $errors = [];
        $periodIds = $this->getActiveAndFinalizedPeriodIds();

        // 1. Check if dosen is an examiner for SEMPRO or EXPO
        $seminarConflict = SeminarSchedule::where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->whereHas('group', function ($q) use ($periodIds) {
                $q->whereIn('period_id', $periodIds);
            })
            ->where(function ($q) use ($dosenId) {
                $q->where('examiner_1_id', $dosenId)
                    ->orWhere('examiner_2_id', $dosenId);
            })
            ->first();

        if ($seminarConflict) {
            $errors[] = "You have a conflicting {$seminarConflict->type} schedule on {$date} ({$seminarConflict->start_time}-{$seminarConflict->end_time})";
        }

        // 2. Check if dosen is an examiner for TA Defense
        $taConflict = TaDefenseSchedule::where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->whereHas('group', function ($q) use ($periodIds) {
                $q->whereIn('period_id', $periodIds);
            })
            ->where(function ($q) use ($dosenId) {
                $q->where('examiner_1_id', $dosenId)
                    ->orWhere('examiner_2_id', $dosenId)
                    ->orWhereHas('examiners', fn($sq) => $sq->where('examiner_id', $dosenId));
            })
            ->first();

        if ($taConflict) {
            $errors[] = "You have a conflicting TA defense schedule on {$date} ({$taConflict->start_time}-{$taConflict->end_time})";
        }

        // 3. Check for existing BIMBINGAN schedules by this dosen
        $bimbinganConflict = Schedule::where('type', 'BIMBINGAN')
            ->where('created_by', $dosenId)
            ->whereRaw('DATE(date) = ?', [$date])
            ->whereRaw('start_time < ?', [$endTime])
            ->whereRaw('end_time > ?', [$startTime])
            ->when($excludeBimbinganId, fn($q) => $q->where('id', '!=', $excludeBimbinganId))
            ->first();

        if ($bimbinganConflict) {
            $bTime = $bimbinganConflict->start_time->format('H:i');
            $bEndTime = $bimbinganConflict->end_time->format('H:i');
            $errors[] = "You have a conflicting BIMBINGAN schedule on {$date} ({$bTime}-{$bEndTime})";
        }

        return $errors;
    }

    // ══════════════════════════════════════════
    // Auto-Generate Evaluation Rows
    // ══════════════════════════════════════════

    /**
     * Auto-generate PENDING evaluation rows for a seminar schedule.
     * Note: EXPO does not require examiner evaluations (only supervisors).
     */
    public function autoGenerateSeminarEvaluations(SeminarSchedule $schedule): void
    {
        // Skip examiner evaluations for EXPO - only supervisors evaluate EXPO
        if ($schedule->type === 'EXPO') {
            return;
        }

        foreach ([$schedule->examiner_1_id, $schedule->examiner_2_id] as $examinerId) {
            if ($examinerId) {
                SeminarEvaluation::create([
                    'schedule_id' => $schedule->id,
                    'examiner_id' => $examinerId,
                    'status' => 'PENDING',
                ]);
            }
        }
    }

    /**
     * Auto-generate PENDING evaluation rows for a TA defense schedule.
     */
    public function autoGenerateTaDefenseEvaluations(TaDefenseSchedule $schedule): void
    {
        $examiners = TaDefenseExaminer::where('schedule_id', $schedule->id)->get();

        foreach ($examiners as $examiner) {
            TaDefenseEvaluation::create([
                'schedule_id' => $schedule->id,
                'examiner_id' => $examiner->examiner_id,
                'student_id' => $schedule->student_id,
                'status' => 'PENDING',
            ]);
        }
    }

    // ══════════════════════════════════════════
    // Transactional Evaluation Submission
    // ══════════════════════════════════════════

    /**
     * Submit a seminar evaluation. Transactional with lockForUpdate().
     * If all evaluations are submitted → auto state transition.
     *
     * @return array ['evaluation' => ..., 'all_submitted' => bool, 'result' => ?string]
     */
    public function submitSeminarEvaluation(
        int $evaluationId,
        array $rubricJson,
        float $score,
        string $result, // PASS or FAIL
        int $userId
    ): array {
        return DB::transaction(function () use ($evaluationId, $rubricJson, $score, $result, $userId) {
            $evaluation = SeminarEvaluation::lockForUpdate()->findOrFail($evaluationId);

            if ($evaluation->status === 'SUBMITTED') {
                throw new \InvalidArgumentException('Evaluation already submitted.');
            }

            $evaluation->update([
                'rubric_json' => $rubricJson,
                'score' => $score,
                'status' => 'SUBMITTED',
            ]);

            $schedule = SeminarSchedule::lockForUpdate()->findOrFail($evaluation->schedule_id);

            $totalEvals = SeminarEvaluation::where('schedule_id', $schedule->id)->count();
            $submittedEvals = SeminarEvaluation::where('schedule_id', $schedule->id)
                ->where('status', 'SUBMITTED')
                ->count();

            $allExaminerSubmitted = $submittedEvals >= $totalEvals;

            // For SEMPRO and EXPO, also check if supervisors have submitted their evaluations
            $allSupervisorSubmitted = true;
            if ($schedule->type === 'SEMPRO' || $schedule->type === 'EXPO') {
                $allSupervisorSubmitted = $this->checkSupervisorEvaluationsComplete($schedule);
            }

            // For EXPO: only require supervisor evaluations (no examiners)
            // For SEMPRO: require both examiners and supervisors
            if ($schedule->type === 'EXPO') {
                $allSubmitted = $allSupervisorSubmitted;
            } else {
                $allSubmitted = $allExaminerSubmitted && $allSupervisorSubmitted;
            }

            if ($allSubmitted) {
                $schedule->update(['status' => 'COMPLETED']);

                // Determine group transition based on result
                $group = Group::findOrFail($schedule->group_id);

                $this->ensurePeriodIsActive($group);

                // Calculate final score from examiners AND supervisors
                $finalScore = $this->calculateFinalSeminarScore($schedule);
                $calculatedResult = $finalScore >= 60 ? 'PASS' : 'FAIL';

                // Update schedule with final score
                $schedule->update(['final_score' => $finalScore]);

                if ($schedule->type === 'SEMPRO') {
                    if ($calculatedResult === 'PASS') {
                        $this->stateMachine->transition($group, 'SEMPRO_DONE');
                        // Auto-transition to PDC2_ACTIVE after SEMPRO completion
                        $this->stateMachine->transition($group, 'PDC2_ACTIVE');
                    } else {
                        $this->stateMachine->transition($group, 'PDC1_ACTIVE');
                    }
                } elseif ($schedule->type === 'EXPO') {
                    if ($calculatedResult === 'PASS') {
                        $this->stateMachine->transition($group, 'EXPO_DONE');

                        // Unlock peer review for all group members
                        try {
                            $peerReviewService = app(\App\Services\PeerReviewService::class);
                            $peerReviewService->unlockPeerReview($group->id);
                            Log::info("Peer review unlocked for group {$group->id} after EXPO completion");
                        } catch (\Exception $e) {
                            Log::error("Failed to unlock peer review for group {$group->id}: " . $e->getMessage());
                            // Don't throw - peer review unlock failure shouldn't break the flow
                        }
                    } else {
                        $this->stateMachine->transition($group, 'PDC2_ACTIVE');
                    }
                }

                AuditLog::create([
                    'user_id' => $userId,
                    'action' => "{$schedule->type}_{$calculatedResult}",
                    'target_type' => 'SeminarSchedule',
                    'target_id' => $schedule->id,
                    'payload' => [
                        'group_id' => $group->id,
                        'final_score' => $finalScore,
                        'calculated_result' => $calculatedResult,
                    ],
                ]);
            }

            return [
                'evaluation' => $evaluation->fresh(),
                'all_submitted' => $allSubmitted,
                'result' => $allSubmitted ? $result : null,
            ];
        });
    }

    /**
     * Submit a TA defense evaluation. Transactional with lockForUpdate().
     * If all evaluations submitted → determine PASS/FAIL → update TA status → check group CLOSED.
     */
    public function submitTaDefenseEvaluation(
        int $evaluationId,
        array $rubricJson,
        float $score,
        string $result, // PASS or FAIL
        int $userId
    ): array {
        return DB::transaction(function () use ($evaluationId, $rubricJson, $score, $result, $userId) {
            $evaluation = TaDefenseEvaluation::lockForUpdate()->findOrFail($evaluationId);

            if ($evaluation->status === 'SUBMITTED') {
                throw new \InvalidArgumentException('Evaluation already submitted.');
            }

            $evaluation->update([
                'rubric_json' => $rubricJson,
                'score' => $score,
                'status' => 'SUBMITTED',
            ]);

            $schedule = TaDefenseSchedule::lockForUpdate()->findOrFail($evaluation->schedule_id);

            $totalEvals = TaDefenseEvaluation::where('schedule_id', $schedule->id)->count();
            $submittedEvals = TaDefenseEvaluation::where('schedule_id', $schedule->id)
                ->where('status', 'SUBMITTED')
                ->count();

            $allSubmitted = $submittedEvals >= $totalEvals;

            if ($allSubmitted) {
                $schedule->update(['status' => 'COMPLETED']);

                // Update TA submission status
                $taSubmission = TaSubmission::where('student_id', $schedule->student_id)
                    ->where('group_id', $schedule->group_id)
                    ->firstOrFail();

                $group = Group::findOrFail($schedule->group_id);
                $this->ensurePeriodIsActive($group);

                // Calculate final score from examiners AND supervisors
                $finalScore = $this->calculateFinalTaDefenseScore($schedule);
                $calculatedResult = $finalScore >= 60 ? 'PASS' : 'FAIL';

                // Update schedule with final score
                $schedule->update(['final_score' => $finalScore]);

                if ($calculatedResult === 'PASS') {
                    $taSubmission->update(['status' => 'TA_DEFENDED']);

                    // Check if ALL active group members have defended → group CLOSED
                    $group = Group::findOrFail($schedule->group_id);
                    $activeMemberCount = GroupMember::where('group_id', $group->id)->count();
                    $defendedCount = TaSubmission::where('group_id', $group->id)
                        ->where('status', 'TA_DEFENDED')
                        ->count();

                    if ($activeMemberCount > 0 && $defendedCount >= $activeMemberCount) {
                        $this->stateMachine->transition($group, 'CLOSED');
                    }
                } else {
                    $taSubmission->update(['status' => 'TA_REVISED']);
                }

                AuditLog::create([
                    'user_id' => $userId,
                    'action' => "TA_DEFENSE_{$calculatedResult}",
                    'target_type' => 'TaDefenseSchedule',
                    'target_id' => $schedule->id,
                    'payload' => [
                        'student_id' => $schedule->student_id,
                        'final_score' => $finalScore,
                        'calculated_result' => $calculatedResult,
                    ],
                ]);
            }

            return [
                'evaluation' => $evaluation->fresh(),
                'all_submitted' => $allSubmitted,
                'result' => $allSubmitted ? $result : null,
            ];
        });
    }

    // ══════════════════════════════════════════
    // TA Defense Methods
    // ══════════════════════════════════════════

    /**
     * Create evaluation records for TA defense examiners
     */
    public function createTaDefenseEvaluations(TaDefenseSchedule $schedule): void
    {
        // Create evaluation record for examiner 1
        TaDefenseEvaluation::firstOrCreate([
            'schedule_id' => $schedule->id,
            'examiner_id' => $schedule->examiner_1_id,
            'student_id' => $schedule->student_id,
        ], [
            'status' => 'PENDING',
        ]);

        // Create examiner record for examiner 1 (required for examiner lookup)
        TaDefenseExaminer::firstOrCreate([
            'schedule_id' => $schedule->id,
            'examiner_id' => $schedule->examiner_1_id,
        ], [
            'role' => 'EXAMINER_1',
        ]);

        // Create evaluation record for examiner 2
        TaDefenseEvaluation::firstOrCreate([
            'schedule_id' => $schedule->id,
            'examiner_id' => $schedule->examiner_2_id,
            'student_id' => $schedule->student_id,
        ], [
            'status' => 'PENDING',
        ]);

        // Create examiner record for examiner 2 (required for examiner lookup)
        TaDefenseExaminer::firstOrCreate([
            'schedule_id' => $schedule->id,
            'examiner_id' => $schedule->examiner_2_id,
        ], [
            'role' => 'EXAMINER_2',
        ]);
    }

    /**
     * Send notifications when TA defense is scheduled
     */
    public function notifyTaDefenseScheduled(TaDefenseSchedule $schedule): void
    {
        // This will be implemented by NotificationService
        // For now, just log the notification
        Log::info('TA Defense scheduled', [
            'schedule_id' => $schedule->id,
            'student_id' => $schedule->student_id,
            'examiner_1' => $schedule->examiner_1_id,
            'examiner_2' => $schedule->examiner_2_id,
            'date' => $schedule->date,
        ]);
    }

    /**
     * Calculate final seminar score from examiners AND supervisors
     * Formula: Average of (per-dosen averages) from both examiners and supervisors
     *
     * @param SeminarSchedule $schedule
     * @return float
     */
    private function calculateFinalSeminarScore(SeminarSchedule $schedule): float
    {
        $dosenAverages = [];

        // Get examiner scores from sempro_scores table
        $examinerIds = array_filter([$schedule->examiner_1_id, $schedule->examiner_2_id]);
        if (!empty($examinerIds)) {
            $examinerScores = SemproScore::where('group_id', $schedule->group_id)
                ->whereIn('examiner_id', $examinerIds)
                ->get()
                ->groupBy('examiner_id');

            foreach ($examinerScores as $examinerId => $scores) {
                $dosenAverages[] = $scores->avg('score');
            }
        }

        // Get supervisor scores from bimbingan_sempro_scores table
        $group = Group::find($schedule->group_id);
        if ($group) {
            $supervisorIds = array_filter([$group->supervisor_1_id, $group->supervisor_2_id]);
            if (!empty($supervisorIds)) {
                $supervisorScores = BimbinganSemproScore::where('group_id', $schedule->group_id)
                    ->whereIn('evaluator_id', $supervisorIds)
                    ->get()
                    ->groupBy('evaluator_id');

                foreach ($supervisorScores as $supervisorId => $scores) {
                    $dosenAverages[] = $scores->avg('score');
                }
            }
        }

        // For EXPO: only use supervisors (handled by BIMBINGAN_EXPO and MILESTONE scores)
        if ($schedule->type === 'EXPO') {
            $expoScores = \App\Models\ExpoScore::where('group_id', $schedule->group_id)
                ->get()
                ->groupBy('evaluator_id');

            $milestoneScores = \App\Models\MilestoneScore::where('group_id', $schedule->group_id)
                ->get()
                ->groupBy('evaluator_id');

            // Combine EXPO and MILESTONE scores per supervisor
            $allSupervisorIds = $expoScores->keys()->merge($milestoneScores->keys())->unique();
            foreach ($allSupervisorIds as $supervisorId) {
                $expoAvg = $expoScores->has($supervisorId) ? $expoScores[$supervisorId]->avg('score') : null;
                $milestoneAvg = $milestoneScores->has($supervisorId) ? $milestoneScores[$supervisorId]->avg('score') : null;

                if ($expoAvg !== null && $milestoneAvg !== null) {
                    $dosenAverages[] = ($expoAvg + $milestoneAvg) / 2;
                } elseif ($expoAvg !== null) {
                    $dosenAverages[] = $expoAvg;
                } elseif ($milestoneAvg !== null) {
                    $dosenAverages[] = $milestoneAvg;
                }
            }
        }

        // Calculate final score (average of all dosen averages)
        if (count($dosenAverages) > 0) {
            return round(array_sum($dosenAverages) / count($dosenAverages), 2);
        }

        return 0;
    }

    /**
     * Calculate final TA defense score from examiners AND supervisors
     * Formula: Average of (per-dosen averages) from both examiners and supervisors
     *
     * @param TaDefenseSchedule $schedule
     * @return float
     */
    private function calculateFinalTaDefenseScore(TaDefenseSchedule $schedule): float
    {
        $dosenAverages = [];

        // Get examiner scores from sidang_ta_scores table
        $examiners = TaDefenseExaminer::where('schedule_id', $schedule->id)
            ->whereIn('role', ['EXAMINER_1', 'EXAMINER_2'])
            ->pluck('examiner_id');

        if ($examiners->isNotEmpty()) {
            $examinerScores = SidangTaScore::where('group_id', $schedule->group_id)
                ->whereIn('examiner_id', $examiners)
                ->get()
                ->groupBy('examiner_id');

            foreach ($examinerScores as $examinerId => $scores) {
                $dosenAverages[] = $scores->avg('score');
            }
        }

        // Get supervisor scores from bimbingan_ta_scores table
        $group = Group::find($schedule->group_id);
        if ($group) {
            $supervisorIds = array_filter([$group->supervisor_1_id, $group->supervisor_2_id]);
            if (!empty($supervisorIds)) {
                $supervisorScores = BimbinganTaScore::where('group_id', $schedule->group_id)
                    ->whereIn('evaluator_id', $supervisorIds)
                    ->get()
                    ->groupBy('evaluator_id');

                foreach ($supervisorScores as $supervisorId => $scores) {
                    $dosenAverages[] = $scores->avg('score');
                }
            }
        }

        // Calculate final score (average of all dosen averages)
        if (count($dosenAverages) > 0) {
            return round(array_sum($dosenAverages) / count($dosenAverages), 2);
        }

        return 0;
    }
}
