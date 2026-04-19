<?php

namespace App\Http\Controllers;

use App\Models\TaDefenseSchedule;
use App\Models\Group;
use App\Models\User;
use App\Services\SchedulingService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class TaDefenseScheduleController extends Controller
{
    protected $schedulingService;

    public function __construct(SchedulingService $schedulingService)
    {
        $this->schedulingService = $schedulingService;
    }

    /**
     * List all TA defense schedules for admin
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->hasRole('admin')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = TaDefenseSchedule::with(['student', 'group', 'period', 'examiner1', 'examiner2'])
            ->orderBy('date', 'asc');

        if ($request->has('period_id')) {
            $query->where('period_id', $request->period_id);
        }

        if ($request->has('group_id')) {
            $query->where('group_id', $request->group_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $schedules = $query->paginate($request->per_page ?? 20);

        return response()->json([
            'data' => $schedules->items(),
            'meta' => [
                'current_page' => $schedules->currentPage(),
                'last_page' => $schedules->lastPage(),
                'total' => $schedules->total(),
            ]
        ]);
    }

    /**
     * Create new TA defense schedule (individual)
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->hasRole('admin')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'student_id' => 'required|exists:users,id',
            'group_id' => 'required|exists:groups,id',
            'period_id' => 'required|exists:periods,id',
            'examiner_1_id' => 'required|exists:users,id',
            'examiner_2_id' => 'required|exists:users,id|different:examiner_1_id',
            'date' => 'required|date|after_or_equal:today',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'required|string|max:100',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Validate examiners are not supervisors
        $group = Group::with(['supervisors'])->findOrFail($request->group_id);
        $supervisorIds = $group->supervisors->pluck('id')->toArray();
        
        if (in_array($request->examiner_1_id, $supervisorIds)) {
            return response()->json([
                'error' => 'Examiner 1 cannot be a supervisor of this group'
            ], 400);
        }
        
        if (in_array($request->examiner_2_id, $supervisorIds)) {
            return response()->json([
                'error' => 'Examiner 2 cannot be a supervisor of this group'
            ], 400);
        }

        // Validate examiners are dosen
        $examiner1 = User::find($request->examiner_1_id);
        $examiner2 = User::find($request->examiner_2_id);
        
        if (!$examiner1->hasRole('dosen')) {
            return response()->json(['error' => 'Examiner 1 must be a dosen'], 400);
        }
        
        if (!$examiner2->hasRole('dosen')) {
            return response()->json(['error' => 'Examiner 2 must be a dosen'], 400);
        }

        // Auto-calculate evaluation deadline (2 days after schedule)
        $evaluationDeadline = date('Y-m-d H:i:s', strtotime($request->date . ' +2 days'));

        $schedule = TaDefenseSchedule::create([
            'student_id' => $request->student_id,
            'group_id' => $request->group_id,
            'period_id' => $request->period_id,
            'examiner_1_id' => $request->examiner_1_id,
            'examiner_2_id' => $request->examiner_2_id,
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'room' => $request->room,
            'status' => 'SCHEDULED',
            'evaluation_deadline' => $evaluationDeadline,
            'notes' => $request->notes,
        ]);

        // Create evaluation records for examiners
        $this->schedulingService->createTaDefenseEvaluations($schedule);

        // Notify student and examiners
        $this->schedulingService->notifyTaDefenseScheduled($schedule);

        return response()->json([
            'message' => 'TA defense scheduled successfully',
            'data' => $schedule->load(['student', 'group', 'examiner1', 'examiner2'])
        ], 201);
    }

    /**
     * Get TA defense schedule details
     */
    public function show($id): JsonResponse
    {
        $user = Auth::user();
        $schedule = TaDefenseSchedule::with(['student', 'group', 'period', 'examiner1', 'examiner2', 'evaluations'])
            ->findOrFail($id);

        // Check authorization
        if (!$user->hasRole('admin') && 
            $user->id !== $schedule->student_id &&
            $user->id !== $schedule->examiner_1_id &&
            $user->id !== $schedule->examiner_2_id &&
            !$schedule->group->supervisors->contains('id', $user->id)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json(['data' => $schedule]);
    }

    /**
     * Update TA defense schedule
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->hasRole('admin')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $schedule = TaDefenseSchedule::findOrFail($id);

        if ($schedule->status === 'DONE') {
            return response()->json(['error' => 'Cannot update completed schedule'], 400);
        }

        $validator = Validator::make($request->all(), [
            'date' => 'sometimes|date|after_or_equal:today',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i|after:start_time',
            'room' => 'sometimes|string|max:100',
            'notes' => 'nullable|string|max:1000',
            'status' => 'sometimes|in:SCHEDULED,CANCELLED',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $schedule->update($request->only([
            'date', 'start_time', 'end_time', 'room', 'notes', 'status'
        ]));

        return response()->json([
            'message' => 'Schedule updated successfully',
            'data' => $schedule->fresh()
        ]);
    }

    /**
     * Get schedules for current user (student view)
     */
    public function mySchedule(): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->hasRole('mahasiswa')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $schedules = TaDefenseSchedule::with(['examiner1', 'examiner2'])
            ->where('student_id', $user->id)
            ->whereIn('status', ['SCHEDULED', 'DONE'])
            ->orderBy('date', 'desc')
            ->get();

        return response()->json(['data' => $schedules]);
    }

    /**
     * Get schedules for examiner
     */
    public function examinerSchedules(): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->hasRole('dosen')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $schedules = TaDefenseSchedule::with(['student', 'group'])
            ->where(function ($query) use ($user) {
                $query->where('examiner_1_id', $user->id)
                      ->orWhere('examiner_2_id', $user->id);
            })
            ->whereIn('status', ['SCHEDULED', 'DONE'])
            ->orderBy('date', 'asc')
            ->get();

        return response()->json(['data' => $schedules]);
    }

    /**
     * Cancel TA defense schedule
     */
    public function cancel($id): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->hasRole('admin')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $schedule = TaDefenseSchedule::findOrFail($id);

        if ($schedule->status === 'DONE') {
            return response()->json(['error' => 'Cannot cancel completed schedule'], 400);
        }

        $schedule->update(['status' => 'CANCELLED']);

        return response()->json(['message' => 'Schedule cancelled successfully']);
    }
}