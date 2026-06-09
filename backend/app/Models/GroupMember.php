<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GroupMember extends Model
{
    protected $fillable = ['group_id', 'student_id', 'is_leader', 'period_id'];

    protected $casts = [
        'is_leader' => 'boolean',
    ];

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}
