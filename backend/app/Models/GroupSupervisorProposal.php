<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GroupSupervisorProposal extends Model
{
    protected $fillable = [
        'group_id',
        'proposed_supervisor_1_id',
        'proposed_supervisor_2_id',
        'status',
    ];

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function supervisor1()
    {
        return $this->belongsTo(User::class, 'proposed_supervisor_1_id');
    }

    public function supervisor2()
    {
        return $this->belongsTo(User::class, 'proposed_supervisor_2_id');
    }
}
