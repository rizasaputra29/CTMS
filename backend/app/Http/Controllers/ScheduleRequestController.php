<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\SeminarSchedule;
use App\Models\TaDefenseExaminer;
use App\Models\TaDefenseSchedule;
use App\Models\TaSubmission;
use App\Services\SchedulingService;
use Illuminate\Http\Request;

class ScheduleRequestController extends Controller
{
    use RequiresActivePeriod;

    protected SchedulingService $schedulingService;

    public function __construct(SchedulingService $schedulingService)
    {
        $this->schedulingService = $schedulingService;
    }

    /**
     * List student's own schedule requests.
     */
    public function myRequests(Request $request)
    {
        $user = $request->user();

        $group = $this->getStudentGroup($user->id);
        if (! $group) {
            return response()->json(['data' => ['seminars' => [], 'ta_defense' => null]]);
        }

        $seminars = SeminarSchedule::with(['examiner1', 'examiner2'])
            ->where('group_id', $group->id)
            ->orderByDesc('created_at')
            ->get();

        $taDefense = TaDefenseSchedule::with(['examiners.examiner'])
            ->where('student_id', $user->id)
            ->first();

        return response()->json([
            'data' => [
                'seminars' => $seminars,
                'ta_defense' => $taDefense,
            ],
        ]);
    }

    /**
     * Student requests a SEMPRO schedule.
     */
    public function requestSempro(Request $request)
    {
        return $this->requestSeminar($request, 'SEMPRO', 'READY_FOR_SEMPRO');
    }

    /**
     * Student requests an EXPO schedule.
     */
    public function requestExpo(Request $request)
    {
        return $this->requestSeminar($request, 'EXPO', 'EXPO_READY');
    }

    /**
     * Internal: handle SEMPRO/EXPO request.
     */
    private function requestSeminar(Request $request, string $type, string $requiredStatus)
    {
        $request->validate([
            'date' => 'required|date|after:today',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'nullable|string|max:100',
            'examiner_1_id' => 'required|exists:users,id',
            'examiner_2_id' => 'required|exists:users,id|different:examiner_1_id',
        ]);

        $user = $request->user();
        $group = $this->getStudentGroup($user->id);

        if (! $group) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        $this->ensurePeriodIsActive($group);

        // Eligibility: group status check
        if ($group->status !== $requiredStatus) {
            return response()->json(['message' => "Group must be in {$requiredStatus} status to request {$type}."], 400);
        }

        // Anti-spam: only 1 active PENDING per type per group
        $pendingExists = SeminarSchedule::where('group_id', $group->id)
            ->where('type', $type)
            ->where('status', 'PENDING_APPROVAL')
            ->exists();

        if ($pendingExists) {
            return response()->json(['message' => "A pending {$type} request already exists."], 400);
        }

        // Also check no active (non-cancelled) schedule exists
        $activeExists = SeminarSchedule::where('group_id', $group->id)
            ->where('type', $type)
            ->whereNotIn('status', ['CANCELLED'])
            ->exists();

        if ($activeExists) {
            return response()->json(['message' => "Group already has an active {$type} schedule."], 400);
        }

        // Validate examiner constraints
        $examinerIds = [$request->examiner_1_id, $request->examiner_2_id];
        $constraintError = $this->schedulingService->validateExaminerConstraints($group, $examinerIds);
        if ($constraintError) {
            return response()->json(['message' => $constraintError], 400);
        }

        // Create as PENDING_APPROVAL (no conflict check — admin will validate)
        $schedule = SeminarSchedule::create([
            'group_id' => $group->id,
            'type' => $type,
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'room' => $request->room,
            'examiner_1_id' => $request->examiner_1_id,
            'examiner_2_id' => $request->examiner_2_id,
            'status' => 'PENDING_APPROVAL',
            'requested_by' => $user->id,
        ]);

        return response()->json([
            'message' => "{$type} schedule request submitted. Awaiting admin approval.",
            'data' => $schedule->load(['examiner1', 'examiner2']),
        ], 201);
    }

    /**
     * Student requests a TA defense schedule.
     */
    public function requestTaDefense(Request $request)
    {
        $request->validate([
            'date' => 'required|date|after:today',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'nullable|string|max:100',
            'examiner_1_id' => 'required|exists:users,id',
            'examiner_2_id' => 'required|exists:users,id|different:examiner_1_id',
        ]);

        $user = $request->user();

        // Eligibility: must have TA submission in TA_REGISTERED
        $taSubmission = TaSubmission::where('student_id', $user->id)
            ->where('status', 'TA_REGISTERED')
            ->first();

        if (! $taSubmission) {
            return response()->json(['message' => 'Must have a TA submission in TA_REGISTERED status.'], 400);
        }

        $group = Group::with('period')->findOrFail($taSubmission->group_id);

        $this->ensurePeriodIsActive($group);

        // Eligibility: group status
        if (! in_array($group->status, ['PDC2_COMPLETE', 'EXPO_DONE'])) {
            return response()->json(['message' => 'Student not eligible for TA defense. Group must be in PDC2_COMPLETE or EXPO_DONE.'], 400);
        }

        // Anti-spam: no existing pending or active defense
        $existingDefense = TaDefenseSchedule::where('student_id', $user->id)
            ->where('status', '!=', 'CANCELLED')
            ->exists();

        if ($existingDefense) {
            return response()->json(['message' => 'You already have a TA defense schedule.'], 400);
        }

        // Validate examiner constraints
        $examinerIds = [$request->examiner_1_id, $request->examiner_2_id];
        $constraintError = $this->schedulingService->validateExaminerConstraints($group, $examinerIds);
        if ($constraintError) {
            return response()->json(['message' => $constraintError], 400);
        }

        // Create as PENDING_APPROVAL
        $schedule = TaDefenseSchedule::create([
            'student_id' => $user->id,
            'group_id' => $group->id,
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'room' => $request->room,
            'status' => 'PENDING_APPROVAL',
            'requested_by' => $user->id,
        ]);

        // Attach proposed examiners (NOT supervisors yet — admin will finalize)
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

        return response()->json([
            'message' => 'TA defense schedule request submitted. Awaiting admin approval.',
            'data' => $schedule->load(['examiners.examiner']),
        ], 201);
    }

    /**
     * Get the student's active group.
     */
    private function getStudentGroup(int $studentId): ?Group
    {
        $membership = GroupMember::where('student_id', $studentId)->first();

        return $membership ? Group::with('period')->find($membership->group_id) : null;
    }
}
