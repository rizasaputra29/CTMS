<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Supervision;
use App\Models\TaDefenseEvaluation;
use App\Models\TaDefenseExaminer;
use App\Models\TaDefenseSchedule;
use App\Models\TaSubmission;
use App\Models\User;
use App\Services\GroupStateMachine;
use App\Services\SchedulingService;
use Illuminate\Http\Request;

class TaDefenseController extends Controller
{
    use RequiresActivePeriod;

    protected GroupStateMachine $stateMachine;

    protected SchedulingService $schedulingService;

    public function __construct(GroupStateMachine $stateMachine, SchedulingService $schedulingService)
    {
        $this->stateMachine = $stateMachine;
        $this->schedulingService = $schedulingService;
    }

    /**
     * List TA defense schedules (admin).
     */
    public function index(Request $request)
    {
        $query = TaDefenseSchedule::with([
            'student',
            'group.title',
            'examiners.examiner',
            'evaluations.examiner',
        ])
            ->orderByDesc('date');

        if ($request->has('period_id')) {
            $query->whereHas('group', function ($q) use ($request) {
                $q->where('period_id', $request->period_id);
            });
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * Schedule a TA defense for a student (admin).
     * Auto-attaches supervisors from the supervisions table.
     */
    public function schedule(Request $request)
    {
        $request->validate([
            'student_id' => 'required|exists:users,id',
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'nullable|string',
            'examiner_1_id' => 'required|exists:users,id',
            'examiner_2_id' => 'required|exists:users,id|different:examiner_1_id',
        ]);

        // Find student's TA submission
        $taSubmission = TaSubmission::where('student_id', $request->student_id)
            ->where('status', 'TA_REGISTERED')
            ->first();

        if (! $taSubmission) {
            return response()->json(['message' => 'Student must have a TA submission in TA_REGISTERED status.'], 400);
        }

        $group = Group::with('period')->findOrFail($taSubmission->group_id);
        $this->ensurePeriodIsActive($group);

        // Validate examiners are dosen
        foreach (['examiner_1_id', 'examiner_2_id'] as $field) {
            $user = User::find($request->$field);
            if (! $user || ! $user->hasRole('dosen')) {
                return response()->json(['message' => "{$field} must be a dosen."], 400);
            }
        }

        // Get supervisors
        $supervisor1 = Supervision::where('group_id', $group->id)->where('role', 'SUPERVISOR_1')->first();
        $supervisor2 = Supervision::where('group_id', $group->id)->where('role', 'SUPERVISOR_2')->first();

        // Validate examiners cannot be supervisors
        $supervisorIds = array_filter([
            $supervisor1?->supervisor_id,
            $supervisor2?->supervisor_id,
        ]);
        if (in_array($request->examiner_1_id, $supervisorIds)) {
            return response()->json(['message' => 'Examiner 1 cannot be a supervisor of this group.'], 400);
        }
        if (in_array($request->examiner_2_id, $supervisorIds)) {
            return response()->json(['message' => 'Examiner 2 cannot be a supervisor of this group.'], 400);
        }

        // Collect ALL examiner IDs for double-booking check
        $allExaminerIds = array_filter([
            $request->examiner_1_id,
            $request->examiner_2_id,
            $supervisor1?->supervisor_id,
            $supervisor2?->supervisor_id,
        ]);
        $allExaminerIds = array_unique($allExaminerIds);

        // Double-booking & room conflict check
        $conflicts = $this->schedulingService->validateScheduleConflicts(
            $allExaminerIds,
            $request->date,
            $request->start_time,
            $request->end_time,
            $request->room
        );

        if (! empty($conflicts)) {
            return response()->json(['message' => 'Scheduling conflicts detected.', 'conflicts' => $conflicts], 400);
        }

        // Check no existing defense for this student
        $existing = TaDefenseSchedule::where('student_id', $request->student_id)
            ->where('status', '!=', 'CANCELLED')
            ->first();
        if ($existing) {
            return response()->json(['message' => 'Student already has a TA defense schedule.'], 400);
        }

        $schedule = TaDefenseSchedule::create([
            'student_id' => $request->student_id,
            'group_id' => $group->id,
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'room' => $request->room,
            'status' => 'SCHEDULED',
        ]);

        // Auto-attach supervisors
        if ($supervisor1) {
            TaDefenseExaminer::create([
                'schedule_id' => $schedule->id,
                'examiner_id' => $supervisor1->supervisor_id,
                'role' => 'SUPERVISOR_1',
            ]);
        }
        if ($supervisor2) {
            TaDefenseExaminer::create([
                'schedule_id' => $schedule->id,
                'examiner_id' => $supervisor2->supervisor_id,
                'role' => 'SUPERVISOR_2',
            ]);
        }

        // Assign external examiners
        TaDefenseExaminer::create([
            'schedule_id' => $schedule->id,
            'examiner_id' => $request->examiner_1_id,
            'role' => 'EXAMINER_1',
        ]);
        TaDefenseExaminer::create([
            'schedule_id' => $schedule->id,
            'examiner_id' => $request->examiner_2_id,
            'role' => 'EXAMINER_2',
        ]);

        // Auto-generate evaluation rows for all examiners
        $this->schedulingService->autoGenerateTaDefenseEvaluations($schedule);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'TA_DEFENSE_SCHEDULED',
            'target_type' => 'TaDefenseSchedule',
            'target_id' => $schedule->id,
            'payload' => ['student_id' => $request->student_id, 'group_id' => $group->id],
        ]);

        // Send notifications
        $notificationService = app(\App\Services\NotificationService::class);
        $notificationService->send(
            $request->student_id,
            'SCHEDULE_APPROVED',
            'TA Defense Scheduled',
            "Your TA defense schedule has been set for {$schedule->date} at {$schedule->start_time}.",
            'ta_defense_schedules',
            $schedule->id
        );

        $examinerIds = array_unique(array_filter([
            $request->examiner_1_id,
            $request->examiner_2_id,
            $supervisor1?->supervisor_id,
            $supervisor2?->supervisor_id,
        ]));
        $notificationService->sendToMany(
            $examinerIds,
            'SCHEDULE_APPROVED',
            'You are assigned as an examiner/supervisor',
            "You have been assigned to a TA defense on {$schedule->date} at {$schedule->start_time}.",
            'ta_defense_schedules',
            $schedule->id
        );

        return response()->json([
            'message' => 'TA defense scheduled.',
            'data' => $schedule->load(['student', 'examiners.examiner', 'evaluations']),
        ]);
    }

