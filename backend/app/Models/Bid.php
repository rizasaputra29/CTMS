<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bid extends Model
{
    protected $fillable = [
        'group_id',
        'title_id',
        'priority',
        'status',
        'lecturer_recommendation',
        'proposed_supervisor_1_id',
        'proposed_supervisor_2_id',
    ];

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function title()
    {
        return $this->belongsTo(Title::class);
    }

    public function proposedSupervisor1()
    {
        return $this->belongsTo(User::class, 'proposed_supervisor_1_id');
    }

    public function proposedSupervisor2()
    {
        return $this->belongsTo(User::class, 'proposed_supervisor_2_id');
    }
}
