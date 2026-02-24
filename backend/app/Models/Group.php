<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Group extends Model
{
    // WARNING: Do not mutate title_id or assignment_type directly.
    // They are intentionally excluded from $fillable.
    // Use assignTitleFromFinalization() and assignTypeFromFinalization() only.
    // These methods are called exclusively by FinalizationService.
    protected $fillable = ['period_id', 'status', 'supervisor_1_id', 'supervisor_2_id'];

    /**
     * Assign title_id — ONLY callable from FinalizationService.
     * Direct $group->title_id = X or $group->update(['title_id' => X]) is blocked
     * because title_id is not in $fillable.
     */
    public function assignTitleFromFinalization(int $titleId): void
    {
        $this->attributes['title_id'] = $titleId;
    }

    /**
     * Assign assignment_type — ONLY callable from FinalizationService.
     */
    public function assignTypeFromFinalization(string $type): void
    {
        $this->attributes['assignment_type'] = $type;
    }

    public function title()
    {
        return $this->belongsTo(Title::class);
    }

    public function period()
    {
        return $this->belongsTo(Period::class);
    }

    public function members()
    {
        return $this->hasMany(GroupMember::class);
    }

    public function students()
    {
        return $this->belongsToMany(User::class, 'group_members', 'group_id', 'student_id');
    }

    public function bids()
    {
        return $this->hasMany(Bid::class);
    }

    public function supervisorProposals()
    {
        return $this->hasMany(GroupSupervisorProposal::class);
    }

    public function supervisions()
    {
        return $this->hasMany(Supervision::class);
    }

    public function taSubmissions()
    {
        return $this->hasMany(TaSubmission::class);
    }

    public function documents()
    {
        return $this->hasMany(Document::class);
    }

    /**
     * Cache field — source of truth is supervisions table.
     */
    public function supervisor1()
    {
        return $this->belongsTo(User::class, 'supervisor_1_id');
    }

    /**
     * Cache field — source of truth is supervisions table.
     */
    public function supervisor2()
    {
        return $this->belongsTo(User::class, 'supervisor_2_id');
    }

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function evaluations()
    {
        return $this->hasMany(Evaluation::class);
    }

    /**
     * Get active members (non-deleted, current members).
     */
    public function activeMembers()
    {
        return $this->hasMany(GroupMember::class);
    }

    public function seminarSchedules()
    {
        return $this->hasMany(SeminarSchedule::class);
    }

    public function taDefenseSchedules()
    {
        return $this->hasMany(TaDefenseSchedule::class);
    }
}
