<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PeriodPeerReviewIndicator extends Model
{
    protected $fillable = [
        'period_id',
        'template_id',
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

    public function reviews()
    {
        return $this->hasMany(PeerReview::class, 'period_indicator_id');
    }

    /**
     * Get the full indicator data including template info
     */
    public function getFullIndicatorAttribute()
    {
        return [
            'id' => $this->id,
            'code' => $this->template->code,
            'name' => $this->template->name,
            'description' => $this->template->description,
            'weight' => $this->template->weight,
            'sort_order' => $this->sort_order,
            'template_id' => $this->template_id,
        ];
    }
}
