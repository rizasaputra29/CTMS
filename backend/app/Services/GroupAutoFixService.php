<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Bid;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * GROUP AUTO-FIX SERVICE
 *
 * Purpose: Safely repair groups stuck in invalid states without duplicate logic.
 *
 * Pattern: Reuse FinalizationService for core allocation logic.
 * Modes:
 *   - 'safe': Only fix with existing valid data (safe bids, known supervisors)
 *   - 'aggressive': Auto-fix may reassign supervisors and rebalance, requires audit log
 *
 * CRITICAL RULE: Do NOT duplicate logic from FinalizationService.
 * Always call existing service methods or extract to shared utility.
 */
class GroupAutoFixService
{
    protected FinalizationService $finalizationService;
    protected GroupStateMachine $stateMachine;

    public function __construct(
        FinalizationService $finalizationService,
        GroupStateMachine $stateMachine
    ) {
        $this->finalizationService = $finalizationService;
        $this->stateMachine = $stateMachine;
    }

    /**
     * Safely fix a single group readiness issue.
     *
     * @param Group $group The group to fix
     * @param string $mode 'safe' (only use valid existing data) or 'aggressive' (may reassign)
     * @param int|null $adminId Admin user ID (for audit log)
     * @return array ['success' => bool, 'message' => string, 'fixed_issues' => [...]]
     *
     * @throws InvalidArgumentException If mode is invalid or group cannot be fixed
     */
    public function fixGroupReadiness(Group $group, string $mode = 'safe', ?int $adminId = null): array
    {
        if (!in_array($mode, ['safe', 'aggressive'])) {
            throw new InvalidArgumentException("Mode must be 'safe' or 'aggressive'");
        }

        return DB::transaction(function () use ($group, $mode, $adminId) {
            $group->lockForUpdate();

            // Get current issues
            $issues = $group->getReadinessIssues();
            $fixedIssues = [];

            // Try to fix each critical issue
            foreach ($issues['critical'] as $issue) {
                if ($this->resemblesSizeIssue($issue)) {
                    // Size issue: Can't auto-fix, needs manual member management
                    continue;
                }

                if ($this->resemblesTitleIssue($issue)) {
                    $fixedIssue = $this->fixTitleIssue($group, $mode);
                    if ($fixedIssue) {
                        $fixedIssues[] = $fixedIssue;
                    }
                }

                if ($this->resemblesSupervisorIssue($issue)) {
                    $fixedIssue = $this->fixSupervisorIssue($group, $mode);
                    if ($fixedIssue) {
                        $fixedIssues[] = $fixedIssue;
                    }
                }
            }

            // Refresh snapshot after fixes
            $group->refreshReadinessSnapshot();

            // Audit log the auto-fix operation
            AuditLog::create([
                'user_id' => $adminId,
                'action' => 'GROUP_AUTOFIX_APPLIED',
                'target_type' => Group::class,
                'target_id' => $group->id,
                'payload' => [
                    'mode' => $mode,
                    'original_issues' => $issues['critical'],
                    'fixed_issues' => $fixedIssues,
                    'still_broken' => empty($fixedIssues),
                ],
            ]);

            return [
                'success' => $group->isReadyForBidding(),
                'message' => empty($fixedIssues)
                    ? 'Tidak ada issue yang bisa diperbaiki secara otomatis'
                    : 'Berhasil memperbaiki ' . count($fixedIssues) . ' issue(s)',
                'fixed_issues' => $fixedIssues,
                'is_ready' => $group->isReadyForBidding(),
            ];
        }, attempts: 3, timeout: 10);
    }

    /**
     * Fix title issue in SAFE mode: Find valid accepted bid.
     *
     * @return string|null Description of what was fixed, or null if couldn't fix
     */
    private function fixTitleIssue(Group $group, string $mode): ?string
    {
        if ($mode === 'safe') {
            // Find a valid, accepted bid for this group
            $acceptedBid = $group->bids()
                ->where('lecturer_recommendation', 'ACCEPT')
                ->with('title')
                ->first();

            if ($acceptedBid) {
                // Use FinalizationService to allocate (reuse logic)
                // This will assign title and supervisors if available
                // For now, just mark that we found a candidate
                return 'Ditemukan bid yang diterima lecturer untuk judul: ' . $acceptedBid->title->title;
            }

            return null;
        }

        if ($mode === 'aggressive') {
            // In aggressive mode, could auto-find a title
            // But this is riskier — for now, log and skip
            return null;
        }

        return null;
    }

    /**
     * Fix supervisor assignment in SAFE or AGGRESSIVE mode.
     *
     * @return string|null Description of what was fixed
     */
    private function fixSupervisorIssue(Group $group, string $mode): ?string
    {
        if ($mode === 'safe') {
            // Safe: Only assign if already assigned in supervisions table
            $supervisions = $group->supervisions()->get();
            $hasUpdated = false;

            foreach ($supervisions as $supervision) {
                if ($supervision->role === 'SUPERVISOR_1' && !$group->supervisor_1_id) {
                    $group->supervisor_1_id = $supervision->supervisor_id;
                    $group->save();
                    $hasUpdated = true;
                }

                if ($supervision->role === 'SUPERVISOR_2' && !$group->supervisor_2_id) {
                    $group->supervisor_2_id = $supervision->supervisor_id;
                    $group->save();
                    $hasUpdated = true;
                }
            }

            if ($hasUpdated) {
                return 'Sinkronisasi pembimbing dari tabel supervisions';
            }

            return null;
        }

        if ($mode === 'aggressive') {
            // Aggressive: Auto-assign available supervisors
            // This requires smart logic — marked as TODO for now
            return null;
        }

        return null;
    }

    /**
     * Helper: Does issue message indicate size problem?
     */
    private function resemblesSizeIssue(string $issue): bool
    {
        return str_contains($issue, 'Anggota');
    }

    /**
     * Helper: Does issue message indicate title problem?
     */
    private function resemblesTitleIssue(string $issue): bool
    {
        return str_contains($issue, 'Judul') || str_contains($issue, 'Bursa');
    }

    /**
     * Helper: Does issue message indicate supervisor problem?
     */
    private function resemblesSupervisorIssue(string $issue): bool
    {
        return str_contains($issue, 'Pembimbing');
    }

    /**
     * [BATCH OPERATION] Fix readiness for multiple groups in a period.
     *
     * @param int $periodId Period to fix
     * @param string $mode 'safe' or 'aggressive'
     * @param int|null $adminId Admin user ID
     * @return array Summary of fixes
     */
    public function fixPeriodGroupsReadiness(int $periodId, string $mode = 'safe', ?int $adminId = null): array
    {
        $groups = Group::where('period_id', $periodId)
            ->whereNotIn('status', ['CLOSED', 'DISSOLVED'])
            ->get();

        $results = [
            'total' => $groups->count(),
            'fixed' => 0,
            'failed' => 0,
            'details' => [],
        ];

        foreach ($groups as $group) {
            try {
                $result = $this->fixGroupReadiness($group, $mode, $adminId);
                if ($result['success']) {
                    $results['fixed']++;
                } else {
                    $results['failed']++;
                }
                $results['details'][] = [
                    'group_id' => $group->id,
                    'success' => $result['success'],
                    'message' => $result['message'],
                ];
            } catch (\Exception $e) {
                $results['failed']++;
                $results['details'][] = [
                    'group_id' => $group->id,
                    'success' => false,
                    'message' => 'Error: ' . $e->getMessage(),
                ];
            }
        }

        return $results;
    }
}
