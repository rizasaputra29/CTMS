<?php

namespace App\Services;

use App\Models\AssessmentScore;
use App\Models\Group;
use App\Models\Period;
use App\Models\PeriodAssessmentComponent;
use App\Models\PeerReview;
use Illuminate\Support\Facades\Log;

class GradeCalculationService
{
    /**
     * In-memory cache for batch data loading.
     * Used to eliminate N+1 query problems.
     */
    private array $batchCache = [];

    /**
     * Preload all period data into memory cache.
     * Call this ONCE before processing multiple students.
     * Reduces queries from 3,200+ to ~5 for 200 students.
     */
    public function preloadPeriodData(int $periodId): void
    {
        $this->clearCache();

        // 1. Get all group IDs for this period
        $groupIds = Group::where('period_id', $periodId)->pluck('id')->toArray();
        $this->batchCache['group_ids'] = $groupIds;

        // 2. Batch load ALL assessment scores with relationships
        $scores = AssessmentScore::with(['evaluator:id,name', 'periodComponent.template'])
            ->whereIn('group_id', $groupIds)
            ->get();

        foreach ($scores as $score) {
            $key = "{$score->student_id}:{$score->group_id}:{$score->evaluation_type}";
            if (!isset($this->batchCache['assessment_scores'][$key])) {
                $this->batchCache['assessment_scores'][$key] = [];
            }
            $this->batchCache['assessment_scores'][$key][] = $score;
        }

        // 3. Batch load ALL peer reviews
        $reviews = PeerReview::with(['periodIndicator.template'])
            ->whereIn('group_id', $groupIds)
            ->where('is_final_submission', true)
            ->get();

        foreach ($reviews as $review) {
            $key = "{$review->reviewee_id}:{$review->group_id}";
            if (!isset($this->batchCache['peer_reviews'][$key])) {
                $this->batchCache['peer_reviews'][$key] = [];
            }
            $this->batchCache['peer_reviews'][$key][] = $review;
        }

        // 4. Batch load ALL groups with supervisors
        $groups = Group::with(['supervisor1:id,name', 'supervisor2:id,name'])
            ->where('period_id', $periodId)
            ->get();

        $this->batchCache['groups'] = $groups->keyBy('id');

        // 5. Pre-compute evaluator roles
        foreach ($groups as $group) {
            if ($group->supervisor_1_id) {
                $this->batchCache['evaluator_roles'][$group->id][$group->supervisor_1_id] = 'SUPERVISOR_1';
            }
            if ($group->supervisor_2_id) {
                $this->batchCache['evaluator_roles'][$group->id][$group->supervisor_2_id] = 'SUPERVISOR_2';
            }
        }

        // 6. Batch load period components
        $components = PeriodAssessmentComponent::with('template')
            ->whereHas('period', fn($q) => $q->where('id', $periodId))
            ->get();

        $this->batchCache['period_components'] = $components->keyBy('id');

        // 7. Batch load peer review indicators
        $indicators = \App\Models\PeriodPeerReviewIndicator::with('template')
            ->whereHas('period', fn($q) => $q->where('id', $periodId))
            ->get();

        $this->batchCache['peer_review_indicators'] = $indicators->keyBy('id');
    }

    /**
     * Clear the batch cache to free memory.
     */
    public function clearCache(): void
    {
        $this->batchCache = [];
    }

    /**
     * Calculate PDC1 for multiple students using cached data.
     */
    public function calculatePDC1ForStudentsBatch(array $studentGroupPairs): array
    {
        $results = [];
        foreach ($studentGroupPairs as $pair) {
            $studentId = $pair['student_id'];
            $groupId = $pair['group_id'];
            $results[$studentId] = $this->calculatePDC1FromCache($studentId, $groupId);
        }
        return $results;
    }

    /**
     * Calculate PDC2 for multiple students using cached data.
     */
    public function calculatePDC2ForStudentsBatch(array $studentGroupPairs): array
    {
        $results = [];
        foreach ($studentGroupPairs as $pair) {
            $studentId = $pair['student_id'];
            $groupId = $pair['group_id'];
            $results[$studentId] = $this->calculatePDC2FromCache($studentId, $groupId);
        }
        return $results;
    }

