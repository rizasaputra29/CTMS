<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PeriodRegistration extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'period_id',
        'status',
        'flagged_at',
        'flagged_by',
    ];

    protected $casts = [
        'flagged_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function period()
    {
        return $this->belongsTo(Period::class);
    }

    /**
     * User who flagged this registration.
     */
    public function flaggedBy()
    {
        return $this->belongsTo(User::class, 'flagged_by');
    }

    /**
     * Scope to get active registrations.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope to get flagged registrations.
     */
    public function scopeFlagged($query)
    {
        return $query->where('status', 'flagged');
    }
}
