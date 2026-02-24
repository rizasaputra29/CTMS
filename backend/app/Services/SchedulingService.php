<?php

namespace App\Services;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\SeminarEvaluation;
use App\Models\SeminarSchedule;
use App\Models\TaDefenseEvaluation;
use App\Models\TaDefenseExaminer;
use App\Models\TaDefenseSchedule;
use App\Models\TaSubmission;
use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;

class SchedulingService
{
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

    // ══════════════════════════════════════════
    // Double-Booking & Room Conflict Checks
    // ══════════════════════════════════════════

    /**
     * Check if an examiner has an overlapping schedule on the given date/time range.
     * Queries BOTH seminar_schedules and ta_defense_schedules.
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
        // Check seminar_schedules (examiner as examiner_1 or examiner_2)
        $seminarConflict = SeminarSchedule::where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
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

        // Check ta_defense_schedules via ta_defense_examiners
        $taConflict = TaDefenseSchedule::where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->whereHas('examiners', fn($q) => $q->where('examiner_id', $examinerId))
            ->when($excludeTaDefenseId, fn($q) => $q->where('id', '!=', $excludeTaDefenseId))
            ->first();

        if ($taConflict) {
            return [
                'type' => 'ta_defense',
                'schedule' => $taConflict,
                'message' => "Examiner has a conflicting TA defense schedule on {$date} ({$taConflict->start_time}-{$taConflict->end_time})",
            ];
        }

        return null; // No conflict
    }

    /**
     * Check if a room has an overlapping schedule on the given date/time range.
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

        $seminarConflict = SeminarSchedule::where('room', $room)
            ->where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->when($excludeSeminarId, fn($q) => $q->where('id', '!=', $excludeSeminarId))
            ->first();

        if ($seminarConflict) {
            return [
                'type' => 'seminar',
                'message' => "Room '{$room}' is already booked for {$seminarConflict->type} on {$date} ({$seminarConflict->start_time}-{$seminarConflict->end_time})",
            ];
        }

        $taConflict = TaDefenseSchedule::where('room', $room)
            ->where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->when($excludeTaDefenseId, fn($q) => $q->where('id', '!=', $excludeTaDefenseId))
            ->first();

        if ($taConflict) {
            return [
                'type' => 'ta_defense',
                'message' => "Room '{$room}' is already booked for TA defense on {$date} ({$taConflict->start_time}-{$taConflict->end_time})",
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

    // ══════════════════════════════════════════
    // Auto-Generate Evaluation Rows
    // ══════════════════════════════════════════

    /**
     * Auto-generate PENDING evaluation rows for a seminar schedule.
     */
    public function autoGenerateSeminarEvaluations(SeminarSchedule $schedule): void
    {
        foreach ([$schedule->examiner_1_id, $schedule->examiner_2_id] as $examinerId) {
            SeminarEvaluation::create([
                'schedule_id' => $schedule->id,
                'examiner_id' => $examinerId,
                'status' => 'PENDING',
            ]);
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

            // Check if ALL evaluations for this schedule are submitted
            $schedule = SeminarSchedule::lockForUpdate()->findOrFail($evaluation->schedule_id);
            $totalEvals = SeminarEvaluation::where('schedule_id', $schedule->id)->count();
            $submittedEvals = SeminarEvaluation::where('schedule_id', $schedule->id)
                ->where('status', 'SUBMITTED')
                ->count();

            $allSubmitted = $submittedEvals >= $totalEvals;

            if ($allSubmitted) {
                $schedule->update(['status' => 'COMPLETED']);

                // Determine group transition based on result
                $group = Group::findOrFail($schedule->group_id);

                if ($schedule->type === 'SEMPRO') {
                    if ($result === 'PASS') {
                        $this->stateMachine->transition($group, 'PDC2_ACTIVE');
                    } else {
                        $this->stateMachine->transition($group, 'PDC1_ACTIVE');
                    }
                } elseif ($schedule->type === 'EXPO') {
                    if ($result === 'PASS') {
                        $this->stateMachine->transition($group, 'EXPO_DONE');
                    }
                    // FAIL: stays at current status for re-evaluation
                }

                AuditLog::create([
                    'user_id' => $userId,
                    'action' => "{$schedule->type}_{$result}",
                    'target_type' => 'SeminarSchedule',
                    'target_id' => $schedule->id,
                    'payload' => [
                        'group_id' => $group->id,
                        'avg_score' => SeminarEvaluation::where('schedule_id', $schedule->id)->avg('score'),
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

            // Check if ALL evaluations for this TA defense are submitted
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

                if ($result === 'PASS') {
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
                    'action' => "TA_DEFENSE_{$result}",
                    'target_type' => 'TaDefenseSchedule',
                    'target_id' => $schedule->id,
                    'payload' => [
                        'student_id' => $schedule->student_id,
                        'avg_score' => TaDefenseEvaluation::where('schedule_id', $schedule->id)->avg('score'),
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
}
