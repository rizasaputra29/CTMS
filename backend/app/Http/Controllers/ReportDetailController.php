<?php

namespace App\Http\Controllers;

use App\Models\PeerReview;
use App\Models\Group;
use App\Repositories\AssessmentScoreRepository;
use App\Services\GradeCalculationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportDetailController extends Controller
{
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

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $scores->currentPage(),
                'last_page' => $scores->lastPage(),
                'per_page' => $scores->perPage(),
                'total' => $scores->total(),
            ]
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
        ]);

        $periodId = $request->period_id;
        $perPage = $request->input('per_page', 50);

        $query = PeerReview::with(['reviewer', 'reviewee', 'periodIndicator.template', 'group.title'])
            ->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });

        // Apply filters
        if ($request->filled('group_id')) {
            $query->where('group_id', $request->group_id);
        }

        // Sort by date descending
        $query->orderBy('created_at', 'desc');

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

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
                'per_page' => $reviews->perPage(),
                'total' => $reviews->total(),
            ]
        ]);
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
        $gradeService = new GradeCalculationService();

        // Preload period data for batch calculations
        $gradeService->preloadPeriodData($periodId);

        $groups = Group::where('period_id', $periodId)
            ->with(['title', 'members.student']);

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
                if (!$student) continue;

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
            if ($pdc1Score !== null) $availableScores[] = $pdc1Score;
            if ($pdc2Score !== null) $availableScores[] = $pdc2Score;
            if ($taScore !== null) $availableScores[] = $taScore;
            
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

        return response()->json([
            'data' => $paginatedStudents,
            'meta' => [
                'current_page' => $page,
                'last_page' => ceil($total / $perPage),
                'per_page' => $perPage,
                'total' => $total,
            ]
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
        $gradeService = new GradeCalculationService();

        // Preload period data for batch calculations
        $gradeService->preloadPeriodData($periodId);

        $groups = Group::where('period_id', $periodId)
            ->with(['title', 'members.student'])
            ->get();

        // Build student-group pairs for batch calculation
        $studentGroupPairs = [];
        $studentInfo = [];

        foreach ($groups as $group) {
            foreach ($group->members as $member) {
                $student = $member->student;
                if (!$student) continue;

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
                    if (!str_contains(strtolower($student->name), $search) &&
                        !str_contains(strtolower($student->nim ?? ''), $search)) {
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

        return response()->json([
            'data' => $paginatedStudents,
            'meta' => [
                'current_page' => $page,
                'last_page' => ceil($total / $perPage),
                'per_page' => $perPage,
                'total' => $total,
            ]
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
            ->with(['title', 'supervisor1', 'supervisor2', 'members.student']);

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

        return response()->json([
            'data' => $transformedGroups,
            'meta' => [
                'current_page' => $groups->currentPage(),
                'last_page' => $groups->lastPage(),
                'per_page' => $groups->perPage(),
                'total' => $groups->total(),
            ]
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

        // Get all groups in period with students
        $groupsQuery = Group::with(['members.student', 'title'])
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
                if (!$student) continue;

                // Filter by search
                if ($search) {
                    $searchLower = strtolower($search);
                    $nameMatch = stripos(strtolower($student->name), $searchLower) !== false;
                    $nimMatch = stripos(strtolower($student->nim ?? ''), $searchLower) !== false;
                    if (!$nameMatch && !$nimMatch) continue;
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
            usort($students, fn($a, $b) => strcmp($a['student_name'], $b['student_name']));
        } else {
            usort($students, fn($a, $b) => strcmp($a['group_name'], $b['group_name']) ?: strcmp($a['student_name'], $b['student_name']));
        }

        // Manual pagination
        $page = $request->input('page', 1);
        $total = count($students);
        $offset = ($page - 1) * $perPage;
        $paginatedStudents = array_slice($students, $offset, $perPage);

        return response()->json([
            'data' => $paginatedStudents,
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
        if (!$data) {
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
        if (!in_array($evaluationType, $supportedTypes)) {
            return response()->json(['error' => 'Invalid evaluation type'], 400);
        }

        // Get student and group info
        $group = Group::where('period_id', $periodId)
            ->whereHas('members', function ($q) use ($studentId) {
                $q->where('student_id', $studentId);
            })
            ->with(['members.student', 'title'])
            ->first();

        if (!$group) {
            return response()->json(['error' => 'Student not found in this period'], 404);
        }

        $student = $group->members->firstWhere('student_id', $studentId)?->student;
        if (!$student) {
            return response()->json(['error' => 'Student not found'], 404);
        }

        // Get all scores for this evaluation type
        $scores = AssessmentScoreRepository::forType($evaluationType)
            ->where('student_id', $studentId)
            ->where('group_id', $group->id)
            ->with(['periodComponent.template', 'evaluator:id,name'])
            ->get();

        // Group scores by evaluator
        $evaluatorGroups = [];
        $unassignedComponents = [];
        $lastEvaluatedOverall = null;

        foreach ($scores as $score) {
            $component = [
                'component_id' => $score->periodComponent?->id ?? $score->component_id,
                'component_code' => $score->periodComponent?->template?->code ?? $score->component?->code ?? 'N/A',
                'component_name' => $score->periodComponent?->template?->name ?? $score->component?->name ?? 'Unknown',
                'weight' => $score->periodComponent?->template?->weight ?? $score->component?->weight ?? 1,
                'score' => $score->score,
                'notes' => $score->notes,
                'evaluated_at' => $score->created_at ? $score->created_at->format('M d, Y') : null,
            ];

            // Track last evaluated date
            if ($score->created_at && (!$lastEvaluatedOverall || $score->created_at > $lastEvaluatedOverall)) {
                $lastEvaluatedOverall = $score->created_at;
            }

            // Group by evaluator
            if ($score->evaluator) {
                $evaluatorId = $score->evaluator->id;
                
                if (!isset($evaluatorGroups[$evaluatorId])) {
                    $evaluatorGroups[$evaluatorId] = [
                        'evaluator_id' => $evaluatorId,
                        'name' => $score->evaluator->name,
                        'role' => $score->evaluator->role ?? 'Evaluator',
                        'components' => [],
                    ];
                }
                
                $evaluatorGroups[$evaluatorId]['components'][] = $component;
            } else {
                $unassignedComponents[] = $component;
            }
        }

        // Build evaluator data with normalized weights and calculations
        $evaluators = [];
        $completedEvaluators = 0;
        
        foreach ($evaluatorGroups as $evaluatorId => $evaluatorData) {
            $components = $evaluatorData['components'];
            
            // Calculate total weight for normalization
            $totalWeight = array_sum(array_column($components, 'weight'));
            
            // Normalize weights and build component data
            $normalizedComponents = [];
            $scoredCount = 0;
            $totalScore = 0;
            
            foreach ($components as $comp) {
                $normalizedWeight = $totalWeight > 0 ? round(($comp['weight'] / $totalWeight) * 100, 2) : 0;
                
                $normalizedComponents[] = [
                    'component_id' => $comp['component_id'],
                    'component_code' => $comp['component_code'],
                    'component_name' => $comp['component_name'],
                    'weight' => $comp['weight'],
                    'normalized_weight' => $normalizedWeight,
                    'score' => $comp['score'],
                    'notes' => $comp['notes'],
                    'evaluated_at' => $comp['evaluated_at'],
                ];
                
                if ($comp['score'] !== null) {
                    $scoredCount++;
                    $totalScore += $comp['score'] * $normalizedWeight;
                }
            }
            
            // Calculate evaluator's final score (weights sum to 100)
            $finalScore = $scoredCount > 0 && $totalWeight > 0 ? round($totalScore / 100, 2) : null;
            
            // Determine evaluator status
            $totalComponents = count($components);
            $evaluatorStatus = 'NOT_STARTED';
            if ($scoredCount === $totalComponents && $totalComponents > 0) {
                $evaluatorStatus = 'COMPLETE';
                $completedEvaluators++;
            } elseif ($scoredCount > 0) {
                $evaluatorStatus = 'PARTIAL';
            }
            
            // Build calculation breakdown
            $calculationBreakdown = [];
            foreach ($normalizedComponents as $comp) {
                if ($comp['score'] !== null) {
                    $calculationBreakdown[] = [
                        'component' => $comp['component_name'],
                        'score' => $comp['score'],
                        'weight' => $comp['normalized_weight'],
                        'weighted' => round($comp['score'] * $comp['normalized_weight'] / 100, 2),
                    ];
                }
            }
            
            $evaluators[] = [
                'evaluator_id' => $evaluatorId,
                'name' => $evaluatorData['name'],
                'role' => $evaluatorData['role'],
                'status' => $evaluatorStatus,
                'score' => $finalScore,
                'total_components' => $totalComponents,
                'scored_components' => $scoredCount,
                'components' => $normalizedComponents,
                'calculation_summary' => [
                    'formula' => 'Σ(score × normalized_weight) / 100',
                    'breakdown' => $calculationBreakdown,
                    'total_weight' => 100,
                    'weighted_sum' => $finalScore !== null ? round($totalScore / 100, 2) : 0,
                    'final_score' => $finalScore,
                ],
            ];
        }

        // Calculate overall score (simple average of evaluator scores)
        $evaluatorScores = array_filter(array_column($evaluators, 'score'), fn($s) => $s !== null);
        $overallScore = count($evaluatorScores) > 0 ? round(array_sum($evaluatorScores) / count($evaluatorScores), 2) : null;
        
        // Determine overall status
        $overallStatus = 'NOT_STARTED';
        $totalEvaluators = count($evaluators);
        
        if (count($unassignedComponents) > 0) {
            $overallStatus = 'PARTIAL';
        } elseif ($totalEvaluators === 0) {
            $overallStatus = 'NOT_STARTED';
        } elseif ($completedEvaluators === $totalEvaluators) {
            $overallStatus = 'COMPLETE';
        } elseif ($completedEvaluators > 0 || count(array_filter($evaluators, fn($e) => $e['status'] === 'PARTIAL')) > 0) {
            $overallStatus = 'PARTIAL';
        }

        // Format unassigned components
        $unassigned = [];
        foreach ($unassignedComponents as $comp) {
            $unassigned[] = [
                'component_id' => $comp['component_id'],
                'component_code' => $comp['component_code'],
                'component_name' => $comp['component_name'],
                'weight' => $comp['weight'],
                'score' => $comp['score'],
                'notes' => $comp['notes'],
                'evaluated_at' => $comp['evaluated_at'],
            ];
        }

        return response()->json([
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
                'components' => $unassigned,
                'total' => count($unassigned),
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

        // Get all data (no pagination for export)
        $groups = Group::with(['members.student', 'title'])
            ->where('period_id', $periodId)
            ->get();

        $gradeService = app(GradeCalculationService::class);
        $gradeService->preloadPeriodData($periodId);

        $students = [];
        foreach ($groups as $group) {
            foreach ($group->members as $member) {
                $student = $member->student;
                if (!$student) continue;

                if ($search) {
                    $searchLower = strtolower($search);
                    $nameMatch = stripos(strtolower($student->name), $searchLower) !== false;
                    $nimMatch = stripos(strtolower($student->nim ?? ''), $searchLower) !== false;
                    if (!$nameMatch && !$nimMatch) continue;
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
            usort($students, fn($a, $b) => strcmp($a['student_name'], $b['student_name']));
        } else {
            usort($students, fn($a, $b) => strcmp($a['group_name'], $b['group_name']) ?: strcmp($a['student_name'], $b['student_name']));
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
                $headers[] = $type . ' Score';
                $headers[] = $type . ' Status';
                $headers[] = $type . ' Components';
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
                    $row[] = $eval['scored_components'] . '/' . $eval['total_components'];
                }
                
                fputcsv($handle, $row);
            }

            fclose($handle);
        }, 'student_evaluations_summary.csv', ['Content-Type' => 'text/csv']);
    }
}
