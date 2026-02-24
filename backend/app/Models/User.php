<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Groups supervised by this user (via supervisions table — source of truth).
     */
    public function supervisedGroups()
    {
        return $this->belongsToMany(Group::class, 'supervisions', 'supervisor_id', 'group_id')
            ->withPivot('role', 'assigned_by')
            ->withTimestamps();
    }

    /**
     * TA submissions for this student.
     */
    public function taSubmissions()
    {
        return $this->hasMany(TaSubmission::class, 'student_id');
    }

    /**
     * Supervision records (as supervisor).
     */
    public function supervisions()
    {
        return $this->hasMany(Supervision::class, 'supervisor_id');
    }

    /**
     * Get current supervision load (number of groups supervised) in a given period.
     */
    public function supervisionLoadInPeriod($periodId): int
    {
        return $this->supervisions()
            ->whereHas('group', fn($q) => $q->where('period_id', $periodId))
            ->count();
    }

    /**
     * Group memberships for this student.
     */
    public function groupMemberships()
    {
        return $this->hasMany(GroupMember::class, 'student_id');
    }
}
