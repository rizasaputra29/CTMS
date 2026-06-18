<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\PeerReview;
use App\Models\PeriodAssessmentComponent;
use App\Models\User;
use App\Repositories\AssessmentScoreRepository;
use App\Services\GradeCalculationService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportDetailController extends Controller
{
    use ApiResponseTrait;

    /**
     * Get detailed assessment scores data.
     */
    public function assessments(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'evaluation_type' => 'nullable|string',
            'group_id' => 'nullable|integer',
            'student_search' => 'nullable|string',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:10|max:100',
        ]);

        $periodId = $request->period_id;
        $perPage = $request->input('per_page', 50);

        // Build query using repository for each supported type
        $query = null;
        $first = true;
        foreach (AssessmentScoreRepository::getSupportedTypes() as $type) {
            $typeQuery = AssessmentScoreRepository::forType($type)
                ->with(['component', 'periodComponent.template', 'evaluator', 'student', 'group.title'])
                ->whereHas('group', function ($q) use ($periodId) {
                    $q->where('period_id', $periodId);
                });

            if ($first) {
                $query = $typeQuery;
                $first = false;
            } else {
                $query->union($typeQuery);
            }
        }

        // Apply filters
        if ($request->filled('evaluation_type')) {
            $query->where('evaluation_type', $request->evaluation_type);
        }

        if ($request->filled('group_id')) {
            $query->where('group_id', $request->group_id);
        }

        if ($request->filled('student_search')) {
            $search = $request->student_search;
            $query->whereHas('student', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('nim', 'like', "%{$search}%");
            });
        }

        // Sort by date descending (newest first)
        $query->orderBy('created_at', 'desc');

        // Check if export requested
        if ($request->input('format') === 'csv') {
            return $this->exportAssessmentsCsv($query->get());
        }

        $scores = $query->paginate($perPage);

        // Transform data to ensure score is a number and component info is unified
        $data = collect($scores->items())->map(function ($score) {
            $score->score = (float) $score->score;
            // Create unified component display from either component or periodComponent
            if ($score->component) {
                $score->component_display = [
                    'name' => $score->component->name,
                    'code' => $score->component->code,
                ];
            } elseif ($score->periodComponent?->template) {
                $score->component_display = [
                    'name' => $score->periodComponent->template->name,
                    'code' => $score->periodComponent->template->code,
                ];
            } else {
                $score->component_display = null;
            }

            return $score;
        });

        return $this->envelopeResponse($data, [
            'meta' => [
                'current_page' => $scores->currentPage(),
                'last_page' => $scores->lastPage(),
                'per_page' => $scores->perPage(),
                'total' => $scores->total(),
            ],
        ]);
    }

    /**
     * Get detailed peer reviews data.
     */
    public function peerReviews(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'group_id' => 'nullable|integer',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:10|max:100',
            'sort_by' => 'nullable|in:created_at,reviewer,reviewee,raw_score,score',
            'sort_order' => 'nullable|in:asc,desc',
        ]);

        $periodId = $request->period_id;
        $perPage = $request->input('per_page', 50);
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');

        $query = PeerReview::with(['reviewer', 'reviewee', 'periodIndicator.template', 'group.title'])
            ->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });

        // Apply filters
        if ($request->filled('group_id')) {
            $query->where('group_id', $request->group_id);
        }

        // Apply sorting
        $this->applyPeerReviewSorting($query, $sortBy, $sortOrder);

        // Check if export requested
        if ($request->input('format') === 'csv') {
            return $this->exportPeerReviewsCsv($query->get());
        }

        $reviews = $query->paginate($perPage);

        // Transform data to ensure score is a number and add camelCase aliases for frontend
        $data = collect($reviews->items())->map(function ($review) {
            // Convert to array to properly add camelCase keys
            $array = $review->toArray();
            $array['score'] = (float) $array['score']; // Ensure score is number
            $array['periodIndicator'] = $array['period_indicator']; // Add camelCase alias

            return $array;
        });

        return $this->envelopeResponse($data, [
            'meta' => [
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
                'per_page' => $reviews->perPage(),
                'total' => $reviews->total(),
            ],
        ]);
    }

    /**
     * Apply sorting to peer review query based on sort parameters.
     */
    private function applyPeerReviewSorting($query, string $sortBy, string $sortOrder): void
    {
        switch ($sortBy) {
            case 'reviewer':
                $query->join('students as reviewer_student', 'peer_reviews.reviewer_id', '=', 'reviewer_student.id')
                    ->orderBy('reviewer_student.name', $sortOrder)
                    ->select('peer_reviews.*');
                break;
            case 'reviewee':
                $query->join('students as reviewee_student', 'peer_reviews.reviewee_id', '=', 'reviewee_student.id')
                    ->orderBy('reviewee_student.name', $sortOrder)
                    ->select('peer_reviews.*');
                break;
            case 'raw_score':
                $query->orderBy('raw_score', $sortOrder);
                break;
            case 'score':
                $query->orderBy('score', $sortOrder);
                break;
            case 'created_at':
            default:
                $query->orderBy('created_at', $sortOrder);
                break;
        }
    }

    /**
     * Get detailed final grades data.
     */
    public function finalGrades(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'group_id' => 'nullable|integer',
            'grade_range' => 'nullable|in:A,B,C,D,E',
            'status' => 'nullable|in:Complete,Incomplete',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:10|max:100',
        ]);

        $periodId = $request->period_id;
        $perPage = $request->input('per_page', 50);
        $gradeService = app(\App\Services\GradeCalculationService::class);

        // Preload period data for batch calculations
        $gradeService->preloadPeriodData($periodId);

        $groups = Group::where('period_id', $periodId)
            ->with(['title', 'members' => function ($query) {
                $query->withTrashed()->with('student');
            }]);

        if ($request->filled('group_id')) {
            $groups->where('id', $request->group_id);
        }

        $groups = $groups->get();

        // Build student-group pairs for batch calculation
        $studentGroupPairs = [];
        $studentInfo = [];

        foreach ($groups as $group) {
            foreach ($group->members as $member) {
                $student = $member->student;
                if (! $student) {
                    continue;
                }

                $studentGroupPairs[] = [
                    'student_id' => $student->id,
                    'group_id' => $group->id,
                ];

                $studentInfo[$student->id] = [
                    'student' => $student,
                    'group' => $group,
                    'is_flagged' => $member->status === 'flagged' || $member->deleted_at !== null,
                ];
            }
        }

        // Batch calculate all grades at once (much faster)
        $pdc1Results = $gradeService->calculatePDC1ForStudentsBatch($studentGroupPairs);
        $pdc2Results = $gradeService->calculatePDC2ForStudentsBatch($studentGroupPairs);
        $taResults = $gradeService->calculateSidangTAForStudentsBatch($studentGroupPairs);

        // Clear cache after calculations
        $gradeService->clearCache();

        $students = [];

        foreach ($studentGroupPairs as $pair) {
            $studentId = $pair['student_id'];
            $info = $studentInfo[$studentId];
            $student = $info['student'];
            $group = $info['group'];

            $pdc1Data = $pdc1Results[$studentId] ?? null;
            $pdc2Data = $pdc2Results[$studentId] ?? null;
            $taData = $taResults[$studentId] ?? null;

            $pdc1Score = $pdc1Data ? $pdc1Data['grade'] : null;
            $pdc2Score = $pdc2Data ? $pdc2Data['grade'] : null;
            $taScore = $taData ? $taData['grade'] : null;

            // Skip students with no grades at all
            if ($pdc1Score === null && $pdc2Score === null && $taScore === null) {
                continue;
            }

            // Calculate final grade (average of available scores)
            $availableScores = [];
            if ($pdc1Score !== null) {
                $availableScores[] = $pdc1Score;
            }
            if ($pdc2Score !== null) {
                $availableScores[] = $pdc2Score;
            }
            if ($taScore !== null) {
                $availableScores[] = $taScore;
            }

            $finalGrade = count($availableScores) > 0 ? array_sum($availableScores) / count($availableScores) : 0;

            $letterGrade = $gradeService->getLetterGrade($finalGrade);
            $isPDC1Complete = $pdc1Data && $pdc1Data['status'] === 'COMPLETE';
            $isPDC2Complete = $pdc2Data && $pdc2Data['status'] === 'COMPLETE';
            $isTAComplete = $taData && $taData['status'] === 'COMPLETE';
            $isComplete = $isPDC1Complete && $isPDC2Complete && $isTAComplete;

            // Apply filters
            if ($request->filled('grade_range') && $letterGrade !== $request->grade_range) {
                continue;
            }

            if ($request->filled('status')) {
                $requestedStatus = $request->status === 'Complete';
                if ($isComplete !== $requestedStatus) {
                    continue;
                }
            }

            $students[] = [
                'group_id' => $group->id,
                'group_name' => $group->code ?? "Group {$group->id}",
                'student_id' => $student->id,
                'student_name' => $student->name,
                'student_nim' => $student->nim ?? '',
                'pdc1_score' => $pdc1Score !== null ? round($pdc1Score, 2) : null,
                'pdc2_score' => $pdc2Score !== null ? round($pdc2Score, 2) : null,
                'ta_score' => $taScore !== null ? round($taScore, 2) : null,
                'pdc1_complete' => $isPDC1Complete,
                'pdc2_complete' => $isPDC2Complete,
                'ta_complete' => $isTAComplete,
                'is_flagged' => $info['is_flagged'],
            ];
        }

        // Sort by final grade descending
        // Sort by student name ascending
        usort($students, function ($a, $b) {
            return $a['student_name'] <=> $b['student_name'];
        });

        // Check if export requested
        if ($request->input('format') === 'csv') {
            return $this->exportFinalGradesCsv($students);
        }

        // Manual pagination
        $total = count($students);
        $page = $request->input('page', 1);
        $offset = ($page - 1) * $perPage;
        $paginatedStudents = array_slice($students, $offset, $perPage);

        return $this->envelopeResponse($paginatedStudents, [
            'meta' => [
                'current_page' => $page,
                'last_page' => ceil($total / $perPage),
                'per_page' => $perPage,
                'total' => $total,
            ],
        ]);
    }

    /**
     * Get grade consistency data.
     */
    public function gradeConsistency(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'status' => 'nullable|in:CONSISTENT,INCONSISTENT',
            'student_search' => 'nullable|string',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:10|max:100',
        ]);

        $periodId = $request->period_id;
        $perPage = $request->input('per_page', 50);
        $gradeService = app(\App\Services\GradeCalculationService::class);

        // Preload period data for batch calculations
        $gradeService->preloadPeriodData($periodId);

        $groups = Group::where('period_id', $periodId)
            ->with(['title', 'members' => function ($query) {
                $query->withTrashed()->with('student');
            }])
            ->get();

        // Build student-group pairs for batch calculation
        $studentGroupPairs = [];
        $studentInfo = [];

        foreach ($groups as $group) {
            foreach ($group->members as $member) {
                $student = $member->student;
                if (! $student) {
                    continue;
                }

                $studentGroupPairs[] = [
                    'student_id' => $student->id,
                    'group_id' => $group->id,
                ];

                $studentInfo[$student->id] = [
                    'student' => $student,
                    'group' => $group,
                ];
            }
        }

        // Batch calculate all grades at once (much faster)
        $pdc1Results = $gradeService->calculatePDC1ForStudentsBatch($studentGroupPairs);
        $pdc2Results = $gradeService->calculatePDC2ForStudentsBatch($studentGroupPairs);

        // Clear cache after calculations
        $gradeService->clearCache();

        $students = [];

        foreach ($studentGroupPairs as $pair) {
            $studentId = $pair['student_id'];
            $info = $studentInfo[$studentId];
            $student = $info['student'];
            $group = $info['group'];

            $pdc1Data = $pdc1Results[$studentId] ?? null;
            $pdc2Data = $pdc2Results[$studentId] ?? null;

            $pdc1Score = $pdc1Data ? $pdc1Data['grade'] : 0;
            $pdc2Score = $pdc2Data ? $pdc2Data['grade'] : 0;

            if ($pdc1Score > 0 && $pdc2Score > 0) {
                $deviation = abs($pdc1Score - $pdc2Score);
                $isConsistent = $deviation <= 15;

                $status = $isConsistent ? 'CONSISTENT' : 'INCONSISTENT';

                // Apply status filter
                if ($request->filled('status') && $status !== $request->status) {
                    continue;
                }

                // Apply student search filter
                if ($request->filled('student_search')) {
                    $search = strtolower($request->student_search);
                    if (! str_contains(strtolower($student->name), $search) &&
                        ! str_contains(strtolower($student->nim ?? ''), $search)) {
                        continue;
                    }
                }

                $students[] = [
                    'group_id' => $group->id,
                    'group_name' => $group->code ?? "Group {$group->id}",
                    'student_id' => $student->id,
                    'student_name' => $student->name,
                    'pdc1_score' => round($pdc1Score, 2),
                    'pdc2_score' => round($pdc2Score, 2),
                    'deviation' => round($deviation, 2),
                    'is_consistent' => $isConsistent,
                    'status' => $status,
                    'created_at' => now()->toDateTimeString(),
                ];
            }
        }

        // Sort by deviation descending (most inconsistent first)
        usort($students, function ($a, $b) {
            return $b['deviation'] <=> $a['deviation'];
        });

        // Check if export requested
        if ($request->input('format') === 'csv') {
            return $this->exportGradeConsistencyCsv($students);
        }

        // Manual pagination
        $total = count($students);
        $page = $request->input('page', 1);
        $offset = ($page - 1) * $perPage;
        $paginatedStudents = array_slice($students, $offset, $perPage);

        return $this->envelopeResponse($paginatedStudents, [
            'meta' => [
                'current_page' => $page,
                'last_page' => ceil($total / $perPage),
                'per_page' => $perPage,
                'total' => $total,
            ],
        ]);
    }

    /**
     * Get detailed groups data.
     */
    public function groups(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:10|max:100',
        ]);

        $periodId = $request->period_id;
        $perPage = $request->input('per_page', 50);

        $query = Group::where('period_id', $periodId)
            ->with(['title', 'supervisor1', 'supervisor2', 'members' => function ($query) {
                $query->withTrashed()->with('student');
            }]);

        // Sort by creation date
        $query->orderBy('created_at', 'desc');

        // Check if export requested
        if ($request->input('format') === 'csv') {
            return $this->exportGroupsCsv($query->get());
        }

        $groups = $query->paginate($perPage);

        // Transform data to match frontend expectations
        $transformedGroups = $groups->map(function ($group) {
            return [
                'id' => $group->id,
                'title' => [
                    'title' => $group->title->title ?? "Group {$group->id}",
                    'description' => $group->title->description ?? null,
                ],
                'status' => $group->status,
                'group_mode' => $group->group_mode ?? 'GROUP',
                'supervisor1' => $group->supervisor1 ? [
                    'id' => $group->supervisor1->id,
                    'name' => $group->supervisor1->name,
                    'email' => $group->supervisor1->email,
                ] : null,
                'supervisor2' => $group->supervisor2 ? [
                    'id' => $group->supervisor2->id,
                    'name' => $group->supervisor2->name,
                    'email' => $group->supervisor2->email,
                ] : null,
                'members' => $group->members->map(function ($member) {
                    return [
                        'id' => $member->id,
                        'student' => [
                            'id' => $member->student->id ?? null,
                            'name' => $member->student->name ?? '',
                            'nim' => $member->student->nim ?? '',
                            'email' => $member->student->email ?? '',
                        ],
                        'is_leader' => $member->is_leader,
                    ];
                }),
                'members_count' => $group->members->count(),
                'created_at' => $group->created_at,
            ];
        });

        return $this->envelopeResponse($transformedGroups, [
            'meta' => [
                'current_page' => $groups->currentPage(),
                'last_page' => $groups->lastPage(),
                'per_page' => $groups->perPage(),
                'total' => $groups->total(),
            ],
        ]);
    }

    /**
     * Export assessments to CSV.
     */
    private function exportAssessmentsCsv($scores): StreamedResponse
    {
        return response()->streamDownload(function () use ($scores) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Group', 'Student', 'Evaluator', 'Type', 'Component', 'Score', 'Date']);

            foreach ($scores as $score) {
                fputcsv($handle, [
                    $score->group->title->title ?? "Group {$score->group_id}",
                    $score->student->name ?? 'N/A',
                    $score->evaluator->name ?? 'N/A',
                    $score->evaluation_type,
                    $score->component->name ?? 'N/A',
                    $score->score,
                    $score->created_at->format('Y-m-d H:i:s'),
                ]);
            }

            fclose($handle);
        }, 'assessments.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * Export peer reviews to CSV.
     */
    private function exportPeerReviewsCsv($reviews): StreamedResponse
    {
        return response()->streamDownload(function () use ($reviews) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Group', 'Reviewer', 'Reviewee', 'Indicator', 'Raw Score', 'Converted Score', 'Comment', 'Date']);

            foreach ($reviews as $review) {
                fputcsv($handle, [
                    $review->group->title->title ?? "Group {$review->group_id}",
                    $review->reviewer->name ?? 'N/A',
                    $review->reviewee->name ?? 'N/A',
                    $review->periodIndicator->template->name ?? 'N/A',
                    $review->raw_score,
                    $review->score,
                    $review->comment ?? '',
                    $review->created_at->format('Y-m-d H:i:s'),
                ]);
            }

            fclose($handle);
        }, 'peer_reviews.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * Export final grades to CSV.
     */
    private function exportFinalGradesCsv($students): StreamedResponse
    {
        return response()->streamDownload(function () use ($students) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Group', 'Student Name', 'NIM', 'PDC1 Score', 'PDC1 Status', 'PDC2 Score', 'PDC2 Status', 'TA Score', 'TA Status']);

            foreach ($students as $student) {
                fputcsv($handle, [
                    $student['group_name'],
                    $student['student_name'],
                    $student['student_nim'],
                    $student['pdc1_score'] ?? 'N/A',
                    $student['pdc1_complete'] ? 'Complete' : 'Incomplete',
                    $student['pdc2_score'] ?? 'N/A',
                    $student['pdc2_complete'] ? 'Complete' : 'Incomplete',
                    $student['ta_score'] ?? 'N/A',
                    $student['ta_complete'] ? 'Complete' : 'Incomplete',
                ]);
            }

            fclose($handle);
        }, 'final_grades.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * Export grade consistency to CSV.
     */
    private function exportGradeConsistencyCsv($students): StreamedResponse
    {
        return response()->streamDownload(function () use ($students) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Group', 'Student Name', 'PDC1 Score', 'PDC2 Score', 'Deviation', 'Status']);

            foreach ($students as $student) {
                fputcsv($handle, [
                    $student['group_name'],
                    $student['student_name'],
                    $student['pdc1_score'],
                    $student['pdc2_score'],
                    $student['deviation'],
                    $student['status'],
                ]);
            }

            fclose($handle);
        }, 'grade_consistency.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * Export groups to CSV.
     */
    private function exportGroupsCsv($groups): StreamedResponse
    {
        return response()->streamDownload(function () use ($groups) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Group ID', 'Title', 'Status', 'Mode', 'Supervisor 1', 'Supervisor 2', 'Members Count', 'Members']);

            foreach ($groups as $group) {
                $memberNames = $group->members->map(function ($m) {
                    return $m->student->name ?? '';
                })->implode('; ');

                fputcsv($handle, [
                    $group->id,
                    $group->title->title ?? '',
                    $group->status,
                    $group->group_mode ?? 'GROUP',
                    $group->supervisor1->name ?? '',
                    $group->supervisor2->name ?? '',
                    $group->members->count(),
                    $memberNames,
                ]);
            }

            fclose($handle);
        }, 'groups.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * Get student evaluation scores grouped by phase and evaluator for table views.
     */
    public function phaseEvaluatorScores(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'phase' => 'required|string|in:pdc1,pdc2,ta',
            'student_search' => 'nullable|string',
            'sort_by' => 'nullable|string|in:group,name',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:10|max:100',
        ]);

        $periodId = $request->period_id;
        $phase = $request->phase;
        $perPage = $request->input('per_page', 50);
        $sortBy = $request->input('sort_by', 'group');
        $search = $request->input('student_search', '');

        $phaseTypes = match ($phase) {
            'pdc1' => ['SEMPRO', 'BIMBINGAN_SEMPRO'],
            'pdc2' => ['NILAI_DOSEN', 'MILESTONE', 'EXPO', 'PEER_REVIEW'],
            'ta' => ['SIDANG_TA', 'BIMBINGAN_TA'],
            default => [],
        };

        // Get all groups in period with students (include soft-deleted members)
        $groups = Group::with(['members' => function ($query) {
            $query->withTrashed()->with('student');
        }, 'title'])
            ->where('period_id', $periodId)
            ->get();

        // Preload all assessment scores and roles for the period
        $gradeService = app(GradeCalculationService::class);
        $gradeService->preloadPeriodData($periodId);

        $students = [];
        foreach ($groups as $group) {
            foreach ($group->members as $member) {
                $student = $member->student;
                if (! $student) {
                    continue;
                }

                // Filter by search
                if ($search) {
                    $searchLower = strtolower($search);
                    $nameMatch = stripos(strtolower($student->name), $searchLower) !== false;
                    $nimMatch = stripos(strtolower($student->nim ?? ''), $searchLower) !== false;
                    if (! $nameMatch && ! $nimMatch) {
                        continue;
                    }
                }

                $studentId = $student->id;
                $groupId = $group->id;

                $evaluations = [];
                $overallComplete = 0;
                $overallTotal = 0;

                foreach ($phaseTypes as $type) {
                    if ($type === 'PEER_REVIEW') {
                        $peerReviewScores = $gradeService->getPeerReviewsFromCache($studentId, $groupId);
                        $hasScore = ! empty($peerReviewScores);
                        $score = $hasScore ? $gradeService->calculatePeerReviewAverageFromCache($peerReviewScores) : null;

                        $evaluations['PEER_REVIEW'] = [
                            'score' => $score !== null ? round($score, 2) : null,
                            'status' => $hasScore ? 'COMPLETE' : 'NOT_STARTED',
                            'evaluators' => [['evaluator_id' => null, 'name' => 'Peers', 'role' => 'PEER', 'score' => $score !== null ? round($score, 2) : null]],
                        ];

                        $overallTotal++;
                        if ($score !== null) {
                            $overallComplete++;
                        }

                        continue;
                    }

                    $evaluators = $gradeService->getEvaluatorsWithScoresFromCache($studentId, $groupId, $type);
                    $hasEvaluators = ! empty($evaluators);
                    $evaluatorScores = array_filter(array_column($evaluators, 'score'), fn ($s) => $s !== null);
                    $score = $hasEvaluators && ! empty($evaluatorScores)
                        ? round(array_sum($evaluatorScores) / count($evaluatorScores), 2)
                        : null;

                    $totalComponents = count($evaluators);
                    $completedComponents = count($evaluatorScores);

                    $status = 'NOT_STARTED';
                    if ($completedComponents === $totalComponents && $totalComponents > 0) {
                        $status = 'COMPLETE';
                    } elseif ($completedComponents > 0 || $hasEvaluators) {
                        $status = 'PARTIAL';
                    }

                    $evaluations[$type] = [
                        'score' => $score,
                        'status' => $status,
                        'evaluators' => $evaluators,
                    ];

                    $overallTotal++;
                    if ($status === 'COMPLETE') {
                        $overallComplete++;
                    }
                }

                $students[] = [
                    'student_id' => $studentId,
                    'student_name' => $student->name,
                    'student_nim' => $student->nim ?? '',
                    'group_id' => $groupId,
                    'group_name' => $group->code ?? "Group {$groupId}",
                    'evaluations' => $evaluations,
                    'overall_status' => $overallTotal === 0 ? 'NOT_STARTED' : ($overallComplete === $overallTotal ? 'COMPLETE' : ($overallComplete > 0 || $overallTotal > 0 ? 'PARTIAL' : 'NOT_STARTED')),
                ];
            }
        }

        // Clear cache after building response
        $gradeService->clearCache();

        // Sort students
        if ($sortBy === 'name') {
            usort($students, fn ($a, $b) => strcmp($a['student_name'], $b['student_name']));
        } else {
            usort($students, fn ($a, $b) => strcmp($a['group_name'], $b['group_name']) ?: strcmp($a['student_name'], $b['student_name']));
        }

        // Manual pagination
        $page = $request->input('page', 1);
        $total = count($students);
        $offset = ($page - 1) * $perPage;
        $paginatedStudents = array_slice($students, $offset, $perPage);

        return $this->envelopeResponse($paginatedStudents, [
            'meta' => [
                'current_page' => $page,
                'last_page' => ceil($total / $perPage),
                'per_page' => $perPage,
                'total' => $total,
            ],
        ]);
    }

    /**
     * Get student evaluation summary with all 8 evaluation types.
     */
    public function studentEvaluationsSummary(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'student_search' => 'nullable|string',
            'sort_by' => 'nullable|string|in:group,name',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:10|max:100',
        ]);

        $periodId = $request->period_id;
        $perPage = $request->input('per_page', 50);
        $sortBy = $request->input('sort_by', 'group');
        $search = $request->input('student_search', '');

        // Get all groups in period with students (include soft-deleted members)
        $groupsQuery = Group::with(['members' => function ($query) {
            $query->withTrashed()->with('student');
        }, 'title'])
            ->where('period_id', $periodId);

        $groups = $groupsQuery->get();

        // Preload all assessment scores for this period
        $gradeService = app(GradeCalculationService::class);
        $gradeService->preloadPeriodData($periodId);

        // Build student list
        $students = [];
        foreach ($groups as $group) {
            foreach ($group->members as $member) {
                $student = $member->student;
                if (! $student) {
                    continue;
                }

                // Filter by search
                if ($search) {
                    $searchLower = strtolower($search);
                    $nameMatch = stripos(strtolower($student->name), $searchLower) !== false;
                    $nimMatch = stripos(strtolower($student->nim ?? ''), $searchLower) !== false;
                    if (! $nameMatch && ! $nimMatch) {
                        continue;
                    }
                }

                $studentGroupPairs = [['student_id' => $student->id, 'group_id' => $group->id]];

                // Get all evaluation scores
                $pdc1Data = $gradeService->calculatePDC1ForStudentsBatch($studentGroupPairs)[$student->id] ?? null;
                $pdc2Data = $gradeService->calculatePDC2ForStudentsBatch($studentGroupPairs)[$student->id] ?? null;
                $taData = $gradeService->calculateSidangTAForStudentsBatch($studentGroupPairs)[$student->id] ?? null;

                // Calculate individual evaluation scores
                $evaluations = [
                    'SEMPRO' => $this->calculateEvaluationStatus($pdc1Data, 'SEMPRO'),
                    'BIMBINGAN_SEMPRO' => $this->calculateEvaluationStatus($pdc1Data, 'BIMBINGAN_SEMPRO'),
                    'SIDANG_TA' => $this->calculateEvaluationStatus($taData, 'SIDANG_TA'),
                    'BIMBINGAN_TA' => ['score' => null, 'status' => 'NOT_STARTED', 'total_components' => 0, 'scored_components' => 0],
                    'EXPO' => $this->calculateEvaluationStatus($pdc2Data, 'EXPO'),
                    'MILESTONE' => $this->calculateEvaluationStatus($pdc2Data, 'MILESTONE'),
                    'NILAI_DOSEN' => $this->calculateEvaluationStatus($pdc2Data, 'NILAI_DOSEN'),
                ];

                // Get BIMBINGAN_TA separately
                $bimbinganTaScores = AssessmentScoreRepository::forType('BIMBINGAN_TA')
                    ->where('student_id', $student->id)
                    ->where('group_id', $group->id)
                    ->with('periodComponent.template')
                    ->get();

                if ($bimbinganTaScores->count() > 0) {
                    $totalComponents = $bimbinganTaScores->count();
                    $scoredComponents = $bimbinganTaScores->whereNotNull('score')->count();
                    $avgScore = $bimbinganTaScores->whereNotNull('score')->avg('score');

                    $evaluations['BIMBINGAN_TA'] = [
                        'score' => $avgScore ? round($avgScore, 2) : null,
                        'status' => $scoredComponents === $totalComponents ? 'COMPLETE' : ($scoredComponents > 0 ? 'PARTIAL' : 'NOT_STARTED'),
                        'total_components' => $totalComponents,
                        'scored_components' => $scoredComponents,
                    ];
                }

                $students[] = [
                    'student_id' => $student->id,
                    'student_name' => $student->name,
                    'student_nim' => $student->nim ?? '',
                    'group_id' => $group->id,
                    'group_name' => $group->code ?? "Group {$group->id}",
                    'evaluations' => $evaluations,
                ];
            }
        }

        // Sort students
        if ($sortBy === 'name') {
            usort($students, fn ($a, $b) => strcmp($a['student_name'], $b['student_name']));
        } else {
            usort($students, fn ($a, $b) => strcmp($a['group_name'], $b['group_name']) ?: strcmp($a['student_name'], $b['student_name']));
        }

        // Manual pagination
        $page = $request->input('page', 1);
        $total = count($students);
        $offset = ($page - 1) * $perPage;
        $paginatedStudents = array_slice($students, $offset, $perPage);

        return $this->envelopeResponse($paginatedStudents, [
            'meta' => [
                'current_page' => $page,
                'last_page' => ceil($total / $perPage),
                'per_page' => $perPage,
                'total' => $total,
            ],
        ]);
    }

    /**
     * Calculate evaluation status from grade data.
     */
    private function calculateEvaluationStatus($data, string $type): array
    {
        if (! $data) {
            return [
                'score' => null,
                'status' => 'NOT_STARTED',
                'total_components' => 0,
                'scored_components' => 0,
            ];
        }

        // The components are keyed by type name in the data structure
        // e.g., ['SEMPRO' => ['score' => 85, 'evaluators' => [...]], ...]
        if (isset($data['components']) && is_array($data['components'])) {
            // Check if the specific evaluation type exists in components
            if (isset($data['components'][$type])) {
                $component = $data['components'][$type];
                $hasScore = isset($component['score']) && $component['score'] !== null;

                return [
                    'score' => $hasScore ? round($component['score'], 2) : null,
                    'status' => $hasScore ? 'COMPLETE' : 'NOT_STARTED',
                    'total_components' => 1,
                    'scored_components' => $hasScore ? 1 : 0,
                ];
            }
        }

        // Fallback: if there's a grade but no component breakdown
        $score = $data['grade'] ?? null;
        if ($score !== null) {
            return [
                'score' => round($score, 2),
                'status' => 'COMPLETE',
                'total_components' => 1,
                'scored_components' => 1,
            ];
        }

        return [
            'score' => null,
            'status' => 'NOT_STARTED',
            'total_components' => 0,
            'scored_components' => 0,
        ];
    }

    /**
     * Get detailed breakdown for a specific student and evaluation type.
     */
    public function studentEvaluationDetail(Request $request, $studentId, $evaluationType)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $periodId = $request->period_id;

        // Validate evaluation type
        $supportedTypes = AssessmentScoreRepository::getSupportedTypes();
        if (! in_array($evaluationType, $supportedTypes)) {
            return $this->errorResponse('Invalid evaluation type', 400);
        }

        // Get student and group info (include soft-deleted members)
        $group = Group::where('period_id', $periodId)
            ->whereHas('members', function ($q) use ($studentId) {
                $q->withTrashed()->where('student_id', $studentId);
            })
            ->with(['members' => function ($q) {
                $q->withTrashed()->with('student');
            }, 'title'])
            ->first();

        if (! $group) {
            return $this->notFoundResponse('Student not found in this period');
        }

        $student = $group->members->firstWhere('student_id', $studentId)?->student;
        if (! $student) {
            return $this->notFoundResponse('Student not found');
        }

        // Get ALL period assessment components for this evaluation type, ordered by code
        $allComponents = PeriodAssessmentComponent::with('template')
            ->where('period_id', $periodId)
            ->where('type', $evaluationType)
            ->get()
            ->sortBy(fn ($c) => $c->template?->code ?? '')
            ->values();

        // Get all scores for this evaluation type
        $scores = AssessmentScoreRepository::forType($evaluationType)
            ->where('student_id', $studentId)
            ->where('group_id', $group->id)
            ->with(['periodComponent.template', 'evaluator:id,name'])
            ->get();

        // EXPO special handling - simplified view with only combined score
        if ($evaluationType === 'EXPO') {
            $gradeService = app(GradeCalculationService::class);
            $pdc2Data = $gradeService->calculatePDC2ForStudent($studentId, $group->id);
            $expoData = $pdc2Data['components']['EXPO'] ?? null;

            $overallScore = $expoData['score'] ?? null;
            $status = $overallScore !== null ? 'COMPLETE' : 'NOT_STARTED';
            $lastEvaluated = null;

            // Find last evaluated date
            foreach ($scores as $score) {
                if ($score->created_at && (! $lastEvaluated || $score->created_at > $lastEvaluated)) {
                    $lastEvaluated = $score->created_at;
                }
            }

            return $this->successResponse([
                'student' => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'nim' => $student->nim ?? '',
                    'group_id' => $group->id,
                    'group_name' => $group->code ?? "Group {$group->id}",
                ],
                'evaluation_type' => $evaluationType,
                'overall' => [
                    'score' => $overallScore,
                    'status' => $status,
                    'total_evaluators' => 0,
                    'completed_evaluators' => 0,
                    'last_evaluated_at' => $lastEvaluated ? $lastEvaluated->format('M d, Y') : null,
                ],
                'evaluators' => [], // No evaluator breakdown for EXPO
                'unassigned' => [
                    'components' => [],
                    'total' => 0,
                ],
            ]);
        }

        // For other evaluation types: build evaluator data with ALL components (scored and unscored)
        // Group scores by evaluator
        $evaluatorScores = [];
        $lastEvaluatedOverall = null;

        foreach ($scores as $score) {
            // Track last evaluated date
            if ($score->created_at && (! $lastEvaluatedOverall || $score->created_at > $lastEvaluatedOverall)) {
                $lastEvaluatedOverall = $score->created_at;
            }

            $evaluatorId = null;
            if ($score->evaluator) {
                $evaluatorId = $score->evaluator->id;
            }

            if (! isset($evaluatorScores[$evaluatorId])) {
                $evaluatorScores[$evaluatorId] = [
                    'evaluator_id' => $evaluatorId,
                    'name' => $score->evaluator?->name ?? 'Unknown',
                    'role' => $score->evaluator?->role ?? 'Evaluator',
                    'components' => [],
                ];
            }

            $evaluatorScores[$evaluatorId]['components'][$score->periodComponent?->id ?? $score->component_id] = [
                'component_id' => $score->periodComponent?->id ?? $score->component_id,
                'score' => $score->score,
                'notes' => $score->notes,
                'evaluated_at' => $score->created_at ? $score->created_at->format('M d, Y') : null,
            ];
        }

        // Resolve evaluator roles
        foreach ($evaluatorScores as $evaluatorId => &$evaluatorData) {
            if ($group->supervisor_1_id == $evaluatorId) {
                $evaluatorData['role'] = 'SUPERVISOR_1';
            } elseif ($group->supervisor_2_id == $evaluatorId) {
                $evaluatorData['role'] = 'SUPERVISOR_2';
            } else {
                // Check for examiner roles
                $taSchedule = \App\Models\TaDefenseSchedule::where('group_id', $group->id)
                    ->where('status', '!=', 'CANCELLED')
                    ->whereHas('students', function ($query) use ($studentId) {
                        $query->where('student_id', $studentId);
                    })
                    ->first();

                if ($taSchedule) {
                    if ($taSchedule->examiner_1_id == $evaluatorId) {
                        $evaluatorData['role'] = 'EXAMINER_1';
                    } elseif ($taSchedule->examiner_2_id == $evaluatorId) {
                        $evaluatorData['role'] = 'EXAMINER_2';
                    }
                } else {
                    $seminarSchedule = \App\Models\SeminarSchedule::where('group_id', $group->id)
                        ->where('status', '!=', 'CANCELLED')
                        ->whereIn('type', ['SEMPRO', 'EXPO'])
                        ->first();

                    if ($seminarSchedule) {
                        if ($seminarSchedule->examiner_1_id == $evaluatorId) {
                            $evaluatorData['role'] = 'EXAMINER_1';
                        } elseif ($seminarSchedule->examiner_2_id == $evaluatorId) {
                            $evaluatorData['role'] = 'EXAMINER_2';
                        }
                    }
                }
            }
        }
        unset($evaluatorData); // Break reference

        // Build evaluators with all components (scored and unscored)
        $evaluators = [];
        $completedEvaluators = 0;

        foreach ($evaluatorScores as $evaluatorId => $evaluatorData) {
            $components = [];
            $scoredCount = 0;
            $totalWeighted = 0;
            $calculationBreakdown = [];

            // Calculate total weight for this evaluator's components
            $totalWeight = 0;
            foreach ($allComponents as $periodComponent) {
                $totalWeight += $periodComponent->template?->weight ?? 1;
            }

            foreach ($allComponents as $periodComponent) {
                $template = $periodComponent->template;
                $componentId = $periodComponent->id;
                $scoreData = $evaluatorData['components'][$componentId] ?? null;
                $normalizedWeight = $totalWeight > 0 ? round((($template?->weight ?? 1) / $totalWeight) * 100, 2) : 0;

                $componentData = [
                    'component_id' => $componentId,
                    'component_code' => $template?->code ?? 'N/A',
                    'component_name' => $template?->name ?? 'Unknown',
                    'weight' => $template?->weight ?? 1,
                    'normalized_weight' => $normalizedWeight,
                    'score' => $scoreData['score'] ?? null,
                    'notes' => $scoreData['notes'] ?? null,
                    'evaluated_at' => $scoreData['evaluated_at'] ?? null,
                ];

                $components[] = $componentData;

                if ($scoreData && $scoreData['score'] !== null) {
                    $scoredCount++;
                    $totalWeighted += $scoreData['score'] * $normalizedWeight;

                    // Add to calculation breakdown
                    $calculationBreakdown[] = [
                        'component' => $template?->name ?? 'Unknown',
                        'score' => $scoreData['score'],
                        'weight' => $normalizedWeight,
                        'weighted' => round($scoreData['score'] * $normalizedWeight / 100, 2),
                    ];
                } else {
                    // Add unscored component to breakdown with 0 contribution
                    $calculationBreakdown[] = [
                        'component' => $template?->name ?? 'Unknown',
                        'score' => 0,
                        'weight' => $normalizedWeight,
                        'weighted' => 0,
                    ];
                }
            }

            // Calculate evaluator's final score
            $finalScore = $scoredCount > 0 ? round($totalWeighted / 100, 2) : null;

            // Determine evaluator status
            $totalComponents = count($allComponents);
            $evaluatorStatus = 'NOT_STARTED';
            if ($scoredCount === $totalComponents && $totalComponents > 0) {
                $evaluatorStatus = 'COMPLETE';
                $completedEvaluators++;
            } elseif ($scoredCount > 0) {
                $evaluatorStatus = 'PARTIAL';
            }

            $evaluators[] = [
                'evaluator_id' => $evaluatorId,
                'name' => $evaluatorData['name'],
                'role' => $evaluatorData['role'],
                'status' => $evaluatorStatus,
                'score' => $finalScore,
                'total_components' => $totalComponents,
                'scored_components' => $scoredCount,
                'components' => $components,
                'calculation_summary' => [
                    'formula' => 'Σ(score × normalized_weight) / 100',
                    'breakdown' => $calculationBreakdown,
                    'total_weight' => 100,
                    'weighted_sum' => $finalScore !== null ? round($totalWeighted / 100, 2) : 0,
                    'final_score' => $finalScore,
                ],
            ];
        }

        // Calculate overall score (simple average of evaluator scores)
        $evaluatorScores = array_filter(array_column($evaluators, 'score'), fn ($s) => $s !== null);
        $overallScore = count($evaluatorScores) > 0 ? round(array_sum($evaluatorScores) / count($evaluatorScores), 2) : null;

        // Determine overall status
        $overallStatus = 'NOT_STARTED';
        $totalEvaluators = count($evaluators);

        if ($totalEvaluators === 0) {
            $overallStatus = 'NOT_STARTED';
        } elseif ($completedEvaluators === $totalEvaluators && $totalEvaluators > 0) {
            $overallStatus = 'COMPLETE';
        } elseif ($completedEvaluators > 0 || count(array_filter($evaluators, fn ($e) => $e['status'] === 'PARTIAL')) > 0) {
            $overallStatus = 'PARTIAL';
        }

        return $this->successResponse([
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'nim' => $student->nim ?? '',
                'group_id' => $group->id,
                'group_name' => $group->code ?? "Group {$group->id}",
            ],
            'evaluation_type' => $evaluationType,
            'overall' => [
                'score' => $overallScore,
                'status' => $overallStatus,
                'total_evaluators' => $totalEvaluators,
                'completed_evaluators' => $completedEvaluators,
                'last_evaluated_at' => $lastEvaluatedOverall ? $lastEvaluatedOverall->format('M d, Y') : null,
            ],
            'evaluators' => $evaluators,
            'unassigned' => [
                'components' => [],
                'total' => 0,
            ],
        ]);
    }

    /**
     * Export student evaluation summary to CSV.
     */
    public function exportStudentEvaluationsSummary(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'student_search' => 'nullable|string',
            'sort_by' => 'nullable|string|in:group,name',
        ]);

        $periodId = $request->period_id;
        $sortBy = $request->input('sort_by', 'group');
        $search = $request->input('student_search', '');

        // Get all data (no pagination for export) - include soft-deleted members
        $groups = Group::with(['members' => function ($query) {
            $query->withTrashed()->with('student');
        }, 'title'])
            ->where('period_id', $periodId)
            ->get();

        $gradeService = app(GradeCalculationService::class);
        $gradeService->preloadPeriodData($periodId);

        $students = [];
        foreach ($groups as $group) {
            foreach ($group->members as $member) {
                $student = $member->student;
                if (! $student) {
                    continue;
                }

                if ($search) {
                    $searchLower = strtolower($search);
                    $nameMatch = stripos(strtolower($student->name), $searchLower) !== false;
                    $nimMatch = stripos(strtolower($student->nim ?? ''), $searchLower) !== false;
                    if (! $nameMatch && ! $nimMatch) {
                        continue;
                    }
                }

                $studentGroupPairs = [['student_id' => $student->id, 'group_id' => $group->id]];
                $pdc1Data = $gradeService->calculatePDC1ForStudentsBatch($studentGroupPairs)[$student->id] ?? null;
                $pdc2Data = $gradeService->calculatePDC2ForStudentsBatch($studentGroupPairs)[$student->id] ?? null;
                $taData = $gradeService->calculateSidangTAForStudentsBatch($studentGroupPairs)[$student->id] ?? null;

                $evaluations = [
                    'SEMPRO' => $this->calculateEvaluationStatus($pdc1Data, 'SEMPRO'),
                    'BIMBINGAN_SEMPRO' => $this->calculateEvaluationStatus($pdc1Data, 'BIMBINGAN_SEMPRO'),
                    'SIDANG_TA' => $this->calculateEvaluationStatus($taData, 'SIDANG_TA'),
                    'BIMBINGAN_TA' => ['score' => null, 'status' => 'NOT_STARTED', 'total_components' => 0, 'scored_components' => 0],
                    'EXPO' => $this->calculateEvaluationStatus($pdc2Data, 'EXPO'),
                    'MILESTONE' => $this->calculateEvaluationStatus($pdc2Data, 'MILESTONE'),
                    'NILAI_DOSEN' => $this->calculateEvaluationStatus($pdc2Data, 'NILAI_DOSEN'),
                ];

                $students[] = [
                    'student_id' => $student->id,
                    'student_name' => $student->name,
                    'student_nim' => $student->nim ?? '',
                    'group_name' => $group->code ?? "Group {$group->id}",
                    'evaluations' => $evaluations,
                ];
            }
        }

        if ($sortBy === 'name') {
            usort($students, fn ($a, $b) => strcmp($a['student_name'], $b['student_name']));
        } else {
            usort($students, fn ($a, $b) => strcmp($a['group_name'], $b['group_name']) ?: strcmp($a['student_name'], $b['student_name']));
        }

        return $this->exportStudentEvaluationsCsv($students);
    }

    /**
     * Export student evaluations to CSV.
     */
    private function exportStudentEvaluationsCsv($students): StreamedResponse
    {
        return response()->streamDownload(function () use ($students) {
            $handle = fopen('php://output', 'w');

            // Header row with 3 columns per evaluation type
            $headers = ['Group', 'Student Name', 'NIM'];
            $evaluationTypes = ['SEMPRO', 'BIMBINGAN_SEMPRO', 'SIDANG_TA', 'BIMBINGAN_TA', 'EXPO', 'MILESTONE', 'NILAI_DOSEN'];
            foreach ($evaluationTypes as $type) {
                $headers[] = $type.' Score';
                $headers[] = $type.' Status';
                $headers[] = $type.' Components';
            }
            fputcsv($handle, $headers);

            // Data rows
            foreach ($students as $student) {
                $row = [
                    $student['group_name'],
                    $student['student_name'],
                    $student['student_nim'],
                ];

                foreach ($evaluationTypes as $type) {
                    $eval = $student['evaluations'][$type];
                    $row[] = $eval['score'] ?? '';
                    $row[] = $eval['status'];
                    $row[] = $eval['scored_components'].'/'.$eval['total_components'];
                }

                fputcsv($handle, $row);
            }

            fclose($handle);
        }, 'student_evaluations_summary.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * Get detailed breakdown for a specific evaluator.
     * Returns all components (scored and unscored) ordered by component code.
     */
    public function evaluatorDetail(Request $request, $studentId, $evaluationType, $evaluatorId)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $periodId = $request->period_id;

        // Validate evaluation type
        $supportedTypes = AssessmentScoreRepository::getSupportedTypes();
        if (! in_array($evaluationType, $supportedTypes)) {
            return $this->errorResponse('Invalid evaluation type', 400);
        }

        // Get student and group info
        $group = Group::where('period_id', $periodId)
            ->whereHas('members', function ($q) use ($studentId) {
                $q->withTrashed()->where('student_id', $studentId);
            })
            ->with(['members' => function ($q) {
                $q->withTrashed()->with('student');
            }, 'title'])
            ->first();

        if (! $group) {
            return $this->notFoundResponse('Student not found in this period');
        }

        $student = $group->members->firstWhere('student_id', $studentId)?->student;
        if (! $student) {
            return $this->notFoundResponse('Student not found');
        }

        // Get ALL period assessment components for this evaluation type, ordered by code
        $allComponents = PeriodAssessmentComponent::with('template')
            ->where('period_id', $periodId)
            ->where('type', $evaluationType)
            ->get()
            ->sortBy(fn ($c) => $c->template?->code ?? '')
            ->values();

        // Determine the correct evaluator column based on evaluation type
        $usesExaminer = in_array($evaluationType, ['SEMPRO', 'SIDANG_TA']);

        // Get all scores for this student/evaluation type from this specific evaluator
        // Use the correct column name based on evaluation type
        $scoreQuery = AssessmentScoreRepository::forType($evaluationType)
            ->where('student_id', $studentId)
            ->where('group_id', $group->id);

        // Apply the evaluator filter with the correct column name
        if ($usesExaminer) {
            $scoreQuery->where('examiner_id', $evaluatorId);
        } else {
            $scoreQuery->where('evaluator_id', $evaluatorId);
        }

        // Get all scores (don't key by period_component_id since it may be NULL)
        $allScores = $scoreQuery
            ->with(['periodComponent.template', 'evaluator:id,name'])
            ->get();

        // Create lookup maps for efficient matching
        $scoresByPeriodComponent = $allScores
            ->filter(fn ($s) => $s->period_component_id !== null)
            ->keyBy('period_component_id');

        $scoresByComponent = $allScores
            ->filter(fn ($s) => $s->component_id !== null)
            ->keyBy('component_id');

        // Find the evaluator info - use evaluator relationship (which is aliased in models with examiner_id)
        $evaluatorInfo = $allScores->first()?->evaluator;
        if (! $evaluatorInfo) {
            // Try to get evaluator info directly
            $evaluatorInfo = User::find($evaluatorId);
            if (! $evaluatorInfo) {
                return $this->notFoundResponse('Evaluator not found');
            }
        }

        // Resolve evaluator role
        $role = 'Evaluator';
        if ($group->supervisor_1_id == $evaluatorId) {
            $role = 'SUPERVISOR_1';
        } elseif ($group->supervisor_2_id == $evaluatorId) {
            $role = 'SUPERVISOR_2';
        } else {
            // Check if evaluator is an examiner for this student
            // Check TA defense schedules
            $taSchedule = \App\Models\TaDefenseSchedule::where('group_id', $group->id)
                ->where('status', '!=', 'CANCELLED')
                ->whereHas('students', function ($query) use ($studentId) {
                    $query->where('student_id', $studentId);
                })
                ->first();

            if ($taSchedule) {
                if ($taSchedule->examiner_1_id == $evaluatorId) {
                    $role = 'EXAMINER_1';
                } elseif ($taSchedule->examiner_2_id == $evaluatorId) {
                    $role = 'EXAMINER_2';
                }
            } else {
                // Check seminar schedules (SEMPRO/EXPO)
                $seminarSchedule = \App\Models\SeminarSchedule::where('group_id', $group->id)
                    ->where('status', '!=', 'CANCELLED')
                    ->whereIn('type', ['SEMPRO', 'EXPO'])
                    ->first();

                if ($seminarSchedule) {
                    if ($seminarSchedule->examiner_1_id == $evaluatorId) {
                        $role = 'EXAMINER_1';
                    } elseif ($seminarSchedule->examiner_2_id == $evaluatorId) {
                        $role = 'EXAMINER_2';
                    }
                }
            }
        }

        // Build component list with all components (scored and unscored)
        $components = [];
        $scoredCount = 0;
        $totalScore = 0;
        $calculationBreakdown = [];
        $lastEvaluatedAt = null;

        // Calculate total weight first for normalized weight calculation
        $totalWeight = 0;
        foreach ($allComponents as $periodComponent) {
            $totalWeight += $periodComponent->template?->weight ?? 1;
        }

        // Track which scores have been assigned to prevent duplicates
        $assignedScoreIds = [];

        foreach ($allComponents as $periodComponent) {
            $template = $periodComponent->template;

            // Try to match score by period_component_id first, then by component_id
            $score = null;

            // Method 1: Match by period_component_id (preferred for future data)
            if ($scoresByPeriodComponent->has($periodComponent->id)) {
                $score = $scoresByPeriodComponent->get($periodComponent->id);
                $assignedScoreIds[] = $score->id;
            }
            // Method 2: Match by component_id using the template's component_id
            elseif ($template?->id && $scoresByComponent->has($template->id)) {
                $score = $scoresByComponent->get($template->id);
                $assignedScoreIds[] = $score->id;
            }
            // Method 3: For legacy data with NULL component_id, match by unassigned scores
            else {
                // Find first unassigned score that hasn't been used yet
                $unassignedScore = $allScores
                    ->filter(fn ($s) => $s->score !== null &&
                        ! in_array($s->id, $assignedScoreIds) &&
                        ($s->period_component_id === null || ! $scoresByPeriodComponent->has($s->period_component_id))
                    )
                    ->first();

                if ($unassignedScore) {
                    $score = $unassignedScore;
                    $assignedScoreIds[] = $score->id;
                }
            }

            $componentData = [
                'component_id' => $periodComponent->id,
                'component_code' => $template?->code ?? 'N/A',
                'component_name' => $template?->name ?? 'Unknown',
                'weight' => $template?->weight ?? 1,
                'normalized_weight' => $totalWeight > 0 ? round((($template?->weight ?? 1) / $totalWeight) * 100, 2) : 0,
                'score' => $score?->score,
                'notes' => $score?->notes,
                'evaluated_at' => $score?->created_at ? $score->created_at->format('M d, Y') : null,
            ];

            $components[] = $componentData;

            if ($score && $score->score !== null) {
                $scoredCount++;
                $totalScore += $score->score * ($template?->weight ?? 1);

                // Add to calculation breakdown
                $calculationBreakdown[] = [
                    'component' => $template?->name ?? 'Unknown',
                    'score' => $score->score,
                    'weight' => $template?->weight ?? 1,
                    'weighted' => round($score->score * ($template?->weight ?? 1) / 100, 2),
                ];

                if ($score->created_at && (! $lastEvaluatedAt || $score->created_at > $lastEvaluatedAt)) {
                    $lastEvaluatedAt = $score->created_at;
                }
            } else {
                // Add unscored component to breakdown with 0 contribution
                $calculationBreakdown[] = [
                    'component' => $template?->name ?? 'Unknown',
                    'score' => 0,
                    'weight' => $template?->weight ?? 1,
                    'weighted' => 0,
                ];
            }
        }

        // Calculate final score (totalWeight already calculated above)
        $finalScore = $scoredCount > 0 && $totalWeight > 0 ? round($totalScore / $totalWeight, 2) : null;

        // Determine status
        $totalComponents = count($allComponents);
        $status = 'NOT_STARTED';
        if ($scoredCount === $totalComponents && $totalComponents > 0) {
            $status = 'COMPLETE';
        } elseif ($scoredCount > 0) {
            $status = 'PARTIAL';
        }

        return $this->successResponse([
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'nim' => $student->nim ?? '',
                'group_id' => $group->id,
                'group_name' => $group->code ?? "Group {$group->id}",
            ],
            'evaluation_type' => $evaluationType,
            'evaluator' => [
                'evaluator_id' => $evaluatorId,
                'name' => $evaluatorInfo->name,
                'role' => $role,
                'status' => $status,
                'score' => $finalScore,
                'total_components' => $totalComponents,
                'scored_components' => $scoredCount,
                'components' => $components,
                'calculation_summary' => [
                    'formula' => 'Σ(score × weight) / Σ(weights)',
                    'breakdown' => $calculationBreakdown,
                    'total_weight' => $totalWeight,
                    'weighted_sum' => $finalScore !== null ? round($totalScore / 100, 2) : 0,
                    'final_score' => $finalScore,
                ],
                'last_evaluated_at' => $lastEvaluatedAt ? $lastEvaluatedAt->format('M d, Y') : null,
            ],
        ]);
    }
}
