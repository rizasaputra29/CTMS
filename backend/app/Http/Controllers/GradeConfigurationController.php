<?php

namespace App\Http\Controllers;

use App\Models\Period;
use App\Repositories\AssessmentScoreRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GradeConfigurationController extends Controller
{
    private const DEFAULT_PDC1_WEIGHTS = [
        'SEMPRO' => 50,
        'BIMBINGAN_SEMPRO' => 50,
    ];

    private const DEFAULT_PDC2_WEIGHTS = [
        'NILAI_DOSEN' => 25,
        'MILESTONE' => 25,
        'EXPO' => 25,
        'PEER_REVIEW' => 25,
    ];

    private const DEFAULT_TA_WEIGHTS = [
        'BIMBINGAN_TA' => 50,
        'SIDANG_TA' => 50,
    ];

    protected $gradeCalculationService;

    public function __construct(\App\Services\GradeCalculationService $gradeCalculationService)
    {
        $this->gradeCalculationService = $gradeCalculationService;
    }

    /**
     * Get grade weight configuration for PDC1
     */
    public function getPDC1Weights(Request $request, int $periodId): JsonResponse
    {
        $period = Period::findOrFail($periodId);

        $weights = $period->grade_configuration['pdc1'] ?? self::DEFAULT_PDC1_WEIGHTS;

        return response()->json([
            'period_id' => $periodId,
            'period_name' => $period->name,
            'pdc1_weights' => $weights,
            'total_weight' => array_sum($weights),
        ]);
    }

    /**
     * Get grade weight configuration for PDC2
     */
    public function getPDC2Weights(Request $request, int $periodId): JsonResponse
    {
        $period = Period::findOrFail($periodId);

        $weights = $period->grade_configuration['pdc2'] ?? self::DEFAULT_PDC2_WEIGHTS;

        return response()->json([
            'period_id' => $periodId,
            'period_name' => $period->name,
            'pdc2_weights' => $weights,
            'total_weight' => array_sum($weights),
        ]);
    }

    /**
     * Get grade weight configuration for TA
     */
    public function getTAWeights(Request $request, int $periodId): JsonResponse
    {
        $period = Period::findOrFail($periodId);

        $weights = $period->grade_configuration['ta'] ?? self::DEFAULT_TA_WEIGHTS;

        return response()->json([
            'period_id' => $periodId,
            'period_name' => $period->name,
            'ta_weights' => $weights,
            'total_weight' => array_sum($weights),
        ]);
    }

    /**
     * Update grade weight configuration
     */
    public function updateWeights(Request $request, int $periodId): JsonResponse
    {
        $period = Period::findOrFail($periodId);

        $validated = $request->validate([
            'pdc1_weights' => 'nullable|array',
            'pdc1_weights.SEMPRO' => 'nullable|numeric|min:0',
            'pdc1_weights.BIMBINGAN_SEMPRO' => 'nullable|numeric|min:0',
            'pdc2_weights' => 'nullable|array',
            'pdc2_weights.NILAI_DOSEN' => 'nullable|numeric|min:0',
            'pdc2_weights.MILESTONE' => 'nullable|numeric|min:0',
            'pdc2_weights.EXPO' => 'nullable|numeric|min:0',
            'pdc2_weights.PEER_REVIEW' => 'nullable|numeric|min:0',
            'ta_weights' => 'nullable|array',
            'ta_weights.BIMBINGAN_TA' => 'nullable|numeric|min:0',
            'ta_weights.SIDANG_TA' => 'nullable|numeric|min:0',
        ]);

        $gradeConfig = $period->grade_configuration ?? [];

        if (isset($validated['pdc1_weights'])) {
            $gradeConfig['pdc1'] = array_merge(
                $gradeConfig['pdc1'] ?? self::DEFAULT_PDC1_WEIGHTS,
                $validated['pdc1_weights']
            );
        }

        if (isset($validated['pdc2_weights'])) {
            $gradeConfig['pdc2'] = array_merge(
                $gradeConfig['pdc2'] ?? self::DEFAULT_PDC2_WEIGHTS,
                $validated['pdc2_weights']
            );
        }

        if (isset($validated['ta_weights'])) {
            $gradeConfig['ta'] = array_merge(
                $gradeConfig['ta'] ?? self::DEFAULT_TA_WEIGHTS,
                $validated['ta_weights']
            );
        }

        $period->update(['grade_configuration' => $gradeConfig]);

        return response()->json([
            'message' => 'Grade configuration updated successfully',
            'period_id' => $periodId,
            'grade_configuration' => $gradeConfig,
        ]);
    }

    /**
     * Calculate PDC1 grade for a group
     */
    public function calculatePDC1Grade(Request $request, int $groupId): JsonResponse
    {
        $group = \App\Models\Group::with('period')->findOrFail($groupId);
        $period = $group->period;

        $weights = $period->grade_configuration['pdc1'] ?? self::DEFAULT_PDC1_WEIGHTS;

        $grades = [];
        $totalWeightedScore = 0;
        $totalWeight = 0;

        foreach ($weights as $type => $weight) {
            // Check if type is supported by repository
            if (AssessmentScoreRepository::isSupportedType($type)) {
                $scores = AssessmentScoreRepository::getByGroupAndType($groupId, $type);
            } else {
                $scores = collect();
            }

            if ($scores->isEmpty()) {
                $grades[$type] = [
                    'status' => 'not_evaluated',
                    'average_score' => null,
                    'weight' => $weight,
                    'weighted_score' => null,
                ];

                continue;
            }

            // Calculate average score for this evaluation type
            $avgScore = $scores->avg('score');
            $weightedScore = ($avgScore * $weight) / 100;

            $grades[$type] = [
                'status' => 'evaluated',
                'average_score' => round($avgScore, 2),
                'weight' => $weight,
                'weighted_score' => round($weightedScore, 2),
            ];

            $totalWeightedScore += $weightedScore;
            $totalWeight += $weight;
        }

        return response()->json([
            'group_id' => $groupId,
            'group_name' => $group->code,
            'period_id' => $period->id,
            'pdc1_grades' => $grades,
            'final_pdc1_score' => $totalWeight > 0 ? round($totalWeightedScore, 2) : null,
            'total_weight' => $totalWeight,
        ]);
    }

    /**
     * Calculate PDC2 grade for a group
     */
    public function calculatePDC2Grade(Request $request, int $groupId): JsonResponse
    {
        $group = \App\Models\Group::with('period')->findOrFail($groupId);
        $period = $group->period;

        $weights = $period->grade_configuration['pdc2'] ?? self::DEFAULT_PDC2_WEIGHTS;

        $grades = [];
        $totalWeightedScore = 0;
        $totalWeight = 0;

        foreach ($weights as $type => $weight) {
            // Check if type is supported by repository
            if (AssessmentScoreRepository::isSupportedType($type)) {
                $scores = AssessmentScoreRepository::getByGroupAndType($groupId, $type);
            } else {
                // PEER_REVIEW and other types not in split tables
                $scores = collect();
            }

            if ($scores->isEmpty()) {
                $grades[$type] = [
                    'status' => 'not_evaluated',
                    'average_score' => null,
                    'weight' => $weight,
                    'weighted_score' => null,
                ];

                continue;
            }

            // Calculate average score for this evaluation type
            $avgScore = $scores->avg('score');
            $weightedScore = ($avgScore * $weight) / 100;

            $grades[$type] = [
                'status' => 'evaluated',
                'average_score' => round($avgScore, 2),
                'weight' => $weight,
                'weighted_score' => round($weightedScore, 2),
            ];

            $totalWeightedScore += $weightedScore;
            $totalWeight += $weight;
        }

        return response()->json([
            'group_id' => $groupId,
            'group_name' => $group->code,
            'period_id' => $period->id,
            'pdc2_grades' => $grades,
            'final_pdc2_score' => $totalWeight > 0 ? round($totalWeightedScore, 2) : null,
            'total_weight' => $totalWeight,
        ]);
    }

    /**
     * Get full grade configuration for admin view
     */
    public function getFullConfiguration(Request $request, int $periodId): JsonResponse
    {
        $period = Period::findOrFail($periodId);

        $config = $period->grade_configuration ?? [];

        return response()->json([
            'period_id' => $periodId,
            'period_name' => $period->name,
            'pdc1' => [
                'weights' => $config['pdc1'] ?? self::DEFAULT_PDC1_WEIGHTS,
                'components' => ['SEMPRO', 'BIMBINGAN_SEMPRO'],
                'total_weight' => array_sum($config['pdc1'] ?? self::DEFAULT_PDC1_WEIGHTS),
            ],
            'pdc2' => [
                'weights' => $config['pdc2'] ?? self::DEFAULT_PDC2_WEIGHTS,
                'components' => ['NILAI_DOSEN', 'MILESTONE', 'EXPO', 'PEER_REVIEW'],
                'total_weight' => array_sum($config['pdc2'] ?? self::DEFAULT_PDC2_WEIGHTS),
            ],
            'ta' => [
                'weights' => $config['ta'] ?? self::DEFAULT_TA_WEIGHTS,
                'components' => ['BIMBINGAN_TA', 'SIDANG_TA'],
                'total_weight' => array_sum($config['ta'] ?? self::DEFAULT_TA_WEIGHTS),
            ],
        ]);
    }

    /**
     * Reset grade configuration to defaults
     */
    public function resetToDefaults(Request $request, int $periodId): JsonResponse
    {
        $period = Period::findOrFail($periodId);

        $gradeConfig = [
            'pdc1' => self::DEFAULT_PDC1_WEIGHTS,
            'pdc2' => self::DEFAULT_PDC2_WEIGHTS,
            'ta' => self::DEFAULT_TA_WEIGHTS,
        ];

        $period->update(['grade_configuration' => $gradeConfig]);

        return response()->json([
            'message' => 'Grade configuration reset to defaults',
            'period_id' => $periodId,
            'grade_configuration' => $gradeConfig,
        ]);
    }

    /**
     * Calculate TA grade for a student (per-student, not group-based)
     */
    public function calculateTAGrade(Request $request, int $studentId): JsonResponse
    {
        $student = \App\Models\User::findOrFail($studentId);

        // Get student's group to access period
        $groupMember = \App\Models\GroupMember::with('group.period')
            ->where('student_id', $studentId)
            ->first();

        if (! $groupMember || ! $groupMember->group) {
            return response()->json([
                'message' => 'Student is not assigned to any group',
                'grades' => null,
            ], 404);
        }

        $group = $groupMember->group;
        $period = $group->period;

        $weights = $period->grade_configuration['ta'] ?? self::DEFAULT_TA_WEIGHTS;

        $grades = [];
        $totalWeightedScore = 0;
        $totalWeight = 0;

        foreach ($weights as $type => $weight) {
            // TA uses per-student scores, not group scores
            $scores = AssessmentScoreRepository::getByStudentAndType($studentId, $type);

            if ($scores->isEmpty()) {
                $grades[$type] = [
                    'status' => 'not_evaluated',
                    'average_score' => null,
                    'weight' => $weight,
                    'weighted_score' => null,
                ];

                continue;
            }

            // Calculate average score for this evaluation type
            $avgScore = $scores->avg('score');
            $weightedScore = ($avgScore * $weight) / 100;

            $grades[$type] = [
                'status' => 'evaluated',
                'average_score' => round($avgScore, 2),
                'weight' => $weight,
                'weighted_score' => round($weightedScore, 2),
            ];

            $totalWeightedScore += $weightedScore;
            $totalWeight += $weight;
        }

        return response()->json([
            'student_id' => $studentId,
            'student_name' => $student->name,
            'group_id' => $group->id,
            'group_name' => $group->code,
            'period_id' => $period->id,
            'ta_grades' => $grades,
            'final_ta_score' => $totalWeight > 0 ? round($totalWeightedScore, 2) : null,
            'total_weight' => $totalWeight,
        ]);
    }

    /**
     * Get grades for the authenticated student (my grades)
     */
    public function getMyGrades(Request $request): JsonResponse
    {
        $user = $request->user();

        // Get the student's latest period registration (active or flagged) to determine grades period
        $registration = \App\Models\PeriodRegistration::where('user_id', $user->id)
            ->whereIn('status', ['active', 'flagged'])
            ->whereHas('period')
            ->with('period')
            ->latest('updated_at')
            ->first();

        if (! $registration || ! $registration->period) {
            return response()->json([
                'message' => 'You are not registered for any period',
                'grades' => null,
            ], 404);
        }

        $period = $registration->period;

        // Find the student's group in that period, including soft-deleted memberships for flagged students
        $groupMember = \App\Models\GroupMember::withTrashed()
            ->with('group.period')
            ->where('student_id', $user->id)
            ->where('period_id', $period->id)
            ->first();

        if (! $groupMember || ! $groupMember->group) {
            return response()->json([
                'message' => 'You are not assigned to any group',
                'grades' => null,
                'period' => [
                    'id' => $period->id,
                    'name' => $period->name,
                ],
            ], 404);
        }

        $group = $groupMember->group;

        // Calculate grades using the service
        $grades = $this->gradeCalculationService->calculateFinalGradeForStudent(
            $user->id,
            $group->id
        );

        if (! $grades) {
            return response()->json([
                'message' => 'No grades available yet',
                'grades' => null,
                'group' => [
                    'id' => $group->id,
                    'name' => $group->name,
                ],
                'period' => [
                    'id' => $group->period->id,
                    'name' => $group->period->name,
                ],
            ]);
        }

        return response()->json([
            'grades' => $grades,
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
            ],
            'period' => [
                'id' => $period->id,
                'name' => $period->name,
            ],
            'student' => [
                'id' => $user->id,
                'name' => $user->name,
                'nim' => $user->nim,
            ],
        ]);
    }

    /**
     * Get grades for a specific student (admin/dosen only)
     */
    public function getStudentGrades(Request $request, int $studentId): JsonResponse
    {
        $student = \App\Models\User::findOrFail($studentId);

        // Get the student's latest period registration (active or flagged) to determine grades period
        $registration = \App\Models\PeriodRegistration::where('user_id', $studentId)
            ->whereIn('status', ['active', 'flagged'])
            ->whereHas('period')
            ->with('period')
            ->latest('updated_at')
            ->first();

        if (! $registration || ! $registration->period) {
            return response()->json([
                'message' => 'Student is not registered for any period',
                'grades' => null,
            ], 404);
        }

        $period = $registration->period;

        // Find the student's group in that period, including soft-deleted memberships for flagged students
        $groupMember = \App\Models\GroupMember::withTrashed()
            ->with('group.period')
            ->where('student_id', $studentId)
            ->where('period_id', $period->id)
            ->first();

        if (! $groupMember || ! $groupMember->group) {
            return response()->json([
                'message' => 'Student is not assigned to any group',
                'grades' => null,
                'period' => [
                    'id' => $period->id,
                    'name' => $period->name,
                ],
            ], 404);
        }

        $group = $groupMember->group;

        // Calculate grades using the service
        $grades = $this->gradeCalculationService->calculateFinalGradeForStudent(
            $studentId,
            $group->id
        );

        return response()->json([
            'grades' => $grades,
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
            ],
            'period' => [
                'id' => $period->id,
                'name' => $period->name,
            ],
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'nim' => $student->nim,
            ],
        ]);
    }
}
