<?php

namespace App\Http\Controllers;

use App\Models\AssessmentScore;
use App\Models\PeerReview;
use App\Models\Group;
use App\Services\GradeCalculationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        $query = AssessmentScore::with(['component', 'periodComponent.template', 'evaluator', 'student', 'group.title'])
            ->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });

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

            // Calculate final grade
            if ($pdc1Score > 0 && $pdc2Score > 0) {
                $finalGrade = ($pdc1Score + $pdc2Score) / 2;
            } elseif ($pdc1Score > 0) {
                $finalGrade = $pdc1Score;
            } elseif ($pdc2Score > 0) {
                $finalGrade = $pdc2Score;
            } else {
                continue; // Skip students with no grades
            }

            $letterGrade = $gradeService->getLetterGrade($finalGrade);
            $isComplete = $pdc1Data && $pdc2Data &&
                         $pdc1Data['status'] === 'COMPLETE' &&
                         $pdc2Data['status'] === 'COMPLETE';

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
                'group_name' => $group->title->title ?? "Group {$group->id}",
                'student_id' => $student->id,
                'student_name' => $student->name,
                'student_nim' => $student->nim ?? '',
                'pdc1_score' => $pdc1Score > 0 ? round($pdc1Score, 2) : null,
                'pdc2_score' => $pdc2Score > 0 ? round($pdc2Score, 2) : null,
                'final_grade' => round($finalGrade, 2),
                'letter_grade' => $letterGrade,
                'status' => $isComplete ? 'Complete' : 'Incomplete',
                'created_at' => now()->toDateTimeString(), // For sorting
            ];
        }

        // Sort by final grade descending
        usort($students, function ($a, $b) {
            return $b['final_grade'] <=> $a['final_grade'];
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
                    'group_name' => $group->title->title ?? "Group {$group->id}",
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
            fputcsv($handle, ['Group', 'Student Name', 'NIM', 'PDC1 Score', 'PDC2 Score', 'Final Grade', 'Letter Grade', 'Status']);

            foreach ($students as $student) {
                fputcsv($handle, [
                    $student['group_name'],
                    $student['student_name'],
                    $student['student_nim'],
                    $student['pdc1_score'] ?? 'N/A',
                    $student['pdc2_score'] ?? 'N/A',
                    $student['final_grade'],
                    $student['letter_grade'],
                    $student['status'],
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
}
