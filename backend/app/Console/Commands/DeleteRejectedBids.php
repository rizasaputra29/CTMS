<?php

namespace App\Console\Commands;

use App\Models\Bid;
use Illuminate\Console\Command;

class DeleteRejectedBids extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bids:delete-rejected
                            {--days=7 : Delete bids rejected more than X days ago}
                            {--dry-run : Preview only, do not delete}
                            {--group-id= : Delete only for specific group}
                            {--force : Skip confirmation}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Delete rejected bids from the database';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = $this->option('days');
        $dryRun = $this->option('dry-run');
        $groupId = $this->option('group-id');
        $force = $this->option('force');

        // Build query
        $query = Bid::where('lecturer_recommendation', 'REJECTED')
            ->where('updated_at', '<', now()->subDays($days));

        if ($groupId) {
            $query->where('group_id', $groupId);
        }

        $count = $query->count();

        if ($count === 0) {
            $this->info('No rejected bids found to delete.');

            return 0;
        }

        // Show preview
        $this->info("Found {$count} rejected bid(s) to delete:");

        if (! $force && ! $dryRun) {
            $bids = $query->take(5)->get();
            foreach ($bids as $bid) {
                $this->line("  - Bid ID: {$bid->id}, Group: {$bid->group_id}, Title: {$bid->title_id}, Rejected: {$bid->updated_at}");
            }
            if ($count > 5) {
                $this->line('  ... and '.($count - 5).' more');
            }
        }

        // Dry run mode
        if ($dryRun) {
            $this->warn('[DRY RUN] No bids were deleted.');
            $this->info("Would delete {$count} bid(s)");

            return 0;
        }

        // Confirmation
        if (! $force) {
            if (! $this->confirm("Are you sure you want to delete {$count} rejected bid(s)?")) {
                $this->info('Operation cancelled.');

                return 0;
            }
        }

        // Delete bids
        $deleted = $query->delete();

        $this->info("Successfully deleted {$deleted} rejected bid(s).");

        return 0;
    }
}
