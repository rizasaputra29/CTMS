<?php

namespace App\Models;

use App\Traits\HasAssessmentScore;
use Illuminate\Database\Eloquent\Model;

/**
 * Bimbingan Sempro Score Model
 * 
 * Stores assessment scores for BIMBINGAN_SEMPRO evaluation type.
 * This model replaces evaluation_type='BIMBINGAN_SEMPRO' records from the old assessment_scores table.
 */
class BimbinganSemproScore extends Model
{
    use HasAssessmentScore;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'bimbingan_sempro_scores';

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
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'score' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['evaluation_type'];

    public function getEvaluationTypeAttribute(): string
    {
        return 'BIMBINGAN_SEMPRO';
    }
}