    /**
     * Calculate SIDANG_TA for multiple students using cached data.
     */
    public function calculateSidangTAForStudentsBatch(array $studentGroupPairs): array
    {
        $results = [];
        foreach ($studentGroupPairs as $pair) {
            $studentId = $pair['student_id'];
            $groupId = $pair['group_id'];
            $results[$studentId] = $this->calculateSidangTAFromCache($studentId, $groupId);
        }
        return $results;
    }

    /**
     * Calculate PDC1 using cached data (no database queries).
     */
    private function calculatePDC1FromCache(int $studentId, int $groupId): ?array
    {
        $semproKey = "{$studentId}:{$groupId}:SEMPRO";
        $bimbinganKey = "{$studentId}:{$groupId}:BIMBINGAN_SEMPRO";

        $semproScores = $this->batchCache['assessment_scores'][$semproKey] ?? [];
        $bimbinganScores = $this->batchCache['assessment_scores'][$bimbinganKey] ?? [];

        $semproScore = $this->calculateWeightedAverageFromCache($semproScores);
        $bimbinganSemproScore = $this->calculateWeightedAverageFromCache($bimbinganScores);

        $hasSempro = $semproScore !== null;
        $hasBimbingan = $bimbinganSemproScore !== null;

        if (!$hasSempro && !$hasBimbingan) {
            return null;
        }

        $scores = [];
        if ($hasSempro) $scores[] = $semproScore;
        if ($hasBimbingan) $scores[] = $bimbinganSemproScore;

        $average = !empty($scores) ? (array_sum($scores) / count($scores)) : 0;

        return [
            'grade' => round($average, 2),
            'components' => [
                'SEMPRO' => [
                    'score' => $semproScore,
                    'evaluators' => $this->getEvaluatorsFromCache($studentId, $groupId, 'SEMPRO'),
                ],
                'BIMBINGAN_SEMPRO' => [
                    'score' => $bimbinganSemproScore,
                    'evaluators' => $this->getEvaluatorsFromCache($studentId, $groupId, 'BIMBINGAN_SEMPRO'),
                ],
            ],
            'component_count' => count($scores),
            'status' => count($scores) === 2 ? 'COMPLETE' : 'PARTIAL',
        ];
    }

    /**
     * Calculate PDC2 using cached data (no database queries).
     */
    private function calculatePDC2FromCache(int $studentId, int $groupId): ?array
    {
        $nilaiDosenScores = $this->getScoresFromCache($studentId, $groupId, 'NILAI_DOSEN');
        $milestoneScores = $this->getScoresFromCache($studentId, $groupId, 'MILESTONE');
        $expoScores = $this->getScoresFromCache($studentId, $groupId, 'EXPO');
        $peerReviewScores = $this->getPeerReviewsFromCache($studentId, $groupId);

        $nilaiDosenScore = $this->calculateWeightedAverageFromCache($nilaiDosenScores);
        $milestoneScore = $this->calculateWeightedAverageFromCache($milestoneScores);
        $expoScore = $this->calculateWeightedAverageFromCache($expoScores);
        $peerReviewScore = $this->calculatePeerReviewAverageFromCache($peerReviewScores);

        $componentCount = 0;
        $totalScore = 0;

        if ($nilaiDosenScore !== null) { $componentCount++; $totalScore += $nilaiDosenScore; }
        if ($milestoneScore !== null) { $componentCount++; $totalScore += $milestoneScore; }
        if ($expoScore !== null) { $componentCount++; $totalScore += $expoScore; }
        if ($peerReviewScore !== null) { $componentCount++; $totalScore += $peerReviewScore; }

        if ($componentCount === 0) {
            return null;
        }

        $average = $componentCount > 0 ? ($totalScore / $componentCount) : 0;

        return [
            'grade' => round($average, 2),
            'components' => [
                'NILAI_DOSEN' => [
                    'score' => $nilaiDosenScore,
                    'evaluators' => $this->getEvaluatorsFromCache($studentId, $groupId, 'NILAI_DOSEN'),
                ],
                'MILESTONE' => [
                    'score' => $milestoneScore,
                    'evaluators' => $this->getEvaluatorsFromCache($studentId, $groupId, 'MILESTONE'),
                ],
                'EXPO' => [
                    'score' => $expoScore,
                    'evaluators' => $this->getEvaluatorsFromCache($studentId, $groupId, 'EXPO'),
                ],
                'PEER_REVIEW' => [
                    'score' => $peerReviewScore,
                    'evaluators' => [['name' => 'Peers', 'role' => 'STUDENT']],
                ],
            ],
            'component_count' => $componentCount,
            'status' => $componentCount === 4 ? 'COMPLETE' : 'PARTIAL',
        ];
    }

