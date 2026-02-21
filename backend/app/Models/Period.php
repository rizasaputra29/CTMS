<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Period extends Model
{
    protected $fillable = ['name', 'start_date', 'end_date', 'phase_dates', 'is_active'];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'phase_dates' => 'array',
        'is_active' => 'boolean',
    ];
    //
}
