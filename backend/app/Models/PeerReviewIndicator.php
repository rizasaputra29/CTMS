<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PeerReviewIndicator extends Model
{
    protected $fillable = [
        'period_id',
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

    public function reviews()
    {
        return $this->hasMany(PeerReview::class, 'indicator_id');
    }
}
