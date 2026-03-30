<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DigitalSignature extends Model
{
    protected $fillable = [
        'user_id',
        'document_reference',
        'document_type',
        'signature_data',
        'hash',
        'signed_at',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
