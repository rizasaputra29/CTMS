<?php

namespace App\Http\Controllers;

use App\Models\AssessmentComponent;
use Illuminate\Http\Request;

class AssessmentComponentController extends Controller
{
    /**
     * List assessment components, filtered by period_id and type.
     */
    public function index(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'type' => 'nullable|string|in:SEMPRO,SIDANG_TA,EXPO,BIMBINGAN',
        ]);

        $query = AssessmentComponent::where('period_id', $request->period_id)
            ->orderBy('sort_order');

        if ($request->type) {
            $query->where('type', $request->type);
        }

        return response()->json($query->get());
    }

    /**
     * Create a new assessment component.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'period_id' => 'required|exists:periods,id',
            'type' => 'required|string|in:SEMPRO,SIDANG_TA,EXPO,BIMBINGAN',
            'code' => 'required|string|max:50',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'weight' => 'required|numeric|min:0|max:100',
            'sort_order' => 'nullable|integer',
        ]);

        $component = AssessmentComponent::create($data);

        return response()->json($component, 201);
    }

    /**
     * Bulk create/update assessment components for a period + type.
     */
    public function bulkStore(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'type' => 'required|string|in:SEMPRO,SIDANG_TA,EXPO,BIMBINGAN',
            'components' => 'required|array|min:1',
            'components.*.code' => 'required|string|max:50',
            'components.*.name' => 'required|string|max:255',
            'components.*.description' => 'nullable|string',
            'components.*.weight' => 'required|numeric|min:0|max:100',
            'components.*.sort_order' => 'nullable|integer',
        ]);

        $periodId = $request->period_id;
        $type = $request->type;

        // Delete existing components for this period+type, then re-create
        AssessmentComponent::where('period_id', $periodId)
            ->where('type', $type)
            ->delete();

        $created = [];
        foreach ($request->components as $i => $comp) {
            $created[] = AssessmentComponent::create([
                'period_id' => $periodId,
                'type' => $type,
                'code' => $comp['code'],
                'name' => $comp['name'],
                'description' => $comp['description'] ?? null,
                'weight' => $comp['weight'],
                'sort_order' => $comp['sort_order'] ?? $i,
            ]);
        }

        return response()->json($created, 201);
    }

    /**
     * Update an assessment component.
     */
    public function update(Request $request, $id)
    {
        $component = AssessmentComponent::findOrFail($id);

        $data = $request->validate([
            'code' => 'sometimes|string|max:50',
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'weight' => 'sometimes|numeric|min:0|max:100',
            'sort_order' => 'nullable|integer',
        ]);

        $component->update($data);

        return response()->json($component);
    }

    /**
     * Delete an assessment component.
     */
    public function destroy($id)
    {
        $component = AssessmentComponent::findOrFail($id);
        $component->delete();

        return response()->json(['message' => 'Component deleted']);
    }
}
