<?php

namespace App\Http\Controllers;

use App\Models\Period;
use App\Models\PeerReview;
use App\Models\TaDefenseEvaluation;
use App\Models\TaDefenseSchedule;
use App\Repositories\AssessmentScoreRepository;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Facades\DB;

class GradeCheckController extends Controller
{
    /**
     * Get grade check data with filtering and pagination
     */
    public function index(Request $request)
    {
        $request->validate([
            'period_id' => 'nullable|exists:periods,id',
            'evaluation_type' => 'nullable|string|in:SEMPRO,BIMBINGAN_SEMPRO,EXPO,MILESTONE,NILAI_DOSEN,PEER_REVIEW,SIDANG_TA,BIMBINGAN_TA',
            'group_id' => 'nullable|exists:groups,id',
            'student_id' => 'nullable|exists:users,id',
            'per_page' => 'nullable|integer|min:10|max:500',
        ]);

        $perPage = $request->input('per_page', 25);
        
        // Get active period if not specified
        $periodId = $request->input('period_id');
        if (!$periodId) {
            $activePeriod = Period::getActive();
            $periodId = $activePeriod?->id;
        }

        // If student_id is provided, return all evaluation types for that student
        if ($request->student_id) {
            return $this->getStudentAllData($request, $periodId);
        }

        // Build query based on evaluation type
        $evaluationType = $request->input('evaluation_type');
        
        if ($evaluationType === 'PEER_REVIEW') {
            return $this->getPeerReviewData($request, $periodId, $perPage);
        } else {
            return $this->getAssessmentData($request, $periodId, $evaluationType, $perPage);
        }
    }

