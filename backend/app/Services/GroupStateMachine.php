<?php

namespace App\Services;

use App\Models\Group;
use InvalidArgumentException;

class GroupStateMachine
{
    /**
     * All valid state transitions: from => [to, to, ...]
     * 
     * IMPORTANT NOTES:
     * - Group status is determined by member count via determineStatus()
     * - Transitions here are for INTENTIONAL actions, NOT automatic recalculations
     * - When proposal is REJECTED, use determineStatus() in controller, not transitions
     */
    const TRANSITIONS = [
        // Group with insufficient members - can propose or wait for members
        'FORMING' => [
            'READY_FOR_BIDDING',           // via determineStatus() - members reached min
            'WAITING_SUPERVISOR_APPROVAL', // via controller guard - submit proposal
            'DISSOLVED',
        ],
        
        // Group ready to bid/propose - can submit proposal, join other groups, or be finalized
        'READY_FOR_BIDDING' => [
            'FORMING',                       // via determineStatus() - members dropped below min
            'WAITING_SUPERVISOR_APPROVAL',   // submit proposal
            'READY_FOR_FINALIZATION',        // leader manually marks as ready for finalization
            'DISSOLVED',
        ],
        
        // Group has been accepted/recommended by lecturer - waiting for leader to confirm
        'READY_FOR_FINALIZATION' => [
            'READY_FOR_BIDDING',             // leader can revert if needed
            'KELOMPOK_FINAL',                // admin finalization
            'DISSOLVED',
        ],
        
        // Proposal under review - waiting for supervisor decision
        'WAITING_SUPERVISOR_APPROVAL' => [
            'TITLE_APPROVED',      // solo seeker proposal approved - title open for recruitment
            'READY_FOR_BIDDING',   // regular group proposal approved - via determineStatus()
            'DISSOLVED',
        ],
        
        // Title from solo seeker approved - open for bids/recruitment from other groups
        'TITLE_APPROVED' => [
            'READY_FOR_FINALIZATION',       // leader manually marks as ready for finalization
            'KELOMPOK_FINAL',              // admin finalization after member merge
            'DISSOLVED',
        ],
        
        // After finalization - no going back
        'KELOMPOK_FINAL' => ['PDC1_ACTIVE'],
        'PDC1_ACTIVE' => ['READY_FOR_SEMPRO'],
        'READY_FOR_SEMPRO' => ['SEMPRO_DONE', 'PDC1_ACTIVE'],
        'SEMPRO_DONE' => ['PDC2_ACTIVE'],
        'PDC2_ACTIVE' => ['PDC2_READY_FOR_EXPO'],
        'PDC2_READY_FOR_EXPO' => ['EXPO_REGISTERED'],
        'EXPO_REGISTERED' => ['EXPO_DONE', 'PDC2_ACTIVE'],
        'EXPO_DONE' => ['PDC2_COMPLETED'],
        'PDC2_COMPLETED' => ['CLOSED'],
        'CLOSED' => [],
        'DISSOLVED' => [],
    ];

    /**
     * All valid statuses.
     */
    const ALL_STATUSES = [
        'FORMING',
        'FORMING_SOLO',
        'SOFT_FORMING',
        'WAITING_SUPERVISOR_APPROVAL',
        'TITLE_APPROVED',           // solo title approved, open for recruitment
        'READY_FOR_BIDDING',
        'READY_FOR_FINALIZATION',   // group ready for admin finalization (leader clicked button)
        'KELOMPOK_FINAL',
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

    /**
     * Check if a transition is valid.
     */
    public function canTransition(string $from, string $to): bool
    {
        if (!isset(self::TRANSITIONS[$from])) {
            return false;
        }

        return in_array($to, self::TRANSITIONS[$from]);
    }

    /**
     * Transition a group to a new status.
     *
     * @throws InvalidArgumentException if transition is invalid.
     */
    public function transition(Group $group, string $newStatus): void
    {
        $currentStatus = $group->status;

        if ($newStatus === 'PDC1_ACTIVE') {
            $group->loadMissing('period');
            if (!$group->period || !$group->period->is_finalized) {
                throw new InvalidArgumentException(
                    "Invalid transition to PDC1_ACTIVE: period must be finalized by admin first."
                );
            }
        }

        if (!$this->canTransition($currentStatus, $newStatus)) {
            throw new InvalidArgumentException(
                "Invalid group state transition: {$currentStatus} → {$newStatus}. " .
                "Allowed transitions from {$currentStatus}: " .
                implode(', ', self::TRANSITIONS[$currentStatus] ?? [])
            );
        }

        $group->status = $newStatus;
        $group->save();
    }

    /**
     * Get available transitions for a group.
     */
    public function getAvailableTransitions(Group $group): array
    {
        return self::TRANSITIONS[$group->status] ?? [];
    }

    /**
     * Get the integer order of a status for comparison.
     */
    public function statusOrder(string $status): int
    {
        $index = array_search($status, self::ALL_STATUSES);
        return $index !== false ? $index : -1;
    }

    /**
     * Check if a group's status is at least a given status.
     */
    public function isAtLeast(Group $group, string $minStatus): bool
    {
        return $this->statusOrder($group->status) >= $this->statusOrder($minStatus);
    }

    /**
     * READINESS INTEGRATION: Check if group can bid based on readiness & state.
     *
     * Used by controllers/services to guard bidding operations.
     * Combines:
     *   1. Valid state (READY_FOR_BIDDING)
     *   2. Actual readiness (via Group::isReadyForBidding())
     *
     * @return bool True if group can participate in bidding
     */
    public function canGroupBid(Group $group): bool
    {
        // Must be in READY_FOR_BIDDING or equivalent state
        if ($group->status !== 'READY_FOR_BIDDING') {
            return false;
        }

        // Must pass readiness validation
        return $group->isReadyForBidding();
    }

    /**
     * DEBUG: Get reasons why a group cannot bid.
     *
     * Useful for error messaging and troubleshooting.
     *
     * @return array Reasons why group cannot bid (empty = can bid)
     */
    public function getCannotBidReasons(Group $group): array
    {
        $reasons = [];

        if ($group->status !== 'READY_FOR_BIDDING') {
            $reasons[] = "Status harus READY_FOR_BIDDING, sekarang: {$group->status}";
        }

        $issues = $group->getReadinessIssues();
        foreach ($issues['critical'] as $issue) {
            $reasons[] = $issue;
        }

        return $reasons;
    }
}
