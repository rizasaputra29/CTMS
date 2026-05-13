<?php

namespace App\Http\Controllers;

use App\Repositories\AssessmentScoreRepository;
use App\Models\PeerReview;
use App\Models\GradeConsistencyCheck;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\User;
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

    /**
     * Export assessments in matrix format (like web report)
     * Columns: Student Name, Group, SEMPRO, BIMBINGAN, SIDANG_TA, BIMBINGAN_TA, EXPO, MILESTONE, NILAI_DOSEN
     */
    private function exportAssessments($periodId, $evalType = null): StreamedResponse
    {
        // Get all students in the period
        $students = User::whereHas('groupMemberships.group', function ($q) use ($periodId) {
            $q->where('period_id', $periodId);
        })
        ->with(['groupMemberships' => function ($q) use ($periodId) {
            $q->whereHas('group', function ($gq) use ($periodId) {
                $gq->where('period_id', $periodId);
            })->with('group.title');
        }])
        ->get()
        ->keyBy('id');

        // Collect all evaluation data for each student
        $studentData = [];

        foreach ($students as $student) {
            $membership = $student->groupMemberships->first();
            $group = $membership ? $membership->group : null;
            
            $studentData[$student->id] = [
                'student_id' => $student->id,
                'student_name' => $student->name,
                'student_nim' => $student->nim ?? '',
                'group_id' => $group ? $group->id : '',
                'group_name' => $group && $group->title ? $group->title->title : ($group ? 'Group ' . $group->id : ''),
                'evaluations' => [
                    'SEMPRO' => ['score' => null, 'status' => 'NOT_STARTED'],
                    'BIMBINGAN_SEMPRO' => ['score' => null, 'status' => 'NOT_STARTED'],
                    'SIDANG_TA' => ['score' => null, 'status' => 'NOT_STARTED'],
                    'BIMBINGAN_TA' => ['score' => null, 'status' => 'NOT_STARTED'],
                    'EXPO' => ['score' => null, 'status' => 'NOT_STARTED'],
                    'MILESTONE' => ['score' => null, 'status' => 'NOT_STARTED'],
                    'NILAI_DOSEN' => ['score' => null, 'status' => 'NOT_STARTED'],
                ],
            ];
        }

        // Fetch scores for each evaluation type
        $types = $evalType ? [$evalType] : AssessmentScoreRepository::getSupportedTypes();
        
        foreach ($types as $type) {
            if (!AssessmentScoreRepository::isSupportedType($type)) {
                continue;
            }

            // Get group IDs for this period
            $groupIds = Group::where('period_id', $periodId)->pluck('id');
            
            if ($groupIds->isEmpty()) {
                continue;
            }

            // Fetch all scores for this type in the period
            $scores = AssessmentScoreRepository::forType($type)
                ->whereIn('group_id', $groupIds)
                ->get();

            // Group scores by student and calculate average
            $studentScores = [];
            foreach ($scores as $score) {
                $studentId = $score->student_id;
                if (!isset($studentScores[$studentId])) {
                    $studentScores[$studentId] = [];
                }
                $studentScores[$studentId][] = $score->score;
            }

            // Update student data
            foreach ($studentScores as $studentId => $scores) {
                if (!isset($studentData[$studentId])) {
                    continue;
                }
                
                $avgScore = array_sum($scores) / count($scores);
                $studentData[$studentId]['evaluations'][$type] = [
                    'score' => round($avgScore),
                    'status' => 'COMPLETE',
                ];
            }
        }

        // Build CSV rows
        $csvRows = [];
        foreach ($studentData as $data) {
            $row = [
                $data['student_name'],
                $data['group_name'],
            ];

            // Add evaluation columns
            $evalTypes = ['SEMPRO', 'BIMBINGAN_SEMPRO', 'SIDANG_TA', 'BIMBINGAN_TA', 'EXPO', 'MILESTONE', 'NILAI_DOSEN'];
            foreach ($evalTypes as $evalType) {
                $eval = $data['evaluations'][$evalType];
                $score = $eval['score'];
                $status = $eval['status'];
                
                if ($score === null) {
                    $row[] = 'N/A';
                } else {
                    $row[] = $score;
                }
                $row[] = $status;
            }

            $csvRows[] = $row;
        }

        return $this->streamCsv('assessments.csv', [
            'Student Name',
            'Group',
            'SEMPRO Score',
            'SEMPRO Status',
            'BIMBINGAN Score',
            'BIMBINGAN Status',
            'SIDANG TA Score',
            'SIDANG TA Status',
            'BIMBINGAN TA Score',
            'BIMBINGAN TA Status',
            'EXPO Score',
            'EXPO Status',
            'MILESTONE Score',
            'MILESTONE Status',
            'NILAI DOSEN Score',
            'NILAI DOSEN Status',
        ], $csvRows);
    }

    /**
     * Export peer reviews in list format (like web report)
     * Columns: Date, Group, Reviewer, Reviewee, Indicator Code, Indicator Name, Raw Score (1-4), Converted Score (0-100), Comment
     */
    private function exportPeerReviews($periodId): StreamedResponse
    {
        $reviews = PeerReview::with(['reviewer', 'reviewee', 'periodIndicator.template', 'group.title'])
            ->whereHas('group', fn($q) => $q->where('period_id', $periodId))
            ->where('is_final_submission', true)
            ->orderBy('created_at', 'desc')
            ->get();

        $csvRows = $reviews->map(function($r) {
            $rawScore = $r->raw_score;
            $convertedScore = $r->score;
            
            // Determine score interpretation
            $rawInterpretation = match(true) {
                $rawScore >= 4 => 'Excellent',
                $rawScore >= 3 => 'Good',
                $rawScore >= 2 => 'Fair',
                default => 'Poor',
            };
            
            return [
                $r->created_at ? date('Y-m-d', strtotime($r->created_at)) : '',
                $r->group && $r->group->title ? $r->group->title->title : ($r->group ? 'Group ' . $r->group_id : ''),
                $r->reviewer->name ?? '',
                $r->reviewee->name ?? '',
                $r->periodIndicator->template->code ?? '',
                $r->periodIndicator->template->name ?? '',
                $rawScore,
                $rawInterpretation,
                $convertedScore,
                $r->comment ?? '',
            ];
        })->toArray();

        return $this->streamCsv('peer_reviews.csv', [
            'Date',
            'Group',
            'Reviewer',
            'Reviewee',
            'Indicator Code',
            'Indicator Name',
            'Raw Score (1-4)',
            'Interpretation',
            'Converted Score (0-100)',
            'Comment'
        ], $csvRows);
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
                $g->members->map(fn($m) => ($m->student->name ?? '') . ' (' . ($m->student->nim ?? '') . ')')->implode('; '),
            ])->toArray());
    }

    /**
     * Export final grades in summary format (like web report)
     * Columns: Group, Student, NIM, PDC1 Score, PDC1 Status, PDC2 Score, PDC2 Status, TA Score, TA Status
     */
    private function exportFinalGrades($periodId): StreamedResponse
    {
        $gradeService = new GradeCalculationService();

        // Get all groups in the period with their members
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

        // Pre-calculate all grades using batch methods
        $pdc1Results = $gradeService->calculatePDC1ForStudentsBatch($studentGroupPairs);
        $pdc2Results = $gradeService->calculatePDC2ForStudentsBatch($studentGroupPairs);
        $taResults = $gradeService->calculateSidangTAForStudentsBatch($studentGroupPairs);

        // Build CSV rows
        $gradeRows = [];
        foreach ($studentGroupPairs as $pair) {
            $studentId = $pair['student_id'];
            $info = $studentInfo[$studentId];
            $student = $info['student'];
            $group = $info['group'];
            
            $pdc1Data = $pdc1Results[$studentId] ?? null;
            $pdc2Data = $pdc2Results[$studentId] ?? null;
            $taData = $taResults[$studentId] ?? null;

            $pdc1Score = $pdc1Data && isset($pdc1Data['grade']) ? $pdc1Data['grade'] : null;
            $pdc2Score = $pdc2Data && isset($pdc2Data['grade']) ? $pdc2Data['grade'] : null;
            $taScore = $taData && isset($taData['grade']) ? $taData['grade'] : null;

            $gradeRows[] = [
                $group->title->title ?? ($group ? 'Group ' . $group->id : ''),
                $student->name,
                $student->nim ?? '',
                $pdc1Score !== null ? number_format($pdc1Score, 1) : 'N/A',
                $pdc1Data && isset($pdc1Data['status']) && $pdc1Data['status'] === 'COMPLETE' ? 'Complete' : 'Incomplete',
                $pdc2Score !== null ? number_format($pdc2Score, 1) : 'N/A',
                $pdc2Data && isset($pdc2Data['status']) && $pdc2Data['status'] === 'COMPLETE' ? 'Complete' : 'Incomplete',
                $taScore !== null ? number_format($taScore, 1) : 'N/A',
                $taData && isset($taData['status']) && $taData['status'] === 'COMPLETE' ? 'Complete' : 'Incomplete',
            ];
        }

        return $this->streamCsv('final_grades.csv', [
            'Group',
            'Student',
            'NIM',
            'PDC1 Score',
            'PDC1 Status',
            'PDC2 Score',
            'PDC2 Status',
            'TA Score',
            'TA Status'
        ], $gradeRows);
    }

    /**
     * Helper to stream CSV response with CORS headers.
     */
    private function streamCsv(string $filename, array $headers, array $rows): StreamedResponse
    {
        $response = new StreamedResponse(function () use ($headers, $rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        });

        $response->headers->set('Content-Type', 'text/csv');
        $response->headers->set('Content-Disposition', 'attachment; filename="' . $filename . '"');
        $response->headers->set('Access-Control-Allow-Origin', 'http://localhost:3000');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        $response->headers->set('Access-Control-Allow-Credentials', 'true');

        return $response;
    }
}
