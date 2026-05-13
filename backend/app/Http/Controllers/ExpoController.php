<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\SeminarEvaluation;
use App\Models\SeminarSchedule;
use App\Services\ExpoEligibilityService;
use App\Services\GroupStateMachine;
use App\Services\NotificationService;
use App\Services\SchedulingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ExpoController extends Controller
{
    use RequiresActivePeriod;

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
    public function index(Request $request)
    {
        $query = SeminarSchedule::with(['group.title', 'group.period', 'examiner1', 'examiner2', 'evaluations.examiner'])
            ->where('type', 'EXPO')
            ->orderByDesc('date');

        if ($request->has('period_id')) {
            $query->whereHas('group', function ($q) use ($request) {
                $q->where('period_id', $request->period_id);
            });
        }

        return response()->json(['data' => $query->get()]);
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
            // Examiners are now optional for EXPO (only supervisors evaluate EXPO)
            'examiner_1_id' => 'nullable|exists:users,id',
            'examiner_2_id' => 'nullable|exists:users,id|different:examiner_1_id',
        ]);

        $group = Group::with('period')->findOrFail($request->group_id);

        $this->ensurePeriodIsActive($group);

        if ($group->status !== 'PDC2_READY_FOR_EXPO') {
            return response()->json(['message' => 'Group must be in PDC2_READY_FOR_EXPO status.'], 400);
        }

        // Check TA eligibility
        if (!$this->eligibilityService->isEligible($group)) {
            return response()->json(['message' => 'Group does not meet Expo TA eligibility requirements.'], 400);
        }

        // Validate examiners cannot be supervisors (only if examiners are provided)
        $supervisorIds = $group->supervisors()->pluck('supervisor_id')->toArray();
        if ($request->examiner_1_id && in_array($request->examiner_1_id, $supervisorIds)) {
            return response()->json(['message' => 'Examiner 1 cannot be a supervisor of this group.'], 400);
        }
        if ($request->examiner_2_id && in_array($request->examiner_2_id, $supervisorIds)) {
            return response()->json(['message' => 'Examiner 2 cannot be a supervisor of this group.'], 400);
        }

        // Check existing EXPO schedule
        $existing = SeminarSchedule::where('group_id', $group->id)
            ->where('type', 'EXPO')
            ->where('status', '!=', 'CANCELLED')
            ->first();
        if ($existing) {
            return response()->json(['message' => 'Group already has an EXPO schedule.'], 400);
        }

        // Double-booking & room conflict check (only check examiners if provided)
        $examinerIds = array_filter([$request->examiner_1_id, $request->examiner_2_id]);
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

        // Send notifications
        $notificationService = app(\App\Services\NotificationService::class);
        $studentIds = $group->members()->pluck('student_id')->toArray();
        $notificationService->sendToMany(
            $studentIds,
            'SCHEDULE_APPROVED',
            'EXPO Scheduled',
            "Your EXPO schedule has been set for {$schedule->date} at {$schedule->start_time}.",
            'seminar_schedules',
            $schedule->id
        );
        
        // Only notify examiners if they are assigned (EXPO no longer requires examiners)
        $examinerIds = array_filter([$schedule->examiner_1_id, $schedule->examiner_2_id]);
        if (!empty($examinerIds)) {
            $notificationService->sendToMany(
                $examinerIds,
                'SCHEDULE_APPROVED',
                'You are assigned as an examiner',
                "You have been assigned as an examiner for an EXPO on {$schedule->date} at {$schedule->start_time}.",
                'seminar_schedules',
                $schedule->id
            );
        }

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

        // Get schedule for deadline tracking
        $schedule = SeminarSchedule::with('group.period')->find($scheduleId);
        if ($schedule) {
            $this->ensurePeriodIsActive($schedule->group);
        }
        $deadlinePassed = $schedule && $schedule->evaluation_deadline && now() > $schedule->evaluation_deadline;

        try {
            $result = $this->schedulingService->submitSeminarEvaluation(
                $evaluation->id,
                $request->rubric_json,
                $request->score,
                $request->result,
                $user->id
            );

            // Send notification if deadline has passed
            if ($deadlinePassed) {
                try {
                    $notificationService = app(NotificationService::class);
                    $group = Group::find($schedule->group_id);
                    $groupName = $group ? $group->name : "Group {$schedule->group_id}";
                    $deadlineFormatted = $schedule->evaluation_deadline ? date('d M Y H:i', strtotime($schedule->evaluation_deadline)) : 'Unknown';

                    $notificationService->send(
                        $user->id,
                        'EVALUATION_DEADLINE_PASSED',
                        'Evaluation Submitted After Deadline',
                        "Your evaluation for {$groupName} - EXPO was submitted after the deadline (due: {$deadlineFormatted}).",
                        'SeminarSchedule',
                        $scheduleId
                    );
                } catch (\Exception $e) {
                    Log::error("Failed to send deadline notification: " . $e->getMessage());
                }
            }

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
        $request->validate([
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'nullable|string',
            // Examiners are now optional for EXPO (only supervisors evaluate EXPO)
            'examiner_1_id' => 'nullable|exists:users,id',
            'examiner_2_id' => 'nullable|exists:users,id|different:examiner_1_id',
        ]);

        $schedule = SeminarSchedule::with('group.period')
            ->where('id', $id)
            ->where('type', 'EXPO')
            ->where('status', 'PENDING_APPROVAL')
            ->firstOrFail();

        $this->ensurePeriodIsActive($schedule->group);

        $group = Group::findOrFail($schedule->group_id);

        // Double guard: examiner constraints (only if examiners provided)
        $examinerIds = array_filter([$request->examiner_1_id, $request->examiner_2_id]);
        if (!empty($examinerIds)) {
            $constraintError = $this->schedulingService->validateExaminerConstraints($group, $examinerIds);
            if ($constraintError) {
                return response()->json(['message' => $constraintError], 400);
            }
        }

        // Conflict check (authoritative) - only check examiners if provided
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
        $this->schedulingService->autoGenerateSeminarEvaluations($schedule);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'EXPO_APPROVED',
            'target_type' => 'SeminarSchedule',
            'target_id' => $schedule->id,
            'payload' => ['group_id' => $group->id],
        ]);

        // Send notifications
        $notificationService = app(\App\Services\NotificationService::class);
        $studentIds = $group->members()->pluck('student_id')->toArray();
        $notificationService->sendToMany(
            $studentIds,
            'SCHEDULE_APPROVED',
            'EXPO Schedule Approved',
            "Your EXPO schedule request for {$schedule->date} at {$schedule->start_time} has been approved.",
            'seminar_schedules',
            $schedule->id
        );
        $notificationService->sendToMany(
            [$schedule->examiner_1_id, $schedule->examiner_2_id],
            'SCHEDULE_APPROVED',
            'You are assigned as an examiner',
            "You have been assigned as an examiner for an EXPO on {$schedule->date} at {$schedule->start_time}.",
            'seminar_schedules',
            $schedule->id
        );

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

        $schedule = SeminarSchedule::with('group.period')
            ->where('id', $id)
            ->where('type', 'EXPO')
            ->where('status', 'PENDING_APPROVAL')
            ->firstOrFail();

        $this->ensurePeriodIsActive($schedule->group);

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
                'EXPO Schedule Rejected',
                "Your EXPO schedule request was rejected. Reason: {$request->rejection_reason}",
                'seminar_schedules',
                $schedule->id
            );
        }

        return response()->json(['message' => 'EXPO schedule request rejected.', 'data' => $schedule]);
    }
}