    /**
     * Get all evaluation data for a specific student (for detail page)
     */
    private function getStudentAllData(Request $request, $periodId)
    {
        $studentId = $request->student_id;

        // Get group_ids for the period first (faster than whereHas)
        $periodGroupIds = null;
        if ($periodId) {
            $periodGroupIds = \App\Models\Group::where('period_id', $periodId)->pluck('id');
        }

        // Get all assessment scores for the student with optimized eager loading
        // Filter by student_id FIRST, then by group (much faster)
        $assessmentScores = AssessmentScoreRepository::getAllWith([
            'evaluator:id,name',
            'student:id,name,nim',
            'group:id,status,title_id',
            'group.title:id,title',
            'component:id,name',
            'periodComponent:id,template_id',
            'periodComponent.template:id,code,name,weight'
        ], function ($query, $type) use ($studentId, $periodGroupIds) {
            $query->where('student_id', $studentId);
            if ($periodGroupIds && $periodGroupIds->isNotEmpty()) {
                $query->whereIn('group_id', $periodGroupIds);
            }
        });

        // Preload schedules to avoid N+1 queries
        $scoreGroupIds = $assessmentScores->pluck('group_id')->unique()->filter()->values();
        $schedules = \App\Models\Schedule::whereIn('group_id', $scoreGroupIds)
            ->whereIn('type', ['SEMPRO', 'SIDANG_TA'])
            ->get()
            ->keyBy(fn($s) => $s->group_id . '_' . $s->type);

        // Get all peer reviews for the student (filter by student first, then by group)
        $peerReviews = PeerReview::with([
            'reviewer:id,name',
            'reviewee:id,name,nim',
            'group:id,status,title_id',
            'group.title:id,title',
            'periodIndicator:id,template_id',
            'periodIndicator.template:id,code,name,weight'
        ])
        ->where('reviewee_id', $studentId)
        ->where('is_final_submission', true)
        ->when($periodGroupIds && $periodGroupIds->isNotEmpty(), fn($q) => $q->whereIn('group_id', $periodGroupIds))
        ->get();

        // Get all TA defense evaluations for the student
        $taDefenseEvals = TaDefenseEvaluation::with([
            'examiner',
            'schedule.group:id,status,title_id',
            'schedule.group.title:id,title',
        ])
        ->whereHas('schedule', function($q) use ($studentId, $periodId) {
            $q->where('student_id', $studentId);
            if ($periodId) {
                $q->where('period_id', $periodId);
            }
        })
        ->get();

        // Format assessment scores
        $formattedScores = $assessmentScores->map(function ($score) use ($schedules) {
            $evaluatorRole = $this->getEvaluatorRole($score, $schedules);
            $componentScores = $this->getComponentScores($score);
            $weightedAvg = $this->calculateEvaluatorWeightedAverage($score);

            return [
                'id' => $score->id,
                'group' => [
                    'id' => $score->group_id,
                    'code' => 'G' . $score->group_id,
                    'name' => $score->group?->title?->title ?? 'Group ' . $score->group_id,
                    'status' => $score->group?->status,
                ],
                'student' => $score->student ? [
                    'id' => $score->student_id,
                    'name' => $score->student->name,
                    'nim' => $score->student->nim ?? null,
                ] : null,
                'evaluation_type' => $score->evaluation_type,
                'evaluator' => [
                    'id' => $score->evaluator_id,
                    'name' => $score->evaluator?->name,
                    'role' => $evaluatorRole,
                ],
                'component_scores' => $componentScores,
                'weighted_average' => $weightedAvg,
                'submitted_at' => $score->created_at,
                'notes' => $score->notes,
            ];
        });

        // Format peer reviews
        $formattedPeerReviews = $peerReviews->map(function ($review) {
            return [
                'id' => $review->id,
                'group' => [
                    'id' => $review->group_id,
                    'code' => 'G' . $review->group_id,
                    'name' => $review->group?->title?->title ?? 'Group ' . $review->group_id,
                    'status' => $review->group?->status,
                ],
                'student' => [
                    'id' => $review->reviewee_id,
                    'name' => $review->reviewee?->name,
                    'nim' => $review->reviewee?->nim ?? null,
                ],
                'evaluation_type' => 'PEER_REVIEW',
                'evaluator' => [
                    'id' => $review->reviewer_id,
                    'name' => $review->reviewer?->name,
                    'role' => 'PEER_STUDENT',
                ],
                'component_scores' => [
                    [
                        'code' => $review->periodIndicator?->template?->code ?? 'PR',
                        'name' => $review->periodIndicator?->template?->name ?? 'Peer Review',
                        'raw_score' => $review->raw_score,
                        'converted_score' => $review->score,
                        'weight' => $review->periodIndicator?->template?->weight ?? 100,
                    ]
                ],
                'weighted_average' => $review->score,
                'submitted_at' => $review->submitted_at,
                'notes' => $review->comment,
            ];
        });

        // Format TA defense evaluations
        $formattedTaDefense = $taDefenseEvals->map(function ($eval) {
            return [
                'id' => $eval->id,
                'group' => [
                    'id' => $eval->schedule->group_id,
                    'code' => 'G' . $eval->schedule->group_id,
                    'name' => $eval->schedule->group?->title?->title ?? 'Group ' . $eval->schedule->group_id,
                    'status' => $eval->schedule->group?->status,
                ],
                'student' => [
                    'id' => $eval->schedule->student_id,
                    'name' => $eval->schedule->student?->name,
                    'nim' => $eval->schedule->student?->nim ?? null,
                ],
                'evaluation_type' => 'TA_DEFENSE',
                'evaluator' => [
                    'id' => $eval->examiner_id,
                    'name' => $eval->examiner?->name,
                    'role' => 'EXAMINER',
                ],
                'component_scores' => [
                    [
                        'code' => 'TA_DEFENSE',
                        'name' => 'TA Defense',
                        'score' => $eval->score,
                        'weight' => 100,
                    ]
                ],
                'weighted_average' => $eval->score,
                'submitted_at' => $eval->updated_at,
                'notes' => null,
                'status' => $eval->status,
            ];
        });

        // Merge all data
        $allData = $formattedScores->concat($formattedPeerReviews)->concat($formattedTaDefense);

        return response()->json([
            'data' => $allData,
            'pagination' => [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => $allData->count(),
                'total' => $allData->count(),
            ],
            'filters' => [
                'period_id' => $periodId,
                'student_id' => $studentId,
            ],
        ]);
    }

