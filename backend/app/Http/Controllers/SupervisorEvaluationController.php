<?php

namespace App\Http\Controllers;

use App\Models\AssessmentScore;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\PeriodAssessmentComponent;
use App\Models\Schedule;
use App\Models\SeminarSchedule;
use App\Models\TaDefenseSchedule;
use App\Models\Supervision;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SupervisorEvaluationController extends Controller
{
    /**
     * Get list of groups where current dosen is supervisor with evaluation status
     */
    public function groups(Request $request): JsonResponse
    {
        $user = Auth::user();
        $periodId = $request->input('period_id');

        // Get groups where current user is supervisor
        $supervisions = Supervision::where('supervisor_id', $user->id)
            ->when($periodId, fn($q) => $q->whereHas('group', fn($gq) => $gq->where('period_id', $periodId)))
            ->with(['group.period', 'group.members.student'])
            ->get();

        $groups = $supervisions->map(function ($supervision) use ($user) {
            $group = $supervision->group;
            
            // Check schedules for this group
            $schedules = $this->getGroupSchedules($group->id);
            
            // Get evaluation status for each type
            $evaluations = [];
            foreach ($schedules as $schedule) {
                $evalType = $this->getEvaluationType($schedule['type']);
                if ($evalType) {
                    $evaluations[$evalType] = [
                        'schedule_id' => $schedule['id'],
                        'schedule_type' => $schedule['type'],
                        'date' => $schedule['date'],
                        'room' => $schedule['room'],
                        'deadline' => $schedule['evaluation_deadline'],
                        'status' => $this->getEvaluationStatus($group->id, $user->id, $evalType),
                    ];
                }
            }

            return [
                'id' => $group->id,
                'name' => $group->name,
                'code' => $group->code,
                'period' => [
                    'id' => $group->period->id,
                    'name' => $group->period->name,
                ],
                'supervisor_role' => $supervision->role, // SUPERVISOR_1 or SUPERVISOR_2
                'members' => $group->members->map(fn($m) => [
                    'id' => $m->student->id,
                    'name' => $m->student->name,
                    'nim' => $m->student->nim,
                    'is_leader' => $m->is_leader,
                ]),
                'evaluations' => $evaluations,
            ];
        });

        // Filter groups that have pending evaluations
        $groupsWithEvaluations = $groups->filter(fn($g) => count($g['evaluations']) > 0)->values();

        return response()->json([
            'data' => $groupsWithEvaluations,
        ]);
    }

    /**
     * Get count of pending evaluations for current supervisor
     */
    public function pendingCount(): JsonResponse
    {
        $user = Auth::user();

        // Get groups where current user is supervisor
        $supervisions = Supervision::where('supervisor_id', $user->id)
            ->with('group')
            ->get();

        $pendingCount = 0;

        foreach ($supervisions as $supervision) {
            $group = $supervision->group;
            
            // Check schedules for this group
            $schedules = $this->getGroupSchedules($group->id);
            
            foreach ($schedules as $schedule) {
                $evalType = $this->getEvaluationType($schedule['type']);
                if ($evalType) {
                    $status = $this->getEvaluationStatus($group->id, $user->id, $evalType);
                    if ($status === 'PENDING' || $status === 'PARTIAL') {
                        $pendingCount++;
                    }
                }
            }
        }

        return response()->json([
            'count' => $pendingCount,
        ]);
    }

    /**
     * Get schedules where current user is supervisor with evaluation info
     * Returns schedule-based view (similar to examiner)
     */
    public function schedules(Request $request): JsonResponse
    {
        $user = Auth::user();
        $periodId = $request->input('period_id');

        // Get groups where current user is supervisor
        $supervisionsQuery = Supervision::where('supervisor_id', $user->id)
            ->with(['group.period', 'group.members.student']);

        if ($periodId) {
            $supervisionsQuery->whereHas('group', function($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });
        }

        $supervisions = $supervisionsQuery->get();

        $schedules = [];

        foreach ($supervisions as $supervision) {
            $group = $supervision->group;
            
            // Skip if group doesn't exist
            if (!$group) {
                continue;
            }
            
            // Get detailed schedules for this group
            $groupSchedules = $this->getGroupSchedulesDetailed($group, $supervision, $user->id);
            $schedules = array_merge($schedules, $groupSchedules);
        }

        // Sort by date and start time
        usort($schedules, function($a, $b) {
            $dateCompare = strtotime($a['date']) - strtotime($b['date']);
            if ($dateCompare !== 0) return $dateCompare;
            return strcmp($a['start_time'], $b['start_time']);
        });

        return response()->json([
            'data' => $schedules,
        ]);
    }

    /**
     * Get detailed schedules for a group with evaluation status
     */
    private function getGroupSchedulesDetailed($group, $supervision, $supervisorId): array
    {
        $schedules = [];

        // SEMPRO → BIMBINGAN_SEMPRO
        $seminarSchedules = SeminarSchedule::where('group_id', $group->id)
            ->whereIn('type', ['SEMPRO'])
            ->get();
        
        foreach ($seminarSchedules as $sempro) {
            $schedules[] = $this->formatSeminarScheduleForSupervisor(
                $sempro, 'SEMINAR', 'BIMBINGAN_SEMPRO', $group, $supervision, $supervisorId
            );
        }
        
        // EXPO → BIMBINGAN_EXPO + MILESTONE
        $expoSchedules = SeminarSchedule::where('group_id', $group->id)
            ->whereIn('type', ['EXPO'])
            ->get();
        
        foreach ($expoSchedules as $expo) {
            // BIMBINGAN_EXPO
            $schedules[] = $this->formatSeminarScheduleForSupervisor(
                $expo, 'SEMINAR', 'BIMBINGAN_EXPO', $group, $supervision, $supervisorId
            );
            // MILESTONE
            $schedules[] = $this->formatSeminarScheduleForSupervisor(
                $expo, 'SEMINAR', 'MILESTONE', $group, $supervision, $supervisorId
            );
        }
        
        // TA_DEFENSE → BIMBINGAN_TA
        $taSchedules = TaDefenseSchedule::where('group_id', $group->id)
            ->get();
        
        foreach ($taSchedules as $ta) {
            $schedules[] = $this->formatTaDefenseScheduleForSupervisor(
                $ta, 'TA_DEFENSE', 'BIMBINGAN_TA', $group, $supervision, $supervisorId
            );
        }
        
        return $schedules;
    }

    /**
     * Format seminar schedule data for supervisor response
     */
    private function formatSeminarScheduleForSupervisor($seminarSchedule, string $scheduleType, string $evalType, $group, $supervision, int $supervisorId): array
    {
        $status = $this->getEvaluationStatus($group->id, $supervisorId, $evalType);
        
        // Calculate deadline (date + 2 days if not set)
        $deadline = null;
        if ($seminarSchedule->date) {
            $deadline = date('Y-m-d H:i:s', strtotime($seminarSchedule->date . ' +2 days'));
        }
        
        return [
            'schedule_id' => $seminarSchedule->id,
            'schedule_type' => $scheduleType,
            'evaluation_type' => $evalType,
            'date' => $seminarSchedule->date,
            'start_time' => $seminarSchedule->start_time,
            'end_time' => $seminarSchedule->end_time,
            'room' => $seminarSchedule->room,
            'deadline' => $deadline,
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
                'code' => $group->code,
            ],
            'students' => $group->members->map(fn($m) => [
                'id' => $m->student->id,
                'name' => $m->student->name,
                'nim' => $m->student->nim,
                'is_leader' => $m->is_leader,
            ])->values(),
            'status' => $status,
            'supervisor_role' => $supervision->role,
            'period' => [
                'id' => $group->period->id,
                'name' => $group->period->name,
            ],
        ];
    }

    /**
     * Format TA defense schedule data for supervisor response
     */
    private function formatTaDefenseScheduleForSupervisor($taDefenseSchedule, string $scheduleType, string $evalType, $group, $supervision, int $supervisorId): array
    {
        $status = $this->getEvaluationStatus($group->id, $supervisorId, $evalType);
        
        // Calculate deadline (date + 2 days if not set)
        $deadline = null;
        if ($taDefenseSchedule->date) {
            $deadline = date('Y-m-d H:i:s', strtotime($taDefenseSchedule->date . ' +2 days'));
        }
        
        return [
            'schedule_id' => $taDefenseSchedule->id,
            'schedule_type' => $scheduleType,
            'evaluation_type' => $evalType,
            'date' => $taDefenseSchedule->date,
            'start_time' => $taDefenseSchedule->start_time,
            'end_time' => $taDefenseSchedule->end_time,
            'room' => $taDefenseSchedule->room,
            'deadline' => $deadline,
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
                'code' => $group->code,
            ],
            'students' => $group->members->map(fn($m) => [
                'id' => $m->student->id,
                'name' => $m->student->name,
                'nim' => $m->student->nim,
                'is_leader' => $m->is_leader,
            ])->values(),
            'status' => $status,
            'supervisor_role' => $supervision->role,
            'period' => [
                'id' => $group->period->id,
                'name' => $group->period->name,
            ],
        ];
    }

    /**
     * Get evaluation form with components and existing scores
     */
    public function form(Request $request, int $groupId): JsonResponse
    {
        $user = Auth::user();
        $evaluationType = $request->input('type'); // BIMBINGAN_SEMPRO, BIMBINGAN_EXPO, MILESTONE, BIMBINGAN_TA

        // Validate evaluation type
        $validTypes = ['BIMBINGAN_SEMPRO', 'BIMBINGAN_EXPO', 'MILESTONE', 'BIMBINGAN_TA'];
        if (!in_array($evaluationType, $validTypes)) {
            return response()->json(['error' => 'Invalid evaluation type'], 400);
        }

        // Check if user is supervisor of this group
        $supervision = Supervision::where('group_id', $groupId)
            ->where('supervisor_id', $user->id)
            ->first();

        if (!$supervision) {
            return response()->json(['error' => 'You are not a supervisor of this group'], 403);
        }

        $group = Group::with(['members.student', 'period'])->findOrFail($groupId);

        // Get components for this evaluation type
        $components = PeriodAssessmentComponent::with('template')
            ->where('period_id', $group->period_id)
            ->where('type', $evaluationType)
            ->orderBy('sort_order')
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'template_id' => $c->template_id,
                'code' => $c->template->code,
                'name' => $c->template->name,
                'description' => $c->template->description,
                'weight' => $c->template->weight,
                'sort_order' => $c->sort_order,
            ]);

        if ($components->isEmpty()) {
            return response()->json([
                'error' => 'No assessment components configured for this evaluation type',
                'message' => 'Please contact admin to configure components',
            ], 400);
        }

        // Get existing scores
        $existingScores = AssessmentScore::where('group_id', $groupId)
            ->where('evaluator_id', $user->id)
            ->where('evaluation_type', $evaluationType)
            ->get()
            ->keyBy(fn($s) => $s->period_component_id . '_' . ($s->student_id ?? 'group'));

        // Build form structure
        $students = $group->members->map(function ($member) use ($components, $existingScores) {
            $student = $member->student;
            $scores = [];

            foreach ($components as $component) {
                $key = $component['id'] . '_' . $student->id;
                $existing = $existingScores->get($key);
                
                $scores[] = [
                    'component_id' => $component['id'],
                    'code' => $component['code'],
                    'name' => $component['name'],
                    'weight' => $component['weight'],
                    'score' => $existing ? $existing->score : null,
                    'notes' => $existing ? $existing->notes : null,
                ];
            }

            return [
                'id' => $student->id,
                'name' => $student->name,
                'nim' => $student->nim,
                'is_leader' => $member->is_leader,
                'scores' => $scores,
            ];
        });

        // Get schedule info
        $scheduleInfo = $this->getScheduleForType($groupId, $evaluationType);

        return response()->json([
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
                'code' => $group->code,
            ],
            'evaluation_type' => $evaluationType,
            'supervisor_role' => $supervision->role,
            'schedule' => $scheduleInfo,
            'components' => $components,
            'students' => $students,
        ]);
    }

    /**
     * Store supervisor evaluation scores
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        $validated = $request->validate([
            'group_id' => 'required|exists:groups,id',
            'evaluation_type' => 'required|in:BIMBINGAN_SEMPRO,BIMBINGAN_EXPO,MILESTONE,BIMBINGAN_TA',
            'scores' => 'required|array',
            'scores.*.period_component_id' => 'required|exists:period_assessment_components,id',
            'scores.*.student_id' => 'required|exists:users,id',
            'scores.*.score' => 'required|numeric|min:0|max:100',
            'scores.*.notes' => 'nullable|string',
        ]);

        $groupId = $validated['group_id'];
        $evaluationType = $validated['evaluation_type'];

        // Check if user is supervisor of this group
        $supervision = Supervision::where('group_id', $groupId)
            ->where('supervisor_id', $user->id)
            ->first();

        if (!$supervision) {
            return response()->json(['error' => 'You are not a supervisor of this group'], 403);
        }

        $group = Group::findOrFail($groupId);

        // Verify all students are members of this group
        $groupStudentIds = GroupMember::where('group_id', $groupId)->pluck('student_id')->toArray();
        foreach ($validated['scores'] as $score) {
            if (!in_array($score['student_id'], $groupStudentIds)) {
                return response()->json([
                    'error' => 'Invalid student_id: ' . $score['student_id'] . ' is not a member of this group',
                ], 400);
            }
        }

        // Get schedule info for deadline tracking (deadline no longer blocks submission)
        $schedule = $this->getScheduleForType($groupId, $evaluationType);
        $deadlinePassed = $schedule && $schedule['evaluation_deadline'] && now() > $schedule['evaluation_deadline'];

        DB::beginTransaction();
        try {
            foreach ($validated['scores'] as $scoreData) {
                AssessmentScore::updateOrCreate(
                    [
                        'period_component_id' => $scoreData['period_component_id'],
                        'evaluator_id' => $user->id,
                        'group_id' => $groupId,
                        'student_id' => $scoreData['student_id'],
                        'evaluation_type' => $evaluationType,
                    ],
                    [
                        'score' => $scoreData['score'],
                        'notes' => $scoreData['notes'] ?? null,
                    ]
                );
            }

            DB::commit();

            // Check if all bimbingan evaluations are complete after this submission
            if (in_array($evaluationType, ['BIMBINGAN_SEMPRO', 'BIMBINGAN_EXPO', 'MILESTONE'])) {
                $isComplete = $this->areAllBimbinganScoresComplete($groupId, $evaluationType);

                if ($isComplete) {
                    Log::info("All {$evaluationType} evaluations complete for group {$groupId}");
                    
                    // Trigger grade recalculation
                    try {
                        $gradeService = app(\App\Services\GradeCalculationService::class);
                        $gradeService->recalculateAndNotify($groupId, $evaluationType);
                    } catch (\Exception $e) {
                        Log::error("Failed to recalculate grades for group {$groupId}: " . $e->getMessage());
                    }
                }
            }

            // Send notification if deadline has passed
            if ($deadlinePassed) {
                try {
                    $notificationService = app(NotificationService::class);
                    $groupName = $group->name ?? "Group {$groupId}";
                    $deadlineFormatted = $schedule['evaluation_deadline'] ? date('d M Y H:i', strtotime($schedule['evaluation_deadline'])) : 'Unknown';
                    
                    $evaluationName = match ($evaluationType) {
                        'BIMBINGAN_SEMPRO' => 'SEMPRO',
                        'BIMBINGAN_EXPO' => 'EXPO',
                        'MILESTONE' => 'Milestone',
                        default => $evaluationType,
                    };
                    
                    $notificationService->send(
                        $user->id,
                        'EVALUATION_DEADLINE_PASSED',
                        'Evaluation Submitted After Deadline',
                        "Your evaluation for {$groupName} - {$evaluationName} was submitted after the deadline (due: {$deadlineFormatted}).",
                        'Group',
                        $groupId
                    );
                } catch (\Exception $e) {
                    Log::error("Failed to send deadline notification: " . $e->getMessage());
                }
            }

            return response()->json([
                'message' => 'Evaluation submitted successfully',
                'evaluation_type' => $evaluationType,
                'group_id' => $groupId,
                'all_complete' => $isComplete ?? null,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Failed to save evaluation',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Check if all bimbingan evaluations are complete from both supervisors
     */
    private function areAllBimbinganScoresComplete(int $groupId, string $evaluationType): bool
    {
        $group = Group::find($groupId);
        if (!$group) {
            return false;
        }

        // Get both supervisors
        $supervisorIds = [
            $group->supervisor_1_id,
            $group->supervisor_2_id,
        ];

        // Remove null values
        $supervisorIds = array_filter($supervisorIds);
        
        if (empty($supervisorIds)) {
            return false;
        }

        // Check if all supervisors have submitted scores for this evaluation type
        foreach ($supervisorIds as $supervisorId) {
            $hasScore = AssessmentScore::where([
                'group_id' => $groupId,
                'evaluator_id' => $supervisorId,
                'evaluation_type' => $evaluationType,
            ])->exists();

            if (!$hasScore) {
                return false; // This supervisor hasn't submitted yet
            }
        }

        return true;
    }

    /**
     * Get evaluation status for a group
     */
    private function getEvaluationStatus(int $groupId, int $supervisorId, string $evaluationType): string
    {
        $componentCount = PeriodAssessmentComponent::whereHas('period.groups', fn($q) => $q->where('groups.id', $groupId))
            ->where('type', $evaluationType)
            ->count();

        if ($componentCount === 0) {
            return 'not_configured';
        }

        $studentCount = GroupMember::where('group_id', $groupId)->count();
        $expectedScores = $componentCount * $studentCount;

        $actualScores = AssessmentScore::where('group_id', $groupId)
            ->where('evaluator_id', $supervisorId)
            ->where('evaluation_type', $evaluationType)
            ->count();

        if ($actualScores === 0) {
            return 'PENDING';
        } elseif ($actualScores < $expectedScores) {
            return 'PARTIAL';
        } else {
            return 'COMPLETED';
        }
    }

    /**
     * Get schedules for a group
     */
    private function getGroupSchedules(int $groupId): array
    {
        $schedules = [];

        // Check seminar schedules (SEMPRO)
        $seminarSchedules = SeminarSchedule::where('group_id', $groupId)
            ->get();

        foreach ($seminarSchedules as $ss) {
            $deadline = null;
            if ($ss->date) {
                $deadline = date('Y-m-d H:i:s', strtotime($ss->date . ' +2 days'));
            }
            $schedules[] = [
                'id' => $ss->id,
                'type' => 'SEMINAR',
                'date' => $ss->date,
                'room' => $ss->room,
                'evaluation_deadline' => $deadline,
            ];
        }

        // Check TA defense schedules (SIDANG_TA)
        $taSchedules = TaDefenseSchedule::where('group_id', $groupId)
            ->get();

        foreach ($taSchedules as $ts) {
            $deadline = null;
            if ($ts->date) {
                $deadline = date('Y-m-d H:i:s', strtotime($ts->date . ' +2 days'));
            }
            $schedules[] = [
                'id' => $ts->id,
                'type' => 'TA_DEFENSE',
                'date' => $ts->date,
                'room' => $ts->room,
                'evaluation_deadline' => $deadline,
            ];
        }

        // Check expo schedules
        $expoSchedules = Schedule::where('group_id', $groupId)
            ->where('type', 'EXPO')
            ->get();

        foreach ($expoSchedules as $es) {
            $schedules[] = [
                'id' => $es->id,
                'type' => 'EXPO',
                'date' => $es->date,
                'room' => $es->room,
                'evaluation_deadline' => $es->evaluation_deadline,
            ];
        }

        return $schedules;
    }

    /**
     * Map schedule type to evaluation type
     */
    private function getEvaluationType(string $scheduleType): ?string
    {
        return match ($scheduleType) {
            'SEMINAR' => 'BIMBINGAN_SEMPRO',
            'TA_DEFENSE' => 'BIMBINGAN_TA',
            'EXPO' => 'BIMBINGAN_EXPO',
            default => null,
        };
    }

    /**
     * Get schedule info for a specific evaluation type
     */
    private function getScheduleForType(int $groupId, string $evaluationType): ?array
    {
        $scheduleType = match ($evaluationType) {
            'BIMBINGAN_SEMPRO' => 'SEMINAR',
            'BIMBINGAN_TA' => 'TA_DEFENSE',
            'BIMBINGAN_EXPO', 'MILESTONE' => 'EXPO',
            default => null,
        };

        if (!$scheduleType) {
            return null;
        }

        if ($scheduleType === 'SEMINAR') {
            $schedule = SeminarSchedule::where('group_id', $groupId)
                ->latest()
                ->first();
            if ($schedule) {
                $deadline = null;
                if ($schedule->date) {
                    $deadline = date('Y-m-d H:i:s', strtotime($schedule->date . ' +2 days'));
                }
                return [
                    'id' => $schedule->id,
                    'type' => 'SEMINAR',
                    'date' => $schedule->date,
                    'room' => $schedule->room,
                    'evaluation_deadline' => $deadline,
                ];
            }
        } elseif ($scheduleType === 'TA_DEFENSE') {
            $schedule = TaDefenseSchedule::where('group_id', $groupId)
                ->latest()
                ->first();
            if ($schedule) {
                $deadline = null;
                if ($schedule->date) {
                    $deadline = date('Y-m-d H:i:s', strtotime($schedule->date . ' +2 days'));
                }
                return [
                    'id' => $schedule->id,
                    'type' => 'TA_DEFENSE',
                    'date' => $schedule->date,
                    'room' => $schedule->room,
                    'evaluation_deadline' => $deadline,
                ];
            }
        } elseif ($scheduleType === 'EXPO') {
            $schedule = Schedule::where('group_id', $groupId)
                ->where('type', 'EXPO')
                ->latest()
                ->first();
            if ($schedule) {
                return [
                    'id' => $schedule->id,
                    'type' => 'EXPO',
                    'date' => $schedule->date,
                    'room' => $schedule->room,
                    'evaluation_deadline' => $schedule->evaluation_deadline,
                ];
            }
        }

        return null;
    }

    /**
     * Admin: Get evaluation summary for a schedule
     */
    public function adminScheduleSummary(Request $request, int $scheduleId): JsonResponse
    {
        $schedule = Schedule::with(['group.period', 'group.members.student'])->findOrFail($scheduleId);
        $group = $schedule->group;

        // Determine evaluation types based on schedule type
        $evaluationTypes = match ($schedule->type) {
            'SEMINAR' => ['SEMPRO', 'BIMBINGAN_SEMPRO'],
            'TA_DEFENSE' => ['SIDANG_TA', 'BIMBINGAN_TA'],
            'EXPO' => ['EXPO', 'BIMBINGAN_EXPO', 'MILESTONE'],
            default => [],
        };

        $summary = [];

        foreach ($group->members as $member) {
            $student = $member->student;
            $studentScores = [];

            foreach ($evaluationTypes as $evalType) {
                $scores = AssessmentScore::with(['component', 'evaluator'])
                    ->where('group_id', $group->id)
                    ->where('student_id', $student->id)
                    ->where('evaluation_type', $evalType)
                    ->get();

                if ($scores->isEmpty()) {
                    continue;
                }

                // Group by evaluator
                $byEvaluator = $scores->groupBy('evaluator_id')->map(function ($evaluatorScores) use ($group) {
                    $evaluator = $evaluatorScores->first()->evaluator;
                    $componentScores = $evaluatorScores->map(fn($s) => [
                        'component' => $s->component?->name ?? 'Unknown',
                        'score' => $s->score,
                        'weight' => $s->component?->weight ?? 0,
                    ]);

                    $totalWeighted = $componentScores->sum(fn($s) => $s['score'] * $s['weight']);
                    $totalWeight = $componentScores->sum('weight');
                    $weightedAvg = $totalWeight > 0 ? round($totalWeighted / $totalWeight, 2) : 0;

                    return [
                        'evaluator' => [
                            'id' => $evaluator->id,
                            'name' => $evaluator->name,
                            'role' => $this->getEvaluatorRole($evaluator->id, $group->id),
                        ],
                        'weighted_average' => $weightedAvg,
                        'scores' => $componentScores,
                    ];
                })->values();

                $studentScores[$evalType] = $byEvaluator;
            }

            $summary[] = [
                'student' => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'nim' => $student->nim,
                ],
                'scores' => $studentScores,
            ];
        }

        return response()->json([
            'schedule' => [
                'id' => $schedule->id,
                'type' => $schedule->type,
                'date' => $schedule->date,
                'room' => $schedule->room,
            ],
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
                'code' => $group->code,
            ],
            'summary' => $summary,
        ]);
    }

    /**
     * Get evaluator role (examiner or supervisor)
     */
    private function getEvaluatorRole(int $evaluatorId, int $groupId): string
    {
        // Check if supervisor
        $supervision = Supervision::where('group_id', $groupId)
            ->where('supervisor_id', $evaluatorId)
            ->first();

        if ($supervision) {
            return $supervision->role === 'SUPERVISOR_1' ? 'Dosbing 1' : 'Dosbing 2';
        }

        // Check if examiner
        $isSeminarExaminer = \App\Models\SeminarEvaluation::whereHas('schedule', fn($q) => $q->where('group_id', $groupId))
            ->where('examiner_id', $evaluatorId)
            ->exists();

        if ($isSeminarExaminer) {
            return 'Examiner';
        }

        $isTaExaminer = \App\Models\TaDefenseExaminer::whereHas('schedule', fn($q) => $q->where('group_id', $groupId))
            ->where('examiner_id', $evaluatorId)
            ->exists();

        if ($isTaExaminer) {
            return 'Examiner';
        }

        return 'Unknown';
    }

    /**
     * Admin: Export evaluation summary as CSV
     */
    public function exportScheduleSummary(Request $request, int $scheduleId): StreamedResponse
    {
        $schedule = Schedule::with(['group.period', 'group.members.student', 'group.title'])->findOrFail($scheduleId);
        $group = $schedule->group;

        // Determine evaluation types based on schedule type
        $evaluationTypes = match ($schedule->type) {
            'SEMINAR' => ['SEMPRO', 'BIMBINGAN_SEMPRO'],
            'TA_DEFENSE' => ['SIDANG_TA', 'BIMBINGAN_TA'],
            'EXPO' => ['EXPO', 'BIMBINGAN_EXPO', 'MILESTONE'],
            default => [],
        };

        $csvData = [];
        $headers = ['Student', 'NIM', 'Evaluation Type', 'Evaluator', 'Role', 'Component', 'Weight', 'Score', 'Weighted Average'];

        foreach ($group->members as $member) {
            $student = $member->student;

            foreach ($evaluationTypes as $evalType) {
                $scores = AssessmentScore::with(['component', 'evaluator'])
                    ->where('group_id', $group->id)
                    ->where('student_id', $student->id)
                    ->where('evaluation_type', $evalType)
                    ->get();

                if ($scores->isEmpty()) {
                    continue;
                }

                // Group by evaluator
                $byEvaluator = $scores->groupBy('evaluator_id');

                foreach ($byEvaluator as $evaluatorId => $evaluatorScores) {
                    $evaluator = $evaluatorScores->first()->evaluator;
                    $role = $this->getEvaluatorRole($evaluatorId, $group->id);

                    $componentScores = $evaluatorScores->map(fn($s) => [
                        'component' => $s->component?->name ?? 'Unknown',
                        'weight' => $s->component?->weight ?? 0,
                        'score' => $s->score,
                    ]);

                    $totalWeighted = $componentScores->sum(fn($s) => $s['score'] * $s['weight']);
                    $totalWeight = $componentScores->sum('weight');
                    $weightedAvg = $totalWeight > 0 ? round($totalWeighted / $totalWeight, 2) : 0;

                    foreach ($componentScores as $cs) {
                        $csvData[] = [
                            $student->name,
                            $student->nim,
                            $evalType,
                            $evaluator->name,
                            $role,
                            $cs['component'],
                            $cs['weight'] . '%',
                            $cs['score'],
                            $weightedAvg,
                        ];
                    }
                }
            }
        }

        $filename = "evaluation_summary_schedule_{$scheduleId}.csv";

        return response()->streamDownload(function () use ($headers, $csvData) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);
            foreach ($csvData as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }
}
