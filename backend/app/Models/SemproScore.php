<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SemproScore extends Model
{
    protected $table = 'sempro_scores';

    public $timestamps = true;

    protected $fillable = [
        'component_id',
        'period_component_id',
        'examiner_id',
        'group_id',
        'student_id',
        'score',
        'notes',
        'evaluation_type',
    ];

    protected $casts = [
        'score' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['evaluation_type'];

    public function getEvaluationTypeAttribute(): string
    {
        return 'SEMPRO';
    }

    public function component(): BelongsTo
    {
        return $this->belongsTo(AssessmentComponent::class, 'component_id');
    }

    public function periodComponent(): BelongsTo
    {
        return $this->belongsTo(PeriodAssessmentComponent::class, 'period_component_id');
    }

    public function examiner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'examiner_id');
    }

    /**
     * Alias for examiner to maintain compatibility with other score models
     */
    public function evaluator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'examiner_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function scopeByExaminer($query, int $examinerId)
    {
        return $query->where('examiner_id', $examinerId);
    }

    public function scopeByGroup($query, int $groupId)
    {
        return $query->where('group_id', $groupId);
    }

    public function scopeByStudent($query, int $studentId)
    {
        return $query->where('student_id', $studentId);
    }

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

    public function getEvaluatorAttribute()
    {
        if (! $this->relationLoaded('examiner')) {
            $this->setRelation('examiner', $this->examiner()->first());
        }
        return $this->relations['examiner'];
    }
}
