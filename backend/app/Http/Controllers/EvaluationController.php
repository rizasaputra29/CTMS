<?php

namespace App\Http\Controllers;

use App\Models\Evaluation;
use App\Models\Group;
use App\Models\GroupMember;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class EvaluationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $roles = $user->roleSlugs();

        if (in_array('dosen', $roles, true)) {
            // Return evaluations made by this dosen? Or for groups supervised?
            // Since evaluations are usually per student per phase
            // Let's allow filtering by group_id
            if ($request->has('group_id')) {
                return response()->json(['data' => Evaluation::where('group_id', $request->group_id)->with('student')->get()]);
            }
            return response()->json(['data' => []]);
        }

        if (in_array('mahasiswa', $roles, true)) {
            return response()->json(['data' => Evaluation::where('student_id', $user->id)->get()]);
        }

        return response()->json(['data' => []]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        if (!Auth::user()->hasRole('dosen')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'student_id' => 'required|exists:users,id', // Evaluate individual student
            'type' => ['required', Rule::in(['bimbingan', 'proposal', 'skripsi'])], // Using lowercase to match migration or enum? Migration said string.
            'score' => 'required|numeric|min:0|max:100',
            'feedback' => 'nullable|string',
        ]);

        $evaluation = Evaluation::updateOrCreate(
            [
                'group_id' => $request->group_id,
                'student_id' => $request->student_id,
                'type' => $request->type,
            ],
            [
                'evaluator_id' => Auth::id(),
                'score' => $request->score,
                'feedback' => $request->feedback,
            ]
        );

        return response()->json(['message' => 'Evaluation saved', 'data' => $evaluation]);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
