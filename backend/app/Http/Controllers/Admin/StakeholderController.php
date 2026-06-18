<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\ApiResponseTrait;
use App\Http\Controllers\Controller;
use App\Models\Stakeholder;
use App\Models\Title;
use Illuminate\Http\Request;

class StakeholderController extends Controller
{
    use ApiResponseTrait;

    public function index(Request $request)
    {
        $query = Stakeholder::query();

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        return $this->successResponse($query->orderBy('name')->get());
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

        return $this->createdResponse($stakeholder, 'Stakeholder created successfully.');
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

        return $this->successResponse($stakeholder, 'Stakeholder updated successfully.');
    }

    public function destroy(Stakeholder $stakeholder)
    {
        $stakeholder->delete();

        return $this->successResponse(null, 'Stakeholder deleted successfully.');
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
            return $this->errorResponse('Stakeholders can only be attached to student-proposed titles.', 422);
        }

        $title->stakeholders()->syncWithoutDetaching([
            $validated['stakeholder_id'] => [
                'role' => $validated['role'] ?? 'ADVISOR',
                'notes' => $validated['notes'] ?? null,
            ],
        ]);

        return $this->successResponse($title->load('stakeholders'), 'Stakeholder linked to title.');
    }

    public function detachFromTitle(Title $title, Stakeholder $stakeholder)
    {
        $title->stakeholders()->detach($stakeholder->id);

        return $this->successResponse($title->load('stakeholders'), 'Stakeholder unlinked from title.');
    }
}
