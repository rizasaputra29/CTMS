<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinalizationAudit extends Model
{
    protected $fillable = [
        'period_id',
        'group_id',
        'user_id',
        'action',
        'old_values',
        'new_values',
        'notes',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    public function period()
    {
        return $this->belongsTo(Period::class);
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