    /**
     * Get assessment score data (for all types except peer review)
     */
    private function getAssessmentData(Request $request, $periodId, $evaluationType, $perPage)
    {
        // Pre-fetch group_ids for the period (faster than whereHas)
        $periodGroupIds = null;
        if ($periodId) {
            $periodGroupIds = \App\Models\Group::where('period_id', $periodId)->pluck('id');
            // If no groups found for period, return empty result early
            if ($periodGroupIds->isEmpty()) {
                return response()->json([
                    'data' => [],
                    'pagination' => [
                        'current_page' => 1,
                        'last_page' => 1,
                        'per_page' => $perPage,
                        'total' => 0,
                    ],
                    'filters' => [
                        'period_id' => $periodId,
                        'evaluation_type' => $evaluationType,
                    ],
                ]);
            }
        }

        if ($evaluationType && AssessmentScoreRepository::isSupportedType($evaluationType)) {
            // Single evaluation type - use specific repository query
            $query = AssessmentScoreRepository::forType($evaluationType)
                ->with([
                    'evaluator:id,name',
                    'student:id,name,nim',
                    'group:id,status,title_id',
                    'group.title:id,title',
                    'component:id,name',
                    'periodComponent:id,template_id',
                    'periodComponent.template:id,code,name,weight'
                ])
                ->whereHas('group', function ($q) use ($periodId) {
                    $q->where('period_id', $periodId);
                });
            
            if ($request->group_id) {
                $query->where('group_id', $request->group_id);
            }
            if ($request->student_id) {
                $query->where('student_id', $request->student_id);
            }
            
            $scores = $query->paginate($perPage);
        } else {
            // Multiple evaluation types - aggregate from all supported types
            // Note: For paginated results across multiple tables, we collect all and paginate manually
            $allScores = collect();
            
            foreach (AssessmentScoreRepository::getSupportedTypes() as $type) {
                if ($evaluationType && $type !== $evaluationType) {
                    continue;
                }
                
                $typeScores = AssessmentScoreRepository::forType($type)
                    ->with([
                        'evaluator:id,name',
                        'student:id,name,nim',
                        'group:id,status,title_id',
                        'group.title:id,title',
                        'component:id,name',
                        'periodComponent:id,template_id',
                        'periodComponent.template:id,code,name,weight'
                    ])
                    ->whereHas('group', function ($q) use ($periodId) {
                        $q->where('period_id', $periodId);
                    })
                    ->when($request->group_id, fn($q) => $q->where('group_id', $request->group_id))
                    ->when($request->student_id, fn($q) => $q->where('student_id', $request->student_id))
                    ->get();
                
                $allScores = $allScores->merge($typeScores);
            }
            
            // Manual pagination
            $total = $allScores->count();
            $page = $request->input('page', 1);
            $offset = ($page - 1) * $perPage;
            $scores = $allScores->slice($offset, $perPage)->values();
            
            // Create a simple paginator-like object
            $scores = new \Illuminate\Pagination\LengthAwarePaginator(
                $scores,
                $total,
                $perPage,
                $page,
                ['path' => $request->url()]
            );
        }
        
        // Preload schedules to avoid N+1 queries for SEMPRO and SIDANG_TA types
        $scoreGroupIds = $scores->pluck('group_id')->unique()->filter()->values();
        $schedules = collect();
        if ($scoreGroupIds->isNotEmpty()) {
            $schedules = \App\Models\Schedule::whereIn('group_id', $scoreGroupIds)
                ->whereIn('type', ['SEMPRO', 'SIDANG_TA'])
                ->get()
                ->keyBy(fn($s) => $s->group_id . '_' . $s->type);
        }

        $data = $scores->map(function ($score) use ($schedules) {
            // Determine evaluator role
            $evaluatorRole = $this->getEvaluatorRole($score, $schedules);

            // Get component scores
            $componentScores = $this->getComponentScores($score);

            // Calculate weighted average for this evaluator
            $weightedAvg = $this->calculateEvaluatorWeightedAverage($score);

            return [
                'id' => $score->id,
                'group' => [
                    'id' => $score->group_id,
                    'code' => 'G' . $score->group_id,
                    'name' => $score->group?->title?->title ?? 'Group ' . $score->group_id,
                    'status' => $score->group?->status,
                ],
                'student' => $score->student ? [
                    'id' => $score->student_id,
                    'name' => $score->student->name,
                    'nim' => $score->student->nim ?? null,
                ] : null,
                'evaluation_type' => $score->evaluation_type,
                'evaluator' => [
                    'id' => $score->evaluator_id,
                    'name' => $score->evaluator?->name,
                    'role' => $evaluatorRole,
                ],
                'component_scores' => $componentScores,
                'weighted_average' => $weightedAvg,
                'submitted_at' => $score->created_at,
                'notes' => $score->notes,
            ];
        });

        return response()->json([
            'data' => $data,
            'pagination' => [
                'current_page' => $scores->currentPage(),
                'last_page' => $scores->lastPage(),
                'per_page' => $scores->perPage(),
                'total' => $scores->total(),
            ],
            'filters' => [
                'period_id' => $periodId,
                'evaluation_type' => $evaluationType,
            ],
        ]);
    }

