<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Group;
use App\Models\SeminarEvaluation;
use App\Models\SeminarSchedule;
use App\Services\GroupStateMachine;
use App\Services\SchedulingService;
use Illuminate\Http\Request;

class SemproController extends Controller
{
    protected GroupStateMachine $stateMachine;
    protected SchedulingService $schedulingService;

    public function __construct(GroupStateMachine $stateMachine, SchedulingService $schedulingService)
    {
        $this->stateMachine = $stateMachine;
        $this->schedulingService = $schedulingService;
    }

    /**
     * List SEMPRO schedules (admin).
     */
    public function index()
    {
        $schedules = SeminarSchedule::with(['group.title', 'examiner1', 'examiner2', 'evaluations.examiner'])
            ->where('type', 'SEMPRO')
            ->orderByDesc('date')
            ->get();

        return response()->json(['data' => $schedules]);
    }

    /**
     * Schedule a SEMPRO for a group (admin only).
     * Validates double-booking and room conflicts.
     * Auto-generates evaluation rows for each examiner.
     */
    public function schedule(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'nullable|string',
            'examiner_1_id' => 'required|exists:users,id',
            'examiner_2_id' => 'required|exists:users,id|different:examiner_1_id',
        ]);

        $group = Group::findOrFail($request->group_id);

        if ($group->status !== 'READY_FOR_SEMPRO') {
            return response()->json(['message' => 'Group must be in READY_FOR_SEMPRO status.'], 400);
        }

        // Check existing SEMPRO schedule
        $existing = SeminarSchedule::where('group_id', $group->id)
            ->where('type', 'SEMPRO')
            ->where('status', '!=', 'CANCELLED')
            ->first();
        if ($existing) {
            return response()->json(['message' => 'Group already has a SEMPRO schedule.'], 400);
        }

        // Double-booking & room conflict check
        $conflicts = $this->schedulingService->validateScheduleConflicts(
            [$request->examiner_1_id, $request->examiner_2_id],
            $request->date,
            $request->start_time,
            $request->end_time,
            $request->room
        );

        if (!empty($conflicts)) {
            return response()->json(['message' => 'Scheduling conflicts detected.', 'conflicts' => $conflicts], 400);
        }

        $schedule = SeminarSchedule::create([
            'group_id' => $group->id,
            'type' => 'SEMPRO',
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'room' => $request->room,
            'examiner_1_id' => $request->examiner_1_id,
            'examiner_2_id' => $request->examiner_2_id,
            'status' => 'SCHEDULED',
        ]);

        // Auto-generate evaluation rows
        $this->schedulingService->autoGenerateSeminarEvaluations($schedule);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'SEMPRO_SCHEDULED',
            'target_type' => 'SeminarSchedule',
            'target_id' => $schedule->id,
            'payload' => ['group_id' => $group->id],
        ]);

        // Send notifications to group members and examiners
        $notificationService = app(\App\Services\NotificationService::class);
        $studentIds = $group->members()->pluck('student_id')->toArray();
        $notificationService->sendToMany(
            $studentIds,
            'SCHEDULE_APPROVED', // Using existing type for scheduled
            'SEMPRO Scheduled',
            "Your SEMPRO schedule has been set for {$schedule->date} at {$schedule->start_time}.",
            'seminar_schedules',
            $schedule->id
        );
        $notificationService->sendToMany(
            [$schedule->examiner_1_id, $schedule->examiner_2_id],
            'SCHEDULE_APPROVED',
            'You are assigned as an examiner',
            "You have been assigned as an examiner for a SEMPRO on {$schedule->date} at {$schedule->start_time}.",
            'seminar_schedules',
            $schedule->id
        );

        return response()->json([
            'message' => 'SEMPRO scheduled.',
            'data' => $schedule->load(['examiner1', 'examiner2', 'evaluations']),
        ]);
    }

    /**
     * Submit SEMPRO evaluation (per-examiner, transactional).
     */
    public function evaluate(Request $request, $scheduleId)
    {
        $request->validate([
            'rubric_json' => 'required|array',
            'score' => 'required|numeric|min:0|max:100',
            'result' => 'required|in:PASS,FAIL',
        ]);

        $user = $request->user();

        // Find the examiner's evaluation row
        $evaluation = SeminarEvaluation::where('schedule_id', $scheduleId)
            ->where('examiner_id', $user->id)
            ->first();

        if (!$evaluation) {
            return response()->json(['message' => 'You are not assigned as examiner for this schedule.'], 403);
        }

        try {
            $result = $this->schedulingService->submitSeminarEvaluation(
                $evaluation->id,
                $request->rubric_json,
                $request->score,
                $request->result,
                $user->id
            );

            return response()->json([
                'message' => $result['all_submitted']
                    ? "All evaluations submitted. SEMPRO result: {$result['result']}"
                    : 'Evaluation submitted. Waiting for other examiner.',
                'data' => $result,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Approve a student-submitted SEMPRO schedule request (admin).
     * Conflict validation happens HERE — authoritative layer.
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

        $schedule = SeminarSchedule::where('id', $id)
            ->where('type', 'SEMPRO')
            ->where('status', 'PENDING_APPROVAL')
            ->firstOrFail();

        $group = Group::findOrFail($schedule->group_id);

        // Double guard: examiner constraints
        $examinerIds = [$request->examiner_1_id, $request->examiner_2_id];
        $constraintError = $this->schedulingService->validateExaminerConstraints($group, $examinerIds);
        if ($constraintError) {
            return response()->json(['message' => $constraintError], 400);
        }

        // Conflict check (authoritative — only at approval)
        $conflicts = $this->schedulingService->validateScheduleConflicts(
            $examinerIds,
            $request->date,
            $request->start_time,
            $request->end_time,
            $request->room
        );

        if (!empty($conflicts)) {
            return response()->json(['message' => 'Scheduling conflicts detected.', 'conflicts' => $conflicts], 400);
        }

        $schedule->update([
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'room' => $request->room,
            'examiner_1_id' => $request->examiner_1_id,
            'examiner_2_id' => $request->examiner_2_id,
            'status' => 'SCHEDULED'
        ]);

        // Auto-generate evaluation rows
        $this->schedulingService->autoGenerateSeminarEvaluations($schedule);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'SEMPRO_APPROVED',
            'target_type' => 'SeminarSchedule',
            'target_id' => $schedule->id,
            'payload' => ['group_id' => $group->id],
        ]);

        // Send notifications to group members and examiners
        $notificationService = app(\App\Services\NotificationService::class);
        $studentIds = $group->members()->pluck('student_id')->toArray();
        $notificationService->sendToMany(
            $studentIds,
            'SCHEDULE_APPROVED',
            'SEMPRO Schedule Approved',
            "Your SEMPRO schedule request for {$schedule->date} at {$schedule->start_time} has been approved.",
            'seminar_schedules',
            $schedule->id
        );
        $notificationService->sendToMany(
            [$schedule->examiner_1_id, $schedule->examiner_2_id],
            'SCHEDULE_APPROVED',
            'You are assigned as an examiner',
            "You have been assigned as an examiner for a SEMPRO on {$schedule->date} at {$schedule->start_time}.",
            'seminar_schedules',
            $schedule->id
        );

        return response()->json([
            'message' => 'SEMPRO schedule approved.',
            'data' => $schedule->load(['examiner1', 'examiner2', 'evaluations']),
        ]);
    }

    /**
     * Reject a student-submitted SEMPRO schedule request (admin).
     */
    public function reject(Request $request, $id)
    {
        $request->validate([
            'rejection_reason' => 'required|string|max:1000',
        ]);

        $schedule = SeminarSchedule::where('id', $id)
            ->where('type', 'SEMPRO')
            ->where('status', 'PENDING_APPROVAL')
            ->firstOrFail();

        $schedule->update([
            'status' => 'CANCELLED',
            'rejection_reason' => $request->rejection_reason,
        ]);

        // Notify students
        $notificationService = app(\App\Services\NotificationService::class);
        $group = Group::find($schedule->group_id);
        if ($group) {
            $studentIds = $group->members()->pluck('student_id')->toArray();
            $notificationService->sendToMany(
                $studentIds,
                'SCHEDULE_REJECTED',
                'SEMPRO Schedule Rejected',
                "Your SEMPRO schedule request was rejected. Reason: {$request->rejection_reason}",
                'seminar_schedules',
                $schedule->id
            );
        }

        return response()->json([
            'message' => 'SEMPRO schedule request rejected.',
            'data' => $schedule,
        ]);
    }
}
