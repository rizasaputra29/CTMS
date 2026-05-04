<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Period extends Model
{
    use SoftDeletes;

    protected $appends = [
        'max_supervisor_load',
    ];
    protected $fillable = [
        'name',
        'start_date',
        'end_date',
        'phase_dates',
        'is_active',
        'is_finalized',
        'bidding_start',
        'bidding_end',
        'bidding_reminder_at',
        'pdc1_start',
        'pdc1_end',
        'pdc1_reminder_at',
        'pdc2_start',
        'pdc2_end',
        'pdc2_reminder_at',
        'expo_date',
        'expo_reminder_at',
        'ta_start',
        'ta_end',
        'ta_reminder_at',
        'min_group_size',
        'max_group_size',
        'max_supervisor_load',
        'max_supervise_load',
        'allow_solo',
        'require_all_students_grouped',
        'grade_configuration',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'phase_dates' => 'array',
        'grade_configuration' => 'array',
        'is_active' => 'boolean',
        'is_finalized' => 'boolean',
        'require_all_students_grouped' => 'boolean',
        'allow_solo' => 'boolean',
        'bidding_start' => 'datetime',
        'bidding_end' => 'datetime',
        'bidding_reminder_at' => 'datetime',
        'pdc1_start' => 'date',
        'pdc1_end' => 'date',
        'pdc1_reminder_at' => 'datetime',
        'pdc2_start' => 'date',
        'pdc2_end' => 'date',
        'pdc2_reminder_at' => 'datetime',
        'expo_date' => 'date',
        'expo_reminder_at' => 'datetime',
        'ta_start' => 'date',
        'ta_end' => 'date',
        'ta_reminder_at' => 'datetime',
        'max_supervisor_load' => 'integer',
        'max_supervise_load' => 'integer',
    ];

    public function getMaxSupervisorLoadAttribute($value): ?int
    {
        if ($value !== null) {
            return (int) $value;
        }

        $legacy = $this->attributes['max_supervise_load'] ?? null;
        return $legacy !== null ? (int) $legacy : null;
    }

    public function supervisorLoadLimit(int $default = 8): int
    {
        return $this->max_supervisor_load ?? $default;
    }

    /**
     * Check if bidding is locked — bidding_end has passed.
     */
    public function isBiddingLocked(): bool
    {
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

    /**
     * Assessment components configured for this period.
     */
    public function assessmentComponents()
    {
        return $this->hasMany(PeriodAssessmentComponent::class);
    }

    /**
     * Peer review indicators configured for this period.
     */
    public function peerReviewIndicators()
    {
        return $this->hasMany(PeriodPeerReviewIndicator::class);
    }

    /**
     * Get the currently active period with caching.
     * Cache for 5 minutes to reduce database queries.
     */
    public static function getActive(?string $cacheKey = null): ?self
    {
        $cacheKey = $cacheKey ?? 'period:active';

        return cache()->remember($cacheKey, now()->addMinutes(5), function () {
            return self::where('is_active', true)->first();
        });
    }

    /**
     * Get all active periods with caching.
     */
    public static function getAllActive(): \Illuminate\Support\Collection
    {
        return cache()->remember('periods:active:all', now()->addMinutes(5), function () {
            return self::where('is_active', true)->get();
        });
    }

    /**
     * Clear the active period cache.
     * Call this when a period is created, updated, or deleted.
     */
    public static function clearActiveCache(): void
    {
        cache()->forget('period:active');
        cache()->forget('periods:active:all');
    }

    protected static function booted(): void
    {
        // Clear cache when period is saved or deleted
        static::saved(function ($period) {
            self::clearActiveCache();
        });

        static::deleted(function ($period) {
            self::clearActiveCache();
        });
    }
}
