<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssessmentComponentTemplate extends Model
{
    protected $fillable = [
        'code',
        'name',
        'description',
        'weight',
        'is_active',
        'created_by',
        'sort_order',
    ];

    protected $casts = [
        'weight' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function periodComponents()
    {
        return $this->hasMany(PeriodAssessmentComponent::class, 'template_id');
    }
}
