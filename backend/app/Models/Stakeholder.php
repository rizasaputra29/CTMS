<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Stakeholder extends Model
{
    protected $fillable = [
        'name',
        'organization',
        'email',
        'phone',
        'type',
        'notes',
    ];

    public function titles()
    {
        return $this->belongsToMany(Title::class, 'stakeholder_title')
            ->withPivot(['role', 'notes'])
            ->withTimestamps();
    }
}
