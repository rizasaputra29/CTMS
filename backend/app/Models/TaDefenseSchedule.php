<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaDefenseSchedule extends Model
{
    protected $fillable = [
        'student_id',
        'group_id',
        'date',
        'start_time',
        'end_time',
        'room',
        'status',
        'requested_by',
        'rejection_reason',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function examiners(): HasMany
    {
        return $this->hasMany(TaDefenseExaminer::class, 'schedule_id');
    }

    public function evaluations(): HasMany
    {
        return $this->hasMany(TaDefenseEvaluation::class, 'schedule_id');
    }
}
