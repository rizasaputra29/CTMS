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
        'is_finalized',
        'bidding_start',
        'bidding_end',
        'bidding_locked_at',
        'bidding_reminder_at',
        'pdc1_start',
        'pdc1_end',
        'pdc1_reminder_at',
        'pdc1_locked_at',
        'pdc2_start',
        'pdc2_end',
        'pdc2_reminder_at',
        'pdc2_locked_at',
        'expo_date',
        'expo_reminder_at',
        'expo_locked_at',
        'ta_start',
        'ta_end',
        'ta_reminder_at',
        'ta_locked_at',
        'min_group_size',
        'max_group_size',
        'max_supervisor_load',
        'allow_solo',
        'require_all_students_grouped',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'phase_dates' => 'array',
        'is_active' => 'boolean',
        'is_finalized' => 'boolean',
        'require_all_students_grouped' => 'boolean',
        'allow_solo' => 'boolean',
        'bidding_start' => 'datetime',
        'bidding_end' => 'datetime',
        'bidding_locked_at' => 'datetime',
        'bidding_reminder_at' => 'datetime',
        'pdc1_start' => 'date',
        'pdc1_end' => 'date',
        'pdc1_reminder_at' => 'datetime',
        'pdc1_locked_at' => 'datetime',
        'pdc2_start' => 'date',
        'pdc2_end' => 'date',
        'pdc2_reminder_at' => 'datetime',
        'pdc2_locked_at' => 'datetime',
        'expo_date' => 'date',
        'expo_reminder_at' => 'datetime',
        'expo_locked_at' => 'datetime',
        'ta_start' => 'date',
        'ta_end' => 'date',
        'ta_reminder_at' => 'datetime',
        'ta_locked_at' => 'datetime',
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

    /**
     * Check if this period is open for new group registration.
     * A period is open when it's active AND not yet finalized.
     */
    public function isRegistrationOpen(): bool
    {
        return $this->is_active && !$this->is_finalized;
    }

    public function groups()
    {
        return $this->hasMany(Group::class);
    }

    /**
     * Students who have registered for this period.
     */
    public function registeredStudents()
    {
        return $this->belongsToMany(User::class, 'period_registrations')
            ->withTimestamps();
    }
}
