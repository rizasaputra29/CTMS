<?php

namespace App\Http\Controllers;

use App\Models\AssessmentComponent;
use App\Models\PeriodAssessmentComponent;
use App\Repositories\AssessmentScoreRepository;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AssessmentScoreController extends Controller
{
    use ApiResponseTrait;

    private function usesPeriodAssessmentComponents(): bool
    {
        return Schema::hasTable('period_assessment_components');
    }

    private function getEvaluatorIdField(string $type): string
    {
        return ($type === 'SEMPRO' || $type === 'SIDANG_TA') ? 'examiner_id' : 'evaluator_id';
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

        $hasPeriodComponentColumn = Schema::hasTable('bimbingan_sempro_scores')
            || Schema::hasTable('bimbingan_ta_scores');

        $idField = $this->getEvaluatorIdField($request->type);

        $existingScores = AssessmentScoreRepository::forType($request->type)
            ->where($idField, $user->id)
            ->where('group_id', $group->id)
            ->get()
            ->keyBy(function ($score) use ($hasPeriodComponentColumn) {
                $componentId = $hasPeriodComponentColumn && $score->period_component_id
                    ? $score->period_component_id
                    : $score->component_id;

                return $componentId.'_'.$score->student_id;
            });

        return $this->successResponse([
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
        $hasPeriodComponentColumn = Schema::hasTable('bimbingan_sempro_scores')
            || Schema::hasTable('bimbingan_ta_scores');

        $componentIds = collect($request->scores)->pluck('period_component_id')->map(fn ($v) => (int) $v)->unique()->values();

        if ($usePeriodComponents) {
            $validIds = PeriodAssessmentComponent::whereIn('id', $componentIds)->pluck('id')->all();
        } else {
            $validIds = AssessmentComponent::whereIn('id', $componentIds)->pluck('id')->all();
        }

        $invalidIds = $componentIds->diff($validIds)->values();
        if ($invalidIds->isNotEmpty()) {
            return $this->errorResponse('Invalid assessment component selected', 422);
        }

        // OPTIMIZED: Use upsert instead of updateOrCreate in loop for better performance
        $scoresData = [];
        $now = now();

        $idField = $this->getEvaluatorIdField($request->evaluation_type);

        foreach ($request->scores as $scoreData) {
            $data = [
                $idField => $user->id,
                'student_id' => $scoreData['student_id'] ?? null,
                'group_id' => $request->group_id,
                'score' => $scoreData['score'],
                'notes' => $scoreData['notes'] ?? null,
                'evaluation_type' => $request->evaluation_type,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if ($usePeriodComponents && $hasPeriodComponentColumn) {
                $data['period_component_id'] = $scoreData['period_component_id'];
                // Also add component_id for the unique constraint (set to null when using period_component_id)
                $data['component_id'] = null;
            } else {
                $data['component_id'] = $scoreData['period_component_id'];
            }

            $scoresData[] = $data;
        }

        // Determine unique keys and update columns based on schema
        // Use correct unique keys based on whether using period_assessment_components or legacy schema
        $uniqueKeys = $hasPeriodComponentColumn
            ? [$idField, 'student_id', 'period_component_id', 'group_id']
            : [$idField, 'student_id', 'component_id', 'group_id'];

        $updateColumns = ['group_id', 'score', 'notes', 'updated_at'];

        // Use repository to upsert - dispatches to correct table
        AssessmentScoreRepository::upsert($request->evaluation_type, $scoresData, $uniqueKeys, $updateColumns);

        return $this->createdResponse(['message' => 'Scores submitted', 'count' => count($scoresData)]);
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

        $evaluatorRelation = ($request->type === 'SEMPRO' || $request->type === 'SIDANG_TA') ? 'examiner' : 'evaluator';

        $scores = AssessmentScoreRepository::forType($request->type)
            ->with(['periodComponent.template', $evaluatorRelation, 'student', 'group'])
            ->whereHas('group', fn ($q) => $q->where('period_id', $request->period_id))
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

        return $this->successResponse($grouped);
    }
}
