<?php

namespace App\Observers;

use App\Models\Group;

class GroupObserver
{
    public function updated(Group $group): void
    {
        // Don't trigger if only readiness_status changed (avoid infinite loop)
        if ($group->wasChanged('readiness_status')) {
            return;
        }

        $group->refreshReadinessSnapshot();
    }
}
