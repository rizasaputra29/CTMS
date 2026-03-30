<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PhaseDocumentRequirement extends Model
{
    protected $fillable = [
        'period_id',
        'phase',
        'name',
        'description',
        'is_required',
    ];

    protected $casts = [
        'is_required' => 'boolean',
    ];

    public function period()
    {
        return $this->belongsTo(Period::class);
    }
}
