<?php

namespace App\Http\Controllers;

use App\Models\AssessmentComponentTemplate;
use App\Models\Period;
use App\Models\PeriodAssessmentComponent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PeriodAssessmentConfigController extends Controller
{
    /**
     * Get assessment configuration for a period by type.
     */
    public function show(Request $request, $periodId)
    {
        $request->validate([
            'type' => 'required|string|in:SEMPRO,SIDANG_TA,EXPO,BIMBINGAN,BIMBINGAN_SEMPRO,BIMBINGAN_EXPO,BIMBINGAN_TA,MILESTONE',
        ]);

        $period = Period::findOrFail($periodId);
        $type = $request->type;

        // Get all active templates
        $allTemplates = AssessmentComponentTemplate::where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        // Get selected components for this period + type
        $selectedComponents = PeriodAssessmentComponent::with('template')
            ->where('period_id', $periodId)
            ->where('type', $type)
            ->orderBy('sort_order')
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'template_id' => $c->template_id,
                'code' => $c->template->code,
                'name' => $c->template->name,
                'description' => $c->template->description,
                'weight' => $c->template->weight,
                'sort_order' => $c->sort_order,
            ]);

        return response()->json([
            'period' => $period,
            'type' => $type,
            'all_templates' => $allTemplates,
            'selected_components' => $selectedComponents,
        ]);
    }

    /**
     * Configure assessment components for a period + type.
     */
    public function store(Request $request, $periodId)
    {
        $request->validate([
            'type' => 'required|string|in:SEMPRO,SIDANG_TA,EXPO,BIMBINGAN,BIMBINGAN_SEMPRO,BIMBINGAN_EXPO,BIMBINGAN_TA,MILESTONE',
            'template_ids' => 'required|array',
            'template_ids.*' => 'exists:assessment_component_templates,id',
        ]);

        $type = $request->type;

        return DB::transaction(function () use ($periodId, $type, $request) {
            // Delete existing config for this period + type
            PeriodAssessmentComponent::where('period_id', $periodId)
                ->where('type', $type)
                ->delete();

            // Create new config
            $created = [];
            foreach ($request->template_ids as $i => $templateId) {
                $created[] = PeriodAssessmentComponent::create([
                    'period_id' => $periodId,
                    'template_id' => $templateId,
                    'type' => $type,
                    'sort_order' => $i,
                ]);
            }

            return response()->json([
                'message' => 'Assessment configuration saved',
                'count' => count($created),
                'components' => $created,
            ], 201);
        });
    }

    /**
     * Copy assessment configuration from another period.
     */
    public function copy(Request $request, $periodId)
    {
        $request->validate([
            'source_period_id' => 'required|exists:periods,id|different:period_id',
        ]);

        $sourcePeriodId = $request->source_period_id;

        return DB::transaction(function () use ($periodId, $sourcePeriodId) {
            // Get all components from source period
            $sourceComponents = PeriodAssessmentComponent::where('period_id', $sourcePeriodId)
                ->orderBy('sort_order')
                ->get();

            if ($sourceComponents->isEmpty()) {
                return response()->json(['message' => 'Source period has no assessment configuration'], 400);
            }

            // Delete existing config for this period (all types)
            PeriodAssessmentComponent::where('period_id', $periodId)->delete();

            // Copy config
            $created = [];
            foreach ($sourceComponents as $component) {
                $created[] = PeriodAssessmentComponent::create([
                    'period_id' => $periodId,
                    'template_id' => $component->template_id,
                    'type' => $component->type,
                    'sort_order' => $component->sort_order,
                ]);
            }

            return response()->json([
                'message' => 'Assessment configuration copied',
                'count' => count($created),
                'components' => $created,
            ], 201);
        });
    }
}
