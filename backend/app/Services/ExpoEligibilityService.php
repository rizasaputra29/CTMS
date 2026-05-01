<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Group;

class ExpoEligibilityService
{
    /**
     * Check if a group is eligible for expo scheduling.
     * Centralized in service (not controller) for reuse from scheduler and other contexts.
     *
     * Eligibility: group.status == PDC2_READY_FOR_EXPO AND at least one approved TA_DRAFT document exists.
     */
    public function isEligible(Group $group): bool
    {
        if ($group->status !== 'PDC2_READY_FOR_EXPO') {
            return false;
        }

        // Check if at least one TA_DRAFT document is approved
        $hasTaDraft = Document::where('group_id', $group->id)
            ->where('phase', 'TA_DRAFT')
            ->where('status', 'APPROVED')
            ->exists();

        return $hasTaDraft;
    }
}