    /**
     * Calculate SIDANG_TA using cached data (no database queries).
     */
    private function calculateSidangTAFromCache(int $studentId, int $groupId): ?array
    {
        $sidangScores = $this->getScoresFromCache($studentId, $groupId, 'SIDANG_TA');
        $sidangScore = $this->calculateWeightedAverageFromCache($sidangScores);

        if ($sidangScore === null) {
            return null;
        }

        return [
            'grade' => round($sidangScore, 2),
            'components' => [
                'SIDANG_TA' => [
                    'score' => $sidangScore,
                    'evaluators' => $this->getEvaluatorsFromCache($studentId, $groupId, 'SIDANG_TA'),
                ],
            ],
            'component_count' => 1,
            'status' => 'COMPLETE',
        ];
    }

    /**
     * Get assessment scores from cache.
     */
    private function getScoresFromCache(int $studentId, int $groupId, string $evaluationType): array
    {
        $key = "{$studentId}:{$groupId}:{$evaluationType}";
        return $this->batchCache['assessment_scores'][$key] ?? [];
    }

    /**
     * Get peer reviews from cache.
     */
    private function getPeerReviewsFromCache(int $studentId, int $groupId): array
    {
        $key = "{$studentId}:{$groupId}";
        return $this->batchCache['peer_reviews'][$key] ?? [];
    }

    /**
     * Calculate weighted average from cached score objects.
     */
    private function calculateWeightedAverageFromCache(array $scores): ?float
    {
        if (empty($scores)) {
            return null;
        }

        $totalWeighted = 0;
        $totalWeight = 0;

        foreach ($scores as $score) {
            $component = $score->periodComponent;
            if ($component && $component->template) {
                $weight = $component->template->weight;
                $totalWeighted += $score->score * $weight;
                $totalWeight += $weight;
            }
        }

        return $totalWeight > 0 ? ($totalWeighted / $totalWeight) : null;
    }

    /**
     * Calculate peer review average from cached reviews.
     */
    private function calculatePeerReviewAverageFromCache(array $reviews): ?float
    {
        if (empty($reviews)) {
            return null;
        }

        $totalWeighted = 0;
        $totalWeight = 0;

        foreach ($reviews as $review) {
            $indicator = $this->batchCache['peer_review_indicators'][$review->period_indicator_id] ?? null;
            if ($indicator && $indicator->template) {
                $weight = $indicator->template->weight;
                $convertedScore = $review->raw_score * 25;
                $totalWeighted += $convertedScore * $weight;
                $totalWeight += $weight;
            }
        }

        return $totalWeight > 0 ? ($totalWeighted / $totalWeight) : null;
    }

    /**
     * Get evaluators from cache.
     */
    private function getEvaluatorsFromCache(int $studentId, int $groupId, string $evaluationType): array
    {
        $scores = $this->getScoresFromCache($studentId, $groupId, $evaluationType);
        $evaluators = [];

        foreach ($scores as $score) {
            if ($score->evaluator) {
                $evaluators[] = [
                    'name' => $score->evaluator->name,
                    'role' => $this->getEvaluatorRoleFromCache($score->evaluator_id, $groupId),
                ];
            }
        }

        return $evaluators;
    }

