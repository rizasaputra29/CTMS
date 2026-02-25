<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExpoRegistration extends Model
{
    protected $fillable = [
        'expo_event_id',
        'group_id',
        'registered_at',
        'status',
    ];

    protected $casts = [
        'registered_at' => 'datetime',
    ];

    public function expoEvent()
    {
        return $this->belongsTo(ExpoEvent::class);
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }
}
