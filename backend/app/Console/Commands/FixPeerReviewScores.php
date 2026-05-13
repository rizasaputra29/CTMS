<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\PeerReview;
use Illuminate\Support\Facades\DB;

class FixPeerReviewScores extends Command
{
    protected $signature = 'peer-review:fix-scores';
    protected $description = 'Fix all peer review scores to be raw_score × 25';

    public function handle()
    {
        $this->info('Fixing peer review scores...');
        
        $fixed = 0;
        $skipped = 0;
        $processed = 0;
        
        // Use chunkById to avoid loading all records into memory
        PeerReview::query()->chunkById(1000, function ($reviews) use (&$fixed, &$skipped, &$processed) {
            foreach ($reviews as $review) {
                $expectedScore = $review->raw_score * 25;
                
                if ($review->score != $expectedScore) {
                    $oldScore = $review->score;
                    $review->update(['score' => $expectedScore]);
                    $this->info("Fixed ID {$review->id}: {$oldScore} → {$expectedScore} (raw: {$review->raw_score})");
                    $fixed++;
                } else {
                    $skipped++;
                }
                $processed++;
            }
            
            $this->info("Processed {$processed} records so far...");
        });
        
        $this->newLine();
        $this->info("Complete! Fixed: {$fixed}, Already correct: {$skipped}");
        
        return 0;
    }
}
