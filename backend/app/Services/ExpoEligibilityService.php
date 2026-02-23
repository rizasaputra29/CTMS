<?php

namespace App\Services;

use App\Models\Group;
use App\Models\TaSubmission;

class ExpoEligibilityService
{
    /**
     * Check if a group is eligible for expo scheduling.
     * Centralized in service (not controller) for reuse from scheduler and other contexts.
     *
     * Eligibility: group.status == PDC2_READY_FOR_EXPO AND at least one TA submission with status >= TA_DRAFT.
     */
    public function isEligible(Group $group): bool
    {
        if ($group->status !== 'PDC2_READY_FOR_EXPO') {
            return false;
        }

        // Check if at least one TA submission exists with status >= TA_DRAFT (using integer order)
        $hasTaDraft = $group->taSubmissions()
            ->whereIn('status', $this->statusesAtLeast('TA_DRAFT'))
            ->exists();

        return $hasTaDraft;
    }

    /**
     * Get all status strings that are >= the given status.
     */
    private function statusesAtLeast(string $minStatus): array
    {
        $order = TaSubmission::TA_STATUS_ORDER;
        $minOrder = $order[$minStatus] ?? 0;

        return array_keys(array_filter($order, fn($v) => $v >= $minOrder));
    }
}
