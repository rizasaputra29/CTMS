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

    /**
     * Get scores for this component across all split tables.
     * Note: Returns a collection, not a relationship.
     */
    public function scores()
    {
        // Since scores are split across tables, we return from repository
        return \App\Repositories\AssessmentScoreRepository::getByComponentId($this->id, 'component_id');
    }
}