    /**
     * Get peer review data
     */
    private function getPeerReviewData(Request $request, $periodId, $perPage)
    {
        // Pre-fetch group_ids for the period (faster than whereHas)
        $periodGroupIds = null;
        if ($periodId) {
            $periodGroupIds = \App\Models\Group::where('period_id', $periodId)->pluck('id');
            // If no groups found for period, return empty result early
            if ($periodGroupIds->isEmpty()) {
                return response()->json([
                    'data' => [],
                    'pagination' => [
                        'current_page' => 1,
                        'last_page' => 1,
                        'per_page' => $perPage,
                        'total' => 0,
                    ],
                    'filters' => [
                        'period_id' => $periodId,
                        'evaluation_type' => 'PEER_REVIEW',
                    ],
                ]);
            }
        }

        $query = PeerReview::with([
            'reviewer:id,name',
            'reviewee:id,name,nim',
            'group:id,status,title_id',
            'group.title:id,title',
            'periodIndicator:id,template_id',
            'periodIndicator.template:id,code,name,weight'
        ])
        ->when($periodGroupIds && $periodGroupIds->isNotEmpty(), fn($q) => $q->whereIn('group_id', $periodGroupIds))
        ->when($request->group_id, fn($q) => $q->where('group_id', $request->group_id))
        ->when($request->student_id, fn($q) => $q->where('reviewee_id', $request->student_id));

        $reviews = $query->paginate($perPage);

        $data = $reviews->map(function ($review) {
            return [
                'id' => $review->id,
                'group' => [
                    'id' => $review->group_id,
                    'code' => 'G' . $review->group_id,
                    'name' => $review->group?->title?->title ?? 'Group ' . $review->group_id,
                    'status' => $review->group?->status,
                ],
                'student' => [
                    'id' => $review->reviewee_id,
                    'name' => $review->reviewee?->name,
                    'nim' => $review->reviewee?->nim ?? null,
                ],
                'evaluation_type' => 'PEER_REVIEW',
                'evaluator' => [
                    'id' => $review->reviewer_id,
                    'name' => $review->reviewer?->name,
                    'role' => 'PEER_STUDENT',
                ],
                'component_scores' => [
                    [
                        'code' => $review->periodIndicator?->template?->code ?? 'PR',
                        'name' => $review->periodIndicator?->template?->name ?? 'Peer Review',
                        'raw_score' => $review->raw_score,
                        'converted_score' => $review->score,
                        'weight' => $review->periodIndicator?->template?->weight ?? 100,
                    ]
                ],
                'weighted_average' => $review->score,
                'submitted_at' => $review->submitted_at,
                'notes' => $review->comment,
            ];
        });

        return response()->json([
            'data' => $data,
            'pagination' => [
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
                'per_page' => $reviews->perPage(),
                'total' => $reviews->total(),
            ],
            'filters' => [
                'period_id' => $periodId,
                'evaluation_type' => 'PEER_REVIEW',
            ],
        ]);
    }

    /**
     * Determine evaluator role based on score data
     * 
     * @param \Illuminate\Support\Collection|null $schedules Preloaded schedules cache to avoid N+1 queries
     */
    private function getEvaluatorRole($score, $schedules = null): string
    {
        $evaluationType = $score->evaluation_type ?? '';
        $evaluatorId = $score->examiner_id ?? $score->evaluator_id ?? null;
        $group = $score->group;

        if (!$group) {
            return 'EVALUATOR';
        }

        // Check if evaluator is supervisor
        $isSupervisor = $group->supervisor_1_id === $evaluatorId || $group->supervisor_2_id === $evaluatorId;
        
        if ($isSupervisor) {
            $supervisorNumber = $group->supervisor_1_id === $evaluatorId ? '1' : '2';
            return "SUPERVISOR_{$supervisorNumber}";
        }

        // Check if evaluator is examiner (for SEMPRO and SIDANG_TA)
        if (in_array($evaluationType, ['SEMPRO', 'SIDANG_TA'])) {
            // Use preloaded schedules if available, otherwise query (fallback for backward compatibility)
            if ($schedules !== null) {
                $key = $group->id . '_' . $evaluationType;
                $schedule = $schedules->get($key);
            } else {
                $schedule = \App\Models\Schedule::where('group_id', $group->id)
                    ->where('type', $evaluationType)
                    ->first();
            }
            
            if ($schedule) {
                $examiners = $schedule->examiners ?? [];
                foreach ($examiners as $index => $examiner) {
                    if ($examiner['id'] == $evaluatorId) {
                        return "EXAMINER_" . ($index + 1);
                    }
                }
            }
            return 'EXAMINER';
        }

        return 'EVALUATOR';
    }

