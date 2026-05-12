<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Models\Document;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\TaSubmission;
use App\Services\GroupStateMachine;
use App\Services\WorkflowService;
use App\Repositories\AssessmentScoreRepository;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use App\Models\PhaseDocumentRequirement;

class DocumentController extends Controller
{
    use RequiresActivePeriod;

    protected GroupStateMachine $stateMachine;
    protected WorkflowService $workflowService;

    public function __construct(GroupStateMachine $stateMachine, WorkflowService $workflowService)
    {
        $this->stateMachine = $stateMachine;
        $this->workflowService = $workflowService;
    }

    // Workflow phase order - referenced from WorkflowService
    const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'TA_DRAFT', 'EXPO'];

    // Unlock rules: phase => prerequisite phase that must be APPROVED
    const UNLOCK_RULES = [
        'PDC1' => null,
        'SEMPRO' => 'PDC1',
        'PDC2' => 'SEMPRO',
        'TA_DRAFT' => 'PDC2',
        'EXPO' => 'PDC2',
    ];

    /**
     * Status gates for phases that require specific group status beyond document approval.
     */
    const STATUS_GATES = [
        'PDC2' => 'SEMPRO_DONE',
        'TA_DRAFT' => 'PDC2_ACTIVE',
        'EXPO' => 'PDC2_READY_FOR_EXPO',
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
        
        // Use WorkflowService for workflow data
        $workflowData = $this->workflowService->getWorkflowData($groupMember->group, $documents, $allRequirements);
        $nextPhaseRequirements = $this->workflowService->getNextPhaseRequirements(
            $groupMember->group,
            $workflowData['phases'],
            $allRequirements,
            $documents
        );
        $finalReadyForTaIndividual = $this->workflowService->getFinalReadyForTaIndividual(
            $groupMember->group,
            $allRequirements,
            $documents
        );

        return response()->json([
            'phases' => $workflowData['phases'],
            'current_phase' => $workflowData['current_phase'],
            'is_graduated' => $workflowData['is_graduated'],
            'next_phase_requirements' => $nextPhaseRequirements,
            'final_ready_for_ta_individual' => $finalReadyForTaIndividual,
        ]);
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
        $groupMember = GroupMember::with('group.period')->where('student_id', $user->id)->first();

        if (!$groupMember) {
            return response()->json(['message' => 'You are not in any group.'], 400);
        }

        $this->ensurePeriodIsActive($groupMember->group);

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
        $group = Group::with('period')->findOrFail($document->group_id);

        $this->ensurePeriodIsActive($group);

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
            $actualScores = AssessmentScoreRepository::countForGroupAndEvaluator(
                $group->id,
                $supervisorId,
                'NILAI_DOSEN'
            );

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
            $actualScores = AssessmentScoreRepository::forType('MILESTONE')
                ->where('group_id', $group->id)
                ->where('evaluator_id', $supervisorId)
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
