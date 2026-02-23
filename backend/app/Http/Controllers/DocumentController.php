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

class DocumentController extends Controller
{
    protected GroupStateMachine $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    // Workflow phase order
    const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'TA', 'SIDANG', 'EXPO'];

    // Valid document sub-types per phase
    const PHASE_DOCUMENT_TYPES = [
        'PDC1' => ['C100', 'C200', 'C300'],
        'PDC2' => ['C400', 'C500'],
    ];

    // Required document types to complete a phase
    const REQUIRED_DOCUMENT_TYPES = [
        'PDC1' => ['C100', 'C200', 'C300'],
        'PDC2' => ['C400', 'C500'],
    ];

    // Unlock rules: phase => prerequisite phase that must be APPROVED
    const UNLOCK_RULES = [
        'PDC1' => null,          // Always unlocked if group is APPROVED
        'SEMPRO' => 'PDC1',        // PDC1 approved → unlock Sempro
        'PDC2' => 'SEMPRO',      // Sempro approved → unlock PDC2
        'TA' => 'PDC2',        // PDC2 approved → unlock TA
        'SIDANG' => 'TA',          // TA approved → unlock Sidang
        'EXPO' => 'TA',          // Min 1 TA approved → allow Expo (same prereq as SIDANG)
    ];

    /**
     * Get the workflow status for a group (which phases are unlocked/completed).
     */
    public function workflow(Request $request)
    {
        $user = Auth::user();
        $groupMember = GroupMember::where('student_id', $user->id)->first();

        if (!$groupMember) {
            return response()->json(['phases' => [], 'current_phase' => null]);
        }

        $documents = Document::where('group_id', $groupMember->group_id)->get();
        $phases = [];

        foreach (self::PHASES as $phase) {
            $phaseDocs = $documents->where('phase', $phase);
            $latestDoc = $phaseDocs->sortByDesc('version')->first();

            $status = 'locked';
            $prereq = self::UNLOCK_RULES[$phase];

            // Check if unlocked
            if ($prereq === null) {
                $status = 'unlocked';
            } else {
                $prereqApproved = $documents->where('phase', $prereq)
                    ->where('status', 'APPROVED')
                    ->isNotEmpty();
                if ($prereqApproved) {
                    $status = 'unlocked';
                }
            }

            // If there are documents, determine status from latest
            if ($latestDoc) {
                if ($latestDoc->status === 'APPROVED') {
                    $status = 'completed';
                } elseif ($latestDoc->status === 'REJECTED') {
                    $status = 'revision';
                } elseif ($latestDoc->status === 'SUBMITTED') {
                    $status = 'submitted';
                } else {
                    $status = 'draft';
                }
            }

            $phases[] = [
                'phase' => $phase,
                'status' => $status,
                'latest_document' => $latestDoc,
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
            if ($request->has('group_id')) {
                $documents = Document::where('group_id', $request->group_id)
                    ->with('student')
                    ->orderBy('created_at', 'desc')
                    ->get();
                return response()->json(['data' => $documents]);
            }
            return response()->json(['data' => []]);
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

        // Add document_type validation if phase has sub-types
        if ($request->phase && isset(self::PHASE_DOCUMENT_TYPES[$request->phase])) {
            $validationRules['document_type'] = ['required', 'string', Rule::in(self::PHASE_DOCUMENT_TYPES[$request->phase])];
        } else {
            $validationRules['document_type'] = ['nullable', 'string'];
        }

        $request->validate($validationRules);

        $user = Auth::user();
        $groupMember = GroupMember::where('student_id', $user->id)->first();

        if (!$groupMember) {
            return response()->json(['message' => 'You are not in any group.'], 400);
        }

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
        if ($request->status === 'APPROVED' && isset(self::REQUIRED_DOCUMENT_TYPES[$document->phase])) {
            $this->checkPhaseCompletion($document->group_id, $document->phase);
        }

        return response()->json(['message' => 'Document review updated', 'data' => $document]);
    }

    /**
     * Check if all required document types for a phase are approved, and auto-transition.
     */
    private function checkPhaseCompletion(int $groupId, string $phase): void
    {
        $requiredTypes = self::REQUIRED_DOCUMENT_TYPES[$phase] ?? [];
        if (empty($requiredTypes))
            return;

        $group = Group::findOrFail($groupId);

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
