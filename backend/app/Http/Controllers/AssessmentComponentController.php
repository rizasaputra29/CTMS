<?php

namespace App\Http\Controllers;

use App\Models\PeriodAssessmentComponent;
use Illuminate\Http\Request;

class AssessmentComponentController extends Controller
{
    /**
     * List assessment components, filtered by period_id and type.
     * Returns components from period_assessment_components joined with templates.
     */
    public function index(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'type' => 'nullable|string|in:SEMPRO,SIDANG_TA,EXPO,BIMBINGAN',
        ]);

        $query = PeriodAssessmentComponent::with('template')
            ->where('period_id', $request->period_id)
            ->orderBy('sort_order');

        if ($request->type) {
            $query->where('type', $request->type);
        }

        $components = $query->get()->map(fn($c) => [
            'id' => $c->id,
            'code' => $c->template->code,
            'name' => $c->template->name,
            'description' => $c->template->description,
            'weight' => $c->template->weight,
            'type' => $c->type,
            'sort_order' => $c->sort_order,
            'template_id' => $c->template_id,
            'period_id' => $c->period_id,
        ]);

        return response()->json($components);
    }

    /**
     * Note: Creating individual components is deprecated.
     * Use PeriodAssessmentConfigController to configure period assessment.
     */
    public function store(Request $request)
    {
        return response()->json([
            'message' => 'Use PeriodAssessmentConfigController to configure assessment components for a period.'
        ], 400);
    }

    /**
     * Note: Bulk store is deprecated.
     * Use PeriodAssessmentConfigController to configure period assessment.
     */
    public function bulkStore(Request $request)
    {
        return response()->json([
            'message' => 'Use PeriodAssessmentConfigController to configure assessment components for a period.'
        ], 400);
    }

    /**
     * Update sort_order only. Other fields come from template.
     */
    public function update(Request $request, $id)
    {
        $component = PeriodAssessmentComponent::findOrFail($id);

        $data = $request->validate([
            'sort_order' => 'nullable|integer',
        ]);

        $component->update($data);

        return response()->json([
            'id' => $component->id,
            'code' => $component->template->code,
            'name' => $component->template->name,
            'description' => $component->template->description,
            'weight' => $component->template->weight,
            'type' => $component->type,
            'sort_order' => $component->sort_order,
        ]);
    }

    /**
     * Delete an assessment component from period config.
     */
    public function destroy($id)
    {
        $component = PeriodAssessmentComponent::findOrFail($id);
        $component->delete();

        return response()->json(['message' => 'Component removed from period configuration']);
    }
}
