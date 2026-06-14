<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\PeriodAssessmentComponent;
use App\Models\SeminarSchedule;
use App\Repositories\AssessmentScoreRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WorkflowService
{
    const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'TA_DRAFT', 'EXPO'];

    const UNLOCK_RULES = [
        'PDC1' => null,
        'SEMPRO' => 'PDC1',
        'PDC2' => 'SEMPRO',
        'TA_DRAFT' => 'PDC2',
        'EXPO' => 'PDC2',
    ];

    const STATUS_GATES = [
        'PDC2' => 'SEMPRO_DONE',
        'TA_DRAFT' => 'PDC2_ACTIVE',
        'EXPO' => 'PDC2_READY_FOR_EXPO',
    ];

    protected GroupStateMachine $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    /**
     * Get the workflow status for a group (which phases are unlocked/completed).
     */
    public function getWorkflowData(Group $group, $documents, $allRequirements): array
    {
        $phases = [];

        foreach (self::PHASES as $phase) {
            $phaseDocs = $documents->where('phase', $phase);

            // Get required document types for this phase
            $reqs = $allRequirements->where('phase', $phase)->where('is_required', true);
            $requiredTypes = $reqs->pluck('name')->toArray();
            if (empty($requiredTypes)) {
                $requiredTypes = ['GENERAL'];
            }

            $typesStatus = [];
            $allApproved = true;
            $anyRejected = false;
            $anySubmitted = false;
            $uploadedCount = 0;

            foreach ($requiredTypes as $type) {
                $latestForType = $phaseDocs->where('document_type', $type)->sortByDesc('version')->first();
                if ($type === 'GENERAL' && empty($allRequirements->where('phase', $phase)->toArray())) {
                    $latestForType = $phaseDocs->sortByDesc('version')->first();
                }

                $status = 'missing';
                if ($latestForType) {
                    $status = $latestForType->status;
                    $uploadedCount++;
                    if ($status === 'REJECTED') {
                        $anyRejected = true;
                    }
                    if ($status === 'SUBMITTED') {
                        $anySubmitted = true;
                    }
                    if ($status !== 'APPROVED') {
                        $allApproved = false;
                    }
                } else {
                    $allApproved = false;
                }

                $typesStatus[] = [
                    'type' => $type,
                    'status' => $status,
                    'latest_document' => $latestForType,
                ];
            }

            $phaseStatus = 'locked';
            $prereq = self::UNLOCK_RULES[$phase];

            if ($prereq === null) {
                $phaseStatus = 'unlocked';
            } else {
                $prereqReqs = $allRequirements->where('phase', $prereq)->where('is_required', true)->pluck('name')->toArray();
                if (empty($prereqReqs)) {
                    $prereqReqs = ['GENERAL'];
                }

                $prereqAllApproved = true;
                foreach ($prereqReqs as $pType) {
                    $pDoc = $documents->where('phase', $prereq)->where('document_type', $pType)->where('status', 'APPROVED')->first();
                    if ($pType === 'GENERAL' && empty($allRequirements->where('phase', $prereq)->toArray())) {
                        $pDoc = $documents->where('phase', $prereq)->where('status', 'APPROVED')->first();
                    }
                    if (! $pDoc) {
                        $prereqAllApproved = false;
                        break;
                    }
                }

                if ($prereqAllApproved) {
                    $phaseStatus = 'unlocked';
                }
            }

            if ($phaseStatus === 'unlocked' && isset(self::STATUS_GATES[$phase])) {
                $minStatus = self::STATUS_GATES[$phase];
                if ($minStatus && ! $this->stateMachine->isAtLeast($group, $minStatus)) {
                    $phaseStatus = 'locked';
                }
            }

            if ($phaseStatus === 'unlocked') {
                if ($allApproved) {
                    if ($phase === 'SEMPRO') {
                        $semproStatus = $this->getSemproCompletionStatus($group);
                        if (! $semproStatus['schedule_exists'] || ! $semproStatus['all_examiners_submitted'] || ! $semproStatus['all_supervisors_submitted']) {
                            $phaseStatus = 'submitted';
                        } else {
                            $phaseStatus = 'completed';
                        }
                    } else {
                        $phaseStatus = 'completed';
                    }
                } elseif ($anyRejected) {
                    $phaseStatus = 'revision';
                } elseif ($anySubmitted) {
                    $phaseStatus = 'submitted';
                } elseif ($uploadedCount > 0) {
                    $phaseStatus = 'draft';
                }
            }

            $phases[] = [
                'phase' => $phase,
                'status' => $phaseStatus,
                'documents' => $typesStatus,
                'required_types' => $requiredTypes,
                'document_count' => $phaseDocs->count(),
            ];
        }

        $currentPhase = null;
        $isPeriodFinalized = $group->period && $group->period->is_finalized;
        $isPostFinalizationStatus = in_array($group->status, ['PDC1_ACTIVE', 'READY_FOR_SEMPRO', 'SEMPRO_DONE', 'PDC2_ACTIVE', 'PDC2_READY_FOR_EXPO', 'EXPO_REGISTERED', 'EXPO_DONE', 'READY_FOR_TA_INDIVIDUAL']);

        foreach ($phases as $p) {
            // For groups in post-finalization status, PDC1 should always be shown as current/completed
            // This ensures phase labels are correct after reopen/re-finalize cycles
            if ($isPostFinalizationStatus && $p['phase'] === 'PDC1' && $p['status'] === 'locked') {
                // Force PDC1 to be completed if group has progressed past finalization
                $p['status'] = 'completed';
            }

            if ($p['status'] !== 'completed') {
                $currentPhase = $p['phase'];
                break;
            }
        }

        $allCompleted = collect($phases)->every(fn ($p) => $p['status'] === 'completed');

        return [
            'phases' => $phases,
            'current_phase' => $currentPhase,
            'is_graduated' => $allCompleted,
        ];
    }

    /**
     * Get requirements for the next phase transition.
     */
    public function getNextPhaseRequirements(Group $group, array $phases, $allRequirements, $documents): ?array
    {
        $currentPhaseData = null;
        foreach ($phases as $p) {
            if ($p['status'] !== 'completed') {
                $currentPhaseData = $p;
                break;
            }
        }

        if (! $currentPhaseData) {
            return null;
        }

        $phase = $currentPhaseData['phase'];
        $nextPhase = $this->getNextPhase($phase);

        if (! $nextPhase) {
            return null;
        }

        $reqs = $allRequirements->where('phase', $phase)->where('is_required', true);
        $requiredTypes = $reqs->pluck('name')->toArray();
        if (empty($requiredTypes)) {
            $requiredTypes = ['GENERAL'];
        }

        $pendingDocs = [];
        $approvedDocs = 0;
        foreach ($requiredTypes as $type) {
            $latestForType = $documents->where('phase', $phase)
                ->where('document_type', $type)
                ->sortByDesc('version')
                ->first();

            if ($type === 'GENERAL' && empty($allRequirements->where('phase', $phase)->toArray())) {
                $latestForType = $documents->where('phase', $phase)->sortByDesc('version')->first();
            }

            if (! $latestForType || $latestForType->status !== 'APPROVED') {
                $pendingDocs[] = $type;
            } else {
                $approvedDocs++;
            }
        }

        $docsComplete = empty($pendingDocs);

        $supervisorData = null;
        $supervisorEvaluations = [];
        if ($phase === 'PDC2' && $group->status === 'PDC2_ACTIVE') {
            $supervisorEvaluations[] = $this->getSupervisorEvaluationStatus($group, 'NILAI_DOSEN');
            $supervisorEvaluations[] = $this->getSupervisorEvaluationStatus($group, 'MILESTONE');
            $supervisorData = $supervisorEvaluations[0];
        }

        $seminarSchedule = null;
        $examinerEvaluations = null;
        $supervisorBimbinganStatus = null;

        if ($phase === 'SEMPRO') {
            $semproStatus = $this->getSemproCompletionStatus($group);
            $seminarSchedule = $semproStatus['schedule'];
            $examinerEvaluations = $semproStatus['examiner_evaluations'];
            $supervisorBimbinganStatus = $semproStatus['supervisor_bimbingan'];
        }

        return [
            'current_phase' => $phase,
            'next_phase' => $nextPhase,
            'documents' => [
                'completed' => $docsComplete,
                'total_required' => count($requiredTypes),
                'approved_count' => $approvedDocs,
                'pending_types' => $pendingDocs,
            ],
            'supervisor_evaluation' => $supervisorData,
            'supervisor_evaluations' => $supervisorEvaluations,
            'seminar_schedule' => $seminarSchedule ? [
                'exists' => true,
                'date' => $seminarSchedule->date,
                'room' => $seminarSchedule->room,
                'start_time' => $seminarSchedule->start_time,
                'end_time' => $seminarSchedule->end_time,
                'examiners' => [
                    [
                        'id' => $seminarSchedule->examiner_1_id,
                        'name' => $seminarSchedule->examiner1?->name ?? 'Penguji 1',
                    ],
                    [
                        'id' => $seminarSchedule->examiner_2_id,
                        'name' => $seminarSchedule->examiner2?->name ?? 'Penguji 2',
                    ],
                ],
                'status' => $seminarSchedule->status,
                'examiner_evaluations' => $examinerEvaluations,
                'supervisor_bimbingan' => $supervisorBimbinganStatus,
                'is_ready_for_pdc2' => ($examinerEvaluations['pending'] ?? 1) === 0
                    && ($supervisorBimbinganStatus['all_submitted'] ?? false),
            ] : [
                'exists' => false,
                'message' => 'SEMPRO belum dijadwalkan',
            ],
        ];
    }

    /**
     * UI-only final gate for "Ready for TA Individual".
     */
    public function getFinalReadyForTaIndividual(Group $group, $allRequirements, $documents): array
    {
        // Check per-student EXPO documents
        $expoRegistration = \App\Models\ExpoRegistration::where('group_id', $group->id)
            ->where('status', '!=', 'CANCELLED')
            ->first();

        $studentCount = GroupMember::where('group_id', $group->id)->count();

        if ($expoRegistration) {
            $uploadedCount = \App\Models\ExpoStudentDocument::where('expo_registration_id', $expoRegistration->id)
                ->count();
            $expoDocsComplete = $uploadedCount >= $studentCount && $studentCount > 0;
            $pendingDocs = $expoDocsComplete ? [] : ['EXPO documents not uploaded by all students'];
        } else {
            $expoDocsComplete = false;
            $pendingDocs = ['No active expo registration'];
        }

        // Check EXPO self-evaluation from all students
        $studentIds = GroupMember::where('group_id', $group->id)->pluck('student_id')->toArray();
        $allStudentsEvaluated = true;
        foreach ($studentIds as $studentId) {
            $hasEvaluation = AssessmentScoreRepository::forType('EXPO')
                ->where('group_id', $group->id)
                ->where('evaluator_id', $studentId)
                ->where('student_id', $studentId)
                ->exists();
            if (! $hasEvaluation) {
                $allStudentsEvaluated = false;
                break;
            }
        }

        $nilaiDosen = $this->getSupervisorEvaluationStatus($group, 'NILAI_DOSEN');
        $milestone = $this->getSupervisorEvaluationStatus($group, 'MILESTONE');

        $hasNilaiDosenComponents = ($nilaiDosen['component_count'] ?? 0) > 0;
        $hasMilestoneComponents = ($milestone['component_count'] ?? 0) > 0;

        $nilaiDosenComplete = count($nilaiDosen['supervisors'] ?? []) > 0
            && $hasNilaiDosenComponents
            && (bool) ($nilaiDosen['completed'] ?? false);

        $milestoneComplete = count($milestone['supervisors'] ?? []) > 0
            && $hasMilestoneComponents
            && (bool) ($milestone['completed'] ?? false);

        $peerReviewStatus = $this->getPeerReviewRequirementStatus($group);

        return [
            'ready' => $expoDocsComplete
                && $allStudentsEvaluated
                && $nilaiDosenComplete
                && $milestoneComplete
                && $peerReviewStatus['configured']
                && $peerReviewStatus['completed'],
            'expo_documents' => [
                'completed' => $expoDocsComplete,
                'pending_types' => $pendingDocs,
                'total_required' => $studentCount,
                'approved_count' => $expoRegistration
                    ? \App\Models\ExpoStudentDocument::where('expo_registration_id', $expoRegistration->id)->count()
                    : 0,
            ],
            'expo_evaluation' => [
                'required' => true,
                'completed' => $allStudentsEvaluated && $studentCount > 0,
                'type' => 'self_evaluation',
                'students_completed' => $allStudentsEvaluated ? $studentCount : 0,
                'students_total' => $studentCount,
            ],
            'nilai_dosen' => [
                'required' => true,
                'configured' => $hasNilaiDosenComponents,
                'completed' => $nilaiDosenComplete,
                'component_count' => $nilaiDosen['component_count'] ?? 0,
                'supervisors' => $nilaiDosen['supervisors'] ?? [],
            ],
            'milestone' => [
                'required' => true,
                'configured' => $hasMilestoneComponents,
                'completed' => $milestoneComplete,
                'component_count' => $milestone['component_count'] ?? 0,
                'supervisors' => $milestone['supervisors'] ?? [],
            ],
            'peer_review' => [
                'required' => true,
                'configured' => $peerReviewStatus['configured'],
                'completed' => $peerReviewStatus['completed'],
                'indicator_count' => $peerReviewStatus['indicator_count'],
                'total_members' => $peerReviewStatus['total_members'],
                'completed_members' => $peerReviewStatus['completed_members'],
                'incomplete_students' => $peerReviewStatus['incomplete_students'],
            ],
        ];
    }

    /**
     * Get SEMPRO completion status.
     */
    private function getSemproCompletionStatus(Group $group): array
    {
        $schedule = SeminarSchedule::with(['examiner1', 'examiner2', 'evaluations.examiner'])
            ->where('group_id', $group->id)
            ->where('type', 'SEMPRO')
            ->whereIn('status', ['SCHEDULED', 'ONGOING', 'COMPLETED'])
            ->first();

        if (! $schedule) {
            return [
                'schedule_exists' => false,
                'schedule' => null,
                'all_examiners_submitted' => false,
                'all_supervisors_submitted' => false,
                'examiner_evaluations' => null,
                'supervisor_bimbingan' => null,
            ];
        }

        $evaluations = $schedule->evaluations;
        $totalExaminers = $evaluations->count();
        $submittedExaminers = $evaluations->where('status', 'SUBMITTED')->count();
        $allExaminersSubmitted = $totalExaminers > 0 && $submittedExaminers >= $totalExaminers;

        $examinerEvaluations = [
            'total' => $totalExaminers,
            'submitted' => $submittedExaminers,
            'pending' => max($totalExaminers - $submittedExaminers, 0),
            'examiners' => $evaluations->map(fn ($eval) => [
                'id' => $eval->examiner_id,
                'name' => $eval->examiner?->name ?? 'Penguji',
                'status' => $eval->status,
            ])->toArray(),
        ];

        $componentCount = Schema::hasTable('period_assessment_components')
            ? PeriodAssessmentComponent::where('period_id', $group->period_id)->where('type', 'BIMBINGAN_SEMPRO')->count()
            : \App\Models\AssessmentComponent::where('period_id', $group->period_id)->where('type', 'BIMBINGAN_SEMPRO')->count();

        $studentCount = GroupMember::where('group_id', $group->id)->count();
        $expectedScores = $componentCount * $studentCount;

        $supervisorIds = array_filter([$group->supervisor_1_id, $group->supervisor_2_id]);
        $supervisorRows = [];
        $allSupervisorsSubmitted = ! empty($supervisorIds) && $componentCount > 0;

        foreach ($supervisorIds as $supervisorId) {
            $supervisor = \App\Models\User::find($supervisorId);
            $submittedScores = AssessmentScoreRepository::forType('BIMBINGAN_SEMPRO')
                ->where('group_id', $group->id)
                ->where('evaluator_id', $supervisorId)
                ->count();
            $isComplete = $expectedScores > 0 && $submittedScores >= $expectedScores;
            if (! $isComplete) {
                $allSupervisorsSubmitted = false;
            }

            $supervisorRows[] = [
                'id' => $supervisorId,
                'name' => $supervisor?->name ?? 'Pembimbing',
                'role' => $supervisorId === $group->supervisor_1_id ? 'SUPERVISOR_1' : 'SUPERVISOR_2',
                'status' => $isComplete ? 'completed' : 'pending',
                'submitted_components' => $submittedScores,
                'total_components' => $expectedScores,
            ];
        }

        return [
            'schedule_exists' => true,
            'schedule' => $schedule,
            'all_examiners_submitted' => $allExaminersSubmitted,
            'all_supervisors_submitted' => $allSupervisorsSubmitted,
            'examiner_evaluations' => $examinerEvaluations,
            'supervisor_bimbingan' => [
                'required' => true,
                'evaluation_type' => 'BIMBINGAN_SEMPRO',
                'component_count' => $componentCount,
                'all_submitted' => $allSupervisorsSubmitted,
                'supervisors' => $supervisorRows,
            ],
        ];
    }

    /**
     * Get supervisor evaluation status for a group.
     */
    public function getSupervisorEvaluationStatus(Group $group, string $evalType): array
    {
        $periodId = $group->period_id;
        if (Schema::hasTable('period_assessment_components')) {
            $componentCount = PeriodAssessmentComponent::where('period_id', $periodId)
                ->where('type', $evalType)
                ->count();
        } else {
            $componentCount = \App\Models\AssessmentComponent::where('period_id', $periodId)
                ->where('type', $evalType)
                ->count();
        }

        $studentCount = GroupMember::where('group_id', $group->id)->count();
        $expectedScores = $componentCount * $studentCount;

        $supervisors = [];
        $allComplete = true;

        if ($group->supervisor_1_id) {
            $sup1 = \App\Models\User::find($group->supervisor_1_id);
            $scores1 = AssessmentScoreRepository::forType($evalType)
                ->where('group_id', $group->id)
                ->where('evaluator_id', $group->supervisor_1_id)
                ->count();
            $isComplete1 = $expectedScores > 0 ? $scores1 >= $expectedScores : true;
            $supervisors[] = [
                'id' => $group->supervisor_1_id,
                'name' => $sup1?->name ?? 'Pembimbing 1',
                'role' => 'SUPERVISOR_1',
                'status' => $isComplete1 ? 'completed' : 'pending',
                'submitted_components' => $scores1,
                'total_components' => $expectedScores,
            ];
            if (! $isComplete1) {
                $allComplete = false;
            }
        }

        if ($group->supervisor_2_id) {
            $sup2 = \App\Models\User::find($group->supervisor_2_id);
            $scores2 = AssessmentScoreRepository::forType($evalType)
                ->where('group_id', $group->id)
                ->where('evaluator_id', $group->supervisor_2_id)
                ->count();
            $isComplete2 = $expectedScores > 0 ? $scores2 >= $expectedScores : true;
            $supervisors[] = [
                'id' => $group->supervisor_2_id,
                'name' => $sup2?->name ?? 'Pembimbing 2',
                'role' => 'SUPERVISOR_2',
                'status' => $isComplete2 ? 'completed' : 'pending',
                'submitted_components' => $scores2,
                'total_components' => $expectedScores,
            ];
            if (! $isComplete2) {
                $allComplete = false;
            }
        }

        return [
            'evaluation_type' => $evalType,
            'completed' => $allComplete,
            'component_count' => $componentCount,
            'supervisors' => $supervisors,
        ];
    }

    /**
     * Get peer review requirement status for final TA readiness.
     */
    private function getPeerReviewRequirementStatus(Group $group): array
    {
        $memberRows = GroupMember::with('student')
            ->where('group_id', $group->id)
            ->get();
        $totalMembers = $memberRows->count();

        $hasNewIndicators = Schema::hasTable('period_peer_review_indicators');
        $hasLegacyIndicators = Schema::hasTable('peer_review_indicators');
        $hasPeerReviews = Schema::hasTable('peer_reviews');
        $hasStudentStatus = Schema::hasTable('student_peer_review_status');

        $indicatorCount = 0;
        if ($hasNewIndicators) {
            $indicatorCount = DB::table('period_peer_review_indicators')
                ->where('period_id', $group->period_id)
                ->count();
        } elseif ($hasLegacyIndicators) {
            $indicatorCount = DB::table('peer_review_indicators')
                ->where('period_id', $group->period_id)
                ->count();
        }

        $configured = $indicatorCount > 0;
        if (! $configured || $totalMembers === 0) {
            return [
                'configured' => $configured,
                'completed' => false,
                'indicator_count' => $indicatorCount,
                'total_members' => $totalMembers,
                'completed_members' => 0,
                'incomplete_students' => $memberRows->map(fn ($m) => [
                    'student_id' => $m->student_id,
                    'student_name' => $m->student?->name,
                    'student_nim' => $m->student?->nim,
                ])->values()->all(),
            ];
        }

        $completedStudentIds = [];

        if ($hasStudentStatus) {
            $completedStudentIds = DB::table('student_peer_review_status')
                ->where('group_id', $group->id)
                ->where('has_completed_peer_review', true)
                ->pluck('student_id')
                ->all();
        } elseif ($hasPeerReviews) {
            $useFinalSubmission = Schema::hasColumn('peer_reviews', 'is_final_submission');
            $expected = $indicatorCount * max($totalMembers - 1, 0);

            if ($expected === 0) {
                $completedStudentIds = $memberRows->pluck('student_id')->all();
            } else {
                $query = DB::table('peer_reviews')
                    ->where('group_id', $group->id)
                    ->whereIn('reviewer_id', $memberRows->pluck('student_id'));

                if ($useFinalSubmission) {
                    $query->where('is_final_submission', true);
                }

                $reviewerCounts = $query
                    ->groupBy('reviewer_id')
                    ->selectRaw('reviewer_id, COUNT(*) as count')
                    ->pluck('count', 'reviewer_id')
                    ->all();

                foreach ($memberRows as $member) {
                    $submitted = $reviewerCounts[$member->student_id] ?? 0;
                    if ($submitted >= $expected) {
                        $completedStudentIds[] = $member->student_id;
                    }
                }
            }
        }

        $completedCount = count($completedStudentIds);
        $completed = $completedCount === $totalMembers;

        $incompleteStudents = $memberRows
            ->filter(fn ($m) => ! in_array((int) $m->student_id, $completedStudentIds, true))
            ->map(fn ($m) => [
                'student_id' => $m->student_id,
                'student_name' => $m->student?->name,
                'student_nim' => $m->student?->nim,
            ])
            ->values()
            ->all();

        return [
            'configured' => true,
            'completed' => $completed,
            'indicator_count' => $indicatorCount,
            'total_members' => $totalMembers,
            'completed_members' => $completedCount,
            'incomplete_students' => $incompleteStudents,
        ];
    }

    /**
     * Get the next phase in the workflow.
     */
    private function getNextPhase(string $currentPhase): ?string
    {
        $index = array_search($currentPhase, self::PHASES);
        if ($index === false || $index >= count(self::PHASES) - 1) {
            return null;
        }

        return self::PHASES[$index + 1];
    }
}
