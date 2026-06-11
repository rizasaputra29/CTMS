<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class GroupMember extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'group_id',
        'student_id',
        'is_leader',
        'period_id',
        'status',
        'removed_by',
        'removal_reason',
    ];

    protected $casts = [
        'is_leader' => 'boolean',
        'deleted_at' => 'datetime',
        'status' => 'string',
    ];

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Scope to get active (not soft-deleted) members.
     */
    public function scopeActive($query)
    {
        return $query->whereNull('deleted_at');
    }

    /**
     * Scope to get flagged members.
     */
    public function scopeFlagged($query)
    {
        return $query->where('status', 'flagged');
    }

    /**
     * User who removed this member.
     */
    public function removedBy()
    {
        return $this->belongsTo(User::class, 'removed_by');
    }
}
