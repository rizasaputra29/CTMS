<?php

namespace App\Services;

use App\Models\Group;
use App\Models\Period;
use App\Models\Supervision;
use App\Models\User;

class SupervisorLoadService
{
    /**
     * Get current supervision load for a lecturer in a period.
     */
    public function getLoad(int $lecturerId, int $periodId): array
    {
        // Count active supervisions (SUPERVISOR_1 and SUPERVISOR_2)
        $supervisionCount = Supervision::where('supervisor_id', $lecturerId)
            ->whereHas('group', function ($q) use ($periodId) {
                $q->where('period_id', $periodId)
                    ->whereNotIn('status', ['CLOSED', 'DISSOLVED']);
            })
            ->count();

        // Count groups where lecturer is supervisor_1 or supervisor_2 (cache fields)
        $cachedCount = Group::where('period_id', $periodId)
            ->where(function ($q) use ($lecturerId) {
                $q->where('supervisor_1_id', $lecturerId)
                    ->orWhere('supervisor_2_id', $lecturerId);
            })
            ->whereNotIn('status', ['CLOSED', 'DISSOLVED'])
            ->count();

        // Use max of both counts (in case of data inconsistency)
        $totalLoad = max($supervisionCount, $cachedCount);

        $period = Period::find($periodId);
        $maxLoad = $period?->supervisorLoadLimit(8) ?? 8;

        return [
            'current_load' => $totalLoad,
            'max_load' => $maxLoad,
            'remaining' => max(0, $maxLoad - $totalLoad),
            'is_full' => $totalLoad >= $maxLoad,
            'is_overloaded' => $totalLoad > $maxLoad,
        ];
    }

    /**
     * Check if adding a group would exceed supervisor's max load.
     */
    public function wouldExceedLoad(int $lecturerId, int $periodId, int $additionalGroups = 1): bool
    {
        $load = $this->getLoad($lecturerId, $periodId);

        return ($load['current_load'] + $additionalGroups) > $load['max_load'];
    }

    /**
     * Validate supervisor assignment.
     * Returns array: ['valid' => bool, 'message' => string|null]
     */
    public function validateAssignment(int $lecturerId, int $periodId, ?int $excludeGroupId = null): array
    {
        $lecturer = User::find($lecturerId);

        if (! $lecturer) {
            return ['valid' => false, 'message' => 'Dosen tidak ditemukan.'];
        }

        if (! $lecturer->hasRole('dosen')) {
            return ['valid' => false, 'message' => 'User bukan dosen.'];
        }

        $load = $this->getLoad($lecturerId, $periodId);

        if ($load['is_full']) {
            return [
                'valid' => false,
                'message' => "Dosen {$lecturer->name} sudah mencapai batas maksimal beban ({$load['current_load']}/{$load['max_load']}).",
            ];
        }

        return ['valid' => true, 'message' => null];
    }

    /**
     * Get all lecturers with their load for a period.
     */
    public function getAllLecturerLoads(int $periodId): array
    {
        $lecturers = User::whereHas('roles', function ($q) {
            $q->where('slug', 'dosen');
        })->get();

        $result = [];
        foreach ($lecturers as $lecturer) {
            $load = $this->getLoad($lecturer->id, $periodId);
            $result[] = [
                'lecturer' => $lecturer,
                'load' => $load,
            ];
        }

        return $result;
    }
}
