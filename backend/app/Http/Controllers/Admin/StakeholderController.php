<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Stakeholder;
use App\Models\Title;
use Illuminate\Http\Request;

class StakeholderController extends Controller
{
    public function index(Request $request)
    {
        $query = Stakeholder::query();

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        return response()->json([
            'data' => $query->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'organization' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'type' => 'nullable|string|max:50',
            'notes' => 'nullable|string',
        ]);

        $stakeholder = Stakeholder::create($validated);

        return response()->json([
            'message' => 'Stakeholder created successfully.',
            'data' => $stakeholder,
        ], 201);
    }

    public function update(Request $request, Stakeholder $stakeholder)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'organization' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'type' => 'nullable|string|max:50',
            'notes' => 'nullable|string',
        ]);

        $stakeholder->update($validated);

        return response()->json([
            'message' => 'Stakeholder updated successfully.',
            'data' => $stakeholder,
        ]);
    }

    public function destroy(Stakeholder $stakeholder)
    {
        $stakeholder->delete();

        return response()->json([
            'message' => 'Stakeholder deleted successfully.',
        ]);
    }

    public function attachToTitle(Request $request, Title $title)
    {
        $validated = $request->validate([
            'stakeholder_id' => 'required|exists:stakeholders,id',
            'role' => 'nullable|string|max:50',
            'notes' => 'nullable|string',
        ]);

        // Stakeholders are governed for student-proposed ideas only.
        if ($title->title_source !== 'STUDENT') {
            return response()->json([
                'message' => 'Stakeholders can only be attached to student-proposed titles.',
            ], 422);
        }

        $title->stakeholders()->syncWithoutDetaching([
            $validated['stakeholder_id'] => [
                'role' => $validated['role'] ?? 'ADVISOR',
                'notes' => $validated['notes'] ?? null,
            ],
        ]);

        return response()->json([
            'message' => 'Stakeholder linked to title.',
            'data' => $title->load('stakeholders'),
        ]);
    }

    public function detachFromTitle(Title $title, Stakeholder $stakeholder)
    {
        $title->stakeholders()->detach($stakeholder->id);

        return response()->json([
            'message' => 'Stakeholder unlinked from title.',
            'data' => $title->load('stakeholders'),
        ]);
    }
}
