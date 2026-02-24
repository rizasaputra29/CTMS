<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Group;
use App\Models\SeminarEvaluation;
use App\Models\SeminarSchedule;
use App\Services\ExpoEligibilityService;
use App\Services\GroupStateMachine;
use App\Services\SchedulingService;
use Illuminate\Http\Request;

class ExpoController extends Controller
{
    protected GroupStateMachine $stateMachine;
    protected SchedulingService $schedulingService;
    protected ExpoEligibilityService $eligibilityService;

    public function __construct(
        GroupStateMachine $stateMachine,
        SchedulingService $schedulingService,
        ExpoEligibilityService $eligibilityService
    ) {
        $this->stateMachine = $stateMachine;
        $this->schedulingService = $schedulingService;
        $this->eligibilityService = $eligibilityService;
    }

    /**
     * List EXPO schedules (admin).
     */
    public function index()
    {
        $schedules = SeminarSchedule::with(['group.title', 'examiner1', 'examiner2', 'evaluations.examiner'])
            ->where('type', 'EXPO')
            ->orderByDesc('date')
            ->get();

        return response()->json(['data' => $schedules]);
    }

    /**
     * Schedule an EXPO for a group (admin only).
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

        if ($group->status !== 'PDC2_READY_FOR_EXPO') {
            return response()->json(['message' => 'Group must be in PDC2_READY_FOR_EXPO status.'], 400);
        }

        // Check TA eligibility
        if (!$this->eligibilityService->isEligible($group)) {
            return response()->json(['message' => 'Group does not meet Expo TA eligibility requirements.'], 400);
        }

        // Check existing EXPO schedule
        $existing = SeminarSchedule::where('group_id', $group->id)
            ->where('type', 'EXPO')
            ->where('status', '!=', 'CANCELLED')
            ->first();
        if ($existing) {
            return response()->json(['message' => 'Group already has an EXPO schedule.'], 400);
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
            'type' => 'EXPO',
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'room' => $request->room,
            'examiner_1_id' => $request->examiner_1_id,
            'examiner_2_id' => $request->examiner_2_id,
            'status' => 'SCHEDULED',
        ]);

        $this->schedulingService->autoGenerateSeminarEvaluations($schedule);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'EXPO_SCHEDULED',
            'target_type' => 'SeminarSchedule',
            'target_id' => $schedule->id,
            'payload' => ['group_id' => $group->id],
        ]);

        return response()->json([
            'message' => 'EXPO scheduled.',
            'data' => $schedule->load(['examiner1', 'examiner2', 'evaluations']),
        ]);
    }

    /**
     * Submit EXPO evaluation (per-examiner, transactional).
     */
    public function evaluate(Request $request, $scheduleId)
    {
        $request->validate([
            'rubric_json' => 'required|array',
            'score' => 'required|numeric|min:0|max:100',
            'result' => 'required|in:PASS,FAIL',
        ]);

        $user = $request->user();

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
                    ? "All evaluations submitted. EXPO result: {$result['result']}"
                    : 'Evaluation submitted. Waiting for other examiner.',
                'data' => $result,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Approve a student-submitted EXPO schedule request (admin).
     */
    public function approve(Request $request, $id)
    {
        $schedule = SeminarSchedule::where('id', $id)
            ->where('type', 'EXPO')
            ->where('status', 'PENDING_APPROVAL')
            ->firstOrFail();

        $group = Group::findOrFail($schedule->group_id);

        // Double guard: examiner constraints
        $examinerIds = [$schedule->examiner_1_id, $schedule->examiner_2_id];
        $constraintError = $this->schedulingService->validateExaminerConstraints($group, $examinerIds);
        if ($constraintError) {
            return response()->json(['message' => $constraintError], 400);
        }

        // Conflict check (authoritative)
        $conflicts = $this->schedulingService->validateScheduleConflicts(
            $examinerIds,
            $schedule->date->format('Y-m-d'),
            $schedule->start_time,
            $schedule->end_time,
            $schedule->room
        );

        if (!empty($conflicts)) {
            return response()->json(['message' => 'Scheduling conflicts detected.', 'conflicts' => $conflicts], 400);
        }

        $schedule->update(['status' => 'SCHEDULED']);
        $this->schedulingService->autoGenerateSeminarEvaluations($schedule);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'EXPO_APPROVED',
            'target_type' => 'SeminarSchedule',
            'target_id' => $schedule->id,
            'payload' => ['group_id' => $group->id],
        ]);

        return response()->json([
            'message' => 'EXPO schedule approved.',
            'data' => $schedule->load(['examiner1', 'examiner2', 'evaluations']),
        ]);
    }

    /**
     * Reject a student-submitted EXPO schedule request (admin).
     */
    public function reject(Request $request, $id)
    {
        $request->validate(['rejection_reason' => 'required|string|max:1000']);

        $schedule = SeminarSchedule::where('id', $id)
            ->where('type', 'EXPO')
            ->where('status', 'PENDING_APPROVAL')
            ->firstOrFail();

        $schedule->update([
            'status' => 'CANCELLED',
            'rejection_reason' => $request->rejection_reason,
        ]);

        return response()->json(['message' => 'EXPO schedule request rejected.', 'data' => $schedule]);
    }
}
