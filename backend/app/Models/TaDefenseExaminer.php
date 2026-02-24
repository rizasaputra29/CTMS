<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaDefenseExaminer extends Model
{
    protected $fillable = [
        'schedule_id',
        'examiner_id',
        'role',
    ];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(TaDefenseSchedule::class, 'schedule_id');
    }

    public function examiner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'examiner_id');
    }
}
