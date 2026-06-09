<?php

namespace App\Observers;

use App\Jobs\RefreshGroupReadiness;
use App\Models\Group;
use Illuminate\Support\Facades\Cache;

class GroupObserver
{
    public function saved(Group $group): void
    {
        $this->clearGroupCaches($group);

        // Don't trigger if only readiness_status changed (avoid infinite loop)
        if ($group->wasChanged('readiness_status')) {
            return;
        }

        // Dispatch to queue for better performance - avoids blocking the request
        RefreshGroupReadiness::dispatch($group->id);
    }

    public function updated(Group $group): void
    {
        $this->clearGroupCaches($group);

        // Don't trigger if only readiness_status changed (avoid infinite loop)
        if ($group->wasChanged('readiness_status')) {
            return;
        }

        // Dispatch to queue for better performance - avoids blocking the request
        RefreshGroupReadiness::dispatch($group->id);
    }

    public function deleted(Group $group): void
    {
        $this->clearGroupCaches($group);
    }

    /**
     * Clear all related caches for a group.
     */
    private function clearGroupCaches(Group $group): void
    {
        // Clear user-specific group caches
        $members = $group->members()->get();
        foreach ($members as $member) {
            Cache::forget("user:{$member->student_id}:group:*");
        }

        // Clear dashboard caches
        Cache::forget('dashboard:admin:*');
        Cache::forget("readiness:{$group->period_id}");

        // Clear period caches
        Cache::forget('periods:active:all');
        Cache::forget('period:active:latest');
    }
}
