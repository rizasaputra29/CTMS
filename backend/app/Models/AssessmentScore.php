<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssessmentScore extends Model
{
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

    protected $casts = [
        'score' => 'decimal:2',
    ];

    public function component()
    {
        return $this->belongsTo(AssessmentComponent::class, 'component_id');
    }

    public function periodComponent()
    {
        return $this->belongsTo(PeriodAssessmentComponent::class, 'period_component_id');
    }

    public function evaluator()
    {
        return $this->belongsTo(User::class, 'evaluator_id');
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}
