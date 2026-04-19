<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\ExpoEvent;
use App\Models\ExpoRegistration;
use App\Models\TaDefenseSchedule;
use App\Models\SeminarSchedule;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ScheduleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $query = Schedule::with('group.title.lecturer', 'group.members.student')
            ->orderBy('date', 'asc');

        if ($request->has('period_id')) {
            $query->whereHas('group', function ($q) use ($request) {
                $q->where('period_id', $request->period_id);
            });
        }

        // Admin can only see SEMPRO, SIDANG, EXPO schedules
        if ($user->hasRole('admin')) {
            return response()->json([
                'data' => $query->whereIn('type', ['SEMPRO', 'SIDANG', 'EXPO'])->get()
            ]);
        }

        // Dosen can only see BIMBINGAN schedules for their own groups
        if ($user->hasRole('dosen')) {
            $groupIds = Group::whereHas('title', function ($q) use ($user) {
                $q->where('lecturer_id', $user->id);
            });

            if ($request->has('period_id')) {
                $groupIds->where('period_id', $request->period_id);
            }

            return response()->json([
                'data' => $query->whereIn('group_id', $groupIds->pluck('id'))
                    ->where('type', 'BIMBINGAN')
                    ->get()
            ]);
        }

        // Mahasiswa can only see their own group's schedule (exclude rejected groups)
        if ($user->hasRole('mahasiswa')) {
            $groupMember = \App\Models\GroupMember::where('student_id', $user->id)
                ->whereHas('group', function ($q) {
                    $q->where('status', '!=', 'REJECTED');
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
            'room' => 'required|string',
            'mode' => 'nullable|string|in:online,offline',
            'notes' => 'nullable|string|max:1000',
        ]);

        $data = $request->all();
        
        // Auto-set evaluation deadline to 2 days after schedule date
        if (!isset($data['evaluation_deadline'])) {
            $data['evaluation_deadline'] = date('Y-m-d H:i:s', strtotime($data['date'] . ' +2 days'));
        }
        
        $schedule = Schedule::create($data);

        // Send notifications to supervisors and examiners
        $notificationService = app(NotificationService::class);
        $group = Group::with(['supervisions', 'title'])->find($request->group_id);
        
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
            'room' => 'string',
            'mode' => 'nullable|string|in:online,offline',
            'notes' => 'nullable|string|max:1000',
        ]);

        $schedule = Schedule::findOrFail($id);
        $schedule->update($request->all());

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
        $bimbinganSchedules = Schedule::with('group.title.lecturer')
            ->where('group_id', $groupId)
            ->where('type', 'BIMBINGAN')
            ->get()
            ->map(function ($schedule) {
                return [
                    'id' => $schedule->id,
                    'type' => 'BIMBINGAN',
                    'date' => $schedule->date,
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
        $semproSchedules = SeminarSchedule::with(['examiner1', 'examiner2', 'group.title'])
            ->where('group_id', $groupId)
            ->where('type', 'SEMPRO')
            ->get()
            ->map(function ($schedule) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $schedule->date->format('Y-m-d');
                $timeStr = substr($schedule->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';
                
                return [
                    'id' => 'sempro_' . $schedule->id,
                    'type' => 'SEMPRO',
                    'date' => $isoDate,
                    'room' => $schedule->room,
                    'mode' => null,
                    'notes' => null,
                    'group_id' => $schedule->group_id,
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
                    'id' => 'expo_' . $event->id,
                    'type' => 'EXPO',
                    'date' => $isoDate,
                    'room' => $event->room,
                    'mode' => null,
                    'notes' => $event->name,
                    'group_id' => $groupId,
                    'group' => [
                        'title' => [
                            'title' => $event->name,
                            'lecturer' => null
                        ],
                        'members' => []
                    ]
                ];
            }
        }

        // 4. TA Defense schedules for the individual student
        $taDefenseSchedules = TaDefenseSchedule::with(['examiner1', 'examiner2', 'group.title'])
            ->where('student_id', $user->id)
            ->whereIn('status', ['SCHEDULED', 'DONE'])
            ->get()
            ->map(function ($schedule) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $schedule->date->format('Y-m-d');
                $timeStr = substr($schedule->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';
                
                return [
                    'id' => 'ta_defense_' . $schedule->id,
                    'type' => 'TA_DEFENSE',
                    'date' => $isoDate,
                    'room' => $schedule->room,
                    'mode' => null,
                    'notes' => $schedule->notes,
                    'group_id' => $schedule->group_id,
                    'student_id' => $schedule->student_id,
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

        // 1. BIMBINGAN schedules for supervised groups
        $supervisedGroupIds = Group::whereHas('supervisions', function ($q) use ($user) {
            $q->where('supervisor_id', $user->id);
        })->pluck('id');

        $bimbinganSchedules = Schedule::with('group.title.lecturer')
            ->whereIn('group_id', $supervisedGroupIds)
            ->where('type', 'BIMBINGAN')
            ->get()
            ->map(function ($schedule) {
                return [
                    'id' => $schedule->id,
                    'type' => 'BIMBINGAN',
                    'date' => $schedule->date,
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
        $examinerSchedules = SeminarSchedule::with(['examiner1', 'examiner2', 'group.title'])
            ->where(function ($q) use ($user) {
                $q->where('examiner_1_id', $user->id)
                  ->orWhere('examiner_2_id', $user->id);
            })
            ->get()
            ->map(function ($schedule) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $schedule->date->format('Y-m-d');
                $timeStr = substr($schedule->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';
                
                return [
                    'id' => 'sempro_' . $schedule->id,
                    'type' => $schedule->type,
                    'date' => $isoDate,
                    'room' => $schedule->room,
                    'mode' => null,
                    'notes' => null,
                    'group_id' => $schedule->group_id,
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
        $allSchedules = array_merge($allSchedules, $examinerSchedules->toArray());

        // 3. TA Defense schedules where dosen is examiner
        $taDefenseSchedules = TaDefenseSchedule::with(['student', 'examiner1', 'examiner2', 'group.title'])
            ->where(function ($q) use ($user) {
                $q->where('examiner_1_id', $user->id)
                  ->orWhere('examiner_2_id', $user->id);
            })
            ->whereIn('status', ['SCHEDULED', 'DONE'])
            ->get()
            ->map(function ($schedule) use ($user) {
                // Format date as ISO 8601 to ensure JavaScript can parse it
                $dateStr = $schedule->date->format('Y-m-d');
                $timeStr = substr($schedule->start_time, 0, 5); // Get HH:MM
                $isoDate = $dateStr . 'T' . $timeStr . ':00';
                
                return [
                    'id' => 'ta_defense_' . $schedule->id,
                    'type' => 'TA_DEFENSE',
                    'date' => $isoDate,
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

        // Sort by date
        usort($allSchedules, function ($a, $b) {
            return strtotime($a['date']) - strtotime($b['date']);
        });

        return response()->json(['data' => $allSchedules]);
    }
}
