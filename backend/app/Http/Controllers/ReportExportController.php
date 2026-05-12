<?php

namespace App\Http\Controllers;

use App\Repositories\AssessmentScoreRepository;
use App\Models\PeerReview;
use App\Models\GradeConsistencyCheck;
use App\Models\Group;
use App\Models\GroupMember;
use App\Services\GradeCalculationService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExportController extends Controller
{
    /**
     * Export data as CSV.
     * Supported types: assessments, peer-reviews, grade-consistency, groups
     */
    public function export(Request $request, $type)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $periodId = $request->period_id;

        return match ($type) {
            'assessments' => $this->exportAssessments($periodId, $request->query('eval_type')),
            'peer-reviews' => $this->exportPeerReviews($periodId),
            'grade-consistency' => $this->exportGradeConsistency($periodId),
            'groups' => $this->exportGroups($periodId),
            'final-grades' => $this->exportFinalGrades($periodId),
            default => response()->json(['message' => 'Unknown report type'], 400),
        };
    }

    private function exportAssessments($periodId, $evalType = null): StreamedResponse
    {
        // Aggregate scores from all supported types
        $allScores = collect();
        
        $types = $evalType ? [$evalType] : AssessmentScoreRepository::getSupportedTypes();
        
        foreach ($types as $type) {
            if (AssessmentScoreRepository::isSupportedType($type)) {
                $with = ['component', 'evaluator', 'examiner', 'student', 'group.title'];
                $scores = AssessmentScoreRepository::forType($type)
                    ->with($with)
                    ->whereHas('group', fn($q) => $q->where('period_id', $periodId))
                    ->get();
                $allScores = $allScores->concat($scores);
            }
        }

        return $this->streamCsv('assessments.csv', [
            'Group',
            'Title',
            'Student',
            'Evaluator',
            'Component Code',
            'Component Name',
            'Weight',
            'Score',
            'Type',
            'Notes'
        ], $allScores->map(fn($s) => [
                $s->group->id ?? '',
                $s->group->title->title ?? '',
                $s->student->name ?? 'Group-level',
                $s->examiner->name ?? $s->evaluator->name ?? '',
                $s->component->code ?? '',
                $s->component->name ?? '',
                $s->component->weight ?? '',
                $s->score,
                $type,
                $s->notes ?? '',
            ])->toArray());
    }

    private function exportPeerReviews($periodId): StreamedResponse
    {
        $reviews = PeerReview::with(['reviewer', 'reviewee', 'periodIndicator.template', 'group'])
            ->whereHas('group', fn($q) => $q->where('period_id', $periodId))
            ->get();

        return $this->streamCsv('peer_reviews.csv', [
            'Group ID',
            'Reviewer',
            'Reviewee',
            'Indicator',
            'Weight',
            'Raw Score (1-4)',
            'Converted Score (0-100)',
            'Comment'
        ], $reviews->map(function($r) {
            // Use stored values: raw_score (1-4) and score (0-100)
            $rawScore = $r->raw_score;
            $convertedScore = $r->score; // Should always be raw_score × 25
            
            return [
                $r->group_id,
                $r->reviewer->name ?? '',
                $r->reviewee->name ?? '',
                $r->periodIndicator->template->name ?? ($r->indicator->name ?? ''),
                $r->periodIndicator->template->weight ?? ($r->indicator->weight ?? ''),
                $rawScore,
                $convertedScore,
                $r->comment ?? '',
            ];
        })->toArray());
    }

    private function exportGradeConsistency($periodId): StreamedResponse
    {
        $checks = GradeConsistencyCheck::with(['group.title', 'student', 'checker'])
            ->whereHas('group', fn($q) => $q->where('period_id', $periodId))
            ->get();

        return $this->streamCsv('grade_consistency.csv', [
            'Group ID',
            'Title',
            'Student',
            'PDC1 Score',
            'PDC2 Score',
            'Deviation',
            'Status',
            'Checked By',
            'Notes'
        ], $checks->map(fn($c) => [
                $c->group_id,
                $c->group->title->title ?? '',
                $c->student->name ?? '',
                $c->pdc1_score ?? '',
                $c->pdc2_score ?? '',
                $c->deviation ?? '',
                $c->status,
                $c->checker->name ?? '',
                $c->notes ?? '',
            ])->toArray());
    }

    private function exportGroups($periodId): StreamedResponse
    {
        $groups = Group::where('period_id', $periodId)
            ->with(['title', 'members.student', 'supervisor1', 'supervisor2'])
            ->get();

        return $this->streamCsv('groups.csv', [
            'Group ID',
            'Title',
            'Status',
            'Mode',
            'Supervisor 1',
            'Supervisor 2',
            'Members'
        ], $groups->map(fn($g) => [
                $g->id,
                $g->title->title ?? '',
                $g->status,
                $g->group_mode ?? 'GROUP',
                $g->supervisor1->name ?? '',
                $g->supervisor2->name ?? '',
                $g->members->map(fn($m) => $m->student->name ?? '')->implode('; '),
            ])->toArray());
    }

    private function exportFinalGrades($periodId): StreamedResponse
    {
        $gradeService = new GradeCalculationService();

        // Get all groups in the period with their members
        $groups = Group::where('period_id', $periodId)
            ->with(['title', 'members.student'])
            ->get();

        $gradeRows = [];

        foreach ($groups as $group) {
            foreach ($group->members as $member) {
                $student = $member->student;
                if (!$student) continue;

                // Calculate grades for this student
                $pdc1Data = $gradeService->calculatePDC1ForStudent($student->id, $group->id);
                $pdc2Data = $gradeService->calculatePDC2ForStudent($student->id, $group->id);

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
                    $finalGrade = 0;
                }

                $letterGrade = $finalGrade > 0 ? $gradeService->getLetterGrade($finalGrade) : 'N/A';

                // Check if all components are complete
                $isComplete = $pdc1Data && $pdc2Data &&
                             $pdc1Data['status'] === 'COMPLETE' &&
                             $pdc2Data['status'] === 'COMPLETE';

                $gradeRows[] = [
                    'group_id' => $group->id,
                    'group_title' => $group->title->title ?? '',
                    'student_id' => $student->id,
                    'student_name' => $student->name,
                    'student_nim' => $student->nim ?? '',
                    'pdc1_score' => $pdc1Score > 0 ? number_format($pdc1Score, 2) : 'N/A',
                    'pdc2_score' => $pdc2Score > 0 ? number_format($pdc2Score, 2) : 'N/A',
                    'final_grade' => $finalGrade > 0 ? number_format($finalGrade, 2) : 'N/A',
                    'letter_grade' => $letterGrade,
                    'status' => $isComplete ? 'Complete' : 'Incomplete',
                ];
            }
        }

        return $this->streamCsv('final_grades.csv', [
            'Group ID',
            'Group Title',
            'Student ID',
            'Student Name',
            'NIM',
            'PDC1 Score',
            'PDC2 Score',
            'Final Grade',
            'Letter Grade',
            'Status'
        ], $gradeRows);
    }

    /**
     * Helper to stream CSV response.
     */
    private function streamCsv(string $filename, array $headers, array $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($headers, $rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }
}
