<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Concerns\ResolvesActivePeriods;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Location;
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
    use ApiResponseTrait, RequiresActivePeriod, ResolvesActivePeriods;

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
     * Cross-period: Fetches schedules from all active and finalized periods by default.
     */
    public function index(Request $request)
    {
        // Get active and finalized period IDs for cross-period fetching
        $periodIds = $this->getActiveAndFinalizedPeriodIds();

        $query = SeminarSchedule::with(['group.title', 'group.period', 'examiner1', 'examiner2', 'evaluations.examiner'])
            ->where('type', 'EXPO')
            ->whereHas('group', function ($q) use ($periodIds, $request) {
                // Filter by active/finalized periods
                $q->whereIn('period_id', $periodIds);

                // Allow explicit period filter if provided
                if ($request->has('period_id')) {
                    $q->where('period_id', $request->period_id);
                }
            })
            ->orderByDesc('date');

        return $this->successResponse($query->get());
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
            'location_id' => 'nullable|exists:locations,id',
            // Examiners are now optional for EXPO (only supervisors evaluate EXPO)
            'examiner_1_id' => 'nullable|exists:users,id',
            'examiner_2_id' => 'nullable|exists:users,id|different:examiner_1_id',
        ]);

        $group = Group::with('period')->findOrFail($request->group_id);

        $this->ensurePeriodIsActive($group);

        if ($group->status !== 'PDC2_READY_FOR_EXPO') {
            return $this->errorResponse('Group must be in PDC2_READY_FOR_EXPO status.', 400);
        }

        // Check TA eligibility
        if (! $this->eligibilityService->isEligible($group)) {
            return $this->errorResponse('Group does not meet Expo TA eligibility requirements.', 400);
        }

        // Validate examiners cannot be supervisors (only if examiners are provided)
        $supervisorIds = $group->supervisors()->pluck('supervisor_id')->toArray();
        if ($request->examiner_1_id && in_array($request->examiner_1_id, $supervisorIds)) {
            return $this->errorResponse('Examiner 1 cannot be a supervisor of this group.', 400);
        }
        if ($request->examiner_2_id && in_array($request->examiner_2_id, $supervisorIds)) {
            return $this->errorResponse('Examiner 2 cannot be a supervisor of this group.', 400);
        }

        // Check existing EXPO schedule
        $existing = SeminarSchedule::where('group_id', $group->id)
            ->where('type', 'EXPO')
            ->where('status', '!=', 'CANCELLED')
            ->first();
        if ($existing) {
            return $this->errorResponse('Group already has an EXPO schedule.', 400);
        }

        // Determine room/location for conflict checking
        $room = $request->room;
        if ($request->location_id) {
            $location = Location::find($request->location_id);
            $room = $location->name;
        }

        // Double-booking & room conflict check (only check examiners if provided)
        $examinerIds = array_filter([$request->examiner_1_id, $request->examiner_2_id]);
        $conflicts = $this->schedulingService->validateScheduleConflicts(
            $examinerIds,
            $request->date,
            $request->start_time,
            $request->end_time,
            $room
        );

        if (! empty($conflicts)) {
            return $this->errorResponse('Scheduling conflicts detected.', 400, ['conflicts' => $conflicts]);
        }

        $schedule = SeminarSchedule::create([
            'group_id' => $group->id,
            'type' => 'EXPO',
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'room' => $room,
            'location_id' => $request->location_id,
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
        if (! empty($examinerIds)) {
            $notificationService->sendToMany(
                $examinerIds,
                'SCHEDULE_APPROVED',
                'You are assigned as an examiner',
                "You have been assigned as an examiner for an EXPO on {$schedule->date} at {$schedule->start_time}.",
                'seminar_schedules',
                $schedule->id
            );
        }

        return $this->successResponse($schedule->load(['examiner1', 'examiner2', 'evaluations']), 'EXPO scheduled.');
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

        if (! $evaluation) {
            return $this->unauthorizedResponse('You are not assigned as examiner for this schedule.');
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
                    Log::error('Failed to send deadline notification: '.$e->getMessage());
                }
            }

            return $this->successResponse($result, $result['all_submitted']
                ? "All evaluations submitted. EXPO result: {$result['result']}"
                : 'Evaluation submitted. Waiting for other examiner.');
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage(), 400);
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
        if (! empty($examinerIds)) {
            $constraintError = $this->schedulingService->validateExaminerConstraints($group, $examinerIds);
            if ($constraintError) {
                return $this->errorResponse($constraintError, 400);
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

        if (! empty($conflicts)) {
            return $this->errorResponse('Scheduling conflicts detected.', 400, ['conflicts' => $conflicts]);
        }

        $schedule->update([
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

        return $this->successResponse($schedule->load(['examiner1', 'examiner2', 'evaluations']), 'EXPO schedule approved.');
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

        return $this->successResponse($schedule, 'EXPO schedule request rejected.');
    }
}