    /**
     * Get component scores for a score entry
     */
    private function getComponentScores($score): array
    {
        // For now, return the score as a single component
        // In the future, this could expand to show individual rubric items
        $componentName = $score->component?->name 
            ?? $score->periodComponent?->template?->name 
            ?? 'Component';
        
        $componentCode = $score->component?->code 
            ?? $score->periodComponent?->template?->code 
            ?? 'COMP';

        return [
            [
                'code' => $componentCode,
                'name' => $componentName,
                'score' => $score->score,
                'weight' => $score->component?->weight 
                    ?? $score->periodComponent?->template?->weight 
                    ?? 100,
            ]
        ];
    }

    /**
     * Calculate weighted average for an evaluator's scores
     */
    private function calculateEvaluatorWeightedAverage($score): float
    {
        // If we have component-level data, calculate weighted average
        // For now, return the score directly (already cast via model)
        return $score->score;
    }

    /**
     * Export grade check data to CSV using memory-efficient cursor processing
     */
    public function export(Request $request)
    {
        $request->validate([
            'period_id' => 'nullable|exists:periods,id',
            'evaluation_type' => 'nullable|string',
        ]);

        $periodId = $request->input('period_id');
        if (!$periodId) {
            $activePeriod = Period::getActive();
            $periodId = $activePeriod?->id;
        }

        // Pre-fetch group_ids for the period (faster than whereHas)
        $groupIds = null;
        if ($periodId) {
            $groupIds = \App\Models\Group::where('period_id', $periodId)->pluck('id');
        }

        // Get all student IDs first to pre-load student and group data
        $studentIds = collect();
        if ($groupIds && $groupIds->isNotEmpty()) {
            $studentIds = \App\Models\GroupMember::whereIn('group_id', $groupIds)
                ->pluck('student_id')
                ->unique()
                ->values();
        }

        // Pre-load all students and groups for the period
        $students = $studentIds->isNotEmpty()
            ? \App\Models\User::whereIn('id', $studentIds)
                ->select('id', 'name', 'nim')
                ->get()
                ->keyBy('id')
            : collect();

        $groups = $groupIds && $groupIds->isNotEmpty()
            ? \App\Models\Group::whereIn('id', $groupIds)
                ->with(['title:id,title'])
                ->select('id', 'status', 'title_id')
                ->get()
                ->keyBy('id')
            : collect();

        // Get student group memberships
        $studentGroups = ($studentIds->isNotEmpty() && $groupIds && $groupIds->isNotEmpty())
            ? \App\Models\GroupMember::whereIn('student_id', $studentIds)
                ->whereIn('group_id', $groupIds)
                ->get()
                ->keyBy('student_id')
            : collect();

        // Generate CSV using streaming (memory efficient)
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="grade-check-export-' . date('Y-m-d') . '.csv"',
        ];

