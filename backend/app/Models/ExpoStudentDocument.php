<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExpoStudentDocument extends Model
{
    protected $table = 'expo_student_documents';

    public $timestamps = true;

    protected $fillable = [
        'expo_registration_id',
        'group_id',
        'student_id',
        'file_path',
        'original_name',
        'status',
    ];

    public function expoRegistration(): BelongsTo
    {
        return $this->belongsTo(ExpoRegistration::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}
