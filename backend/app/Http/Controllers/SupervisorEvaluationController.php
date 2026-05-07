<?php

namespace App\Http\Controllers;

use App\Models\AssessmentComponent;
use App\Models\AssessmentScore;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\PeriodAssessmentComponent;
use App\Models\Schedule;
use App\Models\SeminarSchedule;
use App\Models\TaDefenseSchedule;
use App\Models\TaDefenseEvaluation;
use App\Models\TaDefenseExaminer;
use App\Models\Supervision;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
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

            // Use canonical schedule/evaluation generator to keep group and schedule views consistent.
            $groupSchedules = $this->getGroupSchedulesDetailed($group, $supervision, $user->id);

            // Get one card per evaluation type
            $evaluations = [];
            foreach ($groupSchedules as $schedule) {
                $evalType = $schedule['evaluation_type'];
                if (!isset($evaluations[$evalType])) {
                    $evaluations[$evalType] = [
                        'schedule_id' => $schedule['schedule_id'],
                        'schedule_type' => $schedule['schedule_type'],
                        'date' => $schedule['date'],
                        'room' => $schedule['room'],
                        'deadline' => $schedule['deadline'],
                        'status' => strtolower((string) $schedule['status']),
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

            if (!$group) {
                continue;
            }

            $groupSchedules = $this->getGroupSchedulesDetailed($group, $supervision, $user->id);
            $pendingTypes = [];

            foreach ($groupSchedules as $schedule) {
                $evalType = (string) $schedule['evaluation_type'];
                $status = strtoupper((string) $schedule['status']);
                if (in_array($status, ['PENDING', 'PARTIAL'], true) && !in_array($evalType, $pendingTypes, true)) {
                    $pendingTypes[] = $evalType;
                }
            }

            $pendingCount += count($pendingTypes);
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

        // Sort by date and start time (undated cards go last)
        usort($schedules, function($a, $b) {
            $aDate = $a['date'] ? strtotime($a['date']) : PHP_INT_MAX;
            $bDate = $b['date'] ? strtotime($b['date']) : PHP_INT_MAX;
            $dateCompare = $aDate - $bDate;
            if ($dateCompare !== 0) return $dateCompare;
            return strcmp((string) $a['start_time'], (string) $b['start_time']);
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
        
        // EXPO evaluation should be visible when group is ready for expo or expo is active.
        // EXPO_ACTIVE is represented by EXPO_REGISTERED in current state machine.
        if (in_array($group->status, ['PDC2_READY_FOR_EXPO', 'EXPO_REGISTERED'], true)) {
            $expo = SeminarSchedule::where('group_id', $group->id)
                ->where('type', 'EXPO')
                ->orderByDesc('id')
                ->first();

            if ($expo) {
                $schedules[] = $this->formatSeminarScheduleForSupervisor(
                    $expo, 'SEMINAR', 'EXPO', $group, $supervision, $supervisorId
                );
            } else {
                $schedules[] = $this->formatStatusBasedEvaluationForSupervisor(
                    $group,
                    $supervision,
                    $supervisorId,
                    'EXPO',
                    'EXPO'
                );
            }
        }

        // MILESTONE should be visible for PDC2_ACTIVE groups.
        if ($group->status === 'PDC2_ACTIVE') {
            $schedules[] = $this->formatStatusBasedEvaluationForSupervisor(
                $group,
                $supervision,
                $supervisorId,
                'MILESTONE',
                'PDC2'
            );
        }
        
        // TA_DEFENSE → BIMBINGAN_TA (only if student has TA_READY_FOR_SIDANG or higher status)
        $taSchedules = TaDefenseSchedule::where('group_id', $group->id)
            ->where('status', '!=', 'CANCELLED')
            ->get();

        foreach ($taSchedules as $ta) {
            // Check if student is ready for sidang
            $studentSubmission = \App\Models\TaSubmission::where('student_id', $ta->student_id)->first();
            if ($studentSubmission && $studentSubmission->statusIsAtLeast('TA_READY_FOR_SIDANG')) {
                $schedules[] = $this->formatTaDefenseScheduleForSupervisor(
                    $ta, 'TA_DEFENSE', 'BIMBINGAN_TA', $group, $supervision, $supervisorId
                );
            }
        }

        // PDC2 → NILAI_DOSEN (show for active or ready-for-expo states)
        if (in_array($group->status, ['PDC2_ACTIVE', 'PDC2_READY_FOR_EXPO'], true)) {
            $schedules[] = $this->formatNilaiDosenForSupervisor($group, $supervision, $supervisorId);
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
        // Get the specific student for this TA defense schedule
        $student = $taDefenseSchedule->student;
        
        $status = $this->getEvaluationStatus($group->id, $supervisorId, $evalType, $student?->id);
        
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
            'student' => $student ? [
                'id' => $student->id,
                'name' => $student->name,
                'nim' => $student->nim,
                'is_leader' => $group->members->firstWhere('student_id', $student->id)?->is_leader ?? false,
            ] : null,
            'status' => $status,
            'supervisor_role' => $supervision->role,
            'period' => [
                'id' => $group->period->id,
                'name' => $group->period->name,
            ],
        ];
    }

    /**
     * Format NILAI_DOSEN evaluation data for supervisor response (no schedule, just evaluation)
     */
    private function formatNilaiDosenForSupervisor($group, $supervision, int $supervisorId): array
    {
        $status = $this->getEvaluationStatus($group->id, $supervisorId, 'NILAI_DOSEN');

        // NILAI_DOSEN has no specific date - use current date + 7 days as soft deadline
        $deadline = date('Y-m-d H:i:s', strtotime('+7 days'));

        return [
            'schedule_id' => null,
            'schedule_type' => 'PDC2',
            'evaluation_type' => 'NILAI_DOSEN',
            'date' => null,
            'start_time' => null,
            'end_time' => null,
            'room' => null,
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
     * Format status-based evaluation card when schedule may not exist.
     */
    private function formatStatusBasedEvaluationForSupervisor($group, $supervision, int $supervisorId, string $evalType, string $scheduleType): array
    {
        $status = $this->getEvaluationStatus($group->id, $supervisorId, $evalType);
        $deadline = date('Y-m-d H:i:s', strtotime('+7 days'));

        return [
            'schedule_id' => null,
            'schedule_type' => $scheduleType,
            'evaluation_type' => $evalType,
            'date' => null,
            'start_time' => null,
            'end_time' => null,
            'room' => null,
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
        $evaluationType = $request->input('type'); // BIMBINGAN_SEMPRO, NILAI_DOSEN, EXPO, MILESTONE, BIMBINGAN_TA

        // Validate evaluation type
        $validTypes = ['BIMBINGAN_SEMPRO', 'NILAI_DOSEN', 'EXPO', 'MILESTONE', 'BIMBINGAN_TA'];
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

        // Get components for this evaluation type (schema-aware)
        if ($this->usesPeriodAssessmentComponents()) {
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
            $existingScoresKeyField = 'period_component_id';
        } else {
            // Legacy schema
            $components = AssessmentComponent::where('period_id', $group->period_id)
                ->where('type', $evaluationType)
                ->orderBy('sort_order', 'asc')
                ->get()
                ->map(fn($c) => [
                    'id' => $c->id,
                    'template_id' => null,
                    'code' => $c->code ?? $c->name,
                    'name' => $c->name,
                    'description' => $c->description,
                    'weight' => $c->weight,
                    'sort_order' => $c->sort_order,
                ]);
            $existingScoresKeyField = 'component_id';
        }

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
            ->keyBy(fn($s) => $s->{$existingScoresKeyField} . '_' . ($s->student_id ?? 'group'));

        // Build form structure - filter by student if specified (for per-student evaluations like BIMBINGAN_TA)
        $studentId = $request->input('student_id');
        $students = $group->members
            ->when($studentId, fn($q) => $q->where('student_id', $studentId))
            ->map(function ($member) use ($components, $existingScores) {
                $student = $member->student;
                $scores = [];

                foreach ($components as $component) {
                    $key = $component['id'] . '_' . $student->id;
                    $existing = $existingScores->get($key);

                    $scores[] = [
                        'period_component_id' => $component['id'],
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

        // Schema-aware validation - accept both field names for flexibility
        $usesPeriodComponents = $this->usesPeriodAssessmentComponents();
        $componentIdField = $usesPeriodComponents ? 'period_component_id' : 'component_id';
        $componentTable = $usesPeriodComponents ? 'period_assessment_components' : 'assessment_components';
        
        Log::info('SupervisorEvaluationController::store', [
            'uses_period_components' => $usesPeriodComponents,
            'component_id_field' => $componentIdField,
            'component_table' => $componentTable,
            'request_data' => $request->all(),
        ]);

        // Validate with flexible field name (accepts both period_component_id and component_id)
        $validated = $request->validate([
            'group_id' => 'required|exists:groups,id',
            'evaluation_type' => 'required|in:BIMBINGAN_SEMPRO,NILAI_DOSEN,EXPO,MILESTONE,BIMBINGAN_TA',
            'scores' => 'required|array',
            'scores.*.student_id' => 'required|exists:users,id',
            'scores.*.score' => 'required|numeric|min:0|max:100',
            'scores.*.notes' => 'nullable|string',
            // Include both component ID fields so they survive validation
            'scores.*.period_component_id' => "nullable|integer|exists:{$componentTable},id",
            'scores.*.component_id' => "nullable|integer|exists:{$componentTable},id",
        ]);

        // Ensure each score item has at least one component ID
        foreach ($validated['scores'] as $index => $score) {
            if (empty($score['period_component_id']) && empty($score['component_id'])) {
                return response()->json([
                    'error' => "Score item {$index} is missing both period_component_id and component_id",
                ], 422);
            }
        }

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
            // Prepare batch upsert data for better performance
            $upsertData = [];
            foreach ($validated['scores'] as $scoreData) {
                // Extract component ID from whichever field was provided
                $componentId = $scoreData['period_component_id'] ?? $scoreData['component_id'] ?? null;
                if (!$componentId) {
                    throw new \InvalidArgumentException('Missing component ID in score data');
                }

                $insertData = [
                    $componentIdField => $componentId,
                    'evaluator_id' => $user->id,
                    'group_id' => $groupId,
                    'student_id' => $scoreData['student_id'],
                    'evaluation_type' => $evaluationType,
                    'score' => $scoreData['score'],
                    'notes' => $scoreData['notes'] ?? null,
                ];

                // For legacy schema, also set period_component_id to same value if column exists
                if (!$usesPeriodComponents && Schema::hasColumn('assessment_scores', 'period_component_id')) {
                    $insertData['period_component_id'] = $componentId;
                }

                $upsertData[] = $insertData;
            }

            // Batch upsert all scores in a single query
            if (!empty($upsertData)) {
                $updateColumns = ['score', 'notes'];
                if (!$usesPeriodComponents && Schema::hasColumn('assessment_scores', 'period_component_id')) {
                    $updateColumns[] = 'period_component_id';
                }

                AssessmentScore::upsert(
                    $upsertData,
                    [$componentIdField, 'evaluator_id', 'group_id', 'student_id', 'evaluation_type'],
                    $updateColumns
                );
            }

            DB::commit();

            // Check if all bimbingan evaluations are complete after this submission
            if (in_array($evaluationType, ['BIMBINGAN_SEMPRO', 'NILAI_DOSEN', 'EXPO', 'MILESTONE'], true)) {
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
                        'NILAI_DOSEN' => 'Nilai Dosen Pembimbing',
                        'EXPO' => 'Evaluasi EXPO',
                        'MILESTONE' => 'Milestone',
                        'BIMBINGAN_TA' => 'TA Defense',
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
     * Check if period_assessment_components table exists
     */
    private function usesPeriodAssessmentComponents(): bool
    {
        return Schema::hasTable('period_assessment_components');
    }

    /**
     * Get evaluation status for a group
     */
    private function getEvaluationStatus(int $groupId, int $supervisorId, string $evaluationType, ?int $studentId = null): string
    {
        $group = Group::find($groupId);
        if (!$group) {
            return 'not_configured';
        }

        // Schema-aware component count
        if ($this->usesPeriodAssessmentComponents()) {
            $componentCount = PeriodAssessmentComponent::whereHas('period.groups', fn($q) => $q->where('groups.id', $groupId))
                ->where('type', $evaluationType)
                ->count();
        } else {
            // Legacy schema: use assessment_components
            $componentCount = AssessmentComponent::where('period_id', $group->period_id)
                ->where('type', $evaluationType)
                ->count();
        }

        if ($componentCount === 0) {
            return 'not_configured';
        }

        // For per-student evaluations (BIMBINGAN_TA), only check for the specific student
        if ($studentId !== null) {
            $expectedScores = $componentCount;
            
            $actualScores = AssessmentScore::where('group_id', $groupId)
                ->where('evaluator_id', $supervisorId)
                ->where('evaluation_type', $evaluationType)
                ->where('student_id', $studentId)
                ->count();
        } else {
            // For group-level evaluations, check all students
            $studentCount = GroupMember::where('group_id', $groupId)->count();
            $expectedScores = $componentCount * $studentCount;

            $actualScores = AssessmentScore::where('group_id', $groupId)
                ->where('evaluator_id', $supervisorId)
                ->where('evaluation_type', $evaluationType)
                ->count();
        }

        if ($actualScores === 0) {
            return 'PENDING';
        } elseif ($actualScores < $expectedScores) {
            return 'PARTIAL';
        } else {
            return 'COMPLETED';
        }
    }

    /**
     * Get schedule info for a specific evaluation type
     */
    private function getScheduleForType(int $groupId, string $evaluationType): ?array
    {
        $scheduleType = match ($evaluationType) {
            'BIMBINGAN_SEMPRO' => 'SEMINAR',
            'BIMBINGAN_TA' => 'TA_DEFENSE',
            'EXPO' => 'EXPO',
            'MILESTONE' => 'EXPO',
            // NILAI_DOSEN has no schedule
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
        // Try Schedule table first, then TaDefenseSchedule for TA_DEFENSE
        $schedule = Schedule::with(['group.period', 'group.members.student'])->find($scheduleId);
        $isTaDefense = false;
        $taSchedule = null;

        if (!$schedule) {
            // Try TaDefenseSchedule for TA defense schedules
            $taSchedule = TaDefenseSchedule::with(['group.period', 'group.members.student', 'student'])->find($scheduleId);
            if (!$taSchedule) {
                return response()->json(['error' => 'Schedule not found'], 404);
            }
            $isTaDefense = true;
            $schedule = (object)[
                'id' => $taSchedule->id,
                'type' => 'TA_DEFENSE',
                'date' => $taSchedule->date,
                'room' => $taSchedule->room,
            ];
        }

        $group = $isTaDefense ? $taSchedule->group : $schedule->group;

        // Determine evaluation types based on schedule type
        $evaluationTypes = match ($schedule->type) {
            'SEMINAR' => ['SEMPRO', 'BIMBINGAN_SEMPRO'],
            'TA_DEFENSE' => ['SIDANG_TA', 'BIMBINGAN_TA'],
            'EXPO' => ['EXPO', 'MILESTONE'],
            default => [],
        };

        $summary = [];

        // For TA_DEFENSE, only show the specific student (not all group members)
        if ($isTaDefense) {
            $students = collect([$taSchedule->student]);
        } else {
            $students = $group->members->map(fn($m) => $m->student);
        }

        foreach ($students as $student) {
            $studentScores = [];

            foreach ($evaluationTypes as $evalType) {
                if ($evalType === 'SIDANG_TA') {
                    // SIDANG_TA examiner evaluations are in ta_defense_evaluations table
                    $evaluations = TaDefenseEvaluation::with('examiner')
                        ->where('schedule_id', $scheduleId)
                        ->where('student_id', $student->id)
                        ->where('status', 'SUBMITTED')
                        ->get();

                    if ($evaluations->isEmpty()) {
                        continue;
                    }

                    $byEvaluator = $evaluations->map(function ($eval) use ($scheduleId) {
                        // Parse rubric_json for component scores
                        $rubric = $eval->rubric_json ?? [];
                        $componentScores = collect($rubric)->map(function ($r) {
                            return [
                                'component' => $r['component'] ?? $r['name'] ?? 'Unknown',
                                'score' => $r['score'] ?? 0,
                                'weight' => $r['weight'] ?? 0,
                            ];
                        });

                        // Get examiner role
                        $examinerRecord = TaDefenseExaminer::where('schedule_id', $scheduleId)
                            ->where('examiner_id', $eval->examiner_id)
                            ->first();

                        return [
                            'evaluator' => [
                                'id' => $eval->examiner->id,
                                'name' => $eval->examiner->name,
                                'role' => $examinerRecord?->role ?? 'Examiner',
                            ],
                            'weighted_average' => $eval->score,
                            'scores' => $componentScores,
                        ];
                    })->values();

                    $studentScores[$evalType] = $byEvaluator;
                } else {
                    // BIMBINGAN_TA and other evaluations are in assessment_scores table
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
        // Try Schedule table first, then TaDefenseSchedule for TA_DEFENSE
        $schedule = Schedule::with(['group.period', 'group.members.student', 'group.title'])->find($scheduleId);
        $isTaDefense = false;
        $taSchedule = null;

        if (!$schedule) {
            // Try TaDefenseSchedule for TA defense schedules
            $taSchedule = TaDefenseSchedule::with(['group.period', 'group.members.student', 'student'])->find($scheduleId);
            if (!$taSchedule) {
                abort(404, 'Schedule not found');
            }
            $isTaDefense = true;
            $schedule = (object)[
                'id' => $taSchedule->id,
                'type' => 'TA_DEFENSE',
                'date' => $taSchedule->date,
                'room' => $taSchedule->room,
            ];
        }

        $group = $isTaDefense ? $taSchedule->group : $schedule->group;

        // Determine evaluation types based on schedule type
        $evaluationTypes = match ($schedule->type) {
            'SEMINAR' => ['SEMPRO', 'BIMBINGAN_SEMPRO'],
            'TA_DEFENSE' => ['SIDANG_TA', 'BIMBINGAN_TA'],
            'EXPO' => ['EXPO', 'MILESTONE'],
            default => [],
        };

        $csvData = [];
        $headers = ['Student', 'NIM', 'Evaluation Type', 'Evaluator', 'Role', 'Component', 'Weight', 'Score', 'Weighted Average'];

        // For TA_DEFENSE, only export the specific student
        if ($isTaDefense) {
            $students = collect([$taSchedule->student]);
        } else {
            $students = $group->members->map(fn($m) => $m->student);
        }

        foreach ($students as $student) {
            foreach ($evaluationTypes as $evalType) {
                if ($evalType === 'SIDANG_TA') {
                    // SIDANG_TA examiner evaluations are in ta_defense_evaluations table
                    $evaluations = TaDefenseEvaluation::with('examiner')
                        ->where('schedule_id', $scheduleId)
                        ->where('student_id', $student->id)
                        ->where('status', 'SUBMITTED')
                        ->get();

                    if ($evaluations->isEmpty()) {
                        continue;
                    }

                    foreach ($evaluations as $eval) {
                        $rubric = $eval->rubric_json ?? [];
                        $componentScores = collect($rubric)->map(function ($r) {
                            return [
                                'component' => $r['component'] ?? $r['name'] ?? 'Unknown',
                                'score' => $r['score'] ?? 0,
                                'weight' => $r['weight'] ?? 0,
                            ];
                        });

                        $examinerRecord = TaDefenseExaminer::where('schedule_id', $scheduleId)
                            ->where('examiner_id', $eval->examiner_id)
                            ->first();

                        $role = $examinerRecord?->role ?? 'Examiner';
                        $weightedAvg = $eval->score;

                        foreach ($componentScores as $cs) {
                            $csvData[] = [
                                $student->name,
                                $student->nim,
                                $evalType,
                                $eval->examiner->name,
                                $role,
                                $cs['component'],
                                $cs['weight'] . '%',
                                $cs['score'],
                                $weightedAvg,
                            ];
                        }
                    }
                } else {
                    // BIMBINGAN_TA and other evaluations are in assessment_scores table
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

    /**
     * Admin: Get grades for a schedule
     */
    public function getGradesForSchedule(Request $request, int $scheduleId): JsonResponse
    {
        // Try Schedule table first, then TaDefenseSchedule for TA_DEFENSE
        $schedule = Schedule::with(['group'])->find($scheduleId);
        $isTaDefense = false;

        if (!$schedule) {
            $taSchedule = TaDefenseSchedule::with(['group'])->find($scheduleId);
            if (!$taSchedule) {
                return response()->json(['error' => 'Schedule not found'], 404);
            }
            $isTaDefense = true;
            $group = $taSchedule->group;
        } else {
            $group = $schedule->group;
        }

        $grades = [];
        $gradeService = app(\App\Services\GradeCalculationService::class);

        // For TA_DEFENSE, only get grades for the specific student
        if ($isTaDefense) {
            $students = collect([$taSchedule->student]);
        } else {
            $students = $group->members->map(fn($m) => $m->student);
        }

        foreach ($students as $student) {
            try {
                $finalGradeData = $gradeService->calculateFinalGradeForStudent($student->id, $group->id);
                $pdc1Data = $gradeService->calculatePDC1ForStudent($student->id, $group->id);
                $pdc2Data = $gradeService->calculatePDC2ForStudent($student->id, $group->id);

                $grades[$student->id] = [
                    'student' => [
                        'id' => $student->id,
                        'name' => $student->name,
                        'nim' => $student->nim,
                    ],
                    'pdc1_score' => $pdc1Data['grade'] ?? null,
                    'pdc2_score' => $pdc2Data['grade'] ?? null,
                    'final_grade' => $finalGradeData['final_grade'] ?? null,
                    'letter_grade' => $finalGradeData['letter_grade'] ?? null,
                ];
            } catch (\Exception $e) {
                $grades[$student->id] = [
                    'student' => [
                        'id' => $student->id,
                        'name' => $student->name,
                        'nim' => $student->nim,
                    ],
                    'error' => 'Failed to calculate grades: ' . $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'schedule_id' => $scheduleId,
            'grades' => $grades,
        ]);
    }
}
