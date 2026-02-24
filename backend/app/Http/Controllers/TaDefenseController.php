<?php

namespace App\Http\Controllers;

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
    public function index()
    {
        $schedules = TaDefenseSchedule::with([
            'student',
            'group.title',
            'examiners.examiner',
            'evaluations.examiner',
        ])
            ->orderByDesc('date')
            ->get();

        return response()->json(['data' => $schedules]);
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

        if (!$taSubmission) {
            return response()->json(['message' => 'Student must have a TA submission in TA_REGISTERED status.'], 400);
        }

        $group = Group::findOrFail($taSubmission->group_id);

        // Validate examiners are dosen
        foreach (['examiner_1_id', 'examiner_2_id'] as $field) {
            $user = User::find($request->$field);
            if (!$user || $user->role !== 'dosen') {
                return response()->json(['message' => "{$field} must be a dosen."], 400);
            }
        }

        // Validate no duplicate (examiner same as supervisor would be caught by UNIQUE constraint)
        // Get supervisors
        $supervisor1 = Supervision::where('group_id', $group->id)->where('role', 'SUPERVISOR_1')->first();
        $supervisor2 = Supervision::where('group_id', $group->id)->where('role', 'SUPERVISOR_2')->first();

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

        if (!empty($conflicts)) {
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
            'result' => 'required|in:PASS,FAIL',
        ]);

        $user = $request->user();

        $evaluation = TaDefenseEvaluation::where('schedule_id', $scheduleId)
            ->where('examiner_id', $user->id)
            ->first();

        if (!$evaluation) {
            return response()->json(['message' => 'You are not assigned as examiner for this defense.'], 403);
        }

        try {
            $result = $this->schedulingService->submitTaDefenseEvaluation(
                $evaluation->id,
                $request->rubric_json,
                $request->score,
                $request->result,
                $user->id
            );

            return response()->json([
                'message' => $result['all_submitted']
                    ? "All evaluations submitted. TA defense result: {$result['result']}"
                    : 'Evaluation submitted. Waiting for other evaluators.',
                'data' => $result,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Student view: my TA defense schedule.
     */
    public function myDefense(Request $request)
    {
        $user = $request->user();

        $schedule = TaDefenseSchedule::with(['examiners.examiner', 'evaluations.examiner'])
            ->where('student_id', $user->id)
            ->first();

        return response()->json(['data' => $schedule]);
    }

    /**
     * Approve a student-submitted TA defense schedule request (admin).
     * Auto-attaches supervisors and validates conflicts.
     */
    public function approve(Request $request, $id)
    {
        $schedule = TaDefenseSchedule::where('id', $id)
            ->where('status', 'PENDING_APPROVAL')
            ->firstOrFail();

        $group = Group::findOrFail($schedule->group_id);

        // Get supervisors for this group
        $supervisor1 = Supervision::where('group_id', $group->id)->where('role', 'SUPERVISOR_1')->first();
        $supervisor2 = Supervision::where('group_id', $group->id)->where('role', 'SUPERVISOR_2')->first();

        // Double guard: examiner constraints
        $examiners = TaDefenseExaminer::where('schedule_id', $schedule->id)->get();
        $examinerIds = $examiners->pluck('examiner_id')->toArray();
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
            $schedule->date->format('Y-m-d'),
            $schedule->start_time,
            $schedule->end_time,
            $schedule->room
        );

        if (!empty($conflicts)) {
            return response()->json(['message' => 'Scheduling conflicts detected.', 'conflicts' => $conflicts], 400);
        }

        // Auto-attach supervisors (if not already attached)
        if ($supervisor1 && !TaDefenseExaminer::where('schedule_id', $schedule->id)->where('examiner_id', $supervisor1->supervisor_id)->exists()) {
            TaDefenseExaminer::create([
                'schedule_id' => $schedule->id,
                'examiner_id' => $supervisor1->supervisor_id,
                'role' => 'SUPERVISOR_1',
            ]);
        }
        if ($supervisor2 && !TaDefenseExaminer::where('schedule_id', $schedule->id)->where('examiner_id', $supervisor2->supervisor_id)->exists()) {
            TaDefenseExaminer::create([
                'schedule_id' => $schedule->id,
                'examiner_id' => $supervisor2->supervisor_id,
                'role' => 'SUPERVISOR_2',
            ]);
        }

        $schedule->update(['status' => 'SCHEDULED']);

        // Auto-generate evaluation rows for all examiners
        $this->schedulingService->autoGenerateTaDefenseEvaluations($schedule);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'TA_DEFENSE_APPROVED',
            'target_type' => 'TaDefenseSchedule',
            'target_id' => $schedule->id,
            'payload' => ['student_id' => $schedule->student_id, 'group_id' => $schedule->group_id],
        ]);

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

        $schedule = TaDefenseSchedule::where('id', $id)
            ->where('status', 'PENDING_APPROVAL')
            ->firstOrFail();

        $schedule->update([
            'status' => 'CANCELLED',
            'rejection_reason' => $request->rejection_reason,
        ]);

        return response()->json(['message' => 'TA defense schedule request rejected.', 'data' => $schedule]);
    }
}
