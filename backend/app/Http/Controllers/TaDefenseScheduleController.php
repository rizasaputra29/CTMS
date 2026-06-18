<?php

namespace App\Http\Controllers;

use App\Concerns\ResolvesActivePeriods;
use App\Http\Requests\Admin\AssignExaminersRequest;
use App\Http\Requests\Admin\StoreTaDefenseRequest;
use App\Http\Requests\Admin\UpdateTaDefenseRequest;
use App\Models\Group;
use App\Models\Location;
use App\Models\Notification;
use App\Models\TaDefenseEvaluation;
use App\Models\TaDefenseSchedule;
use App\Models\TaSubmission;
use App\Models\User;
use App\Services\SchedulingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TaDefenseScheduleController extends Controller
{
    use ApiResponseTrait, ResolvesActivePeriods;

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

        if (! $user->hasRole('admin')) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        $with = ['students', 'group.title', 'group.period', 'examiner1', 'examiner2'];
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

        // Transform schedules to ensure students data is properly formatted
        // Build response manually to ensure all relationships are properly included
        $transformedSchedules = $schedules->getCollection()->map(function ($schedule) {
            // Ensure students relationship is loaded
            if (! $schedule->relationLoaded('students')) {
                $schedule->load('students');
            }

            // Build students array directly from relationship
            $students = $schedule->students->map(function ($student) {
                return [
                    'id' => $student->id,
                    'name' => $student->name,
                    'nim' => $student->nim,
                    'email' => $student->email,
                ];
            })->toArray();

            return [
                'id' => $schedule->id,
                'student_id' => $schedule->student_id,
                'student' => $students[0] ?? null,
                'students' => $students,
                'group_id' => $schedule->group_id,
                'group' => $schedule->group ? [
                    'id' => $schedule->group->id,
                    'name' => $schedule->group->name ?? null,
                    'code' => $schedule->group->code ?? null,
                    'title' => $schedule->group->title ? [
                        'id' => $schedule->group->title->id,
                        'title' => $schedule->group->title->title,
                    ] : null,
                    'period' => $schedule->group->period ? [
                        'id' => $schedule->group->period->id,
                        'name' => $schedule->group->period->name,
                    ] : null,
                ] : null,
                'period' => $schedule->period ?? null,
                'period_id' => $schedule->period_id ?? null,
                'date' => $schedule->date,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'room' => $schedule->room,
                'location_id' => $schedule->location_id,
                'status' => $schedule->status,
                'notes' => $schedule->notes,
                'evaluation_deadline' => $schedule->evaluation_deadline,
                'examiner_1_id' => $schedule->examiner_1_id,
                'examiner_2_id' => $schedule->examiner_2_id,
                'examiner1' => $schedule->examiner1 ? ['id' => $schedule->examiner1->id, 'name' => $schedule->examiner1->name] : null,
                'examiner2' => $schedule->examiner2 ? ['id' => $schedule->examiner2->id, 'name' => $schedule->examiner2->name] : null,
            ];
        })->toArray();

        return $this->envelopeResponse($transformedSchedules, [
            'current_page' => $schedules->currentPage(),
            'last_page' => $schedules->lastPage(),
            'total' => $schedules->total(),
        ]);
    }

    /**
     * Create new TA defense schedule with multi-student support
     */
    public function store(StoreTaDefenseRequest $request): JsonResponse
    {
        $user = Auth::user();

        if (! $user->hasRole('admin')) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        $validated = $request->validated();
        $studentIds = $validated['student_ids'];
        $group = Group::with(['supervisors', 'period', 'members'])->findOrFail($validated['group_id']);

        // Validate all students are from the same group
        $groupMemberIds = $group->members->pluck('student_id')->toArray();
        $invalidStudents = array_diff($studentIds, $groupMemberIds);

        if (! empty($invalidStudents)) {
            return $this->errorResponse('All selected students must be from the same group', 400);
        }

        // Validate all students have TA_DOCUMENTS_APPROVED status
        $validSubmissions = TaSubmission::whereIn('student_id', $studentIds)
            ->where('group_id', $group->id)
            ->where('status', 'TA_DOCUMENTS_APPROVED')
            ->pluck('student_id')
            ->toArray();

        $invalidStatusStudents = array_diff($studentIds, $validSubmissions);
        if (! empty($invalidStatusStudents)) {
            return $this->errorResponse('All selected students must have TA_DOCUMENTS_APPROVED status', 400);
        }

        // Check for existing scheduled defenses for these students
        $existingScheduled = TaDefenseSchedule::whereHas('students', function ($q) use ($studentIds) {
            $q->whereIn('student_id', $studentIds);
        })
            ->whereIn('status', ['SCHEDULED', 'DONE'])
            ->exists();

        if ($existingScheduled) {
            return $this->errorResponse('One or more selected students already have a scheduled or completed defense', 400);
        }

        // Validate examiners are not supervisors
        $supervisorIds = $group->supervisors->pluck('id')->toArray();

        if (in_array($validated['examiner_1_id'], $supervisorIds)) {
            return $this->errorResponse('Examiner 1 cannot be a supervisor of this group', 400);
        }

        if (in_array($validated['examiner_2_id'], $supervisorIds)) {
            return $this->errorResponse('Examiner 2 cannot be a supervisor of this group', 400);
        }

        // Validate examiners are dosen
        $examiner1 = User::find($validated['examiner_1_id']);
        $examiner2 = User::find($validated['examiner_2_id']);

        if (! $examiner1->hasRole('dosen')) {
            return $this->errorResponse('Examiner 1 must be a dosen', 400);
        }

        if (! $examiner2->hasRole('dosen')) {
            return $this->errorResponse('Examiner 2 must be a dosen', 400);
        }

        // Validate scheduling conflicts
        $examinerIds = [$validated['examiner_1_id'], $validated['examiner_2_id']];

        // Determine room/location for conflict checking
        $room = $validated['room'] ?? null;
        if (! empty($validated['location_id']) && empty($room)) {
            $location = Location::find($validated['location_id']);
            $room = $location->name;
        }

        $conflicts = $this->schedulingService->validateScheduleConflicts(
            $examinerIds,
            $validated['date'],
            $validated['start_time'],
            $validated['end_time'],
            $room
        );

        if (! empty($conflicts)) {
            return $this->errorResponse('Scheduling conflicts detected.', 400, $conflicts);
        }

        // Auto-calculate evaluation deadline
        $evaluationDeadline = date('Y-m-d H:i:s', strtotime($validated['date'].' +2 days'));

        DB::beginTransaction();
        try {
            $payload = [
                'group_id' => $validated['group_id'],
                'student_id' => $studentIds[0], // Backward compatibility
                'examiner_1_id' => $validated['examiner_1_id'],
                'examiner_2_id' => $validated['examiner_2_id'],
                'date' => $validated['date'],
                'start_time' => $validated['start_time'],
                'end_time' => $validated['end_time'],
                'room' => $room,
                'location_id' => $validated['location_id'] ?? null,
                'status' => 'SCHEDULED',
                'evaluation_deadline' => $evaluationDeadline,
                'notes' => $validated['notes'] ?? null,
            ];

            if ($this->hasPeriodColumn()) {
                $payload['period_id'] = $validated['period_id'] ?? $group->period_id;
            }

            $schedule = TaDefenseSchedule::create($payload);

            // Attach all students to pivot table
            $schedule->students()->attach($studentIds);

            // Update or create TA submissions for all scheduled students
            foreach ($studentIds as $studentId) {
                TaSubmission::updateOrCreate(
                    ['student_id' => $studentId],
                    [
                        'status' => 'TA_READY_FOR_SIDANG',
                        'group_id' => $group->id,
                        'period_id' => $payload['period_id'] ?? $group->period_id,
                    ]
                );
            }

            // Create evaluation records
            $this->schedulingService->createTaDefenseEvaluations($schedule, $studentIds);

            // Reload schedule with students relationship for notification
            $schedule->load('students');

            // Notify all students and examiners
            $this->notifyTaDefenseScheduled($schedule, $studentIds);

            DB::commit();

            return $this->createdResponse([
                'message' => 'TA defense scheduled successfully',
                'data' => $schedule->load(['students', 'group.title', 'group.period', 'examiner1', 'examiner2']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            \Illuminate\Support\Facades\Log::error('Failed to create TA defense schedule', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all(),
            ]);

            return $this->errorResponse('Failed to create schedule: '.$e->getMessage(), 500);
        }
    }

    /**
     * Get TA defense schedule details
     */
    public function show($id): JsonResponse
    {
        $user = Auth::user();
        $with = ['students', 'group.title', 'group.period', 'examiner1', 'examiner2', 'evaluations'];
        if ($this->hasPeriodColumn()) {
            $with[] = 'period';
        }

        $schedule = TaDefenseSchedule::with($with)
            ->findOrFail($id);

        // Check authorization - allow if user is admin, one of the students, examiner, or supervisor
        $studentIds = $schedule->students->pluck('id')->toArray();

        if (! $user->hasRole('admin') &&
            ! in_array($user->id, $studentIds) &&
            $user->id !== $schedule->examiner_1_id &&
            $user->id !== $schedule->examiner_2_id &&
            ! $schedule->group->supervisors->contains('id', $user->id)) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        return $this->successResponse($schedule);
    }

    /**
     * Update TA defense schedule with multi-student support
     */
    public function update(UpdateTaDefenseRequest $request, $id): JsonResponse
    {
        $user = Auth::user();

        if (! $user->hasRole('admin')) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        $schedule = TaDefenseSchedule::with(['group', 'students'])->findOrFail($id);

        if ($schedule->status === 'DONE') {
            return $this->errorResponse('Cannot update completed schedule', 400);
        }

        $validated = $request->validated();

        DB::beginTransaction();
        try {
            // Handle student changes if provided
            if ($request->has('student_ids')) {
                $newStudentIds = $validated['student_ids'];
                $currentStudentIds = $schedule->students->pluck('id')->toArray();
                $group = $schedule->group;

                // Validate all students are from the same group
                $groupMemberIds = $group->members->pluck('student_id')->toArray();
                $invalidStudents = array_diff($newStudentIds, $groupMemberIds);

                if (! empty($invalidStudents)) {
                    return $this->errorResponse('All selected students must be from the same group', 400);
                }

                // Validate all students have TA_DOCUMENTS_APPROVED status
                $validSubmissions = TaSubmission::whereIn('student_id', $newStudentIds)
                    ->where('group_id', $group->id)
                    ->where('status', 'TA_DOCUMENTS_APPROVED')
                    ->pluck('student_id')
                    ->toArray();

                $invalidStatusStudents = array_diff($newStudentIds, $validSubmissions);
                if (! empty($invalidStatusStudents)) {
                    return $this->errorResponse('All selected students must have TA_DOCUMENTS_APPROVED status', 400);
                }

                // Check for existing scheduled defenses (excluding current schedule)
                $existingScheduled = TaDefenseSchedule::where('id', '!=', $schedule->id)
                    ->whereHas('students', function ($q) use ($newStudentIds) {
                        $q->whereIn('student_id', $newStudentIds);
                    })
                    ->whereIn('status', ['SCHEDULED', 'COMPLETED'])
                    ->exists();

                if ($existingScheduled) {
                    return $this->errorResponse('One or more selected students already have a scheduled or completed defense', 400);
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
                if (! empty($removedStudents)) {
                    TaSubmission::whereIn('student_id', $removedStudents)
                        ->where('status', 'TA_READY_FOR_SIDANG')
                        ->update(['status' => 'TA_DOCUMENTS_APPROVED']);
                }

                // Update status for added students
                if (! empty($addedStudents)) {
                    TaSubmission::whereIn('student_id', $addedStudents)
                        ->update(['status' => 'TA_READY_FOR_SIDANG']);
                }

                // Notify added students
                if (! empty($addedStudents)) {
                    $this->notifyStudentsAddedToDefense($schedule, $addedStudents);
                }
            }

            // Validate scheduling conflicts
            if ($request->has('date') || $request->has('start_time') || $request->has('end_time') || $request->has('room') || $request->has('location_id')) {
                $examDate = $request->date ?? $schedule->date;
                $examStartTime = $request->start_time ?? $schedule->start_time;
                $examEndTime = $request->end_time ?? $schedule->end_time;

                // Determine room/location for conflict checking
                $examRoom = $request->room ?? $schedule->room;
                $locationId = $request->location_id ?? $schedule->location_id;
                if ($locationId && ! $request->has('room')) {
                    $location = Location::find($locationId);
                    $examRoom = $location->name;
                }

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

                if (! empty($conflicts)) {
                    return $this->errorResponse('Scheduling conflicts detected.', 400, $conflicts);
                }
            }

            $schedule->update(collect($validated)->only([
                'date', 'start_time', 'end_time', 'room', 'location_id', 'notes', 'status',
            ])->toArray());

            // Notify all students of update
            $studentIds = $schedule->fresh()->students->pluck('id')->toArray();
            $this->notifyDefenseUpdated($schedule, $studentIds);

            DB::commit();

            return $this->successResponse(
                $schedule->fresh()->load(['students', 'group.title', 'group.period', 'examiner1', 'examiner2']),
                'Schedule updated successfully'
            );

        } catch (\Exception $e) {
            DB::rollBack();

            return $this->errorResponse('Failed to update schedule: '.$e->getMessage(), 500);
        }
    }

    /**
     * Get schedules for current user (student view)
     */
    public function mySchedule(): JsonResponse
    {
        $user = Auth::user();

        if (! $user->hasRole('mahasiswa')) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        $schedules = TaDefenseSchedule::with(['examiner1', 'examiner2', 'students'])
            ->whereHas('students', function ($q) use ($user) {
                $q->where('student_id', $user->id);
            })
            ->whereIn('status', ['SCHEDULED', 'DONE'])
            ->orderBy('date', 'desc')
            ->get();

        return $this->successResponse($schedules);
    }

    /**
     * Get schedules for examiner
     */
    public function examinerSchedules(): JsonResponse
    {
        $user = Auth::user();

        if (! $user->hasRole('dosen')) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        $schedules = TaDefenseSchedule::with(['students', 'group'])
            ->where(function ($query) use ($user) {
                $query->where('examiner_1_id', $user->id)
                    ->orWhere('examiner_2_id', $user->id);
            })
            ->whereIn('status', ['SCHEDULED', 'DONE'])
            ->orderBy('date', 'asc')
            ->get();

        // Transform schedules to ensure students data is properly formatted
        $transformedSchedules = $schedules->map(function ($schedule) {
            $data = $schedule->toArray();

            // Ensure students array is properly formatted
            if (isset($data['students']) && is_array($data['students'])) {
                $data['students'] = collect($data['students'])->map(function ($student) {
                    return [
                        'id' => $student['id'] ?? null,
                        'name' => $student['name'] ?? 'Unknown',
                        'nim' => $student['nim'] ?? null,
                        'email' => $student['email'] ?? null,
                    ];
                })->toArray();
            } else {
                $data['students'] = [];
            }

            // Add single student property for backward compatibility (first student)
            $data['student'] = $data['students'][0] ?? null;

            return $data;
        })->toArray();

        return $this->successResponse($transformedSchedules);
    }

    /**
     * Cancel TA defense schedule
     */
    public function cancel($id): JsonResponse
    {
        $user = Auth::user();

        if (! $user->hasRole('admin')) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        $schedule = TaDefenseSchedule::with(['students', 'group'])->findOrFail($id);

        if ($schedule->status === 'DONE') {
            return $this->errorResponse('Cannot cancel completed schedule', 400);
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

            return $this->successResponse(null, 'Schedule cancelled successfully. Students are now eligible for rescheduling.');

        } catch (\Exception $e) {
            DB::rollBack();

            return $this->errorResponse('Failed to cancel schedule: '.$e->getMessage(), 500);
        }
    }

    /**
     * Get students eligible for TA defense scheduling.
     * Returns ALL students with readiness status and lock information.
     */
    public function eligibleStudents(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (! $user->hasRole('admin')) {
            return $this->unauthorizedResponse('Unauthorized');
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
                    $isReadyForSidang = ($submission && $submission->status === 'TA_DOCUMENTS_APPROVED' && ! $hasActiveDefense) || $isInCurrentSchedule;

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

        return $this->successResponse($result);
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
                'is_read' => false,
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
                'is_read' => false,
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
                'is_read' => false,
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
                'is_read' => false,
            ]);
        }

        // Notify examiners
        foreach ([$schedule->examiner_1_id, $schedule->examiner_2_id] as $examinerId) {
            Notification::create([
                'user_id' => $examinerId,
                'type' => 'TA_DEFENSE_UPDATED',
                'title' => 'Jadwal Sidang TA Diperbarui',
                'message' => "Jadwal sidang TA yang Anda uji telah diperbarui. Tanggal: {$schedule->date}, Waktu: {$schedule->start_time}, Ruang: {$schedule->room}",
                'related_type' => 'TaDefenseSchedule',
                'related_id' => $schedule->id,
                'is_read' => false,
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
                'is_read' => false,
            ]);
        }

        // Notify examiners
        foreach ([$schedule->examiner_1_id, $schedule->examiner_2_id] as $examinerId) {
            Notification::create([
                'user_id' => $examinerId,
                'type' => 'TA_DEFENSE_UPDATED',
                'title' => 'Jadwal Sidang TA Diperbarui',
                'message' => "Jadwal sidang TA yang Anda uji telah diperbarui. Tanggal: {$schedule->date}, Waktu: {$schedule->start_time}, Ruang: {$schedule->room}",
                'related_type' => 'TaDefenseSchedule',
                'related_id' => $schedule->id,
                'is_read' => false,
            ]);
        }
    }

    private function hasPeriodColumn(): bool
    {
        return Schema::hasColumn('ta_defense_schedules', 'period_id');
    }

    /**
     * Assign examiners to an existing TA defense schedule (admin only).
     * Validates that examiners are not supervisors and checks for conflicts.
     */
    public function assignExaminers(AssignExaminersRequest $request, $id): JsonResponse
    {
        $user = Auth::user();

        if (! $user->hasRole('admin')) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        $schedule = TaDefenseSchedule::with(['group', 'students'])->findOrFail($id);

        if ($schedule->status === 'DONE') {
            return $this->errorResponse('Cannot assign examiners to completed schedule', 400);
        }

        $validated = $request->validated();

        $group = $schedule->group;

        // Validate examiner cannot be supervisor
        $supervisorIds = array_filter([
            $group->supervisor_1_id,
            $group->supervisor_2_id,
        ]);

        if (in_array($validated['examiner_1_id'], $supervisorIds)) {
            return $this->errorResponse('Examiner 1 cannot be a supervisor of this group.', 400);
        }

        if (in_array($validated['examiner_2_id'], $supervisorIds)) {
            return $this->errorResponse('Examiner 2 cannot be a supervisor of this group.', 400);
        }

        // Validate examiners are dosen
        $examinerIds = [$validated['examiner_1_id'], $validated['examiner_2_id']];
        $examiners = User::whereIn('id', $examinerIds)
            ->whereHas('roles', fn ($q) => $q->where('slug', 'dosen'))
            ->get();

        if ($examiners->count() !== 2) {
            return $this->errorResponse('Both examiners must be dosen (lecturers).', 400);
        }

        // Check for scheduling conflicts with new examiners
        $conflicts = $this->schedulingService->validateScheduleConflicts(
            $examinerIds,
            $schedule->date,
            $schedule->start_time,
            $schedule->end_time,
            $schedule->room,
            null,
            $schedule->id
        );

        if (! empty($conflicts)) {
            return $this->errorResponse('Scheduling conflicts detected with new examiners.', 400, $conflicts);
        }

        DB::beginTransaction();
        try {
            $schedule->update([
                'examiner_1_id' => $validated['examiner_1_id'],
                'examiner_2_id' => $validated['examiner_2_id'],
            ]);

            // Recreate evaluations for new examiners
            TaDefenseEvaluation::where('schedule_id', $schedule->id)->delete();
            $studentIds = $schedule->students->pluck('id')->toArray();
            $this->schedulingService->createTaDefenseEvaluations($schedule->fresh(), $studentIds);

            // Notify new examiners
            $studentNames = $schedule->students->pluck('name')->join(', ');
            $notificationService = app(\App\Services\NotificationService::class);

            foreach ($examinerIds as $examinerId) {
                $notificationService->sendToUser(
                    $examinerId,
                    'TA_DEFENSE_ASSIGNED',
                    'You are assigned as an examiner',
                    "You have been assigned as an examiner for a TA defense on {$schedule->date} at {$schedule->start_time} for students: {$studentNames}.",
                    'ta_defense_schedules',
                    $schedule->id
                );
            }

            DB::commit();

            return $this->successResponse(
                $schedule->fresh()->load(['students', 'group.title', 'group.period', 'examiner1', 'examiner2']),
                'Examiners assigned successfully'
            );

        } catch (\Exception $e) {
            DB::rollBack();

            return $this->errorResponse('Failed to assign examiners: '.$e->getMessage(), 500);
        }
    }
}
