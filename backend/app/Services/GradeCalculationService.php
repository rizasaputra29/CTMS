<?php

namespace App\Services;

use App\Models\AssessmentScore;
use App\Models\Group;
use App\Models\Period;
use App\Models\PeriodAssessmentComponent;
use Illuminate\Support\Facades\Log;

class GradeCalculationService
{
    /**
     * Default grade weights configuration.
     */
    private const DEFAULT_PDC1_WEIGHTS = [
        'SEMPRO' => 60,
        'BIMBINGAN_SEMPRO' => 40,
    ];

    private const DEFAULT_PDC2_WEIGHTS = [
        'EXPO' => 50,
        'BIMBINGAN_EXPO' => 25,
        'MILESTONE' => 25,
    ];

    /**
     * Calculate PDC1 grade for a group.
     * PDC1 = (SEMPRO × weight) + (BIMBINGAN_SEMPRO × weight)
     */
    public function calculatePDC1(int $groupId): ?array
    {
        try {
            $group = Group::with('period')->findOrFail($groupId);
            $weights = $this->getPDC1Weights($group->period_id);

            $semproScore = $this->getAverageEvaluationScore($groupId, 'SEMPRO');
            $bimbinganSemproScore = $this->getAverageEvaluationScore($groupId, 'BIMBINGAN_SEMPRO');

            if ($semproScore === null && $bimbinganSemproScore === null) {
                return null;
            }

            $weightedSempro = $semproScore !== null ? ($semproScore * ($weights['SEMPRO'] / 100)) : 0;
            $weightedBimbingan = $bimbinganSemproScore !== null ? ($bimbinganSemproScore * ($weights['BIMBINGAN_SEMPRO'] / 100)) : 0;

            $totalWeight = 0;
            if ($semproScore !== null) $totalWeight += $weights['SEMPRO'];
            if ($bimbinganSemproScore !== null) $totalWeight += $weights['BIMBINGAN_SEMPRO'];

            $finalGrade = $totalWeight > 0 ? (($weightedSempro + $weightedBimbingan) / $totalWeight) * 100 : 0;

            return [
                'grade' => round($finalGrade, 2),
                'components' => [
                    'SEMPRO' => [
                        'score' => $semproScore,
                        'weight' => $weights['SEMPRO'],
                        'weighted_score' => round($weightedSempro, 2),
                    ],
                    'BIMBINGAN_SEMPRO' => [
                        'score' => $bimbinganSemproScore,
                        'weight' => $weights['BIMBINGAN_SEMPRO'],
                        'weighted_score' => round($weightedBimbingan, 2),
                    ],
                ],
                'total_weight' => $totalWeight,
            ];
        } catch (\Exception $e) {
            Log::error("Failed to calculate PDC1 for group {$groupId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Calculate PDC2 grade for a group.
     * PDC2 = (EXPO × weight) + (BIMBINGAN_EXPO × weight) + (MILESTONE × weight)
     */
    public function calculatePDC2(int $groupId): ?array
    {
        try {
            $group = Group::with('period')->findOrFail($groupId);
            $weights = $this->getPDC2Weights($group->period_id);

            $expoScore = $this->getAverageEvaluationScore($groupId, 'EXPO');
            $bimbinganExpoScore = $this->getAverageEvaluationScore($groupId, 'BIMBINGAN_EXPO');
            $milestoneScore = $this->getAverageEvaluationScore($groupId, 'MILESTONE');

            if ($expoScore === null && $bimbinganExpoScore === null && $milestoneScore === null) {
                return null;
            }

            $weightedExpo = $expoScore !== null ? ($expoScore * ($weights['EXPO'] / 100)) : 0;
            $weightedBimbingan = $bimbinganExpoScore !== null ? ($bimbinganExpoScore * ($weights['BIMBINGAN_EXPO'] / 100)) : 0;
            $weightedMilestone = $milestoneScore !== null ? ($milestoneScore * ($weights['MILESTONE'] / 100)) : 0;

            $totalWeight = 0;
            if ($expoScore !== null) $totalWeight += $weights['EXPO'];
            if ($bimbinganExpoScore !== null) $totalWeight += $weights['BIMBINGAN_EXPO'];
            if ($milestoneScore !== null) $totalWeight += $weights['MILESTONE'];

            $finalGrade = $totalWeight > 0 ? (($weightedExpo + $weightedBimbingan + $weightedMilestone) / $totalWeight) * 100 : 0;

            return [
                'grade' => round($finalGrade, 2),
                'components' => [
                    'EXPO' => [
                        'score' => $expoScore,
                        'weight' => $weights['EXPO'],
                        'weighted_score' => round($weightedExpo, 2),
                    ],
                    'BIMBINGAN_EXPO' => [
                        'score' => $bimbinganExpoScore,
                        'weight' => $weights['BIMBINGAN_EXPO'],
                        'weighted_score' => round($weightedBimbingan, 2),
                    ],
                    'MILESTONE' => [
                        'score' => $milestoneScore,
                        'weight' => $weights['MILESTONE'],
                        'weighted_score' => round($weightedMilestone, 2),
                    ],
                ],
                'total_weight' => $totalWeight,
            ];
        } catch (\Exception $e) {
            Log::error("Failed to calculate PDC2 for group {$groupId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Get PDC1 weights for a period.
     */
    public function getPDC1Weights(int $periodId): array
    {
        $period = Period::find($periodId);
        
        if ($period && $period->grade_configuration && isset($period->grade_configuration['pdc1'])) {
            return $period->grade_configuration['pdc1'];
        }

        return self::DEFAULT_PDC1_WEIGHTS;
    }

    /**
     * Get PDC2 weights for a period.
     */
    public function getPDC2Weights(int $periodId): array
    {
        $period = Period::find($periodId);
        
        if ($period && $period->grade_configuration && isset($period->grade_configuration['pdc2'])) {
            return $period->grade_configuration['pdc2'];
        }

        return self::DEFAULT_PDC2_WEIGHTS;
    }

    /**
     * Get full grade configuration for a period.
     */
    public function getFullConfiguration(int $periodId): array
    {
        return [
            'pdc1' => $this->getPDC1Weights($periodId),
            'pdc2' => $this->getPDC2Weights($periodId),
            'defaults' => [
                'pdc1' => self::DEFAULT_PDC1_WEIGHTS,
                'pdc2' => self::DEFAULT_PDC2_WEIGHTS,
            ],
        ];
    }

    /**
     * Update grade configuration for a period.
     */
    public function updateConfiguration(int $periodId, array $config): bool
    {
        try {
            $period = Period::findOrFail($periodId);
            
            $gradeConfig = $period->grade_configuration ?? [];
            
            if (isset($config['pdc1'])) {
                $gradeConfig['pdc1'] = $config['pdc1'];
            }
            
            if (isset($config['pdc2'])) {
                $gradeConfig['pdc2'] = $config['pdc2'];
            }
            
            $period->grade_configuration = $gradeConfig;
            $period->save();

            return true;
        } catch (\Exception $e) {
            Log::error("Failed to update grade configuration for period {$periodId}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Reset to default weights.
     */
    public function resetToDefaults(int $periodId): bool
    {
        return $this->updateConfiguration($periodId, [
            'pdc1' => self::DEFAULT_PDC1_WEIGHTS,
            'pdc2' => self::DEFAULT_PDC2_WEIGHTS,
        ]);
    }

    /**
     * Get average evaluation score for a group and evaluation type.
     */
    private function getAverageEvaluationScore(int $groupId, string $evaluationType): ?float
    {
        $scores = AssessmentScore::where('group_id', $groupId)
            ->where('evaluation_type', $evaluationType)
            ->get();

        if ($scores->isEmpty()) {
            return null;
        }

        // Calculate weighted average per component
        $totalWeighted = 0;
        $totalWeight = 0;

        foreach ($scores as $score) {
            $component = PeriodAssessmentComponent::with('template')
                ->find($score->period_component_id);
            
            if ($component && $component->template) {
                $weight = $component->template->weight;
                $totalWeighted += $score->score * $weight;
                $totalWeight += $weight;
            }
        }

        return $totalWeight > 0 ? ($totalWeighted / $totalWeight) : null;
    }

    /**
     * Get all grades summary for a group.
     */
    public function getFullGradeSummary(int $groupId): array
    {
        $pdc1 = $this->calculatePDC1($groupId);
        $pdc2 = $this->calculatePDC2($groupId);

        return [
            'pdc1' => $pdc1,
            'pdc2' => $pdc2,
            'final_grade' => $this->calculateFinalGrade($pdc1, $pdc2),
        ];
    }

    /**
     * Calculate final grade (average of PDC1 and PDC2).
     */
    private function calculateFinalGrade(?array $pdc1, ?array $pdc2): ?float
    {
        $grades = [];
        
        if ($pdc1 && isset($pdc1['grade'])) {
            $grades[] = $pdc1['grade'];
        }
        
        if ($pdc2 && isset($pdc2['grade'])) {
            $grades[] = $pdc2['grade'];
        }

        if (empty($grades)) {
            return null;
        }

        return round(array_sum($grades) / count($grades), 2);
    }

    /**
     * Recalculate grades and notify relevant parties when all evaluations are complete.
     */
    public function recalculateAndNotify(int $groupId, string $evaluationType): void
    {
        $group = Group::find($groupId);
        if (!$group) {
            Log::warning("Group {$groupId} not found for grade recalculation");
            return;
        }

        // Recalculate based on evaluation type
        switch ($evaluationType) {
            case 'BIMBINGAN_SEMPRO':
                $this->calculatePDC1($groupId);
                break;
            case 'BIMBINGAN_EXPO':
            case 'MILESTONE':
                $this->calculatePDC2($groupId);
                break;
            case 'TA_DEFENSE':
            case 'BIMBINGAN_TA':
                // TA grades are calculated per student, not per group
                // Get all students in the group and recalculate their TA grades
                $group = Group::with('members.student')->find($groupId);
                if ($group) {
                    foreach ($group->members as $member) {
                        $this->calculateTA($member->student_id, $groupId);
                    }
                }
                break;
        }

        Log::info("Grades recalculated for group {$groupId} after {$evaluationType} completion");
    }

    /**
     * Calculate TA grade for an individual student.
     * TA = (TA_DEFENSE × weight) + (BIMBINGAN_TA × weight)
     */
    public function calculateTA(int $studentId, int $groupId): ?array
    {
        try {
            $group = Group::with('period')->findOrFail($groupId);
            
            // Get TA evaluation scores for this specific student
            $taDefenseScores = AssessmentScore::where('student_id', $studentId)
                ->where('group_id', $groupId)
                ->where('evaluation_type', 'TA_DEFENSE')
                ->get();
            
            $bimbinganTAScores = AssessmentScore::where('student_id', $studentId)
                ->where('group_id', $groupId)
                ->where('evaluation_type', 'BIMBINGAN_TA')
                ->get();

            // Calculate weighted averages
            $taDefenseAvg = $this->calculateWeightedAverageFromScores($taDefenseScores);
            $bimbinganTAAvg = $this->calculateWeightedAverageFromScores($bimbinganTAScores);

            if ($taDefenseAvg === null && $bimbinganTAAvg === null) {
                return null;
            }

            // Default weights for TA (can be customized per period)
            $taDefenseWeight = 60;
            $bimbinganTAWeight = 40;

            $weightedTaDefense = $taDefenseAvg !== null ? ($taDefenseAvg * ($taDefenseWeight / 100)) : 0;
            $weightedBimbinganTA = $bimbinganTAAvg !== null ? ($bimbinganTAAvg * ($bimbinganTAWeight / 100)) : 0;

            $totalWeight = 0;
            if ($taDefenseAvg !== null) $totalWeight += $taDefenseWeight;
            if ($bimbinganTAAvg !== null) $totalWeight += $bimbinganTAWeight;

            $grade = $totalWeight > 0 
                ? round((($weightedTaDefense + $weightedBimbinganTA) / $totalWeight) * 100, 2)
                : 0;

            return [
                'student_id' => $studentId,
                'group_id' => $groupId,
                'components' => [
                    'TA_DEFENSE' => [
                        'score' => $taDefenseAvg,
                        'weight' => $taDefenseWeight,
                        'contribution' => $weightedTaDefense,
                    ],
                    'BIMBINGAN_TA' => [
                        'score' => $bimbinganTAAvg,
                        'weight' => $bimbinganTAWeight,
                        'contribution' => $weightedBimbinganTA,
                    ],
                ],
                'total_weight' => $totalWeight,
                'grade' => $grade,
                'calculated_at' => now()->toDateTimeString(),
            ];
        } catch (\Exception $e) {
            Log::error("Failed to calculate TA grade for student {$studentId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Calculate weighted average from a collection of scores.
     */
    private function calculateWeightedAverageFromScores($scores): ?float
    {
        if ($scores->isEmpty()) {
            return null;
        }

        $totalWeighted = 0;
        $totalWeight = 0;

        foreach ($scores as $score) {
            $component = PeriodAssessmentComponent::with('template')
                ->find($score->period_component_id);
            
            if ($component && $component->template) {
                $weight = $component->template->weight;
                $totalWeighted += $score->score * $weight;
                $totalWeight += $weight;
            }
        }

        return $totalWeight > 0 ? ($totalWeighted / $totalWeight) : null;
    }
}
