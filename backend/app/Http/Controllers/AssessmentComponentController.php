<?php

namespace App\Http\Controllers;

use App\Models\AssessmentComponent;
use App\Models\PeriodAssessmentComponent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AssessmentComponentController extends Controller
{
    private function usesPeriodAssessmentComponents(): bool
    {
        return Schema::hasTable('period_assessment_components');
    }

    /**
     * List assessment components, filtered by period_id and type.
     * Returns components from period_assessment_components joined with templates.
     */
    public function index(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'type' => 'nullable|string|in:SEMPRO,SIDANG_TA,EXPO,BIMBINGAN_SEMPRO,BIMBINGAN_TA,NILAI_DOSEN,MILESTONE',
        ]);

        if ($this->usesPeriodAssessmentComponents()) {
            $query = PeriodAssessmentComponent::with('template')
                ->where('period_id', $request->period_id)
                ->orderBy('sort_order');

            if ($request->type) {
                $query->where('type', $request->type);
            }

            $components = $query->get()->map(fn ($c) => [
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
        } else {
            $query = AssessmentComponent::query()
                ->where('period_id', $request->period_id)
                ->orderBy('sort_order');

            if ($request->type) {
                $query->where('type', $request->type);
            }

            $components = $query->get()->map(fn ($c) => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name,
                'description' => $c->description,
                'weight' => $c->weight,
                'type' => $c->type,
                'sort_order' => $c->sort_order,
                'template_id' => null,
                'period_id' => $c->period_id,
            ]);
        }

        return response()->json($components);
    }

    /**
     * Note: Creating individual components is deprecated.
     * Use PeriodAssessmentConfigController to configure period assessment.
     */
    public function store(Request $request)
    {
        return response()->json([
            'message' => 'Use PeriodAssessmentConfigController to configure assessment components for a period.',
        ], 400);
    }

    /**
     * Note: Bulk store is deprecated.
     * Use PeriodAssessmentConfigController to configure period assessment.
     */
    public function bulkStore(Request $request)
    {
        return response()->json([
            'message' => 'Use PeriodAssessmentConfigController to configure assessment components for a period.',
        ], 400);
    }

    /**
     * Update sort_order only. Other fields come from template.
     */
    public function update(Request $request, $id)
    {
        if ($this->usesPeriodAssessmentComponents()) {
            $component = PeriodAssessmentComponent::findOrFail($id);
        } else {
            $component = AssessmentComponent::findOrFail($id);
        }

        $data = $request->validate([
            'sort_order' => 'nullable|integer',
        ]);

        $component->update($data);

        if ($this->usesPeriodAssessmentComponents()) {
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

        return response()->json([
            'id' => $component->id,
            'code' => $component->code,
            'name' => $component->name,
            'description' => $component->description,
            'weight' => $component->weight,
            'type' => $component->type,
            'sort_order' => $component->sort_order,
        ]);
    }

    /**
     * Delete an assessment component from period config.
     */
    public function destroy($id)
    {
        if ($this->usesPeriodAssessmentComponents()) {
            $component = PeriodAssessmentComponent::findOrFail($id);
        } else {
            $component = AssessmentComponent::findOrFail($id);
        }

        $component->delete();

        return response()->json(['message' => 'Component removed from period configuration']);
    }
}
