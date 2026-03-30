<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Group;
use App\Models\GroupMember;
use App\Services\GroupStateMachine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
    const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'TA', 'EXPO', 'SIDANG'];

    // Unlock rules: phase => prerequisite phase that must be APPROVED
    const UNLOCK_RULES = [
        'PDC1' => null,          // Always unlocked if group is APPROVED
        'SEMPRO' => 'PDC1',        // PDC1 approved → unlock Sempro
        'PDC2' => 'SEMPRO',      // Sempro approved → unlock PDC2
        'EXPO' => 'PDC2',          // PDC2 approved -> unlock EXPO
        'TA' => 'PDC2',        // PDC2 approved → unlock TA
        'SIDANG' => 'EXPO',          // EXPO approved → unlock Sidang
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

            // Determine overall phase status if unlocked
            if ($phaseStatus === 'unlocked') {
                if ($phase === 'EXPO') {
                    // Custom rule for EXPO: requires at least 1 TA draft submitted by any member
                    $hasTaDraft = \App\Models\TaSubmission::where('group_id', $groupMember->group_id)->exists();
                    if (!$hasTaDraft) {
                        $phaseStatus = 'locked';
                    }
                }

                if ($phaseStatus === 'unlocked') {
                    if ($allApproved) {
                        $phaseStatus = 'completed';
                    } elseif ($anyRejected) {
                        $phaseStatus = 'revision';
                    } elseif ($anySubmitted) {
                        $phaseStatus = 'submitted';
                    } elseif ($uploadedCount > 0) {
                        $phaseStatus = 'draft';
                    }
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

        return response()->json([
            'phases' => $phases,
            'current_phase' => $currentPhase,
            'is_graduated' => $allCompleted,
        ]);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        if ($user->role === 'mahasiswa') {
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

        if ($user->role === 'dosen') {
            $query = Document::with(['student', 'group.title']);

            if ($request->has('group_id')) {
                $query->where('group_id', $request->group_id);
            } else {
                $supervisedGroupIds = Group::whereHas('supervisions', function ($q) use ($user) {
                    $q->where('supervisor_id', $user->id);
                })->pluck('id');
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

        $path = $request->file('file')->store('documents', 'public');

        // Determine version
        $latestDoc = Document::where('group_id', $groupMember->group_id)
            ->where('phase', $request->phase)
            ->when($request->document_type, fn($q) => $q->where('document_type', $request->document_type))
            ->orderBy('version', 'desc')
            ->first();

        $version = $latestDoc ? $latestDoc->version + 1 : 1;

        $document = Document::create([
            'group_id' => $groupMember->group_id,
            'student_id' => $user->id,
            'phase' => $request->phase,
            'document_type' => $request->document_type ?? 'GENERAL',
            'file_path' => $path,
            'version' => $version,
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
        if ($user->role !== 'dosen') {
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

        if ($request->status === 'APPROVED' && $hasRequirements) {
            $this->checkPhaseCompletion($document->group_id, $document->phase);
        }

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

        if (empty($requiredTypes))
            return;

        foreach ($requiredTypes as $type) {
            $hasApproved = Document::where('group_id', $groupId)
                ->where('phase', $phase)
                ->where('document_type', $type)
                ->where('status', 'APPROVED')
                ->exists();

            if (!$hasApproved)
                return; // Not all types approved yet
        }

        // All required types approved — trigger transition
        try {
            if ($phase === 'PDC1' && $group->status === 'PDC1_ACTIVE') {
                $this->stateMachine->transition($group, 'READY_FOR_SEMPRO');
            } elseif ($phase === 'PDC2' && $group->status === 'PDC2_ACTIVE') {
                $this->stateMachine->transition($group, 'PDC2_READY_FOR_EXPO');
            }
        } catch (\InvalidArgumentException $e) {
            // Transition not valid from current state — ignore
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
