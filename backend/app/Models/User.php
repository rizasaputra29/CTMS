<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property int $id
 * @property string $role
 */
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
        'nip',
        'nim',
        'is_active',
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
    public function supervisedGroups(): BelongsToMany
    {
        return $this->belongsToMany(Group::class, 'supervisions', 'supervisor_id', 'group_id')
            ->withPivot('role', 'assigned_by')
            ->withTimestamps();
    }

    /**
     * Roles assigned to this user.
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    /**
     * Resolve role slugs from both pivot roles and legacy users.role column.
     */
    public function roleSlugs(): array
    {
        $relationRoles = $this->roles->pluck('slug')->filter()->values()->toArray();

        if (! empty($relationRoles)) {
            return array_values(array_unique($relationRoles));
        }

        $legacyRole = $this->getRawOriginal('role');

        return $legacyRole ? [$legacyRole] : [];
    }

    /**
     * Compatibility accessor: prefer pivot role slugs as runtime source of truth.
     */
    public function getRoleAttribute($value): ?string
    {
        if ($this->relationLoaded('roles')) {
            $roleSlug = $this->roles->pluck('slug')->first();

            return $roleSlug ?: $value;
        }

        return $value;
    }

    /**
     * Check if user has a specific role.
     */
    public function hasRole(string $slug): bool
    {
        return in_array($slug, $this->roleSlugs(), true);
    }

    /**
     * TA submissions for this student.
     */
    public function taSubmissions(): HasMany
    {
        return $this->hasMany(TaSubmission::class, 'student_id');
    }

    /**
     * Supervision records (as supervisor).
     */
    public function supervisions(): HasMany
    {
        return $this->hasMany(Supervision::class, 'supervisor_id');
    }

    /**
     * Get current supervision load (number of groups supervised) in a given period.
     */
    public function supervisionLoadInPeriod($periodId): int
    {
        return $this->supervisions()
            ->whereHas('group', fn ($q) => $q->where('period_id', $periodId))
            ->count();
    }

    /**
     * Group memberships for this student.
     */
    public function groupMemberships(): HasMany
    {
        return $this->hasMany(GroupMember::class, 'student_id');
    }

    /**
     * Periods this student has registered for.
     */
    public function registeredPeriods(): BelongsToMany
    {
        return $this->belongsToMany(Period::class, 'period_registrations')
            ->withTimestamps()
            ->wherePivot('status', 'active');
    }

    /**
     * Periods where this student is flagged.
     */
    public function flaggedPeriods()
    {
        return Period::whereIn('id', function ($query) {
            $query->select('period_id')
                ->from('period_registrations')
                ->where('user_id', $this->id)
                ->where('status', 'flagged');
        });
    }
}
