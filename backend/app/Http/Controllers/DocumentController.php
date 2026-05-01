<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\TaSubmission;
use App\Services\GroupStateMachine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use App\Models\PhaseDocumentRequirement;

class DocumentController extends Controller
{
    protected GroupStateMachine $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    // Workflow phase order
    const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'TA_DRAFT', 'EXPO'];

    // Unlock rules: phase => prerequisite phase that must be APPROVED
    const UNLOCK_RULES = [
        'PDC1' => null,              // Always unlocked if group is APPROVED
        'SEMPRO' => 'PDC1',          // PDC1 approved → unlock Sempro
        'PDC2' => 'SEMPRO',          // Sempro approved → unlock PDC2
        'TA_DRAFT' => 'PDC2',        // PDC2 approved → unlock TA_DRAFT
        'EXPO' => 'PDC2',            // PDC2 approved → unlock EXPO
    ];

    /**
     * Status gates for phases that require specific group status beyond document approval.
     * phase => minimum required group status (must be at this status or later)
     */
    const STATUS_GATES = [
        'PDC2' => 'SEMPRO_DONE',           // PDC2 requires SEMPRO_DONE status
        'TA_DRAFT' => 'PDC2_ACTIVE',       // TA_DRAFT requires PDC2_ACTIVE status
        'EXPO' => 'PDC2_READY_FOR_EXPO',   // EXPO requires PDC2_READY_FOR_EXPO status
    ];

    /**
     * Get the workflow status for a group (which phases are unlocked/completed).
     */
    public function workflow(Request $request)
    {
        $user = Auth::user();
        $groupMember = GroupMember::with('group')->where('student_id', $user->id)->first();

        if (!$groupMember || !$groupMember->group) {
            return response()->json(['phases' => [], 'current_phase' => null]);
        }

        $periodId = $groupMember->group->period_id;
        $allRequirements = PhaseDocumentRequirement::where('period_id', $periodId)->get();
        $documents = Document::where('group_id', $groupMember->group_id)->get();
        $phases = [];

        foreach (self::PHASES as $phase) {
            $phaseDocs = $documents->where('phase', $phase);

            // Get required document types for this phase
            $reqs = $allRequirements->where('phase', $phase)->where('is_required', true);
            $requiredTypes = $reqs->pluck('name')->toArray();
            if (empty($requiredTypes)) {
                $requiredTypes = ['GENERAL']; // Fallback if no specific requirements
            }

            $typesStatus = [];
            $allApproved = true;
            $anyRejected = false;
            $anySubmitted = false;
            $uploadedCount = 0;

            foreach ($requiredTypes as $type) {
                // Find latest document for this specific type
                $latestForType = $phaseDocs->where('document_type', $type)->sortByDesc('version')->first();
                // If it's the fallback 'GENERAL', we might just look at the first doc without a specific type
                if ($type === 'GENERAL' && empty($allRequirements->where('phase', $phase)->toArray())) {
                    $latestForType = $phaseDocs->sortByDesc('version')->first();
                }

                $status = 'missing';
                if ($latestForType) {
                    $status = $latestForType->status;
                    $uploadedCount++;
                    if ($status === 'REJECTED')
                        $anyRejected = true;
                    if ($status === 'SUBMITTED')
                        $anySubmitted = true;
                    if ($status !== 'APPROVED')
                        $allApproved = false;
                } else {
                    $allApproved = false;
                }

                $typesStatus[] = [
                    'type' => $type,
                    'status' => $status,
                    'latest_document' => $latestForType
                ];
            }


            $phaseStatus = 'locked';
            $prereq = self::UNLOCK_RULES[$phase];

            // Check if unlocked based on prereq
            if ($prereq === null) {
                $phaseStatus = 'unlocked';
            } else {
                // Prerequisite must be fully approved based on its own requirements
                $prereqReqs = $allRequirements->where('phase', $prereq)->where('is_required', true)->pluck('name')->toArray();
                if (empty($prereqReqs))
                    $prereqReqs = ['GENERAL'];

                $prereqAllApproved = true;
                foreach ($prereqReqs as $pType) {
                    $pDoc = $documents->where('phase', $prereq)->where('document_type', $pType)->where('status', 'APPROVED')->first();
                    if ($pType === 'GENERAL' && empty($allRequirements->where('phase', $prereq)->toArray())) {
                        $pDoc = $documents->where('phase', $prereq)->where('status', 'APPROVED')->first();
                    }
                    if (!$pDoc) {
                        $prereqAllApproved = false;
                        break;
                    }
                }

                if ($prereqAllApproved) {
                    $phaseStatus = 'unlocked';
                }
            }

            // Additional status gate check for phases that require specific group status
            // (Option B: dual-gate unlock - requires both document approval AND status gate)
            if ($phaseStatus === 'unlocked' && isset(self::STATUS_GATES[$phase])) {
                $group = $groupMember->group;
                $minStatus = self::STATUS_GATES[$phase];
                if ($minStatus && !$this->stateMachine->isAtLeast($group, $minStatus)) {
                    $phaseStatus = 'locked';
                }
            }

            // Determine overall phase status if unlocked
            if ($phaseStatus === 'unlocked') {
                if ($allApproved) {
                    // For SEMPRO, phase only completes when docs + examiner + supervisor evaluations are complete.
                    if ($phase === 'SEMPRO') {
                        $semproStatus = $this->getSemproCompletionStatus($groupMember->group);
                        if (!$semproStatus['schedule_exists'] || !$semproStatus['all_examiners_submitted'] || !$semproStatus['all_supervisors_submitted']) {
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

        // Determine current phase
        $currentPhase = null;
        foreach ($phases as $p) {
            if ($p['status'] !== 'completed') {
                $currentPhase = $p['phase'];
                break;
            }
        }

        // Check if all done = GRADUATED
        $allCompleted = collect($phases)->every(fn($p) => $p['status'] === 'completed');

        // Get next phase requirements
        $nextPhaseRequirements = $this->getNextPhaseRequirements($groupMember->group, $phases, $allRequirements, $documents);
        $finalReadyForTaIndividual = $this->getFinalReadyForTaIndividual($groupMember->group, $allRequirements, $documents);

        return response()->json([
            'phases' => $phases,
            'current_phase' => $currentPhase,
            'is_graduated' => $allCompleted,
            'next_phase_requirements' => $nextPhaseRequirements,
            'final_ready_for_ta_individual' => $finalReadyForTaIndividual,
        ]);
    }

    /**
     * UI-only final gate for "Ready for TA Individual".
     * This does not change group state and does not block EXPO registration.
     */
    private function getFinalReadyForTaIndividual(Group $group, $allRequirements, $documents): array
    {
        $expoReqs = $allRequirements->where('phase', 'EXPO')->where('is_required', true);
        $requiredTypes = $expoReqs->pluck('name')->toArray();
        if (empty($requiredTypes)) {
            $requiredTypes = ['GENERAL'];
        }

        $pendingDocs = [];
        foreach ($requiredTypes as $type) {
            $latestForType = $documents->where('phase', 'EXPO')
                ->where('document_type', $type)
                ->sortByDesc('version')
                ->first();

            if ($type === 'GENERAL' && empty($allRequirements->where('phase', 'EXPO')->toArray())) {
                $latestForType = $documents->where('phase', 'EXPO')->sortByDesc('version')->first();
            }

            if (!$latestForType || $latestForType->status !== 'APPROVED') {
                $pendingDocs[] = $type;
            }
        }

        $expoDocsComplete = empty($pendingDocs);

        $nilaiDosen = $this->getSupervisorEvaluationStatus($group, 'NILAI_DOSEN');
        $milestone = $this->getSupervisorEvaluationStatus($group, 'MILESTONE');
        $expoEvaluation = $this->getSupervisorEvaluationStatus($group, 'EXPO');

        $hasNilaiDosenComponents = ($nilaiDosen['component_count'] ?? 0) > 0;
        $hasMilestoneComponents = ($milestone['component_count'] ?? 0) > 0;
        $hasExpoComponents = ($expoEvaluation['component_count'] ?? 0) > 0;

        $nilaiDosenComplete = count($nilaiDosen['supervisors'] ?? []) > 0
            && $hasNilaiDosenComponents
            && (bool) ($nilaiDosen['completed'] ?? false);

        $milestoneComplete = count($milestone['supervisors'] ?? []) > 0
            && $hasMilestoneComponents
            && (bool) ($milestone['completed'] ?? false);

        $expoEvaluationComplete = count($expoEvaluation['supervisors'] ?? []) > 0
            && $hasExpoComponents
            && (bool) ($expoEvaluation['completed'] ?? false);

        $peerReviewStatus = $this->getPeerReviewRequirementStatus($group);

        return [
            'ready' => $expoDocsComplete
                && $nilaiDosenComplete
                && $milestoneComplete
                && $expoEvaluationComplete
                && $peerReviewStatus['configured']
                && $peerReviewStatus['completed'],
            'expo_documents' => [
                'completed' => $expoDocsComplete,
                'pending_types' => $pendingDocs,
                'total_required' => count($requiredTypes),
                'approved_count' => count($requiredTypes) - count($pendingDocs),
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
            'expo_evaluation' => [
                'required' => true,
                'configured' => $hasExpoComponents,
                'completed' => $expoEvaluationComplete,
                'component_count' => $expoEvaluation['component_count'] ?? 0,
                'supervisors' => $expoEvaluation['supervisors'] ?? [],
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
     * Schema-compatible peer review requirement status for final TA readiness.
     * Supports both legacy (peer_review_indicators/peer_reviews) and new schema
     * (period_peer_review_indicators/student_peer_review_status).
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
            $indicatorCount = (int) DB::table('period_peer_review_indicators')
                ->where('period_id', $group->period_id)
                ->count();
        } elseif ($hasLegacyIndicators) {
            $indicatorCount = (int) DB::table('peer_review_indicators')
                ->where('period_id', $group->period_id)
                ->count();
        }

        $configured = $indicatorCount > 0;
        if (!$configured || $totalMembers === 0) {
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
                ->map(fn ($id) => (int) $id)
                ->all();
        } elseif ($hasPeerReviews) {
            $useFinalSubmission = Schema::hasColumn('peer_reviews', 'is_final_submission');
            foreach ($memberRows as $member) {
                $expected = $indicatorCount * max($totalMembers - 1, 0);
                if ($expected === 0) {
                    $completedStudentIds[] = (int) $member->student_id;
                    continue;
                }

                $query = DB::table('peer_reviews')
                    ->where('group_id', $group->id)
                    ->where('reviewer_id', $member->student_id);

                if ($useFinalSubmission) {
                    $query->where('is_final_submission', true);
                }

                $submitted = (int) $query->count();
                if ($submitted >= $expected) {
                    $completedStudentIds[] = (int) $member->student_id;
                }
            }
        }

        $completedCount = count($completedStudentIds);
        $completed = $completedCount === $totalMembers;

        $incompleteStudents = $memberRows
            ->filter(fn ($m) => !in_array((int) $m->student_id, $completedStudentIds, true))
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
     * Get requirements for the next phase transition.
     */
    private function getNextPhaseRequirements(Group $group, array $phases, $allRequirements, $documents): ?array
    {
        // Find the current incomplete phase
        $currentPhaseData = null;
        foreach ($phases as $p) {
            if ($p['status'] !== 'completed') {
                $currentPhaseData = $p;
                break;
            }
        }

        if (!$currentPhaseData) {
            return null; // All phases completed
        }

        $phase = $currentPhaseData['phase'];
        $nextPhase = $this->getNextPhase($phase);

        if (!$nextPhase) {
            return null; // No next phase (final phase)
        }

        // Get pending documents
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

            if (!$latestForType || $latestForType->status !== 'APPROVED') {
                $pendingDocs[] = $type;
            } else {
                $approvedDocs++;
            }
        }

        $docsComplete = empty($pendingDocs);

        // Get supervisor evaluation requirements
        $supervisorData = null;
        $supervisorEvaluations = [];
        if ($phase === 'PDC2' && $group->status === 'PDC2_ACTIVE') {
            $supervisorEvaluations[] = $this->getSupervisorEvaluationStatus($group, 'NILAI_DOSEN');
            $supervisorEvaluations[] = $this->getSupervisorEvaluationStatus($group, 'MILESTONE');
            $supervisorData = $supervisorEvaluations[0]; // backward compatibility
        }

        // Get seminar schedule info for SEMPRO phase
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

    private function getSemproCompletionStatus(Group $group): array
    {
        $schedule = \App\Models\SeminarSchedule::with(['examiner1', 'examiner2', 'evaluations.examiner'])
            ->where('group_id', $group->id)
            ->where('type', 'SEMPRO')
            ->whereIn('status', ['SCHEDULED', 'ONGOING', 'COMPLETED'])
            ->first();

        if (!$schedule) {
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
            'examiners' => $evaluations->map(fn($eval) => [
                'id' => $eval->examiner_id,
                'name' => $eval->examiner?->name ?? 'Penguji',
                'status' => $eval->status,
            ])->toArray(),
        ];

        $componentCount = Schema::hasTable('period_assessment_components')
            ? \App\Models\PeriodAssessmentComponent::where('period_id', $group->period_id)->where('type', 'BIMBINGAN_SEMPRO')->count()
            : \App\Models\AssessmentComponent::where('period_id', $group->period_id)->where('type', 'BIMBINGAN_SEMPRO')->count();

        $studentCount = \App\Models\GroupMember::where('group_id', $group->id)->count();
        $expectedScores = $componentCount * $studentCount;

        $supervisorIds = array_filter([$group->supervisor_1_id, $group->supervisor_2_id]);
        $supervisorRows = [];
        $allSupervisorsSubmitted = !empty($supervisorIds) && $componentCount > 0;

        foreach ($supervisorIds as $supervisorId) {
            $supervisor = \App\Models\User::find($supervisorId);
            $submittedScores = \App\Models\AssessmentScore::where('group_id', $group->id)
                ->where('evaluator_id', $supervisorId)
                ->where('evaluation_type', 'BIMBINGAN_SEMPRO')
                ->count();
            $isComplete = $expectedScores > 0 && $submittedScores >= $expectedScores;
            if (!$isComplete) {
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

    /**
     * Get supervisor evaluation status for a group.
     */
    private function getSupervisorEvaluationStatus(Group $group, string $evalType): array
    {
        // Get expected component count
        $periodId = $group->period_id;
        if (Schema::hasTable('period_assessment_components')) {
            $componentCount = \App\Models\PeriodAssessmentComponent::where('period_id', $periodId)
                ->where('type', $evalType)
                ->count();
        } else {
            $componentCount = \App\Models\AssessmentComponent::where('period_id', $periodId)
                ->where('type', $evalType)
                ->count();
        }

        $studentCount = \App\Models\GroupMember::where('group_id', $group->id)->count();
        $expectedScores = $componentCount * $studentCount;

        // Get supervisors
        $supervisors = [];
        $allComplete = true;

        if ($group->supervisor_1_id) {
            $sup1 = \App\Models\User::find($group->supervisor_1_id);
            $scores1 = \App\Models\AssessmentScore::where('group_id', $group->id)
                ->where('evaluator_id', $group->supervisor_1_id)
                ->where('evaluation_type', $evalType)
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
            if (!$isComplete1) $allComplete = false;
        }

        if ($group->supervisor_2_id) {
            $sup2 = \App\Models\User::find($group->supervisor_2_id);
            $scores2 = \App\Models\AssessmentScore::where('group_id', $group->id)
                ->where('evaluator_id', $group->supervisor_2_id)
                ->where('evaluation_type', $evalType)
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
            if (!$isComplete2) $allComplete = false;
        }

        return [
            'required' => $evalType,
            'completed' => $allComplete,
            'component_count' => $componentCount,
            'supervisors' => $supervisors,
        ];
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $roles = $user->roleSlugs();

        if (in_array('mahasiswa', $roles, true)) {
            $groupMember = GroupMember::where('student_id', $user->id)->first();
            if (!$groupMember) {
                return response()->json(['data' => []]);
            }
            $documents = Document::where('group_id', $groupMember->group_id)
                ->with('student')
                ->orderBy('created_at', 'desc')
                ->get();
            return response()->json(['data' => $documents]);
        }

        if (in_array('dosen', $roles, true)) {
            $query = Document::with(['student', 'group.title']);

            if ($request->has('group_id')) {
                $query->where('group_id', $request->group_id);
            } else {
                $supervisedGroupsQuery = Group::whereHas('supervisions', function ($q) use ($user) {
                    $q->where('supervisor_id', $user->id);
                });

                if ($request->has('period_id')) {
                    $supervisedGroupsQuery->where('period_id', $request->period_id);
                    // Also filter the main query by period even if group_id is provided later
                    $query->whereHas('group', fn($q) => $q->where('period_id', $request->period_id));
                }

                $supervisedGroupIds = $supervisedGroupsQuery->pluck('id');
                $query->whereIn('group_id', $supervisedGroupIds);
            }

            $documents = $query->orderBy('created_at', 'desc')->get();
            return response()->json(['data' => $documents]);
        }

        return response()->json(['message' => 'Unauthorized'], 403);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validationRules = [
            'phase' => ['required', 'string', Rule::in(self::PHASES)],
            'file' => ['required', 'file', 'mimes:pdf,doc,docx', 'max:10240'],
        ];

        $user = Auth::user();
        $groupMember = GroupMember::with('group')->where('student_id', $user->id)->first();

        if (!$groupMember) {
            return response()->json(['message' => 'You are not in any group.'], 400);
        }

        // Add document_type validation if phase has dynamic sub-types from DB
        if ($request->phase) {
            $periodId = $groupMember->group->period_id;
            $requirements = PhaseDocumentRequirement::where('period_id', $periodId)
                ->where('phase', $request->phase)
                ->pluck('name')->toArray();

            if (!empty($requirements)) {
                $validationRules['document_type'] = ['required', 'string', Rule::in($requirements)];
            } else {
                $validationRules['document_type'] = ['nullable', 'string'];
            }
        }

        $request->validate($validationRules);

        // Check workflow unlock rules
        $prereq = self::UNLOCK_RULES[$request->phase];
        if ($prereq !== null) {
            $prereqApproved = Document::where('group_id', $groupMember->group_id)
                ->where('phase', $prereq)
                ->where('status', 'APPROVED')
                ->exists();

            if (!$prereqApproved) {
                return response()->json([
                    'message' => "You must have an approved {$prereq} document before uploading {$request->phase}."
                ], 400);
            }
        }

        // Check SEMPRO schedule exists before allowing SEMPRO document upload
        if ($request->phase === 'SEMPRO') {
            $schedule = \App\Models\SeminarSchedule::where('group_id', $groupMember->group_id)
                ->where('type', 'SEMPRO')
                ->whereIn('status', ['SCHEDULED', 'ONGOING', 'COMPLETED'])
                ->first();

            if (!$schedule) {
                return response()->json([
                    'message' => 'SEMPRO belum dijadwalkan. Mohon tunggu admin menjadwalkan SEMPRO terlebih dahulu.'
                ], 400);
            }
        }

        // Check status gates for phases that require specific group status
        if (isset(self::STATUS_GATES[$request->phase])) {
            $group = $groupMember->group;
            $minStatus = self::STATUS_GATES[$request->phase];
            if ($minStatus && !$this->stateMachine->isAtLeast($group, $minStatus)) {
                $phaseName = match($request->phase) {
                    'PDC2' => 'PDC2',
                    'TA_DRAFT' => 'TA Draft',
                    'EXPO' => 'EXPO',
                    default => $request->phase,
                };
                $message = match($request->phase) {
                    'PDC2' => 'Both SEMPRO examiners must submit their evaluations first.',
                    'TA_DRAFT' => 'Group must be in PDC2 Active status.',
                    'EXPO' => 'TA Draft must be approved first.',
                    default => 'Prerequisites not met.',
                };
                return response()->json([
                    'message' => "{$phaseName} documents are locked. {$message}"
                ], 400);
            }
        }

        $path = $request->file('file')->store('documents', 'public');

        // V5: Replace (overwrite) existing document instead of creating new version
        $existingDoc = Document::where('group_id', $groupMember->group_id)
            ->where('phase', $request->phase)
            ->when($request->document_type, fn($q) => $q->where('document_type', $request->document_type))
            ->first();

        if ($existingDoc) {
            // Delete old file from storage
            if ($existingDoc->file_path && Storage::disk('public')->exists($existingDoc->file_path)) {
                Storage::disk('public')->delete($existingDoc->file_path);
            }

            // Update existing record (overwrite)
            $existingDoc->update([
                'file_path' => $path,
                'status' => 'SUBMITTED',
                'feedback' => null, // Reset feedback on resubmit
            ]);

            return response()->json(['message' => 'Document revised (replaced) successfully', 'data' => $existingDoc->fresh()], 200);
        }

        // First-time upload
        $document = Document::create([
            'group_id' => $groupMember->group_id,
            'student_id' => $user->id,
            'phase' => $request->phase,
            'document_type' => $request->document_type ?? 'GENERAL',
            'file_path' => $path,
            'version' => 1,
            'status' => 'SUBMITTED',
        ]);

        return response()->json(['message' => 'Document uploaded successfully', 'data' => $document], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage (Dosen review).
     */
    public function update(Request $request, string $id)
    {
        $user = Auth::user();
        if (!$user->hasRole('dosen')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'status' => ['required', Rule::in(['APPROVED', 'REJECTED'])],
            'feedback' => ['nullable', 'string'],
        ]);

        $document = Document::findOrFail($id);
        $document->update([
            'status' => $request->status,
            'feedback' => $request->feedback,
            'reviewed_by' => $user->id,
        ]);

        // Auto-transition: if all required document subtypes for phase are APPROVED
        $group = Group::findOrFail($document->group_id);
        $hasRequirements = PhaseDocumentRequirement::where('period_id', $group->period_id)
            ->where('phase', $document->phase)
            ->where('is_required', true)
            ->exists();

        if ($request->status === 'APPROVED') {
            $this->checkPhaseCompletion($document->group_id, $document->phase);
        }

        // Send notifications
        $notificationService = app(\App\Services\NotificationService::class);
        $studentIds = $group->members()->pluck('student_id')->toArray();
        $statusStr = strtolower($request->status);
        $notificationService->sendToMany(
            $studentIds,
            'PROPOSAL_' . strtoupper($request->status), // e.g. PROPOSAL_APPROVED, PROPOSAL_REJECTED (reused for doc status)
            "Document {$request->status}",
            "Your {$document->phase} document ({$document->document_type}) has been {$statusStr}" . ($request->feedback ? " with feedback: {$request->feedback}" : "."),
            'documents',
            $document->id
        );

        return response()->json(['message' => 'Document review updated', 'data' => $document]);
    }

    /**
     * Check if all required document types for a phase are approved, and auto-transition.
     */
    private function checkPhaseCompletion(int $groupId, string $phase): void
    {
        $group = Group::findOrFail($groupId);
        $requiredTypes = PhaseDocumentRequirement::where('period_id', $group->period_id)
            ->where('phase', $phase)
            ->where('is_required', true)
            ->pluck('name')->toArray();

        // If no requirements configured, check if ANY document in this phase is approved
        if (empty($requiredTypes)) {
            $hasAnyApproved = Document::where('group_id', $groupId)
                ->where('phase', $phase)
                ->where('status', 'APPROVED')
                ->exists();
            
            if (!$hasAnyApproved) {
                return; // No approved documents yet
            }
        } else {
            // Check all required types are approved
            foreach ($requiredTypes as $type) {
                $hasApproved = Document::where('group_id', $groupId)
                    ->where('phase', $phase)
                    ->where('document_type', $type)
                    ->where('status', 'APPROVED')
                    ->exists();

                if (!$hasApproved)
                    return; // Not all types approved yet
            }
        }

        // All required types approved (or at least one if no requirements) — check additional requirements
        // PDC1: No supervisor evaluation required, transition immediately when documents approved
        
        if ($phase === 'TA_DRAFT' && $group->status === 'PDC2_ACTIVE') {
            // Check if both supervisors have submitted NILAI_DOSEN and MILESTONE evaluations
            if (!$this->areAllNilaiDosenComplete($group)) {
                return; // Wait for both supervisors to submit evaluations
            }
            if (!$this->areAllMilestoneComplete($group)) {
                return; // Wait for both supervisors to submit milestone evaluations
            }
        }

        // All requirements met — trigger transition
        try {
            if ($phase === 'PDC1' && $group->status === 'PDC1_ACTIVE') {
                $this->stateMachine->transition($group, 'READY_FOR_SEMPRO');
            } elseif ($phase === 'TA_DRAFT' && $group->status === 'PDC2_ACTIVE') {
                // TA_DRAFT approved + both supervisors evaluated → transition to PDC2_READY_FOR_EXPO
                $this->stateMachine->transition($group, 'PDC2_READY_FOR_EXPO');
            }
        } catch (\InvalidArgumentException $e) {
            // Transition not valid from current state — ignore
        }
    }

    /**
     * Check if all NILAI_DOSEN evaluations are complete from both supervisors.
     * Only applies to groups in PDC2_ACTIVE status.
     */
    private function areAllNilaiDosenComplete(Group $group): bool
    {
        // Only check for PDC2_ACTIVE groups
        if ($group->status !== 'PDC2_ACTIVE') {
            return false;
        }

        // Get both supervisors
        $supervisorIds = array_filter([
            $group->supervisor_1_id,
            $group->supervisor_2_id,
        ]);

        if (empty($supervisorIds)) {
            return false;
        }

        // Get expected component count
        $periodId = $group->period_id;
        if (Schema::hasTable('period_assessment_components')) {
            $componentCount = \App\Models\PeriodAssessmentComponent::where('period_id', $periodId)
                ->where('type', 'NILAI_DOSEN')
                ->count();
        } else {
            $componentCount = \App\Models\AssessmentComponent::where('period_id', $periodId)
                ->where('type', 'NILAI_DOSEN')
                ->count();
        }

        if ($componentCount === 0) {
            return true; // No components configured, allow transition
        }

        // Check if all supervisors have submitted scores
        $studentCount = \App\Models\GroupMember::where('group_id', $group->id)->count();
        $expectedScores = $componentCount * $studentCount;

        foreach ($supervisorIds as $supervisorId) {
            $actualScores = \App\Models\AssessmentScore::where('group_id', $group->id)
                ->where('evaluator_id', $supervisorId)
                ->where('evaluation_type', 'NILAI_DOSEN')
                ->count();

            if ($actualScores < $expectedScores) {
                return false; // This supervisor hasn't completed all evaluations
            }
        }

        return true;
    }

    /**
     * Check if all MILESTONE evaluations are complete from both supervisors.
     * Only applies to groups in PDC2_ACTIVE status.
     */
    private function areAllMilestoneComplete(Group $group): bool
    {
        if ($group->status !== 'PDC2_ACTIVE') {
            return false;
        }

        $supervisorIds = array_filter([
            $group->supervisor_1_id,
            $group->supervisor_2_id,
        ]);

        if (empty($supervisorIds)) {
            return false;
        }

        $periodId = $group->period_id;
        if (Schema::hasTable('period_assessment_components')) {
            $componentCount = \App\Models\PeriodAssessmentComponent::where('period_id', $periodId)
                ->where('type', 'MILESTONE')
                ->count();
        } else {
            $componentCount = \App\Models\AssessmentComponent::where('period_id', $periodId)
                ->where('type', 'MILESTONE')
                ->count();
        }

        if ($componentCount === 0) {
            return true;
        }

        $studentCount = \App\Models\GroupMember::where('group_id', $group->id)->count();
        $expectedScores = $componentCount * $studentCount;

        foreach ($supervisorIds as $supervisorId) {
            $actualScores = \App\Models\AssessmentScore::where('group_id', $group->id)
                ->where('evaluator_id', $supervisorId)
                ->where('evaluation_type', 'MILESTONE')
                ->count();

            if ($actualScores < $expectedScores) {
                return false;
            }
        }

        return true;
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
