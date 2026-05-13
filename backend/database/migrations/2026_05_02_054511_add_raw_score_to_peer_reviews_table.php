<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('peer_reviews', function (Blueprint $table) {
            // Add raw_score column to store 1-4 scale scores
            $table->integer('raw_score')->nullable()->after('score');
        });

        // Migrate existing data
        $this->migrateExistingData();
    }

    /**
     * Migrate existing data to separate columns
     */
    private function migrateExistingData(): void
    {
        $reviews = DB::table('peer_reviews')->get();
        
        foreach ($reviews as $review) {
            $currentScore = $review->score;
            
            // Check if score is already in 1-4 range (integer values)
            if ($currentScore >= 1 && $currentScore <= 4 && $currentScore == round($currentScore)) {
                // Already in new format: raw_score = current, score = converted
                $rawScore = (int) $currentScore;
                $convertedScore = $rawScore * 25;
            } else {
                // Old format (0-100): convert to 1-4 for raw_score
                $rawScore = max(1, min(4, round($currentScore / 25)));
                $convertedScore = $currentScore; // Keep original as converted
            }
            
            DB::table('peer_reviews')
                ->where('id', $review->id)
                ->update([
                    'raw_score' => $rawScore,
                    'score' => $convertedScore,
                ]);
        }
        
        echo "Migrated " . count($reviews) . " peer review records.\n";
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('peer_reviews', function (Blueprint $table) {
            $table->dropColumn('raw_score');
        });
    }
};