        $callback = function() use ($groupIds, $students, $groups, $studentGroups) {
            $file = fopen('php://output', 'w');

            // Add headers
            fputcsv($file, [
                'Student Name',
                'NIM',
                'Group Code',
                'Group Name',
                'PDC1 Score',
                'PDC2 Score',
                'Sidang TA Score',
                'Final Score',
                'Status',
            ]);

            // Process students in chunks using cursor
            foreach ($students as $studentId => $student) {
                $scores = [];

                // Get all scores for this student using cursor (memory efficient)
                if ($groupIds && $groupIds->isNotEmpty()) {
                    foreach (AssessmentScoreRepository::getSupportedTypes() as $type) {
                        AssessmentScoreRepository::forType($type)
                            ->where('student_id', $studentId)
                            ->whereIn('group_id', $groupIds)
                            ->select('score')
                            ->cursor()
                            ->each(function ($score) use (&$scores, $type) {
                                $scores[] = ['type' => $type, 'score' => $score->score];
                            });
                    }

                    PeerReview::where('reviewee_id', $studentId)
                        ->whereIn('group_id', $groupIds)
                        ->where('is_final_submission', true)
                        ->select('score')
                        ->cursor()
                        ->each(function ($review) use (&$scores) {
                            $scores[] = ['type' => 'PEER_REVIEW', 'score' => $review->score];
                        });
                }

                // Calculate PDC1 (SEMPRO + BIMBINGAN_SEMPRO) / 2
                $semproScores = array_filter($scores, fn($s) => $s['type'] === 'SEMPRO');
                $bimbinganSemproScores = array_filter($scores, fn($s) => $s['type'] === 'BIMBINGAN_SEMPRO');
                $semproAvg = !empty($semproScores) ? array_sum(array_column($semproScores, 'score')) / count($semproScores) : null;
                $bimbinganSemproAvg = !empty($bimbinganSemproScores) ? array_sum(array_column($bimbinganSemproScores, 'score')) / count($bimbinganSemproScores) : null;
                $pdc1Scores = array_filter([$semproAvg, $bimbinganSemproAvg], fn($s) => $s !== null);
                $pdc1 = !empty($pdc1Scores) ? array_sum($pdc1Scores) / count($pdc1Scores) : null;

                // Calculate PDC2 (NILAI_DOSEN + MILESTONE + EXPO + PEER_REVIEW) / 4
                $nilaiDosenScores = array_filter($scores, fn($s) => $s['type'] === 'NILAI_DOSEN');
                $milestoneScores = array_filter($scores, fn($s) => $s['type'] === 'MILESTONE');
                $expoScores = array_filter($scores, fn($s) => $s['type'] === 'EXPO');
                $peerReviewScores = array_filter($scores, fn($s) => $s['type'] === 'PEER_REVIEW');

                $nilaiDosenAvg = !empty($nilaiDosenScores) ? array_sum(array_column($nilaiDosenScores, 'score')) / count($nilaiDosenScores) : null;
                $milestoneAvg = !empty($milestoneScores) ? array_sum(array_column($milestoneScores, 'score')) / count($milestoneScores) : null;
                $expoAvg = !empty($expoScores) ? array_sum(array_column($expoScores, 'score')) / count($expoScores) : null;
                $peerReviewAvg = !empty($peerReviewScores) ? array_sum(array_column($peerReviewScores, 'score')) / count($peerReviewScores) : null;

                $pdc2Scores = array_filter([$nilaiDosenAvg, $milestoneAvg, $expoAvg, $peerReviewAvg], fn($s) => $s !== null);
                $pdc2 = !empty($pdc2Scores) ? array_sum($pdc2Scores) / count($pdc2Scores) : null;

                // Calculate SidangTA (SIDANG_TA + BIMBINGAN_TA) / 2
                $sidangTaScores = array_filter($scores, fn($s) => $s['type'] === 'SIDANG_TA');
                $bimbinganTaScores = array_filter($scores, fn($s) => $s['type'] === 'BIMBINGAN_TA');

                $sidangTaAvg = !empty($sidangTaScores) ? array_sum(array_column($sidangTaScores, 'score')) / count($sidangTaScores) : null;
                $bimbinganTaAvg = !empty($bimbinganTaScores) ? array_sum(array_column($bimbinganTaScores, 'score')) / count($bimbinganTaScores) : null;

                $sidangTaComponents = array_filter([$sidangTaAvg, $bimbinganTaAvg], fn($s) => $s !== null);
                $sidangTa = !empty($sidangTaComponents) ? array_sum($sidangTaComponents) / count($sidangTaComponents) : null;

                // Calculate Final (PDC1 + PDC2 + SidangTA) / 3
                $finalScores = array_filter([$pdc1, $pdc2, $sidangTa], fn($s) => $s !== null);
                $final = !empty($finalScores) ? array_sum($finalScores) / count($finalScores) : null;

                // Determine status
                $hasAllScores = $pdc1 !== null && $pdc2 !== null && $sidangTa !== null;
                $status = $hasAllScores ? 'COMPLETE' : 'PARTIAL';

                // Get group info
                $groupMember = $studentGroups->get($studentId);
                $group = $groupMember ? $groups->get($groupMember->group_id) : null;
                $groupCode = $group ? 'G' . $group->id : '';
                $groupName = $group?->title?->title ?? ($group ? 'Group ' . $group->id : '');

                // Write row immediately (low memory footprint)
                fputcsv($file, [
                    $student->name ?? 'Unknown',
                    $student->nim ?? '',
                    $groupCode,
                    $groupName,
                    $pdc1 !== null ? number_format($pdc1, 1) : 'N/A',
                    $pdc2 !== null ? number_format($pdc2, 1) : 'N/A',
                    $sidangTa !== null ? number_format($sidangTa, 1) : 'N/A',
                    $final !== null ? number_format($final, 1) : 'N/A',
                    $status,
                ]);
            }

            fclose($file);
        };

        return Response::stream($callback, 200, $headers);
    }
}
