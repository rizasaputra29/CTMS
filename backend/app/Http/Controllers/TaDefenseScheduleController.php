<?php

namespace App\Http\Controllers;

use App\Models\TaDefenseSchedule;
use App\Models\TaDefenseEvaluation;
use App\Models\TaSubmission;
use App\Models\Group;
use App\Models\User;
use App\Models\Notification;
use App\Models\Period;
use App\Services\SchedulingService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
     * Cross-period: Fetches schedules from all active and finalized periods by default.
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->hasRole('admin')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $with = ['students', 'group', 'examiner1', 'examiner2'];
        if ($this->hasPeriodColumn()) {
            $with[] = 'period';
        }

        // Get active and finalized period IDs for cross-period fetching
        $periodIds = $this->getActiveAndFinalizedPeriodIds();
        $hasPeriodColumn = $this->hasPeriodColumn();

        $query = TaDefenseSchedule::with($with)
            ->whereHas('group', function ($q) use ($periodIds) {
                // Filter by active/finalized periods by default
                $q->whereIn('period_id', $periodIds);
            })
            ->orderBy('date', 'asc');

        // Handle period_id filter including 'all' (all removes the period filter for viewing historical data)
        if ($request->has('period_id')) {
            if ($request->period_id === 'all') {
                // Remove the whereHas constraint by requerying without it
                $query = TaDefenseSchedule::with($with)
                    ->orderBy('date', 'asc');
            } elseif ($hasPeriodColumn) {
                $query->where('period_id', $request->period_id);
            } else {
                $query->whereHas('group', function ($q) use ($request) {
                    $q->where('period_id', $request->period_id);
                });
            }
        }

        if ($request->has('group_id')) {
            $query->where('group_id', $request->group_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $schedules = $query->paginate($request->per_page ?? 1000);

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
     * Create new TA defense schedule with multi-student support
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->hasRole('admin')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $hasPeriodColumn = $this->hasPeriodColumn();

        $validator = Validator::make($request->all(), [
            'group_id' => 'required|exists:groups,id',
            'student_ids' => 'required|array|min:1',
            'student_ids.*' => 'exists:users,id',
            'period_id' => $hasPeriodColumn ? 'required|exists:periods,id' : 'nullable',
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

        $studentIds = $request->student_ids;
        $group = Group::with(['supervisors', 'period', 'members'])->findOrFail($request->group_id);

        // Validate all students are from the same group
        $groupMemberIds = $group->members->pluck('student_id')->toArray();
        $invalidStudents = array_diff($studentIds, $groupMemberIds);
        
        if (!empty($invalidStudents)) {
            return response()->json([
                'error' => 'All selected students must be from the same group'
            ], 400);
        }

        // Validate all students have TA_DOCUMENTS_APPROVED status
        $validSubmissions = TaSubmission::whereIn('student_id', $studentIds)
            ->where('group_id', $group->id)
            ->where('status', 'TA_DOCUMENTS_APPROVED')
            ->pluck('student_id')
            ->toArray();

        $invalidStatusStudents = array_diff($studentIds, $validSubmissions);
        if (!empty($invalidStatusStudents)) {
            return response()->json([
                'error' => 'All selected students must have TA_DOCUMENTS_APPROVED status'
            ], 400);
        }

        // Check for existing scheduled defenses for these students
        $existingScheduled = TaDefenseSchedule::whereHas('students', function ($q) use ($studentIds) {
                $q->whereIn('student_id', $studentIds);
            })
            ->whereIn('status', ['SCHEDULED', 'DONE'])
            ->exists();

        if ($existingScheduled) {
            return response()->json([
                'error' => 'One or more selected students already have a scheduled or completed defense'
            ], 400);
        }

        // Validate examiners are not supervisors
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

        // Validate scheduling conflicts
        $examinerIds = [$request->examiner_1_id, $request->examiner_2_id];
        $conflicts = $this->schedulingService->validateScheduleConflicts(
            $examinerIds,
            $request->date,
            $request->start_time,
            $request->end_time,
            $request->room
        );

        if (!empty($conflicts)) {
            return response()->json([
                'message' => 'Scheduling conflicts detected.',
                'conflicts' => $conflicts
            ], 400);
        }

        // Auto-calculate evaluation deadline
        $evaluationDeadline = date('Y-m-d H:i:s', strtotime($request->date . ' +2 days'));

        DB::beginTransaction();
        try {
            $payload = [
                'group_id' => $request->group_id,
                'student_id' => $studentIds[0], // Backward compatibility
                'examiner_1_id' => $request->examiner_1_id,
                'examiner_2_id' => $request->examiner_2_id,
                'date' => $request->date,
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'room' => $request->room,
                'status' => 'SCHEDULED',
                'evaluation_deadline' => $evaluationDeadline,
                'notes' => $request->notes,
            ];

            if ($hasPeriodColumn) {
                $payload['period_id'] = $request->period_id ?: $group->period_id;
            }

            $schedule = TaDefenseSchedule::create($payload);

            // Attach all students to pivot table
            $schedule->students()->attach($studentIds);

            // Update all students' TA submission status
            TaSubmission::whereIn('student_id', $studentIds)
                ->update(['status' => 'TA_READY_FOR_SIDANG']);

            // Create evaluation records
            $this->schedulingService->createTaDefenseEvaluations($schedule);

            // Notify all students and examiners
            $this->notifyTaDefenseScheduled($schedule, $studentIds);

            DB::commit();

            return response()->json([
                'message' => 'TA defense scheduled successfully',
                'data' => $schedule->load(['students', 'group', 'examiner1', 'examiner2'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Failed to create schedule: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get TA defense schedule details
     */
    public function show($id): JsonResponse
    {
        $user = Auth::user();
        $with = ['students', 'group', 'examiner1', 'examiner2', 'evaluations'];
        if ($this->hasPeriodColumn()) {
            $with[] = 'period';
        }

        $schedule = TaDefenseSchedule::with($with)
            ->findOrFail($id);

        // Check authorization - allow if user is admin, one of the students, examiner, or supervisor
        $studentIds = $schedule->students->pluck('id')->toArray();
        
        if (!$user->hasRole('admin') && 
            !in_array($user->id, $studentIds) &&
            $user->id !== $schedule->examiner_1_id &&
            $user->id !== $schedule->examiner_2_id &&
            !$schedule->group->supervisors->contains('id', $user->id)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json(['data' => $schedule]);
    }

    /**
     * Update TA defense schedule with multi-student support
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->hasRole('admin')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $schedule = TaDefenseSchedule::with(['group', 'students'])->findOrFail($id);

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
            'student_ids' => 'sometimes|array|min:1',
            'student_ids.*' => 'exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        DB::beginTransaction();
        try {
            // Handle student changes if provided
            if ($request->has('student_ids')) {
                $newStudentIds = $request->student_ids;
                $currentStudentIds = $schedule->students->pluck('id')->toArray();
                $group = $schedule->group;

                // Validate all students are from the same group
                $groupMemberIds = $group->members->pluck('student_id')->toArray();
                $invalidStudents = array_diff($newStudentIds, $groupMemberIds);
                
                if (!empty($invalidStudents)) {
                    return response()->json([
                        'error' => 'All selected students must be from the same group'
                    ], 400);
                }

                // Validate all students have TA_DOCUMENTS_APPROVED status
                $validSubmissions = TaSubmission::whereIn('student_id', $newStudentIds)
                    ->where('group_id', $group->id)
                    ->where('status', 'TA_DOCUMENTS_APPROVED')
                    ->pluck('student_id')
                    ->toArray();

                $invalidStatusStudents = array_diff($newStudentIds, $validSubmissions);
                if (!empty($invalidStatusStudents)) {
                    return response()->json([
                        'error' => 'All selected students must have TA_DOCUMENTS_APPROVED status'
                    ], 400);
                }

                // Check for existing scheduled defenses (excluding current schedule)
                $existingScheduled = TaDefenseSchedule::where('id', '!=', $schedule->id)
                    ->whereHas('students', function ($q) use ($newStudentIds) {
                        $q->whereIn('student_id', $newStudentIds);
                    })
                    ->whereIn('status', ['SCHEDULED', 'DONE'])
                    ->exists();

                if ($existingScheduled) {
                    return response()->json([
                        'error' => 'One or more selected students already have a scheduled or completed defense'
                    ], 400);
                }

                // Find removed students
                $removedStudents = array_diff($currentStudentIds, $newStudentIds);
                // Find added students
                $addedStudents = array_diff($newStudentIds, $currentStudentIds);

                // Update pivot table
                $schedule->students()->sync($newStudentIds);

                // Update backward-compatible student_id
                $schedule->update(['student_id' => $newStudentIds[0]]);

                // Revert status for removed students
                if (!empty($removedStudents)) {
                    TaSubmission::whereIn('student_id', $removedStudents)
                        ->where('status', 'TA_READY_FOR_SIDANG')
                        ->update(['status' => 'TA_DOCUMENTS_APPROVED']);
                }

                // Update status for added students
                if (!empty($addedStudents)) {
                    TaSubmission::whereIn('student_id', $addedStudents)
                        ->update(['status' => 'TA_READY_FOR_SIDANG']);
                }

                // Notify added students
                if (!empty($addedStudents)) {
                    $this->notifyStudentsAddedToDefense($schedule, $addedStudents);
                }
            }

            // Validate scheduling conflicts
            if ($request->has('date') || $request->has('start_time') || $request->has('end_time') || $request->has('room')) {
                $examDate = $request->date ?? $schedule->date;
                $examStartTime = $request->start_time ?? $schedule->start_time;
                $examEndTime = $request->end_time ?? $schedule->end_time;
                $examRoom = $request->room ?? $schedule->room;

                $examinerIds = array_filter([$schedule->examiner_1_id, $schedule->examiner_2_id]);
                $conflicts = $this->schedulingService->validateScheduleConflicts(
                    $examinerIds,
                    $examDate,
                    $examStartTime,
                    $examEndTime,
                    $examRoom,
                    null,
                    $schedule->id
                );

                if (!empty($conflicts)) {
                    return response()->json([
                        'message' => 'Scheduling conflicts detected.',
                        'conflicts' => $conflicts
                    ], 400);
                }
            }

            $schedule->update($request->only([
                'date', 'start_time', 'end_time', 'room', 'notes', 'status'
            ]));

            // Notify all students of update
            $studentIds = $schedule->fresh()->students->pluck('id')->toArray();
            $this->notifyDefenseUpdated($schedule, $studentIds);

            DB::commit();

            return response()->json([
                'message' => 'Schedule updated successfully',
                'data' => $schedule->fresh()->load(['students', 'group', 'examiner1', 'examiner2'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Failed to update schedule: ' . $e->getMessage()
            ], 500);
        }
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

        $schedules = TaDefenseSchedule::with(['examiner1', 'examiner2', 'students'])
            ->whereHas('students', function ($q) use ($user) {
                $q->where('student_id', $user->id);
            })
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

        $schedules = TaDefenseSchedule::with(['students', 'group'])
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

        $schedule = TaDefenseSchedule::with(['students', 'group'])->findOrFail($id);

        if ($schedule->status === 'DONE') {
            return response()->json(['error' => 'Cannot cancel completed schedule'], 400);
        }

        $studentIds = $schedule->students->pluck('id')->toArray();

        DB::beginTransaction();
        try {
            $schedule->update(['status' => 'CANCELLED']);

            // Revert status for all students
            TaSubmission::whereIn('student_id', $studentIds)
                ->where('status', 'TA_READY_FOR_SIDANG')
                ->update(['status' => 'TA_DOCUMENTS_APPROVED']);

            // Clean up pending evaluations
            TaDefenseEvaluation::where('schedule_id', $schedule->id)
                ->where('status', 'PENDING')
                ->delete();

            // Notify all students of cancellation
            $this->notifyDefenseCancelled($schedule, $studentIds);

            DB::commit();

            return response()->json([
                'message' => 'Schedule cancelled successfully. Students are now eligible for rescheduling.'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Failed to cancel schedule: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get students eligible for TA defense scheduling.
     * Returns ALL students with readiness status and lock information.
     */
    public function eligibleStudents(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->hasRole('admin')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $periodId = $request->input('period_id');
        $currentScheduleId = $request->input('current_schedule_id'); // For edit mode
        
        // Get groups with ALL their members
        $groupQuery = Group::with(['members.student', 'supervisors'])
            ->whereHas('members');

        // Handle period_id filter including 'all'
        if ($periodId && $periodId !== 'all') {
            $groupQuery->where('period_id', $periodId);
        }

        if ($request->has('group_id')) {
            $groupQuery->where('id', $request->group_id);
        }

        $groups = $groupQuery->get();

        // Get all submissions for these groups' members
        $memberIds = $groups->flatMap(function ($group) {
            return $group->members->pluck('student_id');
        })->unique();

        $submissions = TaSubmission::whereIn('student_id', $memberIds)
            ->get()
            ->keyBy('student_id');

        // Get students already in active defenses (SCHEDULED or DONE)
        $activeDefenseStudentIds = TaDefenseSchedule::whereHas('students', function ($q) use ($memberIds) {
            $q->whereIn('student_id', $memberIds);
        })
        ->whereIn('status', ['SCHEDULED', 'DONE'])
        ->when($currentScheduleId, function ($q) use ($currentScheduleId) {
            // Exclude current schedule when editing
            $q->where('id', '!=', $currentScheduleId);
        })
        ->pluck('student_id')
        ->toArray();

        // Get students in current schedule (for edit mode)
        $currentScheduleStudentIds = [];
        if ($currentScheduleId) {
            $currentScheduleStudentIds = TaDefenseSchedule::find($currentScheduleId)
                ?->students()
                ?->pluck('users.id')
                ?->toArray() ?? [];
        }

        // Transform groups with ALL members
        $result = $groups->map(function ($group) use ($submissions, $activeDefenseStudentIds, $currentScheduleStudentIds) {
            return [
                'id' => $group->id,
                'name' => $group->name,
                'code' => $group->code ?? null,
                'supervisors' => $group->supervisors->map(function ($sv) {
                    return [
                        'id' => $sv->id,
                        'name' => $sv->name,
                        'pivot' => [
                            'role' => $sv->pivot->role ?? null,
                        ],
                    ];
                }),
                'members' => $group->members->map(function ($member) use ($submissions, $activeDefenseStudentIds, $currentScheduleStudentIds) {
                    $studentId = $member->student_id;
                    $submission = $submissions->get($studentId);
                    $hasActiveDefense = in_array($studentId, $activeDefenseStudentIds);
                    $isInCurrentSchedule = in_array($studentId, $currentScheduleStudentIds);
                    
                    // Student is ready if:
                    // 1. Has TA_DOCUMENTS_APPROVED status
                    // 2. Is NOT already in another active defense
                    // 3. OR is already in current schedule (edit mode)
                    $isReadyForSidang = ($submission && $submission->status === 'TA_DOCUMENTS_APPROVED' && !$hasActiveDefense) || $isInCurrentSchedule;

                    return [
                        'student' => [
                            'id' => $member->student->id,
                            'name' => $member->student->name,
                            'nim' => $member->student->nim ?? null,
                        ],
                        'is_leader' => $member->is_leader,
                        'is_ready_for_sidang' => $isReadyForSidang,
                        'is_already_selected' => $isInCurrentSchedule,
                        'status_text' => $submission ? $submission->status : 'NO_SUBMISSION',
                        'has_active_defense' => $hasActiveDefense,
                    ];
                })->values(),
            ];
        })->values();

        return response()->json(['data' => $result]);
    }

    /**
     * Notify students and examiners when defense is scheduled
     */
    private function notifyTaDefenseScheduled($schedule, array $studentIds): void
    {
        $studentNames = $schedule->students->pluck('name')->join(', ');

        // Notify all students
        foreach ($studentIds as $studentId) {
            Notification::create([
                'user_id' => $studentId,
                'type' => 'TA_DEFENSE_SCHEDULED',
                'title' => 'Jadwal Sidang TA',
                'message' => "Anda dijadwalkan sidang TA pada {$schedule->date} pukul {$schedule->start_time} di {$schedule->room}",
                'related_type' => 'TaDefenseSchedule',
                'related_id' => $schedule->id,
            ]);
        }

        // Notify examiners
        foreach ([$schedule->examiner_1_id, $schedule->examiner_2_id] as $examinerId) {
            Notification::create([
                'user_id' => $examinerId,
                'type' => 'TA_DEFENSE_EXAMINER_ASSIGNED',
                'title' => 'Penugasan Penguji Sidang TA',
                'message' => "Anda ditugaskan sebagai penguji sidang TA untuk mahasiswa: {$studentNames}",
                'related_type' => 'TaDefenseSchedule',
                'related_id' => $schedule->id,
            ]);
        }
    }

    /**
     * Notify students when they are added to an existing defense
     */
    private function notifyStudentsAddedToDefense($schedule, array $addedStudentIds): void
    {
        foreach ($addedStudentIds as $studentId) {
            Notification::create([
                'user_id' => $studentId,
                'type' => 'TA_DEFENSE_SCHEDULED',
                'title' => 'Ditambahkan ke Jadwal Sidang TA',
                'message' => "Anda ditambahkan ke jadwal sidang TA pada {$schedule->date} pukul {$schedule->start_time} di {$schedule->room}",
                'related_type' => 'TaDefenseSchedule',
                'related_id' => $schedule->id,
            ]);
        }
    }

    /**
     * Notify all students when defense is updated
     */
    private function notifyDefenseUpdated($schedule, array $studentIds): void
    {
        foreach ($studentIds as $studentId) {
            Notification::create([
                'user_id' => $studentId,
                'type' => 'TA_DEFENSE_UPDATED',
                'title' => 'Jadwal Sidang TA Diperbarui',
                'message' => "Jadwal sidang TA Anda telah diperbarui. Tanggal: {$schedule->date}, Waktu: {$schedule->start_time}, Ruang: {$schedule->room}",
                'related_type' => 'TaDefenseSchedule',
                'related_id' => $schedule->id,
            ]);
        }

        // Notify examiners
        foreach ([$schedule->examiner_1_id, $schedule->examiner_2_id] as $examinerId) {
            Notification::create([
                'user_id' => $examinerId,
                'type' => 'TA_DEFENSE_UPDATED',
                'title' => 'Jadwal Sidang TA Diperbarui',
                'message' => "Jadwal sidang TA yang Andauji telah diperbarui. Tanggal: {$schedule->date}, Waktu: {$schedule->start_time}, Ruang: {$schedule->room}",
                'related_type' => 'TaDefenseSchedule',
                'related_id' => $schedule->id,
            ]);
        }
    }

    /**
     * Notify all students when defense is cancelled
     */
    private function notifyDefenseCancelled($schedule, array $studentIds): void
    {
        foreach ($studentIds as $studentId) {
            Notification::create([
                'user_id' => $studentId,
                'type' => 'TA_DEFENSE_CANCELLED',
                'title' => 'Jadwal Sidang TA Dibatalkan',
                'message' => "Jadwal sidang TA Anda pada {$schedule->date} telah dibatalkan. Anda dapat menjadwalkan ulang.",
                'related_type' => 'TaDefenseSchedule',
                'related_id' => $schedule->id,
            ]);
        }

        // Notify examiners
        foreach ([$schedule->examiner_1_id, $schedule->examiner_2_id] as $examinerId) {
            Notification::create([
                'user_id' => $examinerId,
                'type' => 'TA_DEFENSE_CANCELLED',
                'title' => 'Jadwal Sidang TA Dibatalkan',
                'message' => "Jadwal sidang TA yang Andauji pada {$schedule->date} telah dibatalkan.",
                'related_type' => 'TaDefenseSchedule',
                'related_id' => $schedule->id,
            ]);
        }
    }

    private function hasPeriodColumn(): bool
    {
        return Schema::hasColumn('ta_defense_schedules', 'period_id');
    }
}
