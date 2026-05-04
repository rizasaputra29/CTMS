<?php

namespace App\Http\Controllers;

use App\Models\AssessmentScore;
use App\Models\PeerReview;
use App\Models\Group;
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
                'grade_consistency' => $this->getGradeConsistencySummary($periodId),
                'groups' => $this->getGroupsSummary($periodId),
            ]
        ]);
    }

    /**
     * Get assessment scores summary.
     */
    private function getAssessmentSummary(int $periodId): array
    {
        // Get total counts
        $totalScores = AssessmentScore::whereHas('group', function ($q) use ($periodId) {
            $q->where('period_id', $periodId);
        })->count();

        $totalGroups = Group::where('period_id', $periodId)->count();

        $totalStudents = DB::table('assessment_scores')
            ->join('groups', 'assessment_scores.group_id', '=', 'groups.id')
            ->where('groups.period_id', $periodId)
            ->whereNotNull('assessment_scores.student_id')
            ->distinct('assessment_scores.student_id')
            ->count('assessment_scores.student_id');

        // Get average score
        $averageScore = AssessmentScore::whereHas('group', function ($q) use ($periodId) {
            $q->where('period_id', $periodId);
        })->avg('score') ?? 0;

        // Get top 5 groups by average score
        $topGroups = DB::table('assessment_scores')
            ->join('groups', 'assessment_scores.group_id', '=', 'groups.id')
            ->leftJoin('titles', 'groups.title_id', '=', 'titles.id')
            ->where('groups.period_id', $periodId)
            ->select(
                'groups.id as group_id',
                DB::raw("COALESCE(titles.title, 'Group ' || groups.id) as group_name"),
                DB::raw('COUNT(DISTINCT assessment_scores.student_id) as student_count'),
                DB::raw('ROUND(AVG(assessment_scores.score), 2) as average_score')
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
                DB::raw("COALESCE(titles.title, 'Group ' || groups.id) as group_name"),
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
        $gradeService = new GradeCalculationService();

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
                if (!$student) continue;

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

        // Batch calculate ALL grades (2 calls, not N individual calls)
        $pdc1Results = $gradeService->calculatePDC1ForStudentsBatch($studentGroupPairs);
        $pdc2Results = $gradeService->calculatePDC2ForStudentsBatch($studentGroupPairs);

        // Clear cache to free memory
        $gradeService->clearCache();

        // Process results
        $totalStudents = 0;
        $completeGrades = 0;
        $incompleteGrades = 0;
        $topStudents = [];

        foreach ($studentGroupPairs as $pair) {
            $studentId = $pair['student_id'];
            $info = $studentInfo[$studentId];
            $group = $info['group'];
            $student = $info['student'];

            $totalStudents++;

            $pdc1Data = $pdc1Results[$studentId] ?? null;
            $pdc2Data = $pdc2Results[$studentId] ?? null;

            $pdc1Score = $pdc1Data ? $pdc1Data['grade'] : 0;
            $pdc2Score = $pdc2Data ? $pdc2Data['grade'] : 0;

            $isComplete = $pdc1Data && $pdc2Data &&
                         $pdc1Data['status'] === 'COMPLETE' &&
                         $pdc2Data['status'] === 'COMPLETE';

            if ($isComplete) {
                $completeGrades++;
            } else {
                $incompleteGrades++;
            }

            // Calculate final grade
            $finalGrade = 0;
            if ($pdc1Score > 0 && $pdc2Score > 0) {
                $finalGrade = ($pdc1Score + $pdc2Score) / 2;
            } elseif ($pdc1Score > 0) {
                $finalGrade = $pdc1Score;
            } elseif ($pdc2Score > 0) {
                $finalGrade = $pdc2Score;
            }

            if ($finalGrade > 0) {
                $topStudents[] = [
                    'group_id' => $group->id,
                    'group_name' => $group->title->title ?? "Group {$group->id}",
                    'student_id' => $student->id,
                    'student_name' => $student->name,
                    'student_nim' => $student->nim ?? '',
                    'final_grade' => round($finalGrade, 2),
                    'letter_grade' => $gradeService->getLetterGrade($finalGrade),
                    'status' => $isComplete ? 'Complete' : 'Incomplete',
                ];
            }
        }

        // Sort by final grade descending and take top 5
        usort($topStudents, fn($a, $b) => $b['final_grade'] <=> $a['final_grade']);
        $topStudents = array_slice($topStudents, 0, 5);

        return [
            'total_students' => $totalStudents,
            'complete' => $completeGrades,
            'incomplete' => $incompleteGrades,
            'top_students' => $topStudents,
        ];
    }

    /**
     * Get grade consistency summary using optimized batch queries.
     */
    private function getGradeConsistencySummary(int $periodId): array
    {
        $gradeService = new GradeCalculationService();

        // Preload all period data
        $gradeService->preloadPeriodData($periodId);

        $groups = Group::where('period_id', $periodId)
            ->with(['title', 'members.student'])
            ->get();

        // Build student-group pairs
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
                    'group' => $group,
                    'student' => $student,
                ];
            }
        }

        // Batch calculate grades
        $pdc1Results = $gradeService->calculatePDC1ForStudentsBatch($studentGroupPairs);
        $pdc2Results = $gradeService->calculatePDC2ForStudentsBatch($studentGroupPairs);

        // Clear cache
        $gradeService->clearCache();

        // Process results
        $consistentCount = 0;
        $inconsistentCount = 0;
        $pendingCount = 0;
        $inconsistentStudents = [];

        foreach ($studentGroupPairs as $pair) {
            $studentId = $pair['student_id'];
            $info = $studentInfo[$studentId];
            $group = $info['group'];
            $student = $info['student'];

            $pdc1Data = $pdc1Results[$studentId] ?? null;
            $pdc2Data = $pdc2Results[$studentId] ?? null;

            $pdc1Score = $pdc1Data ? $pdc1Data['grade'] : 0;
            $pdc2Score = $pdc2Data ? $pdc2Data['grade'] : 0;

            if ($pdc1Score > 0 && $pdc2Score > 0) {
                $deviation = abs($pdc1Score - $pdc2Score);
                $isConsistent = $deviation <= 15;

                if ($isConsistent) {
                    $consistentCount++;
                } else {
                    $inconsistentCount++;
                    $inconsistentStudents[] = [
                        'group_id' => $group->id,
                        'group_name' => $group->title->title ?? "Group {$group->id}",
                        'student_id' => $student->id,
                        'student_name' => $student->name,
                        'pdc1_score' => round($pdc1Score, 2),
                        'pdc2_score' => round($pdc2Score, 2),
                        'deviation' => round($deviation, 2),
                    ];
                }
            } else {
                $pendingCount++;
            }
        }

        // Sort by deviation descending and take top 5
        usort($inconsistentStudents, fn($a, $b) => $b['deviation'] <=> $a['deviation']);
        $inconsistentStudents = array_slice($inconsistentStudents, 0, 5);

        return [
            'consistent' => $consistentCount,
            'inconsistent' => $inconsistentCount,
            'pending' => $pendingCount,
            'inconsistent_students' => $inconsistentStudents,
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
                    'group_name' => $group->title->title ?? "Group {$group->id}",
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
