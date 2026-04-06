<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaSubmission extends Model
{
    /**
     * Integer ordering for TA status comparison.
     * Use this instead of string comparison for >= checks.
     */
    const TA_STATUS_ORDER = [
        'TA_LOCKED' => 0,
        'TA_DRAFT' => 1,
        'TA_REVISED' => 2,
        'TA_READY' => 3,
        'TA_REGISTERED' => 4,
        'TA_SCHEDULED' => 5,
        'TA_DEFENDED' => 6,
    ];

    protected $fillable = [
        'student_id',
        'group_id',
        'period_id',
        'status',
        'file_path',
        'draft_report_path',
        'paper_path',
        'publication_link',
        'feedback',
        'reviewed_by',
    ];

    /**
     * Get the integer order value of this submission's status.
     */
    public function statusOrder(): int
    {
        return self::TA_STATUS_ORDER[$this->status] ?? -1;
    }

    /**
     * Check if this submission's status is >= a given status.
     */
    public function statusIsAtLeast(string $status): bool
    {
        return $this->statusOrder() >= (self::TA_STATUS_ORDER[$status] ?? PHP_INT_MAX);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
