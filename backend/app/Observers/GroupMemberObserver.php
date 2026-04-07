<?php

namespace App\Observers;

use App\Jobs\RecalculateGroupStatus;
use App\Jobs\RefreshGroupReadiness;
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
        // Dispatch jobs to queue for better performance
        RecalculateGroupStatus::dispatch($member->group_id);
        RefreshGroupReadiness::dispatch($member->group_id);
    }

    /**
     * Handle the GroupMember "deleted" event.
     * When a member leaves (or is kicked), recalculate group status.
     */
    public function deleted(GroupMember $member): void
    {
        // Dispatch jobs to queue for better performance
        RecalculateGroupStatus::dispatch($member->group_id);
        RefreshGroupReadiness::dispatch($member->group_id);
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

            // Dispatch jobs for old group
            RecalculateGroupStatus::dispatch($oldGroupId);
            RefreshGroupReadiness::dispatch($oldGroupId);

            // Dispatch jobs for new group
            RecalculateGroupStatus::dispatch($newGroupId);
            RefreshGroupReadiness::dispatch($newGroupId);
        }
    }
}