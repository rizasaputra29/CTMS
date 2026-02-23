<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Supervision extends Model
{
    protected $fillable = [
        'group_id',
        'supervisor_id',
        'role',
        'assigned_by',
    ];

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function supervisor()
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
