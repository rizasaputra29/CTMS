<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $supervisor_approval_status
 * @property int|null $proposed_supervisor_id
 */
class Title extends Model
{
    protected $fillable = [
        'lecturer_id',
        'title',
        'description',
        'problem_statement',
        'scope',
        'specializations',
        'quota',
        'status',
        'approved_by_admin',
        'title_source',
        'proposed_by_group_id',
        'proposed_supervisor_id',
        'supervisor_approval_status',
        'rejection_reason',
        'period_id',
        'pre_assigned_group_id',
        'is_reserved',
    ];

    protected $casts = [
        'specializations' => 'array',
    ];

    public function period()
    {
        return $this->belongsTo(Period::class);
    }

    public function lecturer()
    {
        return $this->belongsTo(User::class, 'lecturer_id');
    }

    public function groups()
    {
        return $this->hasMany(Group::class);
    }

    public function bids()
    {
        return $this->hasMany(Bid::class);
    }

    public function proposedByGroup()
    {
        return $this->belongsTo(Group::class, 'proposed_by_group_id');
    }

    public function proposedSupervisor()
    {
        return $this->belongsTo(User::class, 'proposed_supervisor_id');
    }

    public function stakeholders()
    {
        return $this->belongsToMany(Stakeholder::class, 'stakeholder_title')
            ->withPivot(['role', 'notes'])
            ->withTimestamps();
    }

    public function approvalAudits()
    {
        return $this->hasMany(TitleApprovalAudit::class, 'title_id');
    }
}
