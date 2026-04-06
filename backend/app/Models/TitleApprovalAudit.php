<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TitleApprovalAudit extends Model
{
    protected $table = 'title_approval_audits';

    protected $fillable = [
        'title_id',
        'lecturer_id',
        'affected_group_id',
        'action',
        'reason',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the title that this audit entry is for.
     */
    public function title(): BelongsTo
    {
        return $this->belongsTo(Title::class, 'title_id');
    }

    /**
     * Get the lecturer who performed the action.
     */
    public function lecturer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lecturer_id');
    }

    /**
     * Get the group affected by this action.
     */
    public function affectedGroup(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'affected_group_id');
    }
}
