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
        'TA_DOCUMENTS_REQUIRED' => 1,      // New: Need to upload required documents
        'TA_DOCUMENTS_UNDER_REVIEW' => 2,  // New: Documents submitted, waiting approval
        'TA_DOCUMENTS_APPROVED' => 3,      // New: All documents approved, ready for sidang schedule
        'TA_DRAFT' => 4,
        'TA_REVISED' => 5,
        'TA_READY' => 6,
        'TA_READY_FOR_SIDANG' => 7,        // New: After admin schedules sidang
        'TA_REGISTERED' => 8,
        'TA_SCHEDULED' => 9,
        'TA_DEFENDED' => 10,
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
