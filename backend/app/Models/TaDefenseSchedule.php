<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaDefenseSchedule extends Model
{
    protected $fillable = [
        'student_id', // Kept for backward compatibility
        'group_id',
        'period_id',
        'examiner_1_id',
        'examiner_2_id',
        'date',
        'start_time',
        'end_time',
        'room',
        'status',
        'evaluation_deadline',
        'notes',
        'requested_by',
        'rejection_reason',
    ];

    protected $casts = [
        'date' => 'date',
        'evaluation_deadline' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Get all students in this defense schedule (multi-student support)
     */
    public function students(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'ta_defense_schedule_student',
            'schedule_id',
            'student_id'
        )->withTimestamps();
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(Period::class);
    }

    public function examiner1(): BelongsTo
    {
        return $this->belongsTo(User::class, 'examiner_1_id');
    }

    public function examiner2(): BelongsTo
    {
        return $this->belongsTo(User::class, 'examiner_2_id');
    }

    public function examiners(): HasMany
    {
        return $this->hasMany(TaDefenseExaminer::class, 'schedule_id');
    }

    public function evaluations(): HasMany
    {
        return $this->hasMany(TaDefenseEvaluation::class, 'schedule_id');
    }

    /**
     * Scope for scheduled defenses.
     */
    public function scopeScheduled($query)
    {
        return $query->where('status', 'SCHEDULED');
    }

    /**
     * Scope for done defenses.
     */
    public function scopeDone($query)
    {
        return $query->where('status', 'DONE');
    }

    /**
     * Check if evaluation deadline has passed.
     */
    public function isDeadlinePassed(): bool
    {
        if (!$this->evaluation_deadline) {
            return false;
        }
        return now()->gt($this->evaluation_deadline);
    }

    /**
     * Mark defense as done.
     */
    public function markAsDone(): void
    {
        $this->status = 'DONE';
        $this->save();
    }
}
