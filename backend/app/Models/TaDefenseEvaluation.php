<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaDefenseEvaluation extends Model
{
    protected $fillable = [
        'schedule_id',
        'student_id',
        'examiner_id',
        'rubric_json',
        'score',
        'status',
    ];

    protected $casts = [
        'rubric_json' => 'array',
        'score' => 'decimal:2',
    ];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(TaDefenseSchedule::class, 'schedule_id');
    }

    public function examiner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'examiner_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}
