<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Location;
use App\Models\Period;
use App\Models\SeminarEvaluation;
use App\Models\SeminarSchedule;
use App\Services\GroupStateMachine;
use App\Services\NotificationService;
use App\Services\SchedulingService;
use App\Repositories\AssessmentScoreRepository;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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
     * Cross-period: Fetches schedules from all active and finalized periods by default.
     */
    public function index(Request $request)
    {
        // Get active and finalized period IDs for cross-period fetching
        $periodIds = $this->getActiveAndFinalizedPeriodIds();

        $query = SeminarSchedule::with(['group.title', 'group.supervisor1', 'group.supervisor2', 'group.members.student', 'group.period', 'examiner1', 'examiner2', 'evaluations.examiner', 'location'])
            ->where('type', 'SEMPRO')
            ->whereHas('group', function ($q) use ($periodIds, $request) {
                // Filter by active/finalized periods
                $q->whereIn('period_id', $periodIds);

                // Allow explicit period filter if provided
                if ($request->has('period_id')) {
                    $q->where('period_id', $request->period_id);
                }
            })
            ->orderByDesc('date');

        $schedules = $query->get();

        $groupIds = $schedules->pluck('group_id')->unique()->filter()->values();

        $bimbinganScores = AssessmentScoreRepository::forType('BIMBINGAN_SEMPRO')
            ->with('evaluator')
            ->whereIn('group_id', $groupIds)
            ->get()
            ->groupBy('student_id');

        foreach ($schedules as $schedule) {
            $members = $schedule->group->members ?? collect();
            $bimbinganByStudent = [];

            foreach ($members as $member) {
                $studentId = $member->student_id;
                $evalRecords = $bimbinganScores->get($studentId, collect());

                if ($evalRecords->isNotEmpty()) {
                    $avg = round($evalRecords->avg('score'), 2);
                    $bimbinganByStudent[] = [
                        'student' => $member->student,
                        'average_score' => $avg,
                    ];
                }
            }

            $schedule->bimbingan_evaluations = array_values($bimbinganByStudent);

            // Examiner evaluations: per-student average across all examiners
            $studentExamScores = [];
            foreach ($schedule->evaluations as $evaluation) {
                if ($evaluation->status !== 'SUBMITTED') {
                    continue;
                }
                $rubric = $evaluation->rubric_json ?? [];
                $scores = $rubric['scores'] ?? [];
                foreach ($scores as $key => $score) {
                    // key format: "componentId_studentId"
                    $parts = explode('_', (string) $key);
                    $studentId = (int) ($parts[1] ?? 0);
                    if ($studentId <= 0) {
                        continue;
                    }
                    if (!isset($studentExamScores[$studentId])) {
                        $studentExamScores[$studentId] = [];
                    }
                    $studentExamScores[$studentId][] = (float) $score;
                }
            }

            $examinerAverages = [];
            foreach ($members as $member) {
                $sid = $member->student_id;
                if (isset($studentExamScores[$sid]) && count($studentExamScores[$sid]) > 0) {
                    $examinerAverages[] = [
                        'student' => $member->student,
                        'average_score' => round(array_sum($studentExamScores[$sid]) / count($studentExamScores[$sid]), 2),
                    ];
                }
            }
            $schedule->examiner_student_averages = array_values($examinerAverages);
        }

        return response()->json(['data' => $schedules]);
    }

    /**
     * Get cached active and finalized period IDs.
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
            'location_id' => 'nullable|exists:locations,id',
            'examiner_1_id' => 'required|exists:users,id',
            'examiner_2_id' => 'required|exists:users,id|different:examiner_1_id',
        ]);

        $group = Group::with(['supervisor1', 'supervisor2'])->findOrFail($request->group_id);

        if ($group->status !== 'READY_FOR_SEMPRO') {
            return response()->json(['message' => 'Group must be in READY_FOR_SEMPRO status.'], 400);
        }

        // Validate examiner cannot be supervisor
        $supervisorIds = array_filter([
            $group->supervisor_1_id,
            $group->supervisor_2_id,
        ]);

        if (in_array($request->examiner_1_id, $supervisorIds)) {
            return response()->json(['message' => 'Examiner 1 cannot be a supervisor of this group.'], 400);
        }

        if (in_array($request->examiner_2_id, $supervisorIds)) {
            return response()->json(['message' => 'Examiner 2 cannot be a supervisor of this group.'], 400);
        }

        // Check existing SEMPRO schedule - use lock to prevent race conditions
        $existing = SeminarSchedule::where('group_id', $group->id)
            ->where('type', 'SEMPRO')
            ->whereIn('status', ['SCHEDULED', 'PENDING_APPROVAL', 'APPROVED', 'COMPLETED'])
            ->lockForUpdate()
            ->first();
        if ($existing) {
            return response()->json([
                'message' => 'Group already has an active SEMPRO schedule.',
                'existing_schedule_id' => $existing->id,
                'existing_status' => $existing->status
            ], 400);
        }

        // Validate examiner constraints (including examiner ≠ supervisor)
        $examinerIds = [$request->examiner_1_id, $request->examiner_2_id];
        $constraintError = $this->schedulingService->validateExaminerConstraints($group, $examinerIds);
        if ($constraintError) {
            return response()->json(['message' => $constraintError], 400);
        }

        // Determine room/location for conflict checking
        $room = $request->room;
        if ($request->location_id) {
            $location = Location::find($request->location_id);
            $room = $location->name;
        }

        // Double-booking & room conflict check
        $conflicts = $this->schedulingService->validateScheduleConflicts(
            $examinerIds,
            $request->date,
            $request->start_time,
            $request->end_time,
            $room
        );

        if (!empty($conflicts)) {
            return response()->json(['message' => 'Scheduling conflicts detected.', 'conflicts' => $conflicts], 400);
        }

        // Use updateOrCreate to handle the unique constraint - update existing or create new
        $schedule = SeminarSchedule::updateOrCreate(
            [
                'group_id' => $group->id,
                'type' => 'SEMPRO',
            ],
            [
                'date' => $request->date,
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'room' => $room,
                'location_id' => $request->location_id,
                'examiner_1_id' => $request->examiner_1_id,
                'examiner_2_id' => $request->examiner_2_id,
                'status' => 'SCHEDULED',
            ]
        );

        // If schedule was reactivated (was CANCELLED or other status), clear old evaluations
        if (!$schedule->wasRecentlyCreated) {
            SeminarEvaluation::where('schedule_id', $schedule->id)->delete();
        }

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
     * Update an existing SEMPRO schedule (admin only).
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'nullable|string',
            'location_id' => 'nullable|exists:locations,id',
            'examiner_1_id' => 'required|exists:users,id',
            'examiner_2_id' => 'required|exists:users,id|different:examiner_1_id',
        ]);

        $schedule = SeminarSchedule::with('group')->findOrFail($id);

        if ($schedule->type !== 'SEMPRO') {
            return response()->json(['message' => 'This endpoint only updates SEMPRO schedules.'], 400);
        }

        $group = $schedule->group;

        // Validate examiner cannot be supervisor
        $supervisorIds = array_filter([
            $group->supervisor_1_id,
            $group->supervisor_2_id,
        ]);

        if (in_array($request->examiner_1_id, $supervisorIds)) {
            return response()->json(['message' => 'Examiner 1 cannot be a supervisor of this group.'], 400);
        }

        if (in_array($request->examiner_2_id, $supervisorIds)) {
            return response()->json(['message' => 'Examiner 2 cannot be a supervisor of this group.'], 400);
        }

        // Determine room/location
        $room = null;
        if ($request->location_id) {
            $location = Location::find($request->location_id);
            $room = $location ? $location->name : null;
        } elseif ($request->room) {
            // Use room string directly if no location_id provided
            $room = $request->room;
        }

        // Validate examiner constraints (including examiner ≠ supervisor)
        $examinerIds = [$request->examiner_1_id, $request->examiner_2_id];
        $constraintError = $this->schedulingService->validateExaminerConstraints($group, $examinerIds);
        if ($constraintError) {
            return response()->json(['message' => $constraintError], 400);
        }

        // Double-booking & room conflict check
        $conflicts = $this->schedulingService->validateScheduleConflicts(
            $examinerIds,
            $request->date,
            $request->start_time,
            $request->end_time,
            $room
        );

        if (!empty($conflicts)) {
            return response()->json(['message' => 'Scheduling conflicts detected.', 'conflicts' => $conflicts], 400);
        }

        // Update the schedule
        $schedule->update([
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'room' => $room,
            'location_id' => $request->location_id,
            'examiner_1_id' => $request->examiner_1_id,
            'examiner_2_id' => $request->examiner_2_id,
        ]);

        // Update examiner evaluations - remove old ones if examiner changed, add new ones
        $currentExaminerIds = [$schedule->examiner_1_id, $schedule->examiner_2_id];
        $newExaminerIds = [$request->examiner_1_id, $request->examiner_2_id];

        // Remove evaluations for removed examiners
        SeminarEvaluation::where('schedule_id', $schedule->id)
            ->whereNotIn('examiner_id', $newExaminerIds)
            ->delete();

        // Create evaluations for new examiners
        foreach ($newExaminerIds as $examinerId) {
            $exists = SeminarEvaluation::where('schedule_id', $schedule->id)
                ->where('examiner_id', $examinerId)
                ->exists();

            if (!$exists) {
                SeminarEvaluation::create([
                    'schedule_id' => $schedule->id,
                    'examiner_id' => $examinerId,
                    'rubric_json' => null,
                    'score' => null,
                    'result' => null,
                    'status' => 'PENDING',
                ]);
            }
        }

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'SEMPRO_SCHEDULE_UPDATED',
            'target_type' => 'SeminarSchedule',
            'target_id' => $schedule->id,
            'payload' => ['group_id' => $group->id],
        ]);

        return response()->json([
            'message' => 'SEMPRO schedule updated.',
            'data' => $schedule->load(['examiner1', 'examiner2', 'evaluations']),
        ]);
    }

    /**
     * Cancel a SEMPRO schedule (admin only).
     */
    public function cancel(Request $request, $id)
    {
        $schedule = SeminarSchedule::with('group')->findOrFail($id);

        if ($schedule->type !== 'SEMPRO') {
            return response()->json(['message' => 'This endpoint only cancels SEMPRO schedules.'], 400);
        }

        if ($schedule->status === 'COMPLETED') {
            return response()->json(['message' => 'Cannot cancel completed SEMPRO schedule.'], 400);
        }

        if ($schedule->status === 'CANCELLED') {
            return response()->json(['message' => 'Schedule is already cancelled.'], 400);
        }

        $group = $schedule->group;

        // Update schedule status
        $schedule->update(['status' => 'CANCELLED']);

        // Delete pending evaluations
        SeminarEvaluation::where('schedule_id', $schedule->id)
            ->where('status', 'PENDING')
            ->delete();

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'SEMPRO_SCHEDULE_CANCELLED',
            'target_type' => 'SeminarSchedule',
            'target_id' => $schedule->id,
            'payload' => ['group_id' => $group->id],
        ]);

        return response()->json([
            'message' => 'SEMPRO schedule cancelled.',
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
        ]);

        $user = $request->user();

        // Find the examiner's evaluation row
        $evaluation = SeminarEvaluation::where('schedule_id', $scheduleId)
            ->where('examiner_id', $user->id)
            ->first();

        if (!$evaluation) {
            return response()->json(['message' => 'You are not assigned as examiner for this schedule.'], 403);
        }

        // Get schedule for deadline tracking
        $schedule = SeminarSchedule::find($scheduleId);
        $deadlinePassed = $schedule && $schedule->evaluation_deadline && now() > $schedule->evaluation_deadline;

        try {
            // Calculate result based on score threshold (60)
            $result = $request->score >= 60 ? 'PASS' : 'FAIL';
            
            $evaluationResult = $this->schedulingService->submitSeminarEvaluation(
                $evaluation->id,
                $request->rubric_json,
                $request->score,
                $result,
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
                        "Your evaluation for {$groupName} - SEMPRO was submitted after the deadline (due: {$deadlineFormatted}).",
                        'SeminarSchedule',
                        $scheduleId
                    );
                } catch (\Exception $e) {
                    Log::error("Failed to send deadline notification: " . $e->getMessage());
                }
            }

            return response()->json([
                'message' => $evaluationResult['all_submitted']
                    ? "All evaluations submitted. SEMPRO result: {$evaluationResult['result']}"
                    : 'Evaluation submitted. Waiting for other examiner.',
                'data' => $evaluationResult,
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
