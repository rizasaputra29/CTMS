<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentType extends Model
{
    protected $fillable = [
        'name',
        'description',
        'phase',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
