<?php

namespace App\Services;

use App\Models\Group;
use InvalidArgumentException;

class GroupStateMachine
{
    /**
     * All valid state transitions: from => [to, to, ...]
     */
    const TRANSITIONS = [
        'FORMING' => ['READY_FOR_BIDDING'],
        'READY_FOR_BIDDING' => ['KELOMPOK_FINAL', 'FORMING'], // FORMING if members drop below min
        'KELOMPOK_FINAL' => ['PDC1_ACTIVE'],
        'PDC1_ACTIVE' => ['READY_FOR_SEMPRO'],
        'READY_FOR_SEMPRO' => ['SEMPRO_DONE', 'PDC1_ACTIVE'], // PDC1_ACTIVE on sempro fail
        'SEMPRO_DONE' => ['PDC2_ACTIVE'],
        'PDC2_ACTIVE' => ['PDC2_READY_FOR_EXPO'],
        'PDC2_READY_FOR_EXPO' => ['EXPO_REGISTERED'],
        'EXPO_REGISTERED' => ['EXPO_DONE', 'PDC2_ACTIVE'], // PDC2_ACTIVE on expo fail
        'EXPO_DONE' => ['PDC2_COMPLETED'],
        'PDC2_COMPLETED' => ['CLOSED'],
        'CLOSED' => [],
    ];

    /**
     * All valid statuses.
     */
    const ALL_STATUSES = [
        'FORMING',
        'READY_FOR_BIDDING',
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
}
