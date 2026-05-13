<?php

namespace App\Http\Controllers;

use App\Models\AssessmentComponentTemplate;
use App\Models\Period;
use App\Models\PeriodPeerReviewIndicator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PeriodPeerReviewConfigController extends Controller
{
    /**
     * Get peer review configuration for a period.
     */
    public function show(Request $request, $periodId)
    {
        $period = Period::findOrFail($periodId);

        // Get all active templates from Assessment Bank
        $allTemplates = AssessmentComponentTemplate::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('code')
            ->get();

        // Get selected indicators for this period
        $selectedIndicators = PeriodPeerReviewIndicator::with('template')
            ->where('period_id', $periodId)
            ->orderBy('sort_order')
            ->get()
            ->map(fn($i) => [
                'id' => $i->id,
                'template_id' => $i->template_id,
                'code' => $i->template->code,
                'name' => $i->template->name,
                'description' => $i->template->description,
                'weight' => $i->template->weight,
                'sort_order' => $i->sort_order,
            ]);

        return response()->json([
            'period' => $period,
            'all_templates' => $allTemplates,
            'selected_indicators' => $selectedIndicators,
        ]);
    }

    /**
     * Configure peer review indicators for a period.
     */
    public function store(Request $request, $periodId)
    {
        $request->validate([
            'template_ids' => 'required|array',
            'template_ids.*' => 'exists:assessment_component_templates,id',
        ]);

        return DB::transaction(function () use ($periodId, $request) {
            // Delete existing config for this period
            PeriodPeerReviewIndicator::where('period_id', $periodId)->delete();

            // Create new config
            $created = [];
            foreach ($request->template_ids as $i => $templateId) {
                $created[] = PeriodPeerReviewIndicator::create([
                    'period_id' => $periodId,
                    'template_id' => $templateId,
                    'sort_order' => $i,
                ]);
            }

            return response()->json([
                'message' => 'Peer review configuration saved',
                'count' => count($created),
                'indicators' => $created,
            ], 201);
        });
    }

    /**
     * Copy peer review configuration from another period.
     */
    public function copy(Request $request, $periodId)
    {
        $request->validate([
            'source_period_id' => 'required|exists:periods,id|different:period_id',
        ]);

        $sourcePeriodId = $request->source_period_id;

        return DB::transaction(function () use ($periodId, $sourcePeriodId) {
            // Get all indicators from source period
            $sourceIndicators = PeriodPeerReviewIndicator::where('period_id', $sourcePeriodId)
                ->orderBy('sort_order')
                ->get();

            if ($sourceIndicators->isEmpty()) {
                return response()->json(['message' => 'Source period has no peer review configuration'], 400);
            }

            // Delete existing config for this period
            PeriodPeerReviewIndicator::where('period_id', $periodId)->delete();

            // Copy config
            $created = [];
            foreach ($sourceIndicators as $indicator) {
                $created[] = PeriodPeerReviewIndicator::create([
                    'period_id' => $periodId,
                    'template_id' => $indicator->template_id,
                    'sort_order' => $indicator->sort_order,
                ]);
            }

            return response()->json([
                'message' => 'Peer review configuration copied',
                'count' => count($created),
                'indicators' => $created,
            ], 201);
        });
    }
}
