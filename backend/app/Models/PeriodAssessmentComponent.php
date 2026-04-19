<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PeriodAssessmentComponent extends Model
{
    protected $fillable = [
        'period_id',
        'template_id',
        'type',
        'sort_order',
    ];

    public function period()
    {
        return $this->belongsTo(Period::class);
    }

    public function template()
    {
        return $this->belongsTo(AssessmentComponentTemplate::class, 'template_id');
    }

    public function scores()
    {
        return $this->hasMany(AssessmentScore::class, 'period_component_id');
    }

    /**
     * Get the full component data including template info
     */
    public function getFullComponentAttribute()
    {
        return [
            'id' => $this->id,
            'code' => $this->template->code,
            'name' => $this->template->name,
            'description' => $this->template->description,
            'weight' => $this->template->weight,
            'type' => $this->type,
            'sort_order' => $this->sort_order,
            'template_id' => $this->template_id,
        ];
    }
}
