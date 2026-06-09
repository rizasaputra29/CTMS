<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SeminarSchedule extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'group_id',
        'type',
        'date',
        'start_time',
        'end_time',
        'room',
        'location_id',
        'examiner_1_id',
        'examiner_2_id',
        'status',
        'requested_by',
        'rejection_reason',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function examiner1(): BelongsTo
    {
        return $this->belongsTo(User::class, 'examiner_1_id');
    }

    public function examiner2(): BelongsTo
    {
        return $this->belongsTo(User::class, 'examiner_2_id');
    }

    public function evaluations(): HasMany
    {
        return $this->hasMany(SeminarEvaluation::class, 'schedule_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }
}
