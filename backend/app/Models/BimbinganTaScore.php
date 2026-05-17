<?php

namespace App\Models;

use App\Traits\HasAssessmentScore;
use Illuminate\Database\Eloquent\Model;

/**
 * Bimbingan TA Score Model
 * 
 * Stores assessment scores for BIMBINGAN_TA evaluation type.
 * This model replaces evaluation_type='BIMBINGAN_TA' records from the old assessment_scores table.
 */
class BimbinganTaScore extends Model
{
    use HasAssessmentScore;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'bimbingan_ta_scores';

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
        return 'BIMBINGAN_TA';
    }
}
