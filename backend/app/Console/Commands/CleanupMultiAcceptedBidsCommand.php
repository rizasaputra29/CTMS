<?php

namespace App\Console\Commands;

use App\Models\Bid;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupMultiAcceptedBidsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bids:cleanup-multi-accepted';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset multi-accepted bids: keep first ACCEPT per title, set others to NULL';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting cleanup of multi-accepted bids...');

        DB::beginTransaction();
        try {
            // Find all titles that have multiple ACCEPT recommendations
            $multiAcceptedTitles = Bid::select('title_id')
                ->where('lecturer_recommendation', 'ACCEPT')
                ->groupBy('title_id')
                ->havingRaw('COUNT(*) > 1')
                ->pluck('title_id');

            if ($multiAcceptedTitles->isEmpty()) {
                $this->info('No multi-accepted titles found. Database is clean.');
                DB::commit();

                return 0;
            }

            $this->warn("Found {$multiAcceptedTitles->count()} titles with multiple ACCEPT recommendations.");

            $totalReset = 0;

            foreach ($multiAcceptedTitles as $titleId) {
                // Get all accepted bids for this title, ordered by created_at (keep first)
                $acceptedBids = Bid::where('title_id', $titleId)
                    ->where('lecturer_recommendation', 'ACCEPT')
                    ->orderBy('created_at', 'asc')
                    ->get();

                $firstBid = $acceptedBids->first();
                $otherBids = $acceptedBids->slice(1);

                $this->line("Title ID {$titleId}: Keeping bid #{$firstBid->id}, resetting ".$otherBids->count().' others');

                // Reset other accepted bids to NULL (pending)
                foreach ($otherBids as $bid) {
                    $bid->update(['lecturer_recommendation' => null]);
                    $totalReset++;
                }
            }

            DB::commit();

            $this->info("✅ Cleanup complete! Reset {$totalReset} bids to pending state.");
            $this->info('Each title now has at most 1 ACCEPT recommendation.');

            return 0;
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error('Error during cleanup: '.$e->getMessage());

            return 1;
        }
    }
}
