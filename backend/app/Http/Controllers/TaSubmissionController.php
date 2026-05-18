<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\TaSubmission;
use App\Models\Period;
use App\Models\Document;
use App\Models\PhaseDocumentRequirement;
use App\Models\PeriodAssessmentConfig;
use App\Models\PeriodAssessmentIndicator;
use App\Models\PeriodPeerReviewIndicator;
use App\Models\StudentPeerReviewStatus;
use App\Repositories\AssessmentScoreRepository;
use App\Services\GroupStateMachine;
use App\Exceptions\ConflictRuleException;
use App\Exceptions\DomainRuleException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\QueryException;

class TaSubmissionController extends Controller
{
    use RequiresActivePeriod;

    protected GroupStateMachine $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    /**
     * Get my TA submission status.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $submission = TaSubmission::with(['group.title', 'reviewer'])
            ->where('student_id', $user->id)
            ->first();

        return response()->json(['data' => $submission]);
    }

    /**
     * Upload TA draft (student).
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file_path' => 'required|string',
        ]);

        $user = $request->user();

        // Find student's group
        $membership = GroupMember::where('student_id', $user->id)->first();
        if (!$membership) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        $group = Group::with('period')->findOrFail($membership->group_id);

        $this->ensurePeriodIsActive($group);

        // Gate: group must be at least PDC2_ACTIVE
        if (!$this->stateMachine->isAtLeast($group, 'PDC2_ACTIVE')) {
            return response()->json(['message' => 'Group must be at least in PDC2_ACTIVE status.'], 400);
        }

        // Gate: Check if group is ready for TA Individual submission
        $readyCheck = $this->checkReadyForTaIndividual($group);
        if (!$readyCheck['ready']) {
            return response()->json([
                'message' => 'Your group is not ready for TA Individual submission. Please complete all requirements.',
                'requirements' => $readyCheck['requirements'],
            ], 403);
        }

        // Create or update TA submission
        $submission = TaSubmission::updateOrCreate(
            ['student_id' => $user->id, 'group_id' => $group->id],
            [
                'status' => 'TA_DRAFT',
                'file_path' => $request->file_path,
                'feedback' => null,
            ]
        );

        return response()->json([
            'message' => 'TA draft uploaded.',
            'data' => $submission,
        ]);
    }

    /**
     * Submit a revision (student).
     */
    public function revise(Request $request)
    {
        $request->validate([
            'file_path' => 'required|string',
        ]);

        $user = $request->user();

        $submission = TaSubmission::with('group.period')->where('student_id', $user->id)->firstOrFail();

        $this->ensurePeriodIsActive($submission->group);

        $submission->update([
            'status' => 'TA_REVISED',
            'file_path' => $request->file_path,
            'feedback' => null,
        ]);

        return response()->json([
            'message' => 'TA revision submitted.',
            'data' => $submission->fresh(),
        ]);
    }

