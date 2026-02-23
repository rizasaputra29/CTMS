<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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
    ];

    protected $casts = [
        'specializations' => 'array',
    ];

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
}
