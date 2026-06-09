<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Location extends Model
{
    protected $fillable = [
        'name',
        'capacity',
        'is_active',
        'type',
        'description',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'capacity' => 'integer',
    ];

    /**
     * Scope for active locations only
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope for offline locations only
     */
    public function scopeOffline($query)
    {
        return $query->where('type', 'offline');
    }

    /**
     * Scope for online/virtual locations only
     */
    public function scopeOnline($query)
    {
        return $query->where('type', 'online');
    }

    /**
     * Get all schedules at this location
     */
    public function schedules()
    {
        return $this->hasMany(Schedule::class, 'room', 'name');
    }

    /**
     * Check if this is an online/virtual location
     */
    public function isOnline(): bool
    {
        return $this->type === 'online';
    }

    /**
     * Check if this is an offline location
     */
    public function isOffline(): bool
    {
        return $this->type === 'offline';
    }
}
