<?php

namespace App\Http\Controllers;

use App\Models\AssessmentScore;
use App\Models\AssessmentComponent;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\PeriodAssessmentComponent;
use App\Models\Schedule;
use App\Models\SeminarEvaluation;
use App\Models\SeminarSchedule;
use App\Models\Supervision;
use App\Models\TaDefenseEvaluation;
use App\Models\TaDefenseExaminer;
use App\Models\TaDefenseSchedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class SeminarDashboardController extends Controller
{
    /**
     * Student: my group's SEMPRO/Expo schedules + results with detailed evaluation status.
     */
    public function studentSchedules(Request $request)
    {
        $user = $request->user();
        $membership = GroupMember::where('student_id', $user->id)->first();

        if (!$membership) {
            return response()->json(['data' => ['seminars' => [], 'ta_defense' => null]]);
        }

        $group = Group::with(['supervisor1', 'supervisor2'])->find($membership->group_id);

        $seminars = SeminarSchedule::with(['examiner1', 'examiner2', 'evaluations.examiner'])
            ->where('group_id', $membership->group_id)
            ->get()
            ->map(function ($seminar) use ($group) {
                $evaluationType = $seminar->type === 'SEMPRO' ? 'BIMBINGAN_SEMPRO' : 'BIMBINGAN_EXPO';

                // Get supervisor evaluation status
                $supervisors = [];
                $supervisorIds = array_filter([$group->supervisor_1_id, $group->supervisor_2_id]);

                foreach ($supervisorIds as $supervisorId) {
                    $supervisor = $supervisorId === $group->supervisor_1_id ? $group->supervisor1 : $group->supervisor2;

                    // Check if this supervisor has submitted BIMBINGAN evaluation
                    $evaluationSubmitted = AssessmentScore::where('group_id', $group->id)
                        ->where('evaluator_id', $supervisorId)
                        ->where('evaluation_type', $evaluationType)
                        ->exists();

                    // Get average score if submitted
                    $averageScore = null;
                    if ($evaluationSubmitted) {
                        $averageScore = AssessmentScore::where('group_id', $group->id)
                            ->where('evaluator_id', $supervisorId)
                            ->where('evaluation_type', $evaluationType)
                            ->avg('score');
                    }

                    $supervisors[] = [
                        'id' => $supervisorId,
                        'name' => $supervisor ? $supervisor->name : 'Unknown',
                        'status' => $evaluationSubmitted ? 'SUBMITTED' : 'PENDING',
                        'score' => $averageScore ? round($averageScore, 2) : null,
                    ];
                }

                // Get examiner evaluation status
                $examiners = [];
                $examinerEvaluations = [];

                foreach ($seminar->evaluations as $evaluation) {
                    $examinerEvaluations[$evaluation->examiner_id] = $evaluation;
                }

                if ($seminar->examiner1) {
                    $eval = $examinerEvaluations[$seminar->examiner_1_id] ?? null;
                    $examiners[] = [
                        'id' => $seminar->examiner_1_id,
                        'name' => $seminar->examiner1->name,
                        'status' => $eval && $eval->status === 'SUBMITTED' ? 'SUBMITTED' : 'PENDING',
                        'score' => $eval && $eval->status === 'SUBMITTED' ? $eval->score : null,
                    ];
                }

                if ($seminar->examiner2) {
                    $eval = $examinerEvaluations[$seminar->examiner_2_id] ?? null;
                    $examiners[] = [
                        'id' => $seminar->examiner_2_id,
                        'name' => $seminar->examiner2->name,
                        'status' => $eval && $eval->status === 'SUBMITTED' ? 'SUBMITTED' : 'PENDING',
                        'score' => $eval && $eval->status === 'SUBMITTED' ? $eval->score : null,
                    ];
                }

                // Calculate completion progress
                $completedCount = 0;
                foreach ($supervisors as $s) {
                    if ($s['status'] === 'SUBMITTED') $completedCount++;
                }
                foreach ($examiners as $e) {
                    if ($e['status'] === 'SUBMITTED') $completedCount++;
                }
                $totalCount = count($supervisors) + count($examiners);

                // Determine overall status
                $overallStatus = 'PENDING';
                if ($completedCount === $totalCount && $totalCount > 0) {
                    $overallStatus = 'COMPLETE';
                } elseif ($completedCount > 0) {
                    $overallStatus = 'IN_PROGRESS';
                }

                // Get final result if all complete
                $finalResult = null;
                if ($overallStatus === 'COMPLETE') {
                    $submittedEvaluations = $seminar->evaluations->where('status', 'SUBMITTED');
                    if ($submittedEvaluations->count() === $seminar->evaluations->count()) {
                        // All examiner evaluations submitted - check if at least one is PASS
                        $hasPass = $submittedEvaluations->contains(function ($eval) {
                            return ($eval->rubric_json['result'] ?? 'FAIL') === 'PASS';
                        });
                        $finalResult = $hasPass ? 'PASS' : 'FAIL';
                    }
                }

                return [
                    'id' => $seminar->id,
                    'type' => $seminar->type,
                    'date' => $seminar->date,
                    'start_time' => $seminar->start_time,
                    'end_time' => $seminar->end_time,
                    'room' => $seminar->room,
                    'status' => $seminar->status,
                    'supervisors' => $supervisors,
                    'examiners' => $examiners,
                    'progress' => [
                        'completed' => $completedCount,
                        'total' => $totalCount,
                        'percentage' => $totalCount > 0 ? round(($completedCount / $totalCount) * 100) : 0,
                    ],
                    'overall_status' => $overallStatus,
                    'final_result' => $finalResult,
                    'group' => [
                        'id' => $group->id,
                        'name' => $group->name,
                    ],
                ];
            });

        $taDefense = TaDefenseSchedule::with(['examiners.examiner', 'evaluations.examiner'])
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
     * Dosen: schedules where I'm a supervisor (read-only view).
     */
    public function supervisorSchedules(Request $request)
    {
        $user = $request->user();
        $periodId = $request->query('period_id');

        // Groups I supervise
        $groupsQuery = Supervision::where('supervisor_id', $user->id);
        if ($periodId) {
            $groupsQuery->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });
        }
        $groupIds = $groupsQuery->pluck('group_id');

        $seminars = SeminarSchedule::with(['group.title', 'examiner1', 'examiner2', 'evaluations.examiner'])
            ->whereIn('group_id', $groupIds)
            ->orderByDesc('date')
            ->get();

        $taDefenses = TaDefenseSchedule::with(['student', 'group.title', 'examiners.examiner', 'evaluations.examiner'])
            ->whereIn('group_id', $groupIds)
            ->orderByDesc('date')
            ->get();

        // Expo schedules for supervisor evaluation (BIMBINGAN_EXPO, MILESTONE)
        $expoSchedules = Schedule::with(['group.title'])
            ->whereIn('group_id', $groupIds)
            ->where('type', 'EXPO')
            ->orderByDesc('date')
            ->get()
            ->map(function ($schedule) use ($user) {
                // Check evaluation status
                $bimbinganExpoCompleted = AssessmentScore::where('group_id', $schedule->group_id)
                    ->where('evaluator_id', $user->id)
                    ->where('evaluation_type', 'BIMBINGAN_EXPO')
                    ->exists();
                
                $milestoneCompleted = AssessmentScore::where('group_id', $schedule->group_id)
                    ->where('evaluator_id', $user->id)
                    ->where('evaluation_type', 'MILESTONE')
                    ->exists();

                return [
                    'id' => $schedule->id,
                    'group_id' => $schedule->group_id,
                    'type' => $schedule->type,
                    'date' => $schedule->date,
                    'room' => $schedule->room,
                    'evaluation_deadline' => $schedule->evaluation_deadline,
                    'group' => $schedule->group,
                    'evaluation_status' => [
                        'bimbingan_expo' => $bimbinganExpoCompleted ? 'completed' : 'pending',
                        'milestone' => $milestoneCompleted ? 'completed' : 'pending',
                    ],
                ];
            });

        return response()->json([
            'data' => [
                'seminars' => $seminars,
                'ta_defenses' => $taDefenses,
                'expo_schedules' => $expoSchedules,
            ],
        ]);
    }

    /**
     * Dosen: schedules where I'm an examiner (can submit rubric).
     */
    public function examinerSchedules(Request $request)
    {
        $user = $request->user();
        $periodId = $request->query('period_id');

        // Seminar schedules where I'm examiner
        $seminarQuery = SeminarSchedule::with([
            'group.title',
            'group.members.student',
            'examiner1',
            'examiner2',
            'evaluations' => function ($q) use ($user) {
                $q->where('examiner_id', $user->id);
            }
        ]);

        if ($periodId) {
            $seminarQuery->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });
        }

        // Only get schedules where I'm examiner (via evaluation or explicit column)
        $seminarScheduleIds = SeminarEvaluation::where('examiner_id', $user->id)
            ->pluck('schedule_id');
        
        $seminars = $seminarQuery->whereIn('id', $seminarScheduleIds)
            ->orderByDesc('date')
            ->get();

        // TA defense schedules where I'm examiner
        $taQuery = TaDefenseSchedule::with([
            'student',
            'group.title',
            'group.members.student',
            'examiners.examiner',
            'evaluations' => function ($q) use ($user) {
                $q->where('examiner_id', $user->id);
            }
        ]);

        if ($periodId) {
            $taQuery->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });
        }

        $taScheduleIds = TaDefenseExaminer::where('examiner_id', $user->id)
            ->pluck('schedule_id');

        $taDefenses = $taQuery->whereIn('id', $taScheduleIds)
            ->orderByDesc('date')
            ->get();

        return response()->json([
            'data' => [
                'seminars' => $seminars,
                'ta_defenses' => $taDefenses,
            ],
        ]);
    }

    /**
     * Get specific evaluation context (Seminar or TA Defense).
     * Returns components from period_assessment_components joined with templates.
     */
    public function evaluationContext(Request $request, $type, $id)
    {
        $user = $request->user();

        if ($type === 'SEMINAR') {
            $evaluation = SeminarEvaluation::where('id', $id)
                ->where('examiner_id', $user->id)
                ->firstOrFail();
            $schedule = SeminarSchedule::with(['group.title', 'group.members.student', 'examiner1', 'examiner2'])
                ->findOrFail($evaluation->schedule_id);
            
            $components = $this->resolveEvaluationComponents($schedule->group->period_id, $schedule->type);

            $existingScores = $this->resolveExistingScores(
                $user->id,
                $schedule->group_id,
                $schedule->type
            );

            return response()->json([
                'evaluation' => $evaluation,
                'schedule' => $schedule,
                'group' => $schedule->group,
                'components' => $components,
                'existing_scores' => $existingScores,
                'type' => 'SEMINAR'
            ]);
        } else {
            // Try to find existing evaluation by ID
            $evaluation = TaDefenseEvaluation::where('id', $id)
                ->where('examiner_id', $user->id)
                ->first();
            
            // If not found by ID, check if this is a valid evaluation ID that belongs to the user
            // or auto-create the evaluation if the user is assigned as examiner
            if (!$evaluation) {
                // First, try to find the evaluation by ID alone to see if it exists
                $existingEval = TaDefenseEvaluation::find($id);
                
                if ($existingEval) {
                    // Evaluation exists but doesn't belong to this user
                    return response()->json([
                        'message' => 'Anda tidak memiliki akses ke penilaian ini'
                    ], 403);
                }
                
                // The ID might be a schedule ID - check if user is examiner for this schedule
                $schedule = TaDefenseSchedule::with(['student', 'group.title', 'group.members.student', 'examiners.examiner'])
                    ->find($id);
                
                if (!$schedule) {
                    return response()->json([
                        'message' => 'Jadwal tidak ditemukan'
                    ], 404);
                }
                
                // Check if user is an examiner for this schedule
                $isExaminer = TaDefenseExaminer::where('schedule_id', $schedule->id)
                    ->where('examiner_id', $user->id)
                    ->exists();
                
                if (!$isExaminer) {
                    return response()->json([
                        'message' => 'Anda tidak ditugaskan sebagai penguji untuk jadwal ini'
                    ], 403);
                }
                
                // Check if evaluation already exists for this schedule/examiner (race condition)
                $existingEvaluation = TaDefenseEvaluation::where('schedule_id', $schedule->id)
                    ->where('examiner_id', $user->id)
                    ->first();
                
                if ($existingEvaluation) {
                    $evaluation = $existingEvaluation;
                } else {
                    // Auto-create evaluation record using firstOrCreate to handle race conditions
                    $evaluation = TaDefenseEvaluation::firstOrCreate([
                        'schedule_id' => $schedule->id,
                        'examiner_id' => $user->id,
                    ], [
                        'student_id' => $schedule->student_id,
                        'status' => 'PENDING',
                        'score' => 0,
                        'rubric_json' => null,
                    ]);
                }
            } else {
                // Evaluation found, load the schedule
                $schedule = TaDefenseSchedule::with(['student', 'group.title', 'group.members.student', 'examiners.examiner'])
                    ->findOrFail($evaluation->schedule_id);
            }

            $components = $this->resolveEvaluationComponents($schedule->group->period_id, 'SIDANG_TA');

            $existingScores = $this->resolveExistingScores(
                $user->id,
                $schedule->group_id,
                'SIDANG_TA'
            );

            return response()->json([
                'evaluation' => $evaluation,
                'schedule' => $schedule,
                'group' => $schedule->group,
                'student' => $schedule->student ? [
                    'id' => $schedule->student->id,
                    'name' => $schedule->student->name,
                    'nim' => $schedule->student->nim ?? '',
                ] : null,
                'components' => $components,
                'existing_scores' => $existingScores,
                'type' => 'TA_DEFENSE'
            ]);
        }
    }

    private function resolveEvaluationComponents(int $periodId, string $type)
    {
        if (Schema::hasTable('period_assessment_components')) {
            $periodComponents = PeriodAssessmentComponent::with('template')
                ->where('period_id', $periodId)
                ->where('type', $type)
                ->orderBy('sort_order')
                ->get();

            if ($periodComponents->isNotEmpty()) {
                return $periodComponents->map(fn ($c) => [
                    'id' => $c->id,
                    'code' => $c->template->code,
                    'name' => $c->template->name,
                    'description' => $c->template->description,
                    'weight' => $c->template->weight,
                    'sort_order' => $c->sort_order,
                    'template_id' => $c->template_id,
                    'period_id' => $c->period_id,
                ]);
            }
        }

        if (Schema::hasTable('assessment_components')) {
            return AssessmentComponent::query()
                ->where('period_id', $periodId)
                ->where('type', $type)
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($c) => [
                    'id' => $c->id,
                    'code' => $c->code,
                    'name' => $c->name,
                    'description' => $c->description,
                    'weight' => $c->weight,
                    'sort_order' => $c->sort_order,
                    'template_id' => null,
                    'period_id' => $c->period_id,
                ]);
        }

        return collect();
    }

    private function resolveExistingScores(int $evaluatorId, int $groupId, string $evaluationType)
    {
        $scores = AssessmentScore::where('evaluator_id', $evaluatorId)
            ->where('group_id', $groupId)
            ->where('evaluation_type', $evaluationType)
            ->get();

        $hasPeriodComponentColumn = Schema::hasTable('assessment_scores')
            && Schema::hasColumn('assessment_scores', 'period_component_id');

        return $scores->keyBy(function ($score) use ($hasPeriodComponentColumn) {
            $componentId = $hasPeriodComponentColumn
                ? ($score->period_component_id ?? $score->component_id)
                : $score->component_id;

            return $componentId . '_' . $score->student_id;
        });
    }
}
