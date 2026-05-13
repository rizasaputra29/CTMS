<?php

namespace App\Repositories;

use App\Models\BimbinganSemproScore;
use App\Models\BimbinganTaScore;
use App\Models\ExpoScore;
use App\Models\MilestoneScore;
use App\Models\NilaiDosenScore;
use App\Models\SemproScore;
use App\Models\SidangTaScore;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class AssessmentScoreRepository
{
    public static function forType(string $type): Builder
    {
        return match ($type) {
            'BIMBINGAN_SEMPRO' => BimbinganSemproScore::query(),
            'BIMBINGAN_TA' => BimbinganTaScore::query(),
            'EXPO' => ExpoScore::query(),
            'MILESTONE' => MilestoneScore::query(),
            'NILAI_DOSEN' => NilaiDosenScore::query(),
            'SEMPRO' => SemproScore::query(),
            'SIDANG_TA' => SidangTaScore::query(),
            default => throw new InvalidArgumentException("Unknown evaluation type: {$type}")
        };
    }

    public static function getModelClass(string $type): string
    {
        return match ($type) {
            'BIMBINGAN_SEMPRO' => BimbinganSemproScore::class,
            'BIMBINGAN_TA' => BimbinganTaScore::class,
            'EXPO' => ExpoScore::class,
            'MILESTONE' => MilestoneScore::class,
            'NILAI_DOSEN' => NilaiDosenScore::class,
            'SEMPRO' => SemproScore::class,
            'SIDANG_TA' => SidangTaScore::class,
            default => throw new InvalidArgumentException("Unknown evaluation type: {$type}")
        };
    }

    public static function create(array $data): Model
    {
        if (!isset($data['evaluation_type'])) {
            throw new InvalidArgumentException('evaluation_type is required');
        }

        $type = $data['evaluation_type'];
        unset($data['evaluation_type']);

        return match ($type) {
            'BIMBINGAN_SEMPRO' => BimbinganSemproScore::create($data),
            'BIMBINGAN_TA' => BimbinganTaScore::create($data),
            'EXPO' => ExpoScore::create($data),
            'MILESTONE' => MilestoneScore::create($data),
            'NILAI_DOSEN' => NilaiDosenScore::create($data),
            'SEMPRO' => SemproScore::create($data),
            'SIDANG_TA' => SidangTaScore::create($data),
            default => throw new InvalidArgumentException("Unknown evaluation type: {$type}")
        };
    }

    /**
     * Create multiple score records (bulk insert)
     *
     * @param array $records Array of score data arrays (each must include evaluation_type)
     * @return array Created model instances
     */
    public static function createMany(array $records): array
    {
        $created = [];
        foreach ($records as $data) {
            $created[] = self::create($data);
        }
        return $created;
    }

    /**
     * Get scores by group ID and evaluation type
     *
     * @param int $groupId Group ID
     * @param string $type Evaluation type
     * @param array $with Relationships to eager load
     * @return Collection
     */
    public static function getByGroupAndType(int $groupId, string $type, array $with = []): Collection
    {
        $query = self::forType($type)->where('group_id', $groupId);
        
        if (!empty($with)) {
            $query->with($with);
        }
        
        return $query->get();
    }

    /**
     * Get scores by evaluator ID and type
     *
     * @param int $evaluatorId Evaluator user ID
     * @param string $type Evaluation type
     * @param array $with Relationships to eager load
     * @return Collection
     */
    public static function getByEvaluatorAndType(int $evaluatorId, string $type, array $with = []): Collection
    {
        $idField = ($type === 'SEMPRO' || $type === 'SIDANG_TA') ? 'examiner_id' : 'evaluator_id';

        $query = self::forType($type)->where($idField, $evaluatorId);

        if (!empty($with)) {
            $query->with($with);
        }

        return $query->get();
    }

    /**
     * Get scores by student ID and type
     *
     * @param int $studentId Student user ID
     * @param string $type Evaluation type
     * @param array $with Relationships to eager load
     * @return Collection
     */
    public static function getByStudentAndType(int $studentId, string $type, array $with = []): Collection
    {
        $query = self::forType($type)->where('student_id', $studentId);
        
        if (!empty($with)) {
            $query->with($with);
        }
        
        return $query->get();
    }

    /**
     * Check if scores exist for group and evaluator
     *
     * @param int $groupId Group ID
     * @param int $evaluatorId Evaluator ID
     * @param string $type Evaluation type
     * @return bool
     */
    public static function existsForGroupAndEvaluator(int $groupId, int $evaluatorId, string $type): bool
    {
        $idField = ($type === 'SEMPRO' || $type === 'SIDANG_TA') ? 'examiner_id' : 'evaluator_id';

        return self::forType($type)
            ->where('group_id', $groupId)
            ->where($idField, $evaluatorId)
            ->exists();
    }

    /**
     * Check if scores exist for group
     *
     * @param int $groupId Group ID
     * @param string $type Evaluation type
     * @return bool
     */
    public static function existsForGroup(int $groupId, string $type): bool
    {
        return self::forType($type)
            ->where('group_id', $groupId)
            ->exists();
    }

    /**
     * Get count of scores for group and type
     *
     * @param int $groupId Group ID
     * @param string $type Evaluation type
     * @return int
     */
    public static function countForGroup(int $groupId, string $type): int
    {
        return self::forType($type)
            ->where('group_id', $groupId)
            ->count();
    }

    /**
     * Get count of scores for group and evaluator
     *
     * @param int $groupId Group ID
     * @param int $evaluatorId Evaluator ID
     * @param string $type Evaluation type
     * @return int
     */
    public static function countForGroupAndEvaluator(int $groupId, int $evaluatorId, string $type): int
    {
        $idField = ($type === 'SEMPRO' || $type === 'SIDANG_TA') ? 'examiner_id' : 'evaluator_id';

        return self::forType($type)
            ->where('group_id', $groupId)
            ->where($idField, $evaluatorId)
            ->count();
    }

    /**
     * Get scores by component ID across all tables
     *
     * @param int $componentId Component ID
     * @param string $columnName Column name (period_component_id or component_id)
     * @return Collection
     */
    public static function getByComponentId(int $componentId, string $columnName = 'period_component_id'): \Illuminate\Support\Collection
    {
        $allScores = collect();
        
        foreach (self::getSupportedTypes() as $type) {
            $scores = self::forType($type)
                ->where($columnName, $componentId)
                ->get();
            $allScores = $allScores->merge($scores);
        }
        
        return $allScores;
    }

    /**
     * Delete scores by group ID and type
     *
     * @param int $groupId Group ID
     * @param string $type Evaluation type
     * @return int Number of deleted records
     */
    public static function deleteByGroup(int $groupId, string $type): int
    {
        return self::forType($type)
            ->where('group_id', $groupId)
            ->delete();
    }

    /**
     * Get all evaluation types supported by this repository
     *
     * @return array
     */
    public static function getSupportedTypes(): array
    {
        return [
            'BIMBINGAN_SEMPRO',
            'BIMBINGAN_TA',
            'EXPO',
            'MILESTONE',
            'NILAI_DOSEN',
            'SEMPRO',
            'SIDANG_TA',
        ];
    }

    /**
     * Check if an evaluation type is supported
     *
     * @param string $type
     * @return bool
     */
    public static function isSupportedType(string $type): bool
    {
        return in_array($type, self::getSupportedTypes(), true);
    }

    /**
     * Get scores by multiple types (aggregate query)
     * Note: This runs separate queries and merges results
     *
     * @param int $groupId Group ID
     * @param array $types Evaluation types
     * @return Collection
     */
    public static function getByGroupAndTypes(int $groupId, array $types): \Illuminate\Support\Collection
    {
        $allScores = collect();
        
        foreach ($types as $type) {
            if (self::isSupportedType($type)) {
                $scores = self::getByGroupAndType($groupId, $type);
                $allScores = $allScores->merge($scores);
            }
        }
        
        return $allScores;
    }

    /**
     * Get all scores with relationships across all supported types
     * Note: This runs separate queries and merges results
     *
     * @param array $with Relationships to eager load
     * @param callable|null $filterCallback Optional callback to apply filters
     * @return Collection
     */
    public static function getAllWith(array $with = [], ?callable $filterCallback = null): \Illuminate\Support\Collection
    {
        $allScores = collect();
        
        foreach (self::getSupportedTypes() as $type) {
            $query = self::forType($type);
            
            if (!empty($with)) {
                $query->with($with);
            }
            
            if ($filterCallback !== null) {
                $filterCallback($query, $type);
            }
            
            $allScores = $allScores->merge($query->get());
        }
        
        return $allScores;
    }

    /**
     * Get all scores with whereHas on group
     * Note: This runs separate queries and merges results
     *
     * @param callable $groupFilter Callback for group filter
     * @param array $with Relationships to eager load
     * @param callable|null $filterCallback Optional callback for additional filters
     * @return Collection
     */
    public static function getAllWhereHasGroup(callable $groupFilter, array $with = [], ?callable $filterCallback = null): Collection
    {
        $allScores = collect();
        
        foreach (self::getSupportedTypes() as $type) {
            $query = self::forType($type);
            
            if (!empty($with)) {
                $query->with($with);
            }
            
            $query->whereHas('group', $groupFilter);
            
            if ($filterCallback !== null) {
                $filterCallback($query, $type);
            }
            
            $allScores = $allScores->merge($query->get());
        }
        
        return $allScores;
    }

    /**
     * Upsert scores into the appropriate table
     *
     * @param string $type Evaluation type
     * @param array $data Array of score data
     * @param array $uniqueKeys Unique keys for upsert
     * @param array $updateColumns Columns to update
     * @return int Number of records affected
     * @throws InvalidArgumentException
     */
    public static function upsert(string $type, array $data, array $uniqueKeys, array $updateColumns): int
    {
        $modelClass = self::getModelClass($type);
        
        return $modelClass::upsert($data, $uniqueKeys, $updateColumns);
    }

    /**
     * Update or create a score record
     *
     * @param string $type Evaluation type
     * @param array $attributes Attributes to match
     * @param array $values Values to update/create
     * @return Model
     * @throws InvalidArgumentException
     */
    public static function updateOrCreate(string $type, array $attributes, array $values): Model
    {
        $modelClass = self::getModelClass($type);
        
        return $modelClass::updateOrCreate($attributes, $values);
    }
}
