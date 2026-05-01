<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PeerReview extends Model
{
    protected $fillable = [
        'group_id',
        'reviewer_id',
        'reviewee_id',
        'indicator_id',
        'period_indicator_id',
        'score',
        'comment',
        'is_final_submission',
        'submitted_at',
    ];

    protected $casts = [
        'score' => 'decimal:2',
    ];

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function reviewee()
    {
        return $this->belongsTo(User::class, 'reviewee_id');
    }

    public function indicator()
    {
        return $this->belongsTo(PeerReviewIndicator::class, 'indicator_id');
    }

    public function periodIndicator()
    {
        return $this->belongsTo(PeriodPeerReviewIndicator::class, 'period_indicator_id');
    }
}