    /**
     * Get evaluator role from cache.
     */
    private function getEvaluatorRoleFromCache(int $evaluatorId, int $groupId): string
    {
        return $this->batchCache['evaluator_roles'][$groupId][$evaluatorId] ?? 'EXAMINER';
    }

    /**
     * Calculate SIDANG_TA grade for a student (individual method).
     */
    public function calculateSidangTAForStudent(int $studentId, int $groupId): ?array
    {
        try {
            $sidangScore = $this->getStudentEvaluationScore($studentId, $groupId, 'SIDANG_TA');

            if ($sidangScore === null) {
                return null;
            }

            return [
                'grade' => round($sidangScore, 2),
                'components' => [
                    'SIDANG_TA' => [
                        'score' => $sidangScore,
                        'evaluators' => $this->getEvaluatorsForStudent($studentId, $groupId, 'SIDANG_TA'),
                    ],
                ],
                'component_count' => 1,
                'status' => 'COMPLETE',
            ];
        } catch (\Exception $e) {
            Log::error("Failed to calculate SIDANG_TA for student {$studentId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Calculate PDC1 grade for a student.
     * PDC1 = (SEMPRO_avg + BIMBINGAN_SEMPRO_avg) / 2
     * Returns 0-100 scale
     */
    public function calculatePDC1ForStudent(int $studentId, int $groupId): ?array
    {
        try {
            $semproScore = $this->getStudentEvaluationScore($studentId, $groupId, 'SEMPRO');
            $bimbinganSemproScore = $this->getStudentEvaluationScore($studentId, $groupId, 'BIMBINGAN_SEMPRO');

            // Check if any scores exist
            $hasScore = false;
            $componentCount = 0;
            $totalScore = 0;

            if ($semproScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $semproScore;
            }

            if ($bimbinganSemproScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $bimbinganSemproScore;
            }

            if (!$hasScore) {
                return null;
            }

            $average = $componentCount > 0 ? ($totalScore / $componentCount) : 0;

            return [
                'grade' => round($average, 2),
                'components' => [
                    'SEMPRO' => [
                        'score' => $semproScore,
                        'evaluators' => $this->getEvaluatorsForStudent($studentId, $groupId, 'SEMPRO'),
                    ],
                    'BIMBINGAN_SEMPRO' => [
                        'score' => $bimbinganSemproScore,
                        'evaluators' => $this->getEvaluatorsForStudent($studentId, $groupId, 'BIMBINGAN_SEMPRO'),
                    ],
                ],
                'component_count' => $componentCount,
                'status' => $componentCount === 2 ? 'COMPLETE' : 'PARTIAL',
            ];
        } catch (\Exception $e) {
            Log::error("Failed to calculate PDC1 for student {$studentId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Calculate PDC2 grade for a student.
     * PDC2 = (NILAI_DOSEN_avg + MILESTONE_avg + EXPO_avg + PEER_REVIEW_avg) / 4
     * Returns 0-100 scale
     */
    public function calculatePDC2ForStudent(int $studentId, int $groupId): ?array
    {
        try {
            $nilaiDosenScore = $this->getStudentEvaluationScore($studentId, $groupId, 'NILAI_DOSEN');
            $milestoneScore = $this->getStudentEvaluationScore($studentId, $groupId, 'MILESTONE');
            $expoScore = $this->getStudentEvaluationScore($studentId, $groupId, 'EXPO');
            $peerReviewScore = $this->getStudentPeerReviewAverage($studentId, $groupId);

            // Check if any scores exist
            $hasScore = false;
            $componentCount = 0;
            $totalScore = 0;

            if ($nilaiDosenScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $nilaiDosenScore;
            }

            if ($milestoneScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $milestoneScore;
            }

            if ($expoScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $expoScore;
            }

            if ($peerReviewScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $peerReviewScore;
            }

            if (!$hasScore) {
                return null;
            }

            $average = $componentCount > 0 ? ($totalScore / $componentCount) : 0;

            return [
                'grade' => round($average, 2),
                'components' => [
                    'NILAI_DOSEN' => [
                        'score' => $nilaiDosenScore,
                        'evaluators' => $this->getEvaluatorsForStudent($studentId, $groupId, 'NILAI_DOSEN'),
                    ],
                    'MILESTONE' => [
                        'score' => $milestoneScore,
                        'evaluators' => $this->getEvaluatorsForStudent($studentId, $groupId, 'MILESTONE'),
                    ],
                    'EXPO' => [
                        'score' => $expoScore,
                        'evaluators' => $this->getEvaluatorsForStudent($studentId, $groupId, 'EXPO'),
                    ],
                    'PEER_REVIEW' => [
                        'score' => $peerReviewScore,
                        'evaluators' => [['name' => 'Peers', 'role' => 'STUDENT']],
                    ],
                ],
                'component_count' => $componentCount,
                'status' => $componentCount === 4 ? 'COMPLETE' : 'PARTIAL',
            ];
        } catch (\Exception $e) {
            Log::error("Failed to calculate PDC2 for student {$studentId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Calculate final grade for a student.
     * Final = (PDC1 + PDC2) / 2
     * Returns 0-100 scale
     */
    public function calculateFinalGradeForStudent(int $studentId, int $groupId): ?array
    {
        $pdc1 = $this->calculatePDC1ForStudent($studentId, $groupId);
        $pdc2 = $this->calculatePDC2ForStudent($studentId, $groupId);

        if (!$pdc1 && !$pdc2) {
            return null;
        }

        $pdc1Grade = $pdc1['grade'] ?? null;
        $pdc2Grade = $pdc2['grade'] ?? null;

        $grades = [];
        if ($pdc1Grade !== null) $grades[] = $pdc1Grade;
        if ($pdc2Grade !== null) $grades[] = $pdc2Grade;

        $finalGrade = count($grades) > 0 ? (array_sum($grades) / count($grades)) : 0;

        return [
            'final_grade' => round($finalGrade, 2),
            'letter_grade' => $this->getLetterGrade($finalGrade),
            'pdc1' => $pdc1,
            'pdc2' => $pdc2,
            'status' => ($pdc1 && $pdc2) ? 'COMPLETE' : 'PARTIAL',
        ];
    }

    /**
     * Get letter grade from numeric score.
     */
    public function getLetterGrade(float $score): string
    {
        return match (true) {
            $score >= 85 => 'A',
            $score >= 70 => 'B',
            $score >= 60 => 'C',
            $score >= 50 => 'D',
            default => 'E',
        };
    }

    /**
     * Get evaluation score for a specific student.
     */
    private function getStudentEvaluationScore(int $studentId, int $groupId, string $evaluationType): ?float
    {
        $scores = AssessmentScore::where('student_id', $studentId)
            ->where('group_id', $groupId)
            ->where('evaluation_type', $evaluationType)
            ->get();

        if ($scores->isEmpty()) {
            return null;
        }

        return $this->calculateWeightedAverageFromScores($scores);
    }

    /**
     * Get evaluators and their individual scores for a student.
     */
    private function getEvaluatorsForStudent(int $studentId, int $groupId, string $evaluationType): array
    {
        $scores = AssessmentScore::with('evaluator')
            ->where('student_id', $studentId)
            ->where('group_id', $groupId)
            ->where('evaluation_type', $evaluationType)
            ->get();

        $evaluators = [];

        foreach ($scores as $score) {
            $component = PeriodAssessmentComponent::with('template')
                ->find($score->period_component_id);

            if ($component && $component->template) {
                $evaluators[] = [
                    'name' => $score->evaluator->name ?? 'Unknown',
                    'role' => $this->getEvaluatorRole($score->evaluator_id, $groupId),
                    'score' => $score->score,
                    'component' => $component->template->name,
                ];
            }
        }

        return $evaluators;
    }

    /**
     * Get peer review average for a student.
     */
    private function getStudentPeerReviewAverage(int $studentId, int $groupId): ?float
    {
        $reviews = PeerReview::where('reviewee_id', $studentId)
            ->where('group_id', $groupId)
            ->where('is_final_submission', true)
            ->get();

        if ($reviews->isEmpty()) {
            return null;
        }

        // Calculate weighted average based on indicator weights
        $totalWeighted = 0;
        $totalWeight = 0;

        foreach ($reviews as $review) {
            $weight = $review->periodIndicator->template->weight ?? 1;
            $totalWeighted += $review->score * $weight;
            $totalWeight += $weight;
        }

        return $totalWeight > 0 ? ($totalWeighted / $totalWeight) : null;
    }

    /**
     * Get evaluator role (Supervisor 1/2, Examiner, etc.).
     */
    private function getEvaluatorRole(int $evaluatorId, int $groupId): string
    {
        $group = Group::with(['supervisor1', 'supervisor2'])->find($groupId);

        if (!$group) {
            return 'EVALUATOR';
        }

        if ($group->supervisor_1_id === $evaluatorId) {
            return 'SUPERVISOR_1';
        }

        if ($group->supervisor_2_id === $evaluatorId) {
            return 'SUPERVISOR_2';
        }

        return 'EXAMINER';
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

    /**
     * Legacy: Calculate PDC1 grade for a group (for backward compatibility).
     */
    public function calculatePDC1(int $groupId): ?array
    {
        try {
            $group = Group::with('members')->findOrFail($groupId);

            $semproScore = $this->getAverageEvaluationScore($groupId, 'SEMPRO');
            $bimbinganSemproScore = $this->getAverageEvaluationScore($groupId, 'BIMBINGAN_SEMPRO');

            $hasScore = false;
            $componentCount = 0;
            $totalScore = 0;

            if ($semproScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $semproScore;
            }

            if ($bimbinganSemproScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $bimbinganSemproScore;
            }

            if (!$hasScore) {
                return null;
            }

            $average = $componentCount > 0 ? ($totalScore / $componentCount) : 0;

            return [
                'grade' => round($average, 2),
                'components' => [
                    'SEMPRO' => ['score' => $semproScore],
                    'BIMBINGAN_SEMPRO' => ['score' => $bimbinganSemproScore],
                ],
                'component_count' => $componentCount,
                'status' => $componentCount === 2 ? 'COMPLETE' : 'PARTIAL',
            ];
        } catch (\Exception $e) {
            Log::error("Failed to calculate PDC1 for group {$groupId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Legacy: Calculate PDC2 grade for a group (for backward compatibility).
     */
    public function calculatePDC2(int $groupId): ?array
    {
        try {
            $nilaiDosenScore = $this->getAverageEvaluationScore($groupId, 'NILAI_DOSEN');
            $milestoneScore = $this->getAverageEvaluationScore($groupId, 'MILESTONE');
            $expoScore = $this->getAverageEvaluationScore($groupId, 'EXPO');

            $hasScore = false;
            $componentCount = 0;
            $totalScore = 0;

            if ($nilaiDosenScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $nilaiDosenScore;
            }

            if ($milestoneScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $milestoneScore;
            }

            if ($expoScore !== null) {
                $hasScore = true;
                $componentCount++;
                $totalScore += $expoScore;
            }

            if (!$hasScore) {
                return null;
            }

            $average = $componentCount > 0 ? ($totalScore / $componentCount) : 0;

            return [
                'grade' => round($average, 2),
                'components' => [
                    'NILAI_DOSEN' => ['score' => $nilaiDosenScore],
                    'MILESTONE' => ['score' => $milestoneScore],
                    'EXPO' => ['score' => $expoScore],
                ],
                'component_count' => $componentCount,
                'status' => $componentCount === 3 ? 'COMPLETE' : 'PARTIAL',
            ];
        } catch (\Exception $e) {
            Log::error("Failed to calculate PDC2 for group {$groupId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Legacy: Get average evaluation score for a group.
     */
    private function getAverageEvaluationScore(int $groupId, string $evaluationType): ?float
    {
        $scores = AssessmentScore::where('group_id', $groupId)
            ->where('evaluation_type', $evaluationType)
            ->get();

        if ($scores->isEmpty()) {
            return null;
        }

        return $this->calculateWeightedAverageFromScores($scores);
    }
}
