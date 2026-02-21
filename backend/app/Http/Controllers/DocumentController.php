<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\GroupMember;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class DocumentController extends Controller
{
    // Workflow phase order
    const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'TA', 'SIDANG', 'EXPO'];

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
        $request->validate([
            'phase' => ['required', 'string', Rule::in(self::PHASES)],
            'file' => ['required', 'file', 'mimes:pdf,doc,docx', 'max:10240'],
        ]);

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
            ->orderBy('version', 'desc')
            ->first();

        $version = $latestDoc ? $latestDoc->version + 1 : 1;

        $document = Document::create([
            'group_id' => $groupMember->group_id,
            'student_id' => $user->id,
            'phase' => $request->phase,
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

        return response()->json(['message' => 'Document review updated', 'data' => $document]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
