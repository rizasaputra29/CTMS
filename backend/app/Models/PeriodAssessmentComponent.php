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

    /**
     * Get scores for this component across all split tables.
     * Note: Returns a collection, not a relationship.
     */
    public function scores()
    {
        // Since scores are split across tables, we return from repository
        return \App\Repositories\AssessmentScoreRepository::getByComponentId($this->id, 'period_component_id');
    }

    public function getNameAttribute()
    {
        return $this->template?->name;
    }

    public function getCodeAttribute()
    {
        return $this->template?->code;
    }

    public function getWeightAttribute()
    {
        return $this->template?->weight;
    }

    public function getDescriptionAttribute()
    {
        return $this->template?->description;
    }

    /**
     * Get the full component data including template info
     */
    public function getFullComponentAttribute()
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'weight' => $this->weight,
            'type' => $this->type,
            'sort_order' => $this->sort_order,
            'template_id' => $this->template_id,
        ];
    }
}
