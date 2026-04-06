<?php

namespace App\Observers;

use App\Models\Group;
use App\Models\GroupMember;

class GroupMemberObserver
{
    /**
     * Handle the GroupMember "created" event.
     * When a new member joins, recalculate group status.
     */
    public function created(GroupMember $member): void
    {
        $this->recalculateStatus($member->group);
        
        // Also refresh readiness snapshot for compatibility
        $member->group->refreshReadinessSnapshot();
    }

    /**
     * Handle the GroupMember "deleted" event.
     * When a member leaves (or is kicked), recalculate group status.
     */
    public function deleted(GroupMember $member): void
    {
        // Get group before deletion since member will be gone
        $group = Group::find($member->group_id);
        if ($group) {
            $this->recalculateStatus($group);
            // Also refresh readiness snapshot for compatibility
            $group->refreshReadinessSnapshot();
        }
    }

    /**
     * Handle the GroupMember "updated" event.
     * If group_id changes (member moved to different group), recalculate both groups.
     */
    public function updated(GroupMember $member): void
    {
        if ($member->isDirty('group_id')) {
            $oldGroupId = $member->getOriginal('group_id');
            $newGroupId = $member->getAttribute('group_id');

            // Recalculate old group
            $oldGroup = Group::find($oldGroupId);
            if ($oldGroup) {
                $this->recalculateStatus($oldGroup);
                $oldGroup->refreshReadinessSnapshot();
            }

            // Recalculate new group
            $newGroup = Group::find($newGroupId);
            if ($newGroup) {
                $this->recalculateStatus($newGroup);
                $newGroup->refreshReadinessSnapshot();
            }
        }
    }

    /**
     * Recalculate group status based on current member count.
     * Skip if group is already in final states.
     * For FORMING_SOLO groups with STUDENT PROPOSED titles, skip auto-transition.
     */
    private function recalculateStatus(Group $group): void
    {
        // Skip if group is in a finalized or beyond state - these should NOT change
        $finalizedStates = [
            'TITLE_APPROVED',    // Solo title approved - waiting for members to join via marketplace
            'READY_FOR_FINALIZATION', // Locked in after leader clicks button - don't revert
            'KELOMPOK_FINAL',   // Waiting for admin finalization
            'PDC1_ACTIVE',
            'READY_FOR_SEMPRO',
            'SEMPRO_DONE',
            'PDC2_ACTIVE',
            'PDC2_READY_FOR_EXPO',
            'EXPO_REGISTERED',
            'EXPO_DONE',
            'PDC2_COMPLETED',
            'CLOSED',
            'DISSOLVED',
        ];

        if (in_array($group->status, $finalizedStates)) {
            return;
        }

        // CRITICAL: For FORMING_SOLO groups with STUDENT PROPOSED titles,
        // DO NOT auto-transition to READY_FOR_BIDDING.
        // Leader must manually click "Siap Finalisasi" button.
        if ($group->status === 'FORMING_SOLO') {
            $title = $group->title;
            if ($title && $title->title_source === 'STUDENT') {
                // Don't auto-transition - stay in FORMING_SOLO
                return;
            }
        }

        // Special handling: If group is READY_FOR_BIDDING and falls below minimum,
        // revert to appropriate status based on group type
        if ($group->status === 'READY_FOR_BIDDING') {
            $period = $group->period;
            $minSize = $period->min_group_size ?? 3;
            $memberCount = $group->members()->count();

            if ($memberCount < $minSize) {
                // If it's a solo seeker (has title_id), revert to FORMING_SOLO
                if ($group->title_id) {
                    $group->status = 'FORMING_SOLO';
                } else {
                    // Normal group, revert to FORMING
                    $group->status = 'FORMING';
                }
                $group->save();
                return;
            }
        }

        // Use determineStatus() to calculate the correct status based on member count
        $newStatus = $group->determineStatus();

        // Only update if status actually changed
        if ($group->status !== $newStatus) {
            $group->status = $newStatus;
            $group->save();
        }
    }
}