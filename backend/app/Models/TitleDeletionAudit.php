<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TitleDeletionAudit extends Model
{
    use HasFactory;

    protected $fillable = [
        'title_id',
        'title_name',
        'lecturer_id',
        'period_id',
        'affected_groups',
        'deleted_by',
        'deleted_at',
    ];

    protected $casts = [
        'affected_groups' => 'array',
        'deleted_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($audit) {
            if (empty($audit->deleted_at)) {
                $audit->deleted_at = now();
            }
        });
    }

    /**
     * Get the title that was deleted.
     */
    public function title()
    {
        return $this->belongsTo(Title::class, 'title_id')->withTrashed();
    }

    /**
     * Get the lecturer who owned the title.
     */
    public function lecturer()
    {
        return $this->belongsTo(User::class, 'lecturer_id');
    }

    /**
     * Get the user who deleted the title.
     */
    public function deleter()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    /**
     * Get the period this title belonged to.
     */
    public function period()
    {
        return $this->belongsTo(Period::class);
    }
}
