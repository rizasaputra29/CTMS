<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Group extends Model
{
    protected $fillable = ['title_id', 'period_id', 'status', 'assignment_type'];

    public function title()
    {
        return $this->belongsTo(Title::class);
    }

    public function period()
    {
        return $this->belongsTo(Period::class);
    }

    public function members()
    {
        return $this->hasMany(GroupMember::class);
    }

    public function students()
    {
        return $this->belongsToMany(User::class, 'group_members', 'group_id', 'student_id');
    }
}