    /**
     * Submit TA defense evaluation (per-examiner, transactional).
     */
    public function evaluate(Request $request, $scheduleId)
    {
        $request->validate([
            'rubric_json' => 'required|array',
            'score' => 'required|numeric|min:0|max:100',
            'student_id' => 'nullable|exists:users,id',
        ]);

        $user = $request->user();

        $evaluationQuery = TaDefenseEvaluation::where('schedule_id', $scheduleId)
            ->where('examiner_id', $user->id);

        // Filter by student_id if provided (for multi-student schedules)
        if ($request->has('student_id')) {
            $evaluationQuery->where('student_id', $request->student_id);
        }

        $evaluation = $evaluationQuery->first();

        if (! $evaluation) {
            return response()->json(['message' => 'You are not assigned as examiner for this defense.'], 403);
        }

        $schedule = TaDefenseSchedule::with('group.period')->find($scheduleId);
        if ($schedule) {
            $this->ensurePeriodIsActive($schedule->group);
        }

        $schedule = TaDefenseSchedule::with('group.period')->find($scheduleId);
        if ($schedule?->group) {
            $this->ensurePeriodIsActive($schedule->group);
        }

        try {
            // Calculate result based on score threshold (60)
            $result = $request->score >= 60 ? 'PASS' : 'FAIL';

            $evaluationResult = $this->schedulingService->submitTaDefenseEvaluation(
                $evaluation->id,
                $request->rubric_json,
                $request->score,
                $result,
                $user->id
            );

            return response()->json([
                'message' => $evaluationResult['all_submitted']
                    ? "All evaluations submitted. TA defense result: {$evaluationResult['result']}"
                    : 'Evaluation submitted. Waiting for other evaluators.',
                'data' => $evaluationResult,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Student view: my TA defense schedule.
     * Supports both single and multiple students via pivot table.
     */
    public function myDefense(Request $request)
    {
        $user = $request->user();

        $schedule = TaDefenseSchedule::with(['examiners.examiner', 'evaluations.examiner', 'students'])
            ->whereHas('students', function ($q) use ($user) {
                $q->where('student_id', $user->id);
            })
            ->first();

        return response()->json(['data' => $schedule]);
    }

    /**
     * Approve a student-submitted TA defense schedule request (admin).
     * Auto-attaches supervisors and validates conflicts.
     */
    public function approve(Request $request, $id)
    {
        $request->validate([
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'nullable|string',
            'examiner_1_id' => 'required|exists:users,id',
            'examiner_2_id' => 'required|exists:users,id|different:examiner_1_id',
        ]);

        $schedule = TaDefenseSchedule::with('group.period')->where('id', $id)
            ->where('status', 'PENDING_APPROVAL')
            ->firstOrFail();

        $group = Group::findOrFail($schedule->group_id);
        $this->ensurePeriodIsActive($group);

        // Get supervisors for this group
        $supervisor1 = Supervision::where('group_id', $group->id)->where('role', 'SUPERVISOR_1')->first();
        $supervisor2 = Supervision::where('group_id', $group->id)->where('role', 'SUPERVISOR_2')->first();

        // Double guard: examiner constraints
        $examinerIds = [$request->examiner_1_id, $request->examiner_2_id];
        $constraintError = $this->schedulingService->validateExaminerConstraints($group, $examinerIds);
        if ($constraintError) {
            return response()->json(['message' => $constraintError], 400);
        }

        // Collect ALL participant IDs for conflict check (examiners + supervisors)
        $allParticipantIds = array_unique(array_filter(array_merge(
            $examinerIds,
            [$supervisor1?->supervisor_id, $supervisor2?->supervisor_id]
        )));

        // Conflict check (authoritative)
        $conflicts = $this->schedulingService->validateScheduleConflicts(
            $allParticipantIds,
            $request->date,
            $request->start_time,
            $request->end_time,
            $request->room
        );

        if (! empty($conflicts)) {
            return response()->json(['message' => 'Scheduling conflicts detected.', 'conflicts' => $conflicts], 400);
        }

        $schedule->update([
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'room' => $request->room,
            'status' => 'SCHEDULED',
        ]);

        // Recreate examiners based on request
        TaDefenseExaminer::where('schedule_id', $schedule->id)->delete();
        TaDefenseExaminer::create([
            'schedule_id' => $schedule->id,
            'examiner_id' => $request->examiner_1_id,
            'role' => 'EXAMINER_1',
        ]);
        TaDefenseExaminer::create([
            'schedule_id' => $schedule->id,
            'examiner_id' => $request->examiner_2_id,
            'role' => 'EXAMINER_2',
        ]);

        // Auto-attach supervisors (if not already attached)
        if ($supervisor1 && ! TaDefenseExaminer::where('schedule_id', $schedule->id)->where('examiner_id', $supervisor1->supervisor_id)->exists()) {
            TaDefenseExaminer::create([
                'schedule_id' => $schedule->id,
                'examiner_id' => $supervisor1->supervisor_id,
                'role' => 'SUPERVISOR_1',
            ]);
        }
        if ($supervisor2 && ! TaDefenseExaminer::where('schedule_id', $schedule->id)->where('examiner_id', $supervisor2->supervisor_id)->exists()) {
            TaDefenseExaminer::create([
                'schedule_id' => $schedule->id,
                'examiner_id' => $supervisor2->supervisor_id,
                'role' => 'SUPERVISOR_2',
            ]);
        }

        // Auto-generate evaluation rows for all examiners
        $this->schedulingService->autoGenerateTaDefenseEvaluations($schedule);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'TA_DEFENSE_APPROVED',
            'target_type' => 'TaDefenseSchedule',
            'target_id' => $schedule->id,
            'payload' => ['student_id' => $schedule->student_id, 'group_id' => $schedule->group_id],
        ]);

        // Send notifications
        $notificationService = app(\App\Services\NotificationService::class);
        $notificationService->send(
            $schedule->student_id,
            'SCHEDULE_APPROVED',
            'TA Defense Schedule Approved',
            "Your TA defense schedule request for {$schedule->date} at {$schedule->start_time} has been approved.",
            'ta_defense_schedules',
            $schedule->id
        );

        $notificationService->sendToMany(
            $allParticipantIds,
            'SCHEDULE_APPROVED',
            'You are assigned to a TA Defense',
            "You have been assigned as an examiner/supervisor for a TA defense on {$schedule->date} at {$schedule->start_time}.",
            'ta_defense_schedules',
            $schedule->id
        );

        return response()->json([
            'message' => 'TA defense schedule approved.',
            'data' => $schedule->load(['student', 'examiners.examiner', 'evaluations']),
        ]);
    }

    /**
     * Reject a student-submitted TA defense schedule request (admin).
     */
    public function reject(Request $request, $id)
    {
        $request->validate(['rejection_reason' => 'required|string|max:1000']);

        $schedule = TaDefenseSchedule::with('group.period')
            ->where('id', $id)
            ->where('status', 'PENDING_APPROVAL')
            ->firstOrFail();

        $this->ensurePeriodIsActive($schedule->group);

        $schedule->update([
            'status' => 'CANCELLED',
            'rejection_reason' => $request->rejection_reason,
        ]);

        app(\App\Services\NotificationService::class)->send(
            $schedule->student_id,
            'SCHEDULE_REJECTED',
            'TA Defense Schedule Rejected',
            "Your TA defense schedule request was rejected. Reason: {$request->rejection_reason}",
            'ta_defense_schedules',
            $schedule->id
        );

        return response()->json(['message' => 'TA defense schedule request rejected.', 'data' => $schedule]);
    }
}
