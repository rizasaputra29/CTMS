<?php

namespace App\Http\Controllers;

use App\Models\AssessmentScore;
use App\Models\PeerReview;
use App\Models\GradeConsistencyCheck;
use App\Models\Group;
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
            default => response()->json(['message' => 'Unknown report type'], 400),
        };
    }

    private function exportAssessments($periodId, $evalType = null): StreamedResponse
    {
        $query = AssessmentScore::with(['component', 'evaluator', 'student', 'group.title'])
            ->whereHas('group', fn($q) => $q->where('period_id', $periodId));

        if ($evalType) {
            $query->where('evaluation_type', $evalType);
        }

        $scores = $query->get();

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
        ], $scores->map(fn($s) => [
                $s->group->id ?? '',
                $s->group->title->title ?? '',
                $s->student->name ?? 'Group-level',
                $s->evaluator->name ?? '',
                $s->component->code ?? '',
                $s->component->name ?? '',
                $s->component->weight ?? '',
                $s->score,
                $s->evaluation_type,
                $s->notes ?? '',
            ])->toArray());
    }

    private function exportPeerReviews($periodId): StreamedResponse
    {
        $reviews = PeerReview::with(['reviewer', 'reviewee', 'indicator', 'group'])
            ->whereHas('group', fn($q) => $q->where('period_id', $periodId))
            ->get();

        return $this->streamCsv('peer_reviews.csv', [
            'Group ID',
            'Reviewer',
            'Reviewee',
            'Indicator',
            'Weight',
            'Score',
            'Comment'
        ], $reviews->map(fn($r) => [
                $r->group_id,
                $r->reviewer->name ?? '',
                $r->reviewee->name ?? '',
                $r->indicator->name ?? '',
                $r->indicator->weight ?? '',
                $r->score,
                $r->comment ?? '',
            ])->toArray());
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
