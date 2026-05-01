<?php

namespace App\Http\Controllers;

use App\Models\AssessmentScore;
use App\Models\AssessmentComponent;
use App\Models\PeriodAssessmentComponent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AssessmentScoreController extends Controller
{
    private function usesPeriodAssessmentComponents(): bool
    {
        return Schema::hasTable('period_assessment_components');
    }

    /**
     * Get the assessment form: components + any existing scores for a group.
     * Used by Dosen to fill evaluations.
     */
    public function index(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'type' => 'required|string|in:SEMPRO,SIDANG_TA,EXPO,BIMBINGAN',
        ]);

        $user = $request->user();
        $group = \App\Models\Group::with('members.student', 'period')->findOrFail($request->group_id);

        if ($this->usesPeriodAssessmentComponents()) {
            $periodComponents = PeriodAssessmentComponent::with('template')
                ->where('period_id', $group->period_id)
                ->where('type', $request->type)
                ->orderBy('sort_order')
                ->get();

            $components = $periodComponents->map(fn ($c) => [
                'id' => $c->id,
                'code' => $c->template->code,
                'name' => $c->template->name,
                'description' => $c->template->description,
                'weight' => $c->template->weight,
                'sort_order' => $c->sort_order,
                'template_id' => $c->template_id,
            ]);
        } else {
            $components = AssessmentComponent::query()
                ->where('period_id', $group->period_id)
                ->where('type', $request->type)
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($c) => [
                    'id' => $c->id,
                    'code' => $c->code,
                    'name' => $c->name,
                    'description' => $c->description,
                    'weight' => $c->weight,
                    'sort_order' => $c->sort_order,
                    'template_id' => null,
                ]);
        }

        $hasPeriodComponentColumn = Schema::hasTable('assessment_scores')
            && Schema::hasColumn('assessment_scores', 'period_component_id');

        $existingScores = AssessmentScore::where('evaluator_id', $user->id)
            ->where('group_id', $group->id)
            ->where('evaluation_type', $request->type)
            ->get()
            ->keyBy(function ($score) use ($hasPeriodComponentColumn) {
                $componentId = $hasPeriodComponentColumn
                    ? ($score->period_component_id ?? $score->component_id)
                    : $score->component_id;

                return $componentId . '_' . $score->student_id;
            });

        return response()->json([
            'components' => $components,
            'existing_scores' => $existingScores,
            'group' => $group,
        ]);
    }

    /**
     * Submit batch scores for a group.
     */
    public function store(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'evaluation_type' => 'required|string|in:SEMPRO,SIDANG_TA,EXPO,BIMBINGAN',
            'scores' => 'required|array|min:1',
            'scores.*.period_component_id' => 'required|integer',
            'scores.*.student_id' => 'nullable|exists:users,id',
            'scores.*.score' => 'required|numeric|min:0|max:100',
            'scores.*.notes' => 'nullable|string',
        ]);

        $user = $request->user();
        $saved = [];

        $usePeriodComponents = $this->usesPeriodAssessmentComponents();
        $hasPeriodComponentColumn = Schema::hasTable('assessment_scores')
            && Schema::hasColumn('assessment_scores', 'period_component_id');

        $componentIds = collect($request->scores)->pluck('period_component_id')->map(fn ($v) => (int) $v)->unique()->values();

        if ($usePeriodComponents) {
            $validIds = PeriodAssessmentComponent::whereIn('id', $componentIds)->pluck('id')->all();
        } else {
            $validIds = AssessmentComponent::whereIn('id', $componentIds)->pluck('id')->all();
        }

        $invalidIds = $componentIds->diff($validIds)->values();
        if ($invalidIds->isNotEmpty()) {
            return response()->json([
                'message' => 'Invalid assessment component selected',
                'invalid_component_ids' => $invalidIds,
            ], 422);
        }

        foreach ($request->scores as $scoreData) {
            $match = [
                'evaluator_id' => $user->id,
                'student_id' => $scoreData['student_id'] ?? null,
            ];

            if ($usePeriodComponents && $hasPeriodComponentColumn) {
                $match['period_component_id'] = $scoreData['period_component_id'];
            } else {
                $match['component_id'] = $scoreData['period_component_id'];
            }

            $saved[] = AssessmentScore::updateOrCreate($match, [
                'group_id' => $request->group_id,
                'score' => $scoreData['score'],
                'notes' => $scoreData['notes'] ?? null,
                'evaluation_type' => $request->evaluation_type,
            ]);
        }

        return response()->json(['message' => 'Scores submitted', 'count' => count($saved)], 201);
    }

    /**
     * Admin summary: aggregated scores per group/student for a period.
     */
    public function summary(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
            'type' => 'required|string|in:SEMPRO,SIDANG_TA,EXPO,BIMBINGAN',
        ]);

        $scores = AssessmentScore::with(['periodComponent.template', 'evaluator', 'student', 'group'])
            ->whereHas('group', fn($q) => $q->where('period_id', $request->period_id))
            ->where('evaluation_type', $request->type)
            ->get();

        // Group by group_id, then by student_id
        $grouped = $scores->groupBy('group_id')->map(function ($groupScores) {
            return $groupScores->groupBy('student_id')->map(function ($studentScores) {
                $totalWeighted = 0;
                $totalWeight = 0;

                foreach ($studentScores as $score) {
                    $weight = $score->periodComponent->template->weight;
                    $totalWeighted += $score->score * $weight;
                    $totalWeight += $weight;
                }

                return [
                    'student' => $studentScores->first()->student,
                    'scores' => $studentScores,
                    'weighted_avg' => $totalWeight > 0 ? round($totalWeighted / $totalWeight, 2) : 0,
                ];
            });
        });

        return response()->json($grouped);
    }
}
