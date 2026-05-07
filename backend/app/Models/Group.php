<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * @property int $id
 * @property int $period_id
 * @property string $status
 * @property string $group_mode
 * @property int|null $title_id
 */
class Group extends Model
{
    // WARNING: Do not mutate title_id or assignment_type directly.
    // They are intentionally excluded from $fillable.
    // Use assignTitleFromFinalization() and assignTypeFromFinalization() only.
    // These methods are called exclusively by FinalizationService.
    protected $fillable = [
        'period_id',
        'status',
        'supervisor_1_id',
        'supervisor_2_id',
        'group_mode',
        'is_solo',
        'has_existing_group',
        'has_active_proposal',
        'title_id',
        'assignment_type',
        'readiness_status',
        'finalization_notes',
        'finalized_at',
        'finalized_by',
    ];

    protected $casts = [
        'has_active_proposal' => 'boolean',
        'readiness_status' => 'array',
        'is_solo' => 'boolean',
    ];

    /**
     * Boot method to add model event listeners.
     */
    protected static function boot()
    {
        parent::boot();

        // DEBUG: Track all status changes to find auto-transition bug
        static::updating(function (Group $group) {
            if ($group->isDirty('status')) {
                $oldStatus = $group->getOriginal('status');
                $newStatus = $group->status;

                // Only log if transitioning TO READY_FOR_FINALIZATION
                if ($newStatus === 'READY_FOR_FINALIZATION') {
                    Log::warning('group.status_change.READY_FOR_FINALIZATION', [
                        'group_id' => $group->id,
                        'from' => $oldStatus,
                        'to' => $newStatus,
                        'trace' => collect(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 15))
                            ->map(fn ($t) => ($t['class'] ?? '').'::'.($t['function'] ?? '').':'.($t['line'] ?? ''))
                            ->toArray(),
                    ]);
                }
            }
        });
    }

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

    /**
     * Get all supervisors through supervisions relationship
     */
    public function supervisors()
    {
        return $this->belongsToMany(User::class, 'supervisions', 'group_id', 'supervisor_id');
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

    public function finalizedBy()
    {
        return $this->belongsTo(User::class, 'finalized_by');
    }

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    /**
     * Determine group status based ONLY on member count.
     * This is the core logic for automatic status calculation.
     *
     * Status is determined by:
     * - Number of members
     * - Period settings (min_group_size, allow_solo)
     *
     * NOT determined by:
     * - Bid/Proposal status (these are independent)
     * - Any preference/choice actions
     */
    public function determineStatus(): string
    {
        // Skip if already finalized or beyond these states
        if (in_array($this->status, [
            'TITLE_APPROVED',
            'KELOMPOK_FINAL',
            'PDC1_ACTIVE',
            'READY_FOR_SEMPRO',
            'SEMPRO_DONE',
            'PDC2_ACTIVE',
            'PDC2_READY_FOR_EXPO',
            'EXPO_REGISTERED',
            'EXPO_DONE',
            'READY_FOR_TA_INDIVIDUAL',
            'CLOSED',
            'DISSOLVED',
        ])) {
            return $this->status;
        }

        $period = $this->period;
        $minSize = $period->min_group_size ?? 3;
        $allowSolo = $period->allow_solo ?? false;
        $memberCount = $this->members()->count();

        // If members >= minimum, group is ready for bidding/proposing
        if ($memberCount >= $minSize) {
            return 'READY_FOR_BIDDING';
        }

        // Check solo seeker status
        if ($memberCount === 1 && $this->is_solo) {
            return 'FORMING_SOLO';
        }

        // If group has exactly 1 member (normal group with 1 member), return FORMING
        if ($memberCount === 1) {
            return 'FORMING';
        }

        // Otherwise, group is still forming (incomplete)
        return 'FORMING';
    }

    /**
     * Check if group has any active preference (bid or proposal).
     * Used for UI display - NOT for status determination.
     */
    public function hasPreference(): bool
    {
        // Check active bids (PENDING or ACCEPTED)
        $hasBids = $this->bids()
            ->whereIn('status', ['PENDING', 'ACCEPTED'])
            ->exists();

        // Check active proposals (PENDING or APPROVED)
        $hasProposals = \App\Models\Title::where('proposed_by_group_id', $this->id)
            ->where('title_source', 'STUDENT')
            ->whereIn('supervisor_approval_status', ['PENDING', 'APPROVED'])
            ->exists();

        return $hasBids || $hasProposals;
    }

    /**
     * Check if current user is the leader of this group.
     */
    public function isLeader(User $user): bool
    {
        return $this->members()
            ->where('student_id', $user->id)
            ->where('is_leader', true)
            ->exists();
    }

    /**
     * Check if group can mark ready for finalization.
     * Used for frontend display and backend validation.
     */
    public function canMarkReadyForFinalization(): bool
    {
        // Must be in READY_FOR_BIDDING or TITLE_APPROVED status
        if (! in_array($this->status, ['READY_FOR_BIDDING', 'TITLE_APPROVED'])) {
            return false;
        }

        // Period must be active
        if (! $this->period || ! $this->period->is_active) {
            return false;
        }

        // Check member count - must reach max
        $memberCount = $this->members()->count();
        $maxSize = $this->period->max_group_size ?? 4;
        if ($memberCount !== $maxSize) {
            return false;
        }

        // Must have at least one accepted bid or approved proposal
        $hasAcceptedBid = $this->bids()
            ->where('lecturer_recommendation', 'ACCEPT')
            ->exists();

        $hasApprovedProposal = Title::where('proposed_by_group_id', $this->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'APPROVED')
            ->exists();

        return $hasAcceptedBid || $hasApprovedProposal;
    }

    /**
     * Check if group can cancel finalization.
     * Used for frontend display.
     */
    public function canCancelFinalization(): bool
    {
        // Must be in READY_FOR_FINALIZATION status
        if ($this->status !== 'READY_FOR_FINALIZATION') {
            return false;
        }

        // Period must still be active
        if (! $this->period || ! $this->period->is_active) {
            return false;
        }

        return true;
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

    // =================================================================
    // ENTERPRISE READINESS SYSTEM (Single Source of Truth Pattern)
    // =================================================================
    // ALL readiness logic must go through Group::refreshReadinessSnapshot()
    // Snapshot is computed once and cached in readiness_status JSON field.
    // This prevents double computation and ensures consistency.
    // =================================================================

    /**
     * SINGLE SOURCE OF TRUTH: Compute & persist readiness snapshot.
     * Called by:
     * - GroupObserver::updated() on model changes
     * - Controllers for manual refresh
     * - Batch commands
     *
     * CRITICAL: Always wrap in DB::transaction() if called from multi-step operations.
     */
    public function refreshReadinessSnapshot(): self
    {
        $memberCount = $this->members()->count();

        $snapshot = [
            'is_ready' => $this->isReadyForBidding(),
            'issues' => $this->getReadinessIssues(),
            'member_count' => $memberCount,
            'supervisor_assigned' => $this->supervisor_1_id !== null && $this->supervisor_2_id !== null,
            'title_assigned' => $this->title_id !== null,
            'progress' => $this->calculateProgressScore($memberCount),
            'last_checked_at' => now()->toIso8601String(),
        ];

        \Illuminate\Support\Facades\DB::transaction(function () use ($snapshot) {
            $this->update(['readiness_status' => $snapshot]);

            AuditLog::create([
                'user_id' => null,
                'action' => 'READINESS_SNAPSHOT_REFRESHED',
                'target_type' => self::class,
                'target_id' => $this->id,
                'payload' => [
                    'snapshot' => $snapshot,
                    'triggered_by' => 'observer',
                ],
            ]);
        });

        return $this->fresh();
    }

    /**
     * Check if group is ready for bidding (explicit check, not cached).
     * This is the CORE LOGIC — used by FinalizationService, GroupStateMachine, etc.
     *
     * @return bool True if all critical requirements met.
     */
    public function isReadyForBidding(): bool
    {
        return empty($this->getReadinessIssues()['critical']);
    }

    /**
     * Get detailed readiness issues (critical & warning).
     * IMPORTANT: This computes fresh — used to build snapshot.
     *
     * @return array ['critical' => [...], 'warning' => [...]]
     */
    public function getReadinessIssues(): array
    {
        $issues = ['critical' => [], 'warning' => []];

        // Always check size constraints
        $sizeIssues = $this->checkSizeConstraints();
        if (! empty($sizeIssues)) {
            $issues['critical'] = array_merge($issues['critical'], $sizeIssues);
        }

        // Always check title requirement
        $titleIssues = $this->checkTitleRequirement();
        if (! empty($titleIssues)) {
            $issues['critical'] = array_merge($issues['critical'], $titleIssues);
        }

        // Always check supervisor requirement
        $supervisorIssues = $this->checkSupervisorRequirement();
        if (! empty($supervisorIssues)) {
            $issues['critical'] = array_merge($issues['critical'], $supervisorIssues);
        }

        return $issues;
    }

    /**
     * Check group size constraints.
     *
     * @return array Issues found
     */
    private function checkSizeConstraints(): array
    {
        $issues = [];
        $period = $this->period;
        if (! $period) {
            return $issues;
        }

        $minSize = $period->min_group_size ?? 3;
        $maxSize = $period->max_group_size ?? 4;
        $activeMembersCount = $this->members()->count();

        if ($activeMembersCount < $minSize) {
            $issues[] = "Anggota kurang dari batas minimum ({$activeMembersCount}/{$minSize})";
        } elseif ($activeMembersCount > $maxSize) {
            $issues[] = "Anggota melebihi batas kapasitas ({$activeMembersCount}/{$maxSize})";
        }

        return $issues;
    }

    /**
     * Check title assignment requirement.
     * Title can come from bidding or student proposal.
     *
     * @return array Issues found
     */
    private function checkTitleRequirement(): array
    {
        $issues = [];

        // Already assigned via finalization
        if ($this->title_id) {
            return $issues;
        }

        // Check if group has accepted bid (lecturer recommendation = ACCEPT)
        $hasAcceptedBid = $this->bids()
            ->where('lecturer_recommendation', 'ACCEPT')
            ->exists();

        if (! $hasAcceptedBid) {
            $issues[] = 'Judul (Bursa Ide/Proposal) belum ditetapkan';
        }

        return $issues;
    }

    /**
     * Check supervisor assignment requirement.
     * Both supervisors must be assigned.
     *
     * @return array Issues found
     */
    private function checkSupervisorRequirement(): array
    {
        $issues = [];
        $missing = [];

        if (! $this->supervisor_1_id) {
            $missing[] = 'Pembimbing 1';
        }
        if (! $this->supervisor_2_id) {
            $missing[] = 'Pembimbing 2';
        }

        if (! empty($missing)) {
            $issues[] = 'Belum memiliki '.implode(' & ', $missing);
        }

        return $issues;
    }

    /**
     * Calculate Progress Score (0-100) based on readiness criteria.
     */
    public function calculateProgressScore(?int $memberCount = null): int
    {
        $criteria = 3;
        $met = 0;

        $activeMembersCount = $memberCount ?? $this->members()->count();
        $minSize = $this->period->min_group_size ?? 3;
        if ($activeMembersCount >= $minSize) {
            $met++;
        }

        if ($this->title_id || $this->bids()->where('lecturer_recommendation', 'ACCEPT')->exists()) {
            $met++;
        }
        if ($this->supervisor_1_id && $this->supervisor_2_id) {
            $met++;
        }

        return (int) round(($met / $criteria) * 100);
    }

    /**
     * DEPRECATED: Use isReadyForBidding() or getReadinessIssues() instead.
     * Kept for backwards compatibility, but don't use in new code.
     */
    public function calculateReadiness(): array
    {
        // Return cached snapshot if available
        if ($this->readiness_status) {
            return $this->readiness_status;
        }

        // Otherwise compute fresh
        return [
            'is_ready' => $this->isReadyForBidding(),
            'issues' => $this->getReadinessIssues(),
            'member_count' => $this->members()->count(),
            'supervisor_assigned' => $this->supervisor_1_id !== null && $this->supervisor_2_id !== null,
            'title_assigned' => $this->title_id !== null,
            'last_checked_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Check if group can accept new members.
     */
    public function canAcceptNewMembers(): bool
    {
        $maxSize = $this->period->max_group_size ?? 4;

        return $this->members()->count() < $maxSize;
    }

    /**
     * Check if group is at maximum capacity.
     */
    public function isAtMaxCapacity(): bool
    {
        $maxSize = $this->period->max_group_size ?? 4;

        return $this->members()->count() >= $maxSize;
    }

    /**
     * Revert group status to FORMING_SOLO.
     */
    public function revertToFormingSolo(): void
    {
        $this->update(['status' => 'FORMING_SOLO']);
    }

    /**
     * Get approval audit history for this group's current title.
     */
    public function getApprovalAuditHistory()
    {
        if (! $this->title_id) {
            return collect();
        }

        return TitleApprovalAudit::where('title_id', $this->title_id)
            ->where('affected_group_id', $this->id)
            ->orderByDesc('created_at')
            ->with('title', 'lecturer')
            ->get();
    }

    /**
     * Relationship: Approval audits affecting this group.
     */
    public function approvalAudits()
    {
        return $this->hasMany(TitleApprovalAudit::class, 'affected_group_id');
    }

    /**
     * Scope: Groups that are ready for finalization.
     */
    public function scopeReadyForFinalization($query)
    {
        return $query->where('status', 'READY_FOR_FINALIZATION');
    }

    /**
     * Scope: Groups that are in KELOMPOK_FINAL status.
     */
    public function scopeKelompokFinal($query)
    {
        return $query->where('status', 'KELOMPOK_FINAL');
    }

    /**
     * Scope: Groups that have been finalized (PDC1_ACTIVE and beyond).
     */
    public function scopeFinalized($query)
    {
        return $query->whereIn('status', ['PDC1_ACTIVE', 'READY_FOR_SEMPRO', 'SEMPRO_DONE', 'PDC2_ACTIVE', 'PDC2_READY_FOR_EXPO', 'EXPO_REGISTERED', 'EXPO_DONE', 'READY_FOR_TA_INDIVIDUAL', 'CLOSED']);
    }

    /**
     * Check if group has both supervisors assigned.
     */
    public function hasSupervisors(): bool
    {
        return ! is_null($this->supervisor_1_id);
    }
}
