<?php

namespace App\Console\Commands;

use App\Models\PeerReview;
use App\Models\User;
use Illuminate\Console\Command;

class MigratePeerReviewScores extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'peer-review:migrate-scores {--student=87 : Student ID to migrate (default: 87)} {--all : Migrate all students}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Migrate peer review scores from 0-100 scale to 1-4 scale';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $studentId = $this->option('student');
        $migrateAll = $this->option('all');

        $migrated = 0;
        $skipped = 0;
        $errors = 0;
        $processed = 0;

        if ($migrateAll) {
            $this->info('Migrating all peer review scores...');

            // Use chunkById to avoid loading all records into memory
            PeerReview::query()->chunkById(1000, function ($reviews) use (&$migrated, &$skipped, &$errors, &$processed) {
                foreach ($reviews as $review) {
                    $result = $this->migrateReview($review);
                    if ($result === 'migrated') {
                        $migrated++;
                    } elseif ($result === 'skipped') {
                        $skipped++;
                    } else {
                        $errors++;
                    }
                    $processed++;
                }
                $this->info("Processed {$processed} records so far...");
            });
        } else {
            $student = User::find($studentId);
            if (! $student) {
                $this->error("Student with ID {$studentId} not found.");

                return 1;
            }
            $this->info("Migrating peer review scores for student: {$student->name} (ID: {$studentId})");

            // Migrate reviews where student is reviewer or reviewee
            PeerReview::where('reviewer_id', $studentId)
                ->orWhere('reviewee_id', $studentId)
                ->chunkById(1000, function ($reviews) use (&$migrated, &$skipped, &$errors, &$processed) {
                    foreach ($reviews as $review) {
                        $result = $this->migrateReview($review);
                        if ($result === 'migrated') {
                            $migrated++;
                        } elseif ($result === 'skipped') {
                            $skipped++;
                        } else {
                            $errors++;
                        }
                        $processed++;
                    }
                });

            $this->info("Found {$processed} peer review records to migrate.");
        }

        $this->newLine();
        $this->info('Migration complete!');
        $this->table(
            ['Status', 'Count'],
            [
                ['Migrated', $migrated],
                ['Skipped (already 1-4)', $skipped],
                ['Errors', $errors],
            ]
        );

        return 0;
    }

    /**
     * Migrate a single peer review record.
     *
     * @return string 'migrated', 'skipped', or 'error'
     */
    private function migrateReview(PeerReview $review): string
    {
        $oldScore = $review->score;

        // Skip if score is already in 1-4 range
        if ($oldScore >= 1 && $oldScore <= 4 && $oldScore == (int) $oldScore) {
            $this->line("  Skipping review ID {$review->id}: Score {$oldScore} already in 1-4 range");

            return 'skipped';
        }

        // Convert 0-100 scale to 1-4 scale
        // Formula: new_score = max(1, min(4, round(old_score / 25)))
        $newScore = max(1, min(4, round($oldScore / 25)));

        try {
            $review->update(['score' => $newScore]);
            $this->info("  Migrated review ID {$review->id}: {$oldScore} → {$newScore}");

            return 'migrated';
        } catch (\Exception $e) {
            $this->error("  Error migrating review ID {$review->id}: ".$e->getMessage());

            return 'error';
        }
    }
}
