<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssessmentComponent extends Model
{
    protected $fillable = [
        'period_id',
        'type',
        'code',
        'name',
        'description',
        'weight',
        'sort_order',
    ];

    protected $casts = [
        'weight' => 'decimal:2',
    ];

    public function period()
    {
        return $this->belongsTo(Period::class);
    }

    public function scores()
    {
        return $this->hasMany(AssessmentScore::class, 'component_id');
    }
}
