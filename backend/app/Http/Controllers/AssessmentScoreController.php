<?php

namespace App\Http\Controllers;

use App\Models\AssessmentScore;
use App\Models\PeriodAssessmentComponent;
use Illuminate\Http\Request;

class AssessmentScoreController extends Controller
{
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

        // Get components for this period + type from period_assessment_components
        $periodComponents = PeriodAssessmentComponent::with('template')
            ->where('period_id', $group->period_id)
            ->where('type', $request->type)
            ->orderBy('sort_order')
            ->get();

        // Map to component format
        $components = $periodComponents->map(fn($c) => [
            'id' => $c->id,
            'code' => $c->template->code,
            'name' => $c->template->name,
            'description' => $c->template->description,
            'weight' => $c->template->weight,
            'sort_order' => $c->sort_order,
            'template_id' => $c->template_id,
        ]);

        // Get existing scores by this evaluator for this group using period_component_id
        $existingScores = AssessmentScore::where('evaluator_id', $user->id)
            ->where('group_id', $group->id)
            ->where('evaluation_type', $request->type)
            ->get()
            ->keyBy(function ($score) {
                return $score->period_component_id . '_' . $score->student_id;
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
            'scores.*.period_component_id' => 'required|exists:period_assessment_components,id',
            'scores.*.student_id' => 'nullable|exists:users,id',
            'scores.*.score' => 'required|numeric|min:0|max:100',
            'scores.*.notes' => 'nullable|string',
        ]);

        $user = $request->user();
        $saved = [];

        foreach ($request->scores as $scoreData) {
            $saved[] = AssessmentScore::updateOrCreate(
                [
                    'period_component_id' => $scoreData['period_component_id'],
                    'evaluator_id' => $user->id,
                    'student_id' => $scoreData['student_id'] ?? null,
                ],
                [
                    'group_id' => $request->group_id,
                    'score' => $scoreData['score'],
                    'notes' => $scoreData['notes'] ?? null,
                    'evaluation_type' => $request->evaluation_type,
                ]
            );
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
