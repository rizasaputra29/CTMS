<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Models\Schedule;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\ExpoEvent;
use App\Models\ExpoRegistration;
use App\Models\Period;
use App\Models\TaDefenseSchedule;
use App\Models\SeminarSchedule;
use App\Services\NotificationService;
use App\Services\SchedulingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class ScheduleController extends Controller
{
    use RequiresActivePeriod;

    protected $schedulingService;

    public function __construct(SchedulingService $schedulingService)
    {
        $this->schedulingService = $schedulingService;
    }

    /**
     * Display a listing of the resource.
     * Cross-period: Fetches schedules from all active and finalized periods by default.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        
        // Get active and finalized period IDs for cross-period fetching
        $periodIds = $this->getActiveAndFinalizedPeriodIds();
        
        $query = Schedule::with(['group.title.lecturer', 'group.members.student', 'group.period'])
            ->whereHas('group', function ($q) use ($periodIds, $request) {
                // Filter by active/finalized periods
                $q->whereIn('period_id', $periodIds);
                
                // Allow explicit period filter if provided
                if ($request->has('period_id')) {
                    $q->where('period_id', $request->period_id);
                }
            })
            ->orderBy('date', 'asc');

        // Admin can only see SEMPRO, SIDANG, EXPO, BIMBINGAN schedules
        if ($user->hasRole('admin')) {
            return response()->json([
                'data' => $query->whereIn('type', ['SEMPRO', 'SIDANG', 'EXPO', 'BIMBINGAN'])->get()
            ]);
        }

        // Dosen can only see BIMBINGAN schedules they created
        if ($user->hasRole('dosen')) {
            return response()->json([
                'data' => $query->where('type', 'BIMBINGAN')
                    ->where('created_by', $user->id)
                    ->get()
            ]);
        }

        // Mahasiswa can only see their own group's schedule (exclude rejected groups)
        if ($user->hasRole('mahasiswa')) {
            $groupMember = \App\Models\GroupMember::where('student_id', $user->id)
                ->whereHas('group', function ($q) use ($periodIds) {
                    $q->where('status', '!=', 'REJECTED')
                      ->whereIn('period_id', $periodIds);
                })
                ->first();
            if (!$groupMember) {
                return response()->json(['data' => []]);
            }
            return response()->json([
                'data' => $query->where('group_id', $groupMember->group_id)->get()
            ]);
        }

        return response()->json(['data' => []]);
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
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = Auth::user();

        if ($user->hasRole('mahasiswa')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Dosen can only create BIMBINGAN, Admin can only create SEMPRO/SIDANG/EXPO
        $allowedTypes = $user->hasRole('dosen')
            ? ['BIMBINGAN']
            : ['SEMPRO', 'SIDANG', 'EXPO'];

        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'type' => ['required', 'string', 'in:' . implode(',', $allowedTypes)],
            'date' => 'required|date',
            'start_time' => ['nullable', 'string', 'regex:/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/u'],
            'end_time' => ['nullable', 'string', 'regex:/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/u'],
            'room' => 'nullable|string',
            'mode' => 'nullable|string|in:online,offline',
            'notes' => 'nullable|string|max:1000',
        ]);

        $data = $request->all();

        // If start_time is provided but end_time isn't, default to 1 hour after start
        if ($request->has('start_time') && !$request->has('end_time')) {
            $data['end_time'] = \Carbon\Carbon::parse($request->date . ' ' . $request->start_time)->addHour()->format('H:i');
        }

        $group = Group::with(['supervisions', 'title'])->find($request->group_id);
        if ($group) {
            $this->ensurePeriodIsActive($group);
        }

        // For BIMBINGAN schedules, validate that dosen is a supervisor of the group
        if ($user->hasRole('dosen') && $request->type === 'BIMBINGAN') {
            $isSupervisor = $group && $group->supervisions->contains(function ($sup) use ($user) {
                return $sup->supervisor_id === $user->id && 
                       in_array($sup->role, ['SUPERVISOR_1', 'SUPERVISOR_2']);
            });

            if (!$isSupervisor) {
                return response()->json([
                    'message' => 'Unauthorized. You can only create BIMBINGAN schedules for groups you supervise.'
                ], 403);
            }

            // Set created_by to current user
            $data['created_by'] = $user->id;
        }

        // Validate scheduling conflicts for BIMBINGAN (cross-period)
        if ($user->hasRole('dosen') && ($request->type === 'BIMBINGAN' || !$request->has('type'))) {
            $scheduleDate = \Carbon\Carbon::parse($request->date);
            $dateOnly = $scheduleDate->format('Y-m-d');
            $startTime = $request->start_time ?? '09:00';
            $endTime = $request->end_time ?? \Carbon\Carbon::parse($dateOnly . ' ' . $startTime)->addHour()->format('H:i');
            $mode = $request->mode ?? 'offline';

            // For BIMBINGAN online: only check dosen examiner conflicts (no room conflict)
            // For BIMBINGAN offline: check dosen examiner conflicts + room conflicts
            if ($mode === 'online') {
                // Online BIMBINGAN: No location conflicts, just check if dosen is available
                $conflicts = $this->schedulingService->validateBimbinganConflicts(
                    $user->id,
                    $dateOnly,
                    $startTime,
                    $endTime
                );
            } else {
                // Offline BIMBINGAN: Check dosen availability + room conflicts
                $conflicts = $this->schedulingService->validateBimbinganConflicts(
                    $user->id,
                    $dateOnly,
                    $startTime,
                    $endTime
                );

                // Also check for room conflicts
                if ($request->room) {
                    $roomConflict = $this->schedulingService->checkRoomConflict(
                        $request->room,
                        $dateOnly,
                        $startTime,
                        $endTime
                    );
                    if ($roomConflict) {
                        $conflicts[] = $roomConflict['message'];
                    }
                }
            }

            if (!empty($conflicts)) {
                return response()->json([
                    'message' => 'Scheduling conflicts detected.',
                    'conflicts' => $conflicts
                ], 400);
            }
        }

        // Auto-set evaluation deadline to 2 days after schedule date
        if (!isset($data['evaluation_deadline'])) {
            $data['evaluation_deadline'] = date('Y-m-d H:i:s', strtotime($data['date'] . ' +2 days'));
        }

        $schedule = Schedule::create($data);

        // Send notifications to supervisors and examiners
        $notificationService = app(NotificationService::class);

        // Notify supervisors
        if ($group) {
            $notificationService->notifySupervisorsOfSchedule($group, $schedule, $request->type);
        }

        return response()->json(['message' => 'Schedule created successfully', 'data' => $schedule], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $user = Auth::user();

        if ($user->hasRole('mahasiswa')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $allowedTypes = $user->hasRole('dosen')
            ? ['BIMBINGAN']
            : ['SEMPRO', 'SIDANG', 'EXPO'];

        $request->validate([
            'group_id' => 'exists:groups,id',
            'type' => ['string', 'in:' . implode(',', $allowedTypes)],
            'date' => 'date',
            'start_time' => ['nullable', 'string', 'regex:/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/u'],
            'end_time' => ['nullable', 'string', 'regex:/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/u'],
            'room' => 'nullable|string',
            'mode' => 'nullable|string|in:online,offline',
            'notes' => 'nullable|string|max:1000',
        ]);

        $schedule = Schedule::with('group')->findOrFail($id);
        if ($schedule->group) {
            $this->ensurePeriodIsActive($schedule->group);
        }
        
        $data = $request->all();
        
        // If start_time is provided but end_time isn't, default to 1 hour after start
        if ($request->has('start_time') && !$request->has('end_time')) {
            $data['end_time'] = \Carbon\Carbon::parse($request->date . ' ' . $request->start_time)->addHour()->format('H:i');
        }
        
        // Validate scheduling conflicts for BIMBINGAN updates (cross-period)
        if ($user->hasRole('dosen') && $schedule->type === 'BIMBINGAN') {
            $scheduleDate = \Carbon\Carbon::parse($request->date ?? $schedule->date);
            $dateOnly = $scheduleDate->format('Y-m-d');
            $startTime = $request->start_time ?? $schedule->start_time?->format('H:i') ?? '09:00';
            $endTime = $request->end_time ?? $schedule->end_time?->format('H:i') ?? \Carbon\Carbon::parse($dateOnly . ' ' . $startTime)->addHour()->format('H:i');
            $room = $request->room ?? $schedule->room;
            $mode = $request->mode ?? $schedule->mode ?? 'offline';

            // For BIMBINGAN online: only check dosen examiner conflicts
            // For BIMBINGAN offline: check dosen examiner conflicts + room conflicts
            if ($mode === 'online') {
                $conflicts = $this->schedulingService->validateBimbinganConflicts(
                    $user->id,
                    $dateOnly,
                    $startTime,
                    $endTime,
                    $schedule->id
                );
            } else {
                $conflicts = $this->schedulingService->validateBimbinganConflicts(
                    $user->id,
                    $dateOnly,
                    $startTime,
                    $endTime,
                    $schedule->id
                );

                // Also check for room conflicts
                if ($room) {
                    $roomConflict = $this->schedulingService->checkRoomConflict(
                        $room,
                        $dateOnly,
                        $startTime,
                        $endTime
                    );
                    if ($roomConflict) {
                        $conflicts[] = $roomConflict['message'];
                    }
                }
            }

            if (!empty($conflicts)) {
                return response()->json([
                    'message' => 'Scheduling conflicts detected.',
                    'conflicts' => $conflicts
                ], 400);
            }
        }
        
        $schedule->update($data);

        return response()->json(['message' => 'Schedule updated successfully', 'data' => $schedule]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        if (Auth::user()->hasRole('mahasiswa')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $schedule = Schedule::with('group')->find($id);
        if ($schedule && $schedule->group) {
            $this->ensurePeriodIsActive($schedule->group);
        }
        Schedule::destroy($id);
        return response()->json(['message' => 'Schedule deleted successfully']);
    }

    /**
     * Get all schedules for a student including BIMBINGAN, SEMPRO, EXPO events, and TA Defense
     */
    public function studentAllSchedules(Request $request)
    {
        $user = Auth::user();
        
        if (!$user->hasRole('mahasiswa')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $groupMember = GroupMember::where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->first();

        if (!$groupMember) {
            return response()->json(['data' => []]);
        }

        $groupId = $groupMember->group_id;
        $periodId = $groupMember->group->period_id;

        $allSchedules = [];

        // 1. BIMBINGAN schedules from schedules table
        // OPTIMIZED: Added 'group.members.student' to eager loading to prevent N+1 queries
        $bimbinganSchedules = Schedule::with(['group.title.lecturer', 'group.members.student'])
            ->where('group_id', $groupId)
            ->where('type', 'BIMBINGAN')
            ->get()
            ->map(function ($schedule) {
                // Format date as ISO 8601 with time if available
                $dateStr = $schedule->date->format('Y-m-d');
                $startTimeStr = $schedule->start_time ? substr($schedule->start_time, 0, 5) : null;
                $isoDate = $startTimeStr 
                    ? $dateStr . 'T' . $startTimeStr . ':00'
                    : $schedule->date;
                
                return [
                    'id' => $schedule->id,
                    'type' => 'BIMBINGAN',
                    'date' => $isoDate,
                    'start_time' => $schedule->start_time ? substr($schedule->start_time, 0, 5) : null,
                    'end_time' => $schedule->end_time ? substr($schedule->end_time, 0, 5) : null,
                    'room' => $schedule->room,
                    'mode' => $schedule->mode,
                    'notes' => $schedule->notes,
                    'group_id' => $schedule->group_id,
                    'group' => [
                        'title' => $schedule->group->title ? [
                            'title' => $schedule->group->title->title,
                            'lecturer' => $schedule->group->title->lecturer ? [
                                'name' => $schedule->group->title->lecturer->name
                            ] : null
                        ] : null,
                        'members' => $schedule->group->members->map(function ($member) {
                            return ['student' => ['name' => $member->student->name]];
                        })
                    ]
                ];
            });
        $allSchedules = array_merge($allSchedules, $bimbinganSchedules->toArray());

        // 2. SEMPRO schedules from seminar_schedules table
        $semproSchedules = SeminarSchedule::with(['examiner1', 'examiner2', 'group.title', 'group.period'])
            ->where('group_id', $groupId)
            ->where('type', 'SEMPRO')
            ->get()
            ->map(function ($schedule) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $schedule->date->format('Y-m-d');
                $timeStr = substr($schedule->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';
                
                return [
                    'id' => $schedule->id,
                    'type' => 'SEMPRO',
                    'date' => $isoDate,
                    'start_time' => substr($schedule->start_time, 0, 5),
                    'end_time' => $schedule->end_time ? substr($schedule->end_time, 0, 5) : null,
                    'room' => $schedule->room,
                    'location_id' => $schedule->location_id,
                    'mode' => null,
                    'notes' => null,
                    'group_id' => $schedule->group_id,
                    'status' => $schedule->status,
                    'examiner1' => $schedule->examiner1 ? ['name' => $schedule->examiner1->name] : null,
                    'examiner2' => $schedule->examiner2 ? ['name' => $schedule->examiner2->name] : null,
                    'group' => [
                        'id' => $schedule->group->id,
                        'title' => $schedule->group->title ? [
                            'title' => $schedule->group->title->title,
                            'lecturer' => null
                        ] : null,
                        'period' => $schedule->group->period ? [
                            'id' => $schedule->group->period->id,
                            'name' => $schedule->group->period->name
                        ] : null,
                        'members' => []
                    ]
                ];
            });
        $allSchedules = array_merge($allSchedules, $semproSchedules->toArray());

        // 3. EXPO events from expo_events via expo_registrations
        $expoRegistrations = ExpoRegistration::where('group_id', $groupId)
            ->with('expoEvent')
            ->get();

        foreach ($expoRegistrations as $registration) {
            $event = $registration->expoEvent;
            if ($event) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $event->date->format('Y-m-d');
                $timeStr = substr($event->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';
                
                $allSchedules[] = [
                    'id' => $event->id,
                    'type' => 'EXPO',
                    'date' => $isoDate,
                    'start_time' => substr($event->start_time, 0, 5),
                    'end_time' => $event->end_time ? substr($event->end_time, 0, 5) : null,
                    'room' => $event->room,
                    'location_id' => $event->location_id,
                    'mode' => null,
                    'notes' => $event->name,
                    'group_id' => $groupId,
                    'status' => 'SCHEDULED',
                    'group' => [
                        'id' => $groupId,
                        'title' => [
                            'title' => $event->name,
                            'lecturer' => null
                        ],
                        'period' => null,
                        'members' => []
                    ]
                ];
            }
        }

        // 4. TA Defense schedules for the individual student
        $taDefenseSchedules = TaDefenseSchedule::with(['examiner1', 'examiner2', 'group.title', 'group.period'])
            ->where('student_id', $user->id)
            ->whereIn('status', ['SCHEDULED', 'DONE'])
            ->get()
            ->map(function ($schedule) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $schedule->date->format('Y-m-d');
                $timeStr = substr($schedule->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';
                
                return [
                    'id' => $schedule->id,
                    'type' => 'TA_DEFENSE',
                    'date' => $isoDate,
                    'start_time' => substr($schedule->start_time, 0, 5),
                    'end_time' => $schedule->end_time ? substr($schedule->end_time, 0, 5) : null,
                    'room' => $schedule->room,
                    'location_id' => $schedule->location_id,
                    'mode' => null,
                    'notes' => $schedule->notes,
                    'status' => $schedule->status,
                    'group_id' => $schedule->group_id,
                    'student_id' => $schedule->student_id,
                    'examiner1' => $schedule->examiner1 ? ['name' => $schedule->examiner1->name] : null,
                    'examiner2' => $schedule->examiner2 ? ['name' => $schedule->examiner2->name] : null,
                    'group' => [
                        'id' => $schedule->group->id,
                        'title' => $schedule->group->title ? [
                            'title' => $schedule->group->title->title,
                            'lecturer' => null
                        ] : null,
                        'period' => $schedule->group->period ? [
                            'id' => $schedule->group->period->id,
                            'name' => $schedule->group->period->name
                        ] : null,
                        'members' => []
                    ]
                ];
            });
        $allSchedules = array_merge($allSchedules, $taDefenseSchedules->toArray());

        // Sort by date
        usort($allSchedules, function ($a, $b) {
            return strtotime($a['date']) - strtotime($b['date']);
        });

        return response()->json(['data' => $allSchedules]);
    }

    /**
     * Get all schedules for a dosen including BIMBINGAN, SEMPRO/EXPO as examiner, and TA Defense
     */
    public function dosenAllSchedules(Request $request)
    {
        $user = Auth::user();
        
        if (!$user->hasRole('dosen')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $allSchedules = [];
        $periodId = $request->get('period_id');

        // 1. BIMBINGAN schedules created by this dosen
        // OPTIMIZED: Added 'group.members.student' to eager loading to prevent N+1 queries
        $bimbinganQuery = Schedule::with(['group.title.lecturer', 'group.members.student'])
            ->where('type', 'BIMBINGAN')
            ->where('created_by', $user->id);
        
        // Filter by period_id if provided
        if ($periodId) {
            $bimbinganQuery->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });
        }
        
        $bimbinganSchedules = $bimbinganQuery->get()
            ->map(function ($schedule) {
                // Format date as ISO 8601 with time if available
                $dateStr = $schedule->date->format('Y-m-d');
                $startTimeStr = $schedule->start_time ? $schedule->start_time->format('H:i') : null;
                $isoDate = $startTimeStr 
                    ? $dateStr . 'T' . $startTimeStr . ':00'
                    : $schedule->date;
                
                return [
                    'id' => $schedule->id,
                    'type' => 'BIMBINGAN',
                    'date' => $isoDate,
                    'start_time' => $schedule->start_time ? $schedule->start_time->format('H:i') : null,
                    'end_time' => $schedule->end_time ? $schedule->end_time->format('H:i') : null,
                    'room' => $schedule->room,
                    'mode' => $schedule->mode,
                    'notes' => $schedule->notes,
                    'group_id' => $schedule->group_id,
                    'group' => [
                        'title' => $schedule->group->title ? [
                            'title' => $schedule->group->title->title,
                            'lecturer' => $schedule->group->title->lecturer ? [
                                'name' => $schedule->group->title->lecturer->name
                            ] : null
                        ] : null,
                        'members' => $schedule->group->members->map(function ($member) {
                            return ['student' => ['name' => $member->student->name]];
                        })
                    ]
                ];
            });
        $allSchedules = array_merge($allSchedules, $bimbinganSchedules->toArray());

        // 2. SEMPRO/EXPO schedules where dosen is examiner
        $examinerQuery = SeminarSchedule::with(['examiner1', 'examiner2', 'group.title', 'group.period'])
            ->where(function ($q) use ($user) {
                $q->where('examiner_1_id', $user->id)
                  ->orWhere('examiner_2_id', $user->id);
            });
        
        // Filter by period_id if provided
        if ($periodId) {
            $examinerQuery->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });
        }
        
        $examinerSchedules = $examinerQuery->get()
            ->map(function ($schedule) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $schedule->date->format('Y-m-d');
                $timeStr = substr($schedule->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';
                
                return [
                    'id' => $schedule->id,
                    'type' => $schedule->type,
                    'date' => $isoDate,
                    'start_time' => substr($schedule->start_time, 0, 5),
                    'end_time' => $schedule->end_time ? substr($schedule->end_time, 0, 5) : null,
                    'room' => $schedule->room,
                    'location_id' => $schedule->location_id,
                    'mode' => null,
                    'notes' => null,
                    'status' => $schedule->status,
                    'group_id' => $schedule->group_id,
                    'examiner1' => $schedule->examiner1 ? ['name' => $schedule->examiner1->name] : null,
                    'examiner2' => $schedule->examiner2 ? ['name' => $schedule->examiner2->name] : null,
                    'group' => [
                        'id' => $schedule->group->id,
                        'title' => $schedule->group->title ? [
                            'title' => $schedule->group->title->title,
                            'lecturer' => null
                        ] : null,
                        'period' => $schedule->group->period ? [
                            'id' => $schedule->group->period->id,
                            'name' => $schedule->group->period->name
                        ] : null,
                        'members' => []
                    ]
                ];
            });
        $allSchedules = array_merge($allSchedules, $examinerSchedules->toArray());

        // 3. TA Defense schedules where dosen is examiner
        $taDefenseQuery = TaDefenseSchedule::with(['student', 'examiner1', 'examiner2', 'group.title', 'group.period'])
            ->where(function ($q) use ($user) {
                $q->where('examiner_1_id', $user->id)
                  ->orWhere('examiner_2_id', $user->id);
            })
            ->whereIn('status', ['SCHEDULED', 'DONE']);
        
        // Filter by period_id if provided
        if ($periodId) {
            $taDefenseQuery->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });
        }
        
        $taDefenseSchedules = $taDefenseQuery->get()
            ->map(function ($schedule) use ($user) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $schedule->date->format('Y-m-d');
                $timeStr = substr($schedule->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';
                
                return [
                    'id' => 'ta_defense_' . $schedule->id,
                    'type' => 'TA_DEFENSE',
                    'date' => $isoDate,
                    'start_time' => substr($schedule->start_time, 0, 5),
                    'end_time' => $schedule->end_time ? substr($schedule->end_time, 0, 5) : null,
                    'room' => $schedule->room,
                    'mode' => null,
                    'notes' => $schedule->notes,
                    'group_id' => $schedule->group_id,
                    'student_id' => $schedule->student_id,
                    'student_name' => $schedule->student ? $schedule->student->name : null,
                    'is_examiner' => ($schedule->examiner_1_id == $user->id || $schedule->examiner_2_id == $user->id),
                    'examiner1' => $schedule->examiner1 ? ['name' => $schedule->examiner1->name] : null,
                    'examiner2' => $schedule->examiner2 ? ['name' => $schedule->examiner2->name] : null,
                    'group' => [
                        'title' => $schedule->group->title ? [
                            'title' => $schedule->group->title->title,
                            'lecturer' => null
                        ] : null,
                        'members' => []
                    ]
                ];
            });
        $allSchedules = array_merge($allSchedules, $taDefenseSchedules->toArray());

        // 4. SEMPRO/EXPO schedules where dosen is SUPERVISOR (not examiner)
        // Get groups where dosen is supervisor with their roles
        $supervisions = \App\Models\Supervision::where('supervisor_id', $user->id)
            ->select('group_id', 'role')
            ->get();

        // SEPARATE: SEMPRO only visible to SUPERVISOR_2 (Dosbing 2)
        $supervisor2GroupIds = $supervisions->where('role', 'SUPERVISOR_2')->pluck('group_id');
        // TA_DEFENSE only visible to SUPERVISOR_1 (Dosbing 1)
        $supervisor1GroupIds = $supervisions->where('role', 'SUPERVISOR_1')->pluck('group_id');

        // SEMPRO/EXPO schedules for SUPERVISOR_2 only (exclude ones already shown as examiner)
        $examinerScheduleIds = $examinerQuery->pluck('id');
        $supervisorSeminarQuery = SeminarSchedule::with(['examiner1', 'examiner2', 'group.title', 'group.period'])
            ->whereIn('group_id', $supervisor2GroupIds);

        if ($examinerScheduleIds->isNotEmpty()) {
            $supervisorSeminarQuery->whereNotIn('id', $examinerScheduleIds);
        }

        $supervisorSeminarSchedules = $supervisorSeminarQuery->get()
            ->map(function ($schedule) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $schedule->date->format('Y-m-d');
                $timeStr = substr($schedule->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';

                return [
                    'id' => $schedule->id,
                    'type' => $schedule->type,
                    'date' => $isoDate,
                    'start_time' => substr($schedule->start_time, 0, 5),
                    'end_time' => $schedule->end_time ? substr($schedule->end_time, 0, 5) : null,
                    'room' => $schedule->room,
                    'mode' => null,
                    'notes' => null,
                    'group_id' => $schedule->group_id,
                    'is_supervisor' => true, // Flag to identify supervisor view
                    'examiner1' => $schedule->examiner1 ? ['name' => $schedule->examiner1->name] : null,
                    'examiner2' => $schedule->examiner2 ? ['name' => $schedule->examiner2->name] : null,
                    'group' => [
                        'id' => $schedule->group->id,
                        'title' => $schedule->group->title ? [
                            'title' => $schedule->group->title->title,
                            'lecturer' => null
                        ] : null,
                        'period' => $schedule->group->period ? [
                            'id' => $schedule->group->period->id,
                            'name' => $schedule->group->period->name
                        ] : null,
                        'members' => []
                    ]
                ];
            });
        $allSchedules = array_merge($allSchedules, $supervisorSeminarSchedules->toArray());

        // TA_DEFENSE schedules for SUPERVISOR_1 only (exclude ones already shown as examiner)
        $taDefenseScheduleIds = $taDefenseQuery->pluck('id');
        $supervisorTaDefenseQuery = TaDefenseSchedule::with(['student', 'examiner1', 'examiner2', 'group.title', 'group.period'])
            ->whereIn('group_id', $supervisor1GroupIds)  // Only SUPERVISOR_1 (Dosbing 1)
            ->whereIn('status', ['SCHEDULED', 'DONE']);

        if ($taDefenseScheduleIds->isNotEmpty()) {
            $supervisorTaDefenseQuery->whereNotIn('id', $taDefenseScheduleIds);
        }

        $supervisorTaDefenseSchedules = $supervisorTaDefenseQuery->get()
            ->map(function ($schedule) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $schedule->date->format('Y-m-d');
                $timeStr = substr($schedule->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';

                return [
                    'id' => $schedule->id,
                    'type' => 'TA_DEFENSE',
                    'date' => $isoDate,
                    'start_time' => substr($schedule->start_time, 0, 5),
                    'end_time' => $schedule->end_time ? substr($schedule->end_time, 0, 5) : null,
                    'room' => $schedule->room,
                    'mode' => null,
                    'notes' => $schedule->notes,
                    'group_id' => $schedule->group_id,
                    'student_id' => $schedule->student_id,
                    'student_name' => $schedule->student ? $schedule->student->name : null,
                    'is_supervisor' => true, // Flag to identify supervisor view
                    'is_examiner' => false,
                    'examiner1' => $schedule->examiner1 ? ['name' => $schedule->examiner1->name] : null,
                    'examiner2' => $schedule->examiner2 ? ['name' => $schedule->examiner2->name] : null,
                    'group' => [
                        'id' => $schedule->group->id,
                        'title' => $schedule->group->title ? [
                            'title' => $schedule->group->title->title,
                            'lecturer' => null
                        ] : null,
                        'period' => $schedule->group->period ? [
                            'id' => $schedule->group->period->id,
                            'name' => $schedule->group->period->name
                        ] : null,
                        'members' => []
                    ]
                ];
            });
        $allSchedules = array_merge($allSchedules, $supervisorTaDefenseSchedules->toArray());

        // Sort by date
        usort($allSchedules, function ($a, $b) {
            return strtotime($a['date']) - strtotime($b['date']);
        });

        return response()->json(['data' => $allSchedules]);
    }
}
