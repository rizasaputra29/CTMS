<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Period extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'name',
        'start_date',
        'end_date',
        'phase_dates',
        'is_active',
        'bidding_start',
        'bidding_end',
        'bidding_locked_at',
        'pdc1_start',
        'pdc1_end',
        'pdc2_start',
        'pdc2_end',
        'expo_date',
        'ta_start',
        'ta_end',
        'min_group_size',
        'max_group_size',
        'max_supervise_load',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'phase_dates' => 'array',
        'is_active' => 'boolean',
        'bidding_start' => 'datetime',
        'bidding_end' => 'datetime',
        'bidding_locked_at' => 'datetime',
        'pdc1_start' => 'date',
        'pdc1_end' => 'date',
        'pdc2_start' => 'date',
        'pdc2_end' => 'date',
        'expo_date' => 'date',
        'ta_start' => 'date',
        'ta_end' => 'date',
    ];

    /**
     * Check if bidding is locked — either admin locked manually or bidding_end passed.
     */
    public function isBiddingLocked(): bool
    {
        if ($this->bidding_locked_at !== null) {
            return true;
        }

        if ($this->bidding_end && now()->isAfter($this->bidding_end)) {
            return true;
        }

        return false;
    }

    /**
     * Check if bidding window is currently open.
     */
    public function isBiddingOpen(): bool
    {
        if ($this->isBiddingLocked()) {
            return false;
        }

        if ($this->bidding_start && now()->isBefore($this->bidding_start)) {
            return false;
        }

        return true;
    }

    public function groups()
    {
        return $this->hasMany(Group::class);
    }
}
