<?php

namespace App\Models;

use App\Traits\HasAssessmentScore;
use Illuminate\Database\Eloquent\Model;

/**
 * Milestone Score Model
 * 
 * Stores assessment scores for MILESTONE evaluation type.
 * This model replaces evaluation_type='MILESTONE' records from the old assessment_scores table.
 */
class MilestoneScore extends Model
{
    use HasAssessmentScore;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'milestone_scores';

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public $timestamps = true;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'component_id',
        'period_component_id',
        'evaluator_id',
        'group_id',
        'student_id',
        'score',
        'notes',
        'evaluation_type',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'score' => 'decimal:2',
        'notes' => 'string',
    ];

    protected $appends = ['evaluation_type'];

    public function getEvaluationTypeAttribute(): string
    {
        return 'MILESTONE';
    }
}
