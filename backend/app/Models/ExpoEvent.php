<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ExpoEvent extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'period_id',
        'name',
        'date',
        'start_time',
        'end_time',
        'room',
        'capacity',
        'is_published',
        'created_by',
    ];

    protected $casts = [
        'date' => 'date',
        'is_published' => 'boolean',
        'capacity' => 'integer',
    ];

    public function period()
    {
        return $this->belongsTo(Period::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function registrations()
    {
        return $this->hasMany(ExpoRegistration::class);
    }

    /**
     * Check if event has remaining capacity.
     */
    public function hasCapacity(): bool
    {
        return $this->registrations()->count() < $this->capacity;
    }

    /**
     * Get current registration count.
     */
    public function getRegisteredCountAttribute(): int
    {
        return $this->registrations()->count();
    }
}
