<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    protected $fillable = ['group_id', 'type', 'date', 'room', 'mode', 'notes'];

    protected $casts = [
        'date' => 'datetime',
    ];

    public function group()
    {
        return $this->belongsTo(Group::class);
    }
}
