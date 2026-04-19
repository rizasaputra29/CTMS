<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentPeerReviewStatus extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'group_id',
        'period_id',
        'has_completed_peer_review',
        'ta_status',
    ];

    protected $casts = [
        'has_completed_peer_review' => 'boolean',
    ];

    /**
     * Get the student that owns the status.
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Get the group that owns the status.
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    /**
     * Get the period that owns the status.
     */
    public function period(): BelongsTo
    {
        return $this->belongsTo(Period::class);
    }

    /**
     * Scope: Get records where peer review is completed.
     */
    public function scopeCompleted($query)
    {
        return $query->where('has_completed_peer_review', true);
    }

    /**
     * Scope: Get records where TA is blocked.
     */
    public function scopeBlocked($query)
    {
        return $query->where('ta_status', 'TA_BLOCKED');
    }

    /**
     * Scope: Get records where TA is active.
     */
    public function scopeActive($query)
    {
        return $query->where('ta_status', 'TA_ACTIVE');
    }

    /**
     * Mark peer review as completed.
     */
    public function markComplete(): void
    {
        $this->update([
            'has_completed_peer_review' => true,
            'ta_status' => 'TA_ACTIVE',
        ]);
    }

    /**
     * Mark TA as blocked.
     */
    public function markBlocked(): void
    {
        $this->update(['ta_status' => 'TA_BLOCKED']);
    }

    /**
     * Mark TA as active.
     */
    public function markActive(): void
    {
        $this->update(['ta_status' => 'TA_ACTIVE']);
    }

    /**
     * Mark TA as done.
     */
    public function markDone(): void
    {
        $this->update(['ta_status' => 'TA_DONE']);
    }
}
