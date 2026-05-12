<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * HasAssessmentScore Trait
 * 
 * Provides common functionality for assessment score models.
 * Used by: BimbinganSemproScore, BimbinganTaScore, ExpoScore, MilestoneScore, NilaiDosenScore
 * 
 * Note: Models using this trait must define their own $fillable property.
 * Do NOT define $fillable or $casts in this trait.
 */
trait HasAssessmentScore
{
    /**
     * Relationship: Component (legacy assessment component)
     */
    public function component(): BelongsTo
    {
        return $this->belongsTo(\App\Models\AssessmentComponent::class, 'component_id');
    }

    /**
     * Relationship: Period Component (new period-specific component)
     */
    public function periodComponent(): BelongsTo
    {
        return $this->belongsTo(\App\Models\PeriodAssessmentComponent::class, 'period_component_id');
    }

    /**
     * Accessor: Resolve component transparently.
     *
     * If component_id is populated, returns the legacy AssessmentComponent.
     * Otherwise returns the periodComponent (via period_component_id).
     * This ensures $score->component always works regardless of which schema is in use.
     */
    public function getComponentAttribute()
    {
        if ($this->component_id !== null) {
            if (! $this->relationLoaded('component')) {
                $this->setRelation('component', $this->component()->first());
            }
            return $this->relations['component'];
        }

        if (! $this->relationLoaded('periodComponent')) {
            $this->setRelation('periodComponent', $this->periodComponent()->first());
        }
        return $this->relations['periodComponent'];
    }

    /**
     * Relationship: Evaluator (User who created the score)
     */
    public function evaluator(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'evaluator_id');
    }

    /**
     * Relationship: Group
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Group::class);
    }

    /**
     * Relationship: Student (User who received the score)
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'student_id');
    }

    /**
     * Scope: Filter by evaluator
     */
    public function scopeByEvaluator($query, int $evaluatorId)
    {
        return $query->where('evaluator_id', $evaluatorId);
    }

    /**
     * Scope: Filter by group
     */
    public function scopeByGroup($query, int $groupId)
    {
        return $query->where('group_id', $groupId);
    }

    /**
     * Scope: Filter by student
     */
    public function scopeByStudent($query, int $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    /**
     * Scope: Filter by component
     */
    public function scopeByComponent($query, int $componentId)
    {
        return $query->where('component_id', $componentId);
    }

    /**
     * Scope: Filter by period component
     */
    public function scopeByPeriodComponent($query, int $periodComponentId)
    {
        return $query->where('period_component_id', $periodComponentId);
    }

    /**
     * Scope: Order by creation date (newest first)
     */
    public function scopeRecent($query)
    {
        return $query->orderBy('created_at', 'desc');
    }

    /**
     * Accessor: Get formatted score
     */
    public function getFormattedScoreAttribute(): string
    {
        return number_format($this->score, 2);
    }

    /**
     * Check if this score is for a specific student
     */
    public function isForStudent(int $studentId): bool
    {
        return $this->student_id === $studentId;
    }

    /**
     * Check if this score is by a specific evaluator
     */
    public function isByEvaluator(int $evaluatorId): bool
    {
        return $this->evaluator_id === $evaluatorId;
    }
}
