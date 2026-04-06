<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JoinRequest extends Model
{
    protected $fillable = [
        'group_id',
        'requester_id',
        'status', // PENDING, ACCEPTED, REJECTED, INVALIDATED
        'message',
    ];

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }
}