    /**
     * Register for TA defense (student).
     */
    public function register(Request $request)
    {
        $user = $request->user();

        // 1. Resolve Active Period (Cached)
        $activePeriod = Cache::remember('active_period', 3600, function () {
            return Period::where('is_active', true)
                ->where('is_finalized', false)
                ->orderBy('created_at', 'desc')
                ->first();
        });

        if (!$activePeriod) {
            throw new DomainRuleException("Tidak ada periode pendaftaran aktif saat ini.");
        }

        // 2. Check TA Registration Window
        $now = now();
        if (!$activePeriod->ta_start || !$activePeriod->ta_end || $now->lt($activePeriod->ta_start) || $now->gt($activePeriod->ta_end)) {
            throw new DomainRuleException("Pendaftaran sidang TA saat ini sedang ditutup.");
        }

        return DB::transaction(function () use ($user, $activePeriod) {
            // A. Row-Level Lock on Submission
            $submission = TaSubmission::where('student_id', $user->id)
                ->where('period_id', $activePeriod->id)
                ->lockForUpdate()
                ->first();

            if (!$submission) {
                throw new DomainRuleException("Data pendaftaran TA tidak ditemukan.");
            }

            // Idempotency
            if ($submission->status === 'TA_REGISTERED') {
                throw new ConflictRuleException("Anda sudah terdaftar untuk sidang TA.");
            }

            // B. Eligibility Check (Submission Status & Group Status)
            if ($submission->status !== 'TA_READY') {
                throw new DomainRuleException("Status TA Anda belum mencapai TA_READY.");
            }

            $group = Group::where('id', $submission->group_id)->lockForUpdate()->first();
            if (!in_array($group->status, ['READY_FOR_TA_INDIVIDUAL'])) {
                throw new DomainRuleException("Grup Anda belum menyelesaikan fase READY_FOR_TA_INDIVIDUAL.");
            }

            // C. Finalize Registration
            $submission->update(['status' => 'TA_REGISTERED']);

            // Audit
            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'TA_REGISTER_DEFENSE',
                'target_type' => 'TaSubmission',
                'target_id' => $submission->id,
                'payload' => [
                    'request_id' => Log::getContext()['request_id'] ?? null,
                    'period_id' => $activePeriod->id
                ],
            ]);

            return response()->json([
                'message' => 'Pendaftaran sidang TA berhasil.',
                'data' => $submission->fresh(),
            ]);
        });
    }

    /**
     * Review TA submission (dosen).
     */
    public function review(Request $request, $id)
    {
        $request->validate([
            'result' => 'required|in:APPROVE,REVISE',
            'feedback' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $submission = TaSubmission::with('group.period')->findOrFail($id);

        $this->ensurePeriodIsActive($submission->group);

        if ($request->result === 'APPROVE') {
            $submission->update([
                'status' => 'TA_READY',
                'feedback' => $request->feedback,
                'reviewed_by' => $user->id,
            ]);
        } else {
            $submission->update([
                'feedback' => $request->feedback,
                'reviewed_by' => $user->id,
                // Status stays at current (student needs to revise)
            ]);
        }

        return response()->json([
            'message' => "TA review: {$request->result}",
            'data' => $submission->fresh(),
        ]);
    }

    /**
     * Mark TA as defended (dosen). If all group members defended → group CLOSED.
     */
    public function defended(Request $request, $id)
    {
        $user = $request->user();
        $submission = TaSubmission::with('group.period')->findOrFail($id);

        $this->ensurePeriodIsActive($submission->group);

        if ($submission->status !== 'TA_REGISTERED') {
            return response()->json(['message' => 'TA must be in TA_REGISTERED status.'], 400);
        }

        return DB::transaction(function () use ($user, $submission) {
            $submission->update([
                'status' => 'TA_DEFENDED',
                'reviewed_by' => $user->id,
            ]);

            // Audit log
            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'TA_DEFENDED',
                'target_type' => 'TaSubmission',
                'target_id' => $submission->id,
                'payload' => ['student_id' => $submission->student_id],
            ]);

            // Check if ALL active group members have defended
            $group = Group::findOrFail($submission->group_id);
            $activeMemberCount = GroupMember::where('group_id', $group->id)->count();
            $defendedCount = TaSubmission::where('group_id', $group->id)
                ->where('status', 'TA_DEFENDED')
                ->count();

            if ($activeMemberCount > 0 && $defendedCount >= $activeMemberCount) {
                $this->stateMachine->transition($group, 'CLOSED');
            }

            return response()->json([
                'message' => 'TA marked as defended.',
                'data' => $submission->fresh(),
                'group' => $group->fresh(),
            ]);
        });
    }

    /**
     * Check if group is ready for TA Individual submission.
     * Returns readiness status and list of requirements.
     */
    private function checkReadyForTaIndividual(Group $group): array
    {
        $requirements = [
            'expo_documents_approved' => false,
            'nilai_dosen_complete' => false,
            'milestone_complete' => false,
            'expo_evaluation_complete' => false,
            'peer_review_configured' => false,
            'peer_review_completed' => false,
        ];

        // Check EXPO documents approved
        $expoDocs = Document::where('group_id', $group->id)
            ->where('phase', 'EXPO')
            ->where('status', 'APPROVED')
            ->count();
        $requiredExpoDocs = PhaseDocumentRequirement::where('period_id', $group->period_id)
            ->where('phase', 'EXPO')
            ->where('is_required', true)
            ->count();
        $requirements['expo_documents_approved'] = $expoDocs >= $requiredExpoDocs || $requiredExpoDocs === 0;

        // Check supervisor evaluations using DB queries directly
        $requirements['nilai_dosen_complete'] = $this->checkSupervisorEvaluationComplete($group, 'NILAI_DOSEN');
        $requirements['milestone_complete'] = $this->checkSupervisorEvaluationComplete($group, 'MILESTONE');
        $requirements['expo_evaluation_complete'] = $this->checkSupervisorEvaluationComplete($group, 'EXPO');

        // Check Peer Review
        $peerReviewIndicators = PeriodPeerReviewIndicator::where('period_id', $group->period_id)->count();
        $requirements['peer_review_configured'] = $peerReviewIndicators > 0;

        if ($requirements['peer_review_configured']) {
            $members = GroupMember::where('group_id', $group->id)->get();
            $completedMembers = 0;
            foreach ($members as $member) {
                $status = StudentPeerReviewStatus::where('student_id', $member->student_id)
                    ->where('group_id', $group->id)
                    ->first();
                if ($status && $status->has_completed_peer_review) {
                    $completedMembers++;
                }
            }
            $requirements['peer_review_completed'] = $completedMembers >= $members->count();
        }

        $allComplete = !in_array(false, $requirements, true);

        return [
            'ready' => $allComplete,
            'requirements' => $requirements,
        ];
    }

    /**
     * Check if all supervisors have completed their evaluation for a specific type.
     */
    private function checkSupervisorEvaluationComplete(Group $group, string $evaluationType): bool
    {
        // Get assigned supervisors from group
        $supervisorIds = [];
        if ($group->supervisor_1_id) {
            $supervisorIds[] = $group->supervisor_1_id;
        }
        if ($group->supervisor_2_id) {
            $supervisorIds[] = $group->supervisor_2_id;
        }

        if (empty($supervisorIds)) {
            return false;
        }

        // Check if assessment config exists for this evaluation type
        $configExists = DB::table('period_assessment_configs')
            ->where('period_id', $group->period_id)
            ->where('evaluation_type', $evaluationType)
            ->exists();

        if (!$configExists) {
            return false;
        }

        // Check if all supervisors have submitted scores
        foreach ($supervisorIds as $supervisorId) {
            $scoreCount = AssessmentScoreRepository::forType($evaluationType)
                ->where('group_id', $group->id)
                ->where('evaluator_id', $supervisorId)
                ->count();

            // Get expected component count
            $expectedCount = DB::table('period_assessment_indicators')
                ->join('period_assessment_configs', 'period_assessment_configs.id', '=', 'period_assessment_indicators.config_id')
                ->where('period_assessment_configs.period_id', $group->period_id)
                ->where('period_assessment_configs.evaluation_type', $evaluationType)
                ->count();

            if ($scoreCount < $expectedCount || $expectedCount === 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get detailed TA status including documents and progress.
     */
    public function getDetailedStatus(Request $request)
    {
        $user = $request->user();
        
        $submission = TaSubmission::with(['group.title', 'reviewer', 'group.supervisor1', 'group.supervisor2'])
            ->where('student_id', $user->id)
            ->first();

        if (!$submission) {
            // Check if group is ready for TA individual
            $membership = GroupMember::where('student_id', $user->id)->first();
            if (!$membership) {
                return response()->json(['message' => 'You are not in a group.'], 400);
            }

            $group = Group::with(['title', 'supervisor1', 'supervisor2'])->find($membership->group_id);
            
            if ($group->status !== 'READY_FOR_TA_INDIVIDUAL') {
                return response()->json([
                    'can_access' => false,
                    'status' => 'TA_LOCKED',
                    'message' => 'TA phase is locked. Your group must complete EXPO first.',
                ]);
            }

            // Create initial submission with TA_DOCUMENTS_REQUIRED status
            $submission = TaSubmission::create([
                'student_id' => $user->id,
                'group_id' => $group->id,
                'period_id' => $group->period_id,
                'status' => 'TA_DOCUMENTS_REQUIRED',
            ]);

            // Reload submission with group relations
            $submission = TaSubmission::with(['group.title', 'group.supervisor1', 'group.supervisor2'])
                ->find($submission->id);

            return response()->json([
                'can_access' => true,
                'status' => 'TA_DOCUMENTS_REQUIRED',
                'submission' => $submission,
                'group' => $submission->group,
                'documents' => [],
                'document_requirements' => $this->getTaDocumentRequirements($group->period_id),
            ]);
        }

        $documents = Document::where('student_id', $user->id)
            ->where('phase', 'TA')
            ->get();

        $documentRequirements = $this->getTaDocumentRequirements($submission->group->period_id);

        // Self-heal: re-evaluate document approval status on every page load
        $this->checkAllDocumentsApproved($user->id, $submission->group_id);
        $submission = TaSubmission::with(['group.title', 'group.supervisor1', 'group.supervisor2'])
            ->find($submission->id);

        return response()->json([
            'can_access' => true,
            'status' => $submission->status,
            'submission' => $submission,
            'group' => $submission->group,
            'documents' => $documents,
            'document_requirements' => $documentRequirements,
        ]);
    }

    /**
     * Get TA document requirements for a period.
     */
    private function getTaDocumentRequirements(int $periodId): array
    {
        return PhaseDocumentRequirement::where('period_id', $periodId)
            ->where('phase', 'TA')
            ->get()
            ->toArray();
    }

    /**
     * Get TA documents for the authenticated student.
     */
    public function getTaDocuments(Request $request)
    {
        $user = $request->user();

        $submission = TaSubmission::where('student_id', $user->id)->first();
        if (!$submission) {
            return response()->json(['message' => 'TA submission not found.'], 404);
        }

        $documents = Document::where('student_id', $user->id)
            ->where('phase', 'TA')
            ->get();

        $documentRequirements = $this->getTaDocumentRequirements($submission->group->period_id);

        return response()->json([
            'documents' => $documents,
            'document_requirements' => $documentRequirements,
        ]);
    }

    /**
     * Upload a TA phase document with actual file upload.
     */
    public function uploadTaDocument(Request $request)
    {
        $request->validate([
            'document_type' => 'required|string',
            'file' => 'required|file|mimes:pdf,doc,docx|max:10240', // Max 10MB
        ]);

        $user = $request->user();

        $submission = TaSubmission::with('group.period')->where('student_id', $user->id)->first();
        if (!$submission) {
            return response()->json(['message' => 'TA submission not found.'], 404);
        }

        $this->ensurePeriodIsActive($submission->group);

        // Check if submission is in a valid state for document upload
        if (!in_array($submission->status, ['TA_DOCUMENTS_REQUIRED', 'TA_DOCUMENTS_UNDER_REVIEW'])) {
            return response()->json(['message' => 'Cannot upload documents at this stage.'], 403);
        }

        // Handle file upload
        $file = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $path = $file->storeAs('ta-documents/' . $submission->group_id . '/' . $user->id, $fileName, 'public');

        // Check if document already exists
        $existingDoc = Document::where('student_id', $user->id)
            ->where('group_id', $submission->group_id)
            ->where('phase', 'TA')
            ->where('document_type', $request->document_type)
            ->first();

        if ($existingDoc) {
            // Update existing document
            $existingDoc->update([
                'file_path' => $path,
                'status' => 'PENDING',
                'feedback' => null,
                'version' => ($existingDoc->version ?? 0) + 1,
            ]);
            $document = $existingDoc;
        } else {
            // Create new document
            $document = Document::create([
                'student_id' => $user->id,
                'group_id' => $submission->group_id,
                'phase' => 'TA',
                'document_type' => $request->document_type,
                'file_path' => $path,
                'status' => 'PENDING',
                'feedback' => null,
                'version' => 1,
            ]);
        }

        // Update submission status to UNDER_REVIEW
        $submission->update(['status' => 'TA_DOCUMENTS_UNDER_REVIEW']);

        return response()->json([
            'message' => 'Document uploaded successfully.',
            'document' => $document,
        ]);
    }

    /**
     * Review (approve/reject) a TA document.
     */
    public function reviewTaDocument(Request $request, $documentId)
    {
        $request->validate([
            'action' => 'required|in:APPROVE,REJECT',
            'feedback' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $document = Document::findOrFail($documentId);

        // Check if user is supervisor of the group
        $group = Group::with('period')->find($document->group_id);

        $this->ensurePeriodIsActive($group);

        $isSupervisor = in_array($user->id, [$group->supervisor_1_id, $group->supervisor_2_id]);
        
        if (!$isSupervisor && !$user->hasRole('admin')) {
            return response()->json(['message' => 'Unauthorized. Only supervisors or admin can review documents.'], 403);
        }

        $document->update([
            'status' => $request->action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            'feedback' => $request->feedback,
            'reviewed_by' => $user->id,
        ]);

        // Check if all required documents are approved
        $this->checkAllDocumentsApproved($document->student_id, $document->group_id);

        return response()->json([
            'message' => "Document {$request->action}D.",
            'document' => $document->fresh(),
        ]);
    }

    /**
     * Check if all required TA documents are approved.
     */
    private function checkAllDocumentsApproved(int $studentId, int $groupId): void
    {
        $submission = TaSubmission::where('student_id', $studentId)->first();

        if (!$submission) {
            return;
        }

        $totalCount = Document::where('student_id', $studentId)
            ->where('phase', 'TA')
            ->count();

        if ($totalCount === 0) {
            return;
        }

        $approvedCount = Document::where('student_id', $studentId)
            ->where('phase', 'TA')
            ->where('status', 'APPROVED')
            ->count();

        if ($approvedCount >= $totalCount) {
            $submission->update(['status' => 'TA_DOCUMENTS_APPROVED']);
        }
    }
}
