<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GradeConsistencyCheck extends Model
{
    protected $fillable = [
        'group_id',
        'student_id',
        'pdc1_score',
        'pdc2_score',
        'deviation',
        'status',
        'notes',
        'checked_by',
    ];

    protected $casts = [
        'pdc1_score' => 'decimal:2',
        'pdc2_score' => 'decimal:2',
        'deviation' => 'decimal:2',
    ];

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function checker()
    {
        return $this->belongsTo(User::class, 'checked_by');
    }
}
