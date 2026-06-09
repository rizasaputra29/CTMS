<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\PeerReview;
use App\Repositories\AssessmentScoreRepository;
use App\Services\GradeCalculationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportSummaryController extends Controller
{
    /**
     * Get summary data for all report types.
     */
    public function summary(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $periodId = $request->period_id;

        return response()->json([
            'data' => [
                'assessments' => $this->getAssessmentSummary($periodId),
                'peer_reviews' => $this->getPeerReviewSummary($periodId),
                'final_grades' => $this->getFinalGradesSummary($periodId),
                'groups' => $this->getGroupsSummary($periodId),
            ],
        ]);
    }

    /**
     * Get assessment scores summary.
     */
    private function getAssessmentSummary(int $periodId): array
    {
        // Aggregate scores from all supported tables
        $totalScores = 0;
        $totalScoreSum = 0;
        $allScores = collect();

        foreach (AssessmentScoreRepository::getSupportedTypes() as $type) {
            $scores = AssessmentScoreRepository::forType($type)
                ->with(['group.title'])
                ->whereHas('group', function ($q) use ($periodId) {
                    $q->where('period_id', $periodId);
                })
                ->get();
            $totalScores += $scores->count();
            $totalScoreSum += $scores->sum('score');
            $allScores = $allScores->concat($scores);
        }

        $totalGroups = Group::where('period_id', $periodId)->count();

        // Get unique students count
        $totalStudents = $allScores->pluck('student_id')->unique()->count();

        // Get average score
        $averageScore = $totalScores > 0 ? ($totalScoreSum / $totalScores) : 0;

        // Get top 5 groups by average score
        $topGroups = $allScores
            ->groupBy('group_id')
            ->map(function ($groupScores) {
                $group = $groupScores->first()->group;

                return (object) [
                    'group_id' => $group->id,
                    'group_name' => $group->code ?? "Group {$group->id}",
                    'student_count' => $groupScores->pluck('student_id')->unique()->count(),
                    'average_score' => round($groupScores->avg('score'), 2),
                ];
            })
            ->sortByDesc('average_score')
            ->take(5)
            ->values();

        // Cast average_score to float for each group (DB returns it as string)
        $topGroups = $topGroups->map(function ($group) {
            $group->average_score = (float) $group->average_score;

            return $group;
        });

        return [
            'total_scores' => $totalScores,
            'total_groups' => $totalGroups,
            'total_students' => $totalStudents,
            'average_score' => round($averageScore, 2),
            'top_groups' => $topGroups,
        ];
    }

    /**
     * Get peer reviews summary.
     */
    private function getPeerReviewSummary(int $periodId): array
    {
        $totalReviews = PeerReview::whereHas('group', function ($q) use ($periodId) {
            $q->where('period_id', $periodId);
        })->count();

        $totalGroups = PeerReview::whereHas('group', function ($q) use ($periodId) {
            $q->where('period_id', $periodId);
        })->distinct('group_id')->count('group_id');

        // Calculate average from raw scores (1-4 scale converted to 0-100)
        $averageScore = PeerReview::whereHas('group', function ($q) use ($periodId) {
            $q->where('period_id', $periodId);
        })->avg('score') ?? 0;

        // Get top 5 groups by peer review average
        $topGroups = DB::table('peer_reviews')
            ->join('groups', 'peer_reviews.group_id', '=', 'groups.id')
            ->leftJoin('titles', 'groups.title_id', '=', 'titles.id')
            ->where('groups.period_id', $periodId)
            ->select(
                'groups.id as group_id',
                DB::raw("COALESCE(groups.code, 'Group ' || groups.id) as group_name"),
                DB::raw('COUNT(DISTINCT peer_reviews.reviewee_id) as student_count'),
                DB::raw('ROUND(AVG(peer_reviews.score), 2) as average_score')
            )
            ->groupBy('groups.id', 'titles.title')
            ->orderByDesc('average_score')
            ->limit(5)
            ->get();

        // Cast average_score to float for each group (DB returns it as string)
        $topGroups = $topGroups->map(function ($group) {
            $group->average_score = (float) $group->average_score;

            return $group;
        });

        return [
            'total_reviews' => $totalReviews,
            'total_groups' => $totalGroups,
            'average_score' => round($averageScore, 2),
            'top_groups' => $topGroups,
        ];
    }

    /**
     * Get final grades summary using optimized batch queries.
     */
    private function getFinalGradesSummary(int $periodId): array
    {
        $gradeService = new GradeCalculationService;

        // Preload all period data (5 queries total instead of 3,200+)
        $gradeService->preloadPeriodData($periodId);

        $groups = Group::where('period_id', $periodId)
            ->with(['title', 'members.student'])
            ->get();

        // Build student-group pairs for batch processing
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
                    'group' => $group,
                    'student' => $student,
                ];
            }
        }

        // Batch calculate ALL grades (3 calls for PDC1, PDC2, and TA)
        $pdc1Results = $gradeService->calculatePDC1ForStudentsBatch($studentGroupPairs);
        $pdc2Results = $gradeService->calculatePDC2ForStudentsBatch($studentGroupPairs);
        $taResults = $gradeService->calculateSidangTAForStudentsBatch($studentGroupPairs);

        // Clear cache to free memory
        $gradeService->clearCache();

        // Process results
        $totalStudents = 0;
        $completeGrades = 0;
        $incompleteGrades = 0;
        $pdc1CompleteCount = 0;
        $pdc2CompleteCount = 0;
        $taCompleteCount = 0;
        $topStudents = [];

        foreach ($studentGroupPairs as $pair) {
            $studentId = $pair['student_id'];
            $info = $studentInfo[$studentId];
            $group = $info['group'];
            $student = $info['student'];

            $totalStudents++;

            $pdc1Data = $pdc1Results[$studentId] ?? null;
            $pdc2Data = $pdc2Results[$studentId] ?? null;
            $taData = $taResults[$studentId] ?? null;

            $pdc1Score = $pdc1Data ? $pdc1Data['grade'] : null;
            $pdc2Score = $pdc2Data ? $pdc2Data['grade'] : null;
            $taScore = $taData ? $taData['grade'] : null;

            $isPDC1Complete = $pdc1Data && $pdc1Data['status'] === 'COMPLETE';
            $isPDC2Complete = $pdc2Data && $pdc2Data['status'] === 'COMPLETE';
            $isTAComplete = $taData && $taData['status'] === 'COMPLETE';
            $isComplete = $isPDC1Complete && $isPDC2Complete && $isTAComplete;

            // Count completions for each component
            if ($isPDC1Complete) {
                $pdc1CompleteCount++;
            }
            if ($isPDC2Complete) {
                $pdc2CompleteCount++;
            }
            if ($isTAComplete) {
                $taCompleteCount++;
            }

            if ($isComplete) {
                $completeGrades++;
            } else {
                $incompleteGrades++;
            }

            // Include students who have at least one score
            if ($pdc1Score !== null || $pdc2Score !== null || $taScore !== null) {
                // Calculate average for ranking purposes (only from available scores)
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
                $avgScore = count($availableScores) > 0 ? array_sum($availableScores) / count($availableScores) : 0;

                $topStudents[] = [
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
                    // Keep for ranking purposes
                    '_avg_score' => $avgScore,
                ];
            }
        }

        // Sort by average score descending and take top 5
        usort($topStudents, fn ($a, $b) => $b['_avg_score'] <=> $a['_avg_score']);
        $topStudents = array_slice($topStudents, 0, 5);

        // Remove internal ranking field from output
        $topStudents = array_map(fn ($s) => [
            'group_id' => $s['group_id'],
            'group_name' => $s['group_name'],
            'student_id' => $s['student_id'],
            'student_name' => $s['student_name'],
            'student_nim' => $s['student_nim'],
            'pdc1_score' => $s['pdc1_score'],
            'pdc2_score' => $s['pdc2_score'],
            'ta_score' => $s['ta_score'],
            'pdc1_complete' => $s['pdc1_complete'],
            'pdc2_complete' => $s['pdc2_complete'],
            'ta_complete' => $s['ta_complete'],
        ], $topStudents);

        return [
            'total_students' => $totalStudents,
            'complete' => $completeGrades,
            'incomplete' => $incompleteGrades,
            'pdc1_complete' => $pdc1CompleteCount,
            'pdc2_complete' => $pdc2CompleteCount,
            'ta_complete' => $taCompleteCount,
            'top_students' => $topStudents,
        ];
    }

    /**
     * Get groups summary.
     */
    private function getGroupsSummary(int $periodId): array
    {
        $totalGroups = Group::where('period_id', $periodId)->count();

        $groups = Group::where('period_id', $periodId)
            ->with(['title', 'supervisor1', 'supervisor2'])
            ->withCount('members')
            ->get()
            ->map(function ($group) {
                return [
                    'group_id' => $group->id,
                    'group_name' => $group->code ?? "Group {$group->id}",
                    'status' => $group->status,
                    'member_count' => $group->members_count,
                    'supervisor_1' => $group->supervisor1->name ?? 'Not assigned',
                    'supervisor_2' => $group->supervisor2->name ?? 'Not assigned',
                ];
            });

        return [
            'total_groups' => $totalGroups,
            'groups' => $groups,
        ];
    }
}
