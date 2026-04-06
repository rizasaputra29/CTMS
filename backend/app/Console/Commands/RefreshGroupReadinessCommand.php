<?php

namespace App\Console\Commands;

use App\Models\Group;
use App\Models\Period;
use Illuminate\Console\Command;

/**
 * REFRESH GROUP READINESS COMMAND
 *
 * Purpose: Batch refresh readiness snapshots for groups in a period.
 * Use cases:
 *   - After data migrations
 *   - Periodic validation (weekly)
 *   - Admin-triggered cache invalidation
 *   - Detect stale snapshots
 *
 * Usage:
 *   php artisan group:refresh-readiness                     # All active periods
 *   php artisan group:refresh-readiness --period=2024-SP-01 # Specific period
 *   php artisan group:refresh-readiness --period=latest     # Latest period only
 *   php artisan group:refresh-readiness --group=123         # Single group
 */
class RefreshGroupReadinessCommand extends Command
{
    protected $signature = 'group:refresh-readiness
                            {--period= : Period code or latest to refresh latest period}
                            {--group= : Refresh single group by ID}
                            {--only-invalid : Only refresh groups with invalid current snapshot}
                            {--verify : Run in dry-run mode (show what would refresh, do not commit)}';

    protected $description = 'Refresh readiness snapshots for groups. Validates current state and updates cache.';

    public function handle()
    {
        $this->info('🔄 Group Readiness Snapshot Refresh');
        $this->line('');

        try {
            if ($this->option('group')) {
                $this->refreshSingleGroup((int)$this->option('group'));
            } else {
                $this->refreshPeriodGroups();
            }

            $this->info('✅ Refresh complete!');
        } catch (\Exception $e) {
            $this->error('❌ Error: ' . $e->getMessage());
            return 1;
        }

        return 0;
    }

    private function refreshSingleGroup(int $groupId): void
    {
        $group = Group::findOrFail($groupId);

        $groupName = $group->group_name ?? 'N/A';
        $this->line("Refreshing group #{$groupId} ({$groupName})...");

        $oldSnapshot = $group->readiness_status;
        $oldReady = data_get($oldSnapshot, 'is_ready');

        if ($this->option('verify')) {
            $this->info("  [DRY-RUN] Would refresh this group");
            return;
        }

        $group->refreshReadinessSnapshot();

        $newSnapshot = $group->fresh()->readiness_status;
        $newReady = data_get($newSnapshot, 'is_ready');

        if ($oldReady === $newReady) {
            $this->info("  ✓ Snapshot unchanged (ready: {$newReady})");
        } else {
            $this->warn("  ⚠ Snapshot changed: was " . ($oldReady ? 'ready' : 'not ready') . ", now " . ($newReady ? 'ready' : 'not ready'));
        }

        if (!empty(data_get($newSnapshot, 'issues.critical'))) {
            foreach (data_get($newSnapshot, 'issues.critical') as $issue) {
                $this->line("    - {$issue}");
            }
        }
    }

    private function refreshPeriodGroups(): void
    {
        $period = $this->getPeriod();

        $this->info("Period: {$period->period_code} ({$period->start_date} – {$period->end_date})");
        $this->line('');

        $query = Group::where('period_id', $period->id)
            ->whereNotIn('status', ['CLOSED', 'DISSOLVED']);

        if ($this->option('only-invalid')) {
            // Only refresh groups where snapshot indicates issues
            $query->whereRaw("readiness_status->>'is_ready' = 'false'");
            $this->info('Filtering: Only groups with invalid status');
        }

        $groups = $query->get();

        if ($groups->isEmpty()) {
            $this->warn('No groups to refresh');
            return;
        }

        $this->info("Found {$groups->count()} group(s) to refresh");
        $this->line('');

        $progressBar = $this->output->createProgressBar($groups->count());
        $progressBar->start();

        $readyCount = 0;
        $invalidCount = 0;
        $changedCount = 0;

        foreach ($groups as $group) {
            $oldSnapshot = $group->readiness_status;
            $oldReady = data_get($oldSnapshot, 'is_ready');

            if ($this->option('verify')) {
                // Dry-run: compute but don't save
                $issues = $group->getReadinessIssues();
                $isReady = empty($issues['critical']);
            } else {
                // Actually refresh
                $group->refreshReadinessSnapshot();
                $newSnapshot = $group->fresh()->readiness_status;
                $isReady = data_get($newSnapshot, 'is_ready');

                if ($oldReady !== $isReady) {
                    $changedCount++;
                }
            }

            if ($isReady) {
                $readyCount++;
            } else {
                $invalidCount++;
            }

            $progressBar->advance();
        }

        $progressBar->finish();
        $this->line('');
        $this->line('');

        // Summary
        $this->info(sprintf(
            'Summary: %d ready, %d invalid, %d changed',
            $readyCount,
            $invalidCount,
            $changedCount
        ));

        if ($this->option('verify')) {
            $this->warn('[DRY-RUN MODE] No changes were committed to the database');
        }

        // Suggest actions
        if ($invalidCount > 0) {
            $this->line('');
            $this->comment('ℹ️  Suggestion: Use "app(GroupAutoFixService::class)->fixPeriodGroupsReadiness()" for automatic repairs');
        }
    }

    private function getPeriod(): Period
    {
        $periodCode = $this->option('period');

        if (!$periodCode) {
            // Default: latest active period
            $period = Period::where('is_active', true)->orderBy('start_date', 'desc')->first();

            if (!$period) {
                $period = Period::orderBy('start_date', 'desc')->first();
            }

            if (!$period) {
                throw new \RuntimeException('No period found. Create one first.');
            }

            return $period;
        }

        if ($periodCode === 'latest') {
            $period = Period::orderBy('start_date', 'desc')->first();
            if (!$period) {
                throw new \RuntimeException('No period found');
            }
            return $period;
        }

        // Search by period_code or id
        $period = Period::where('period_code', $periodCode)
            ->orWhere('id', $periodCode)
            ->first();

        if (!$period) {
            throw new \RuntimeException("Period '{$periodCode}' not found");
        }

        return $period;
    }
}
