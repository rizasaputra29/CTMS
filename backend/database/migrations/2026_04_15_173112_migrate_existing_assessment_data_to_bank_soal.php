<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: Migrate Assessment Components to Templates
        $this->migrateAssessmentComponents();

        // Step 2: Migrate Peer Review Indicators to Templates
        $this->migratePeerReviewIndicators();

        // Step 3: Migrate Period Assessment Components
        $this->migratePeriodAssessmentComponents();

        // Step 4: Migrate Period Peer Review Indicators
        $this->migratePeriodPeerReviewIndicators();

        // Step 5: Migrate Assessment Scores to use period_component_id
        $this->migrateAssessmentScores();

        // Step 6: Migrate Peer Reviews to use period_indicator_id
        $this->migratePeerReviews();
    }

    private function migrateAssessmentComponents(): void
    {
        // Get unique assessment components across all periods
        $components = DB::table('assessment_components')
            ->select('code', 'name', 'description', 'weight', 'sort_order')
            ->distinct()
            ->get();

        foreach ($components as $component) {
            // Check if template already exists
            $exists = DB::table('assessment_component_templates')
                ->where('code', $component->code)
                ->exists();

            if (! $exists) {
                DB::table('assessment_component_templates')->insert([
                    'code' => $component->code,
                    'name' => $component->name,
                    'description' => $component->description,
                    'weight' => $component->weight,
                    'sort_order' => $component->sort_order,
                    'is_active' => true,
                    'created_by' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function migratePeerReviewIndicators(): void
    {
        // Get unique peer review indicators across all periods
        $indicators = DB::table('peer_review_indicators')
            ->select('name', 'description', 'weight', 'sort_order')
            ->distinct()
            ->get();

        foreach ($indicators as $indicator) {
            // Check if template already exists
            $exists = DB::table('peer_review_indicator_templates')
                ->where('name', $indicator->name)
                ->exists();

            if (! $exists) {
                DB::table('peer_review_indicator_templates')->insert([
                    'name' => $indicator->name,
                    'description' => $indicator->description,
                    'weight' => $indicator->weight,
                    'sort_order' => $indicator->sort_order,
                    'is_active' => true,
                    'created_by' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function migratePeriodAssessmentComponents(): void
    {
        // Get all existing assessment components with their period and type
        $components = DB::table('assessment_components')->get();

        foreach ($components as $component) {
            // Find the template
            $template = DB::table('assessment_component_templates')
                ->where('code', $component->code)
                ->first();

            if ($template) {
                // Check if already exists in period config
                $exists = DB::table('period_assessment_components')
                    ->where('period_id', $component->period_id)
                    ->where('type', $component->type)
                    ->where('template_id', $template->id)
                    ->exists();

                if (! $exists) {
                    DB::table('period_assessment_components')->insert([
                        'period_id' => $component->period_id,
                        'template_id' => $template->id,
                        'type' => $component->type,
                        'sort_order' => $component->sort_order,
                        'created_at' => $component->created_at ?? now(),
                        'updated_at' => $component->updated_at ?? now(),
                    ]);
                }
            }
        }
    }

    private function migratePeriodPeerReviewIndicators(): void
    {
        // Get all existing peer review indicators with their period
        $indicators = DB::table('peer_review_indicators')->get();

        foreach ($indicators as $indicator) {
            // Find the template
            $template = DB::table('peer_review_indicator_templates')
                ->where('name', $indicator->name)
                ->first();

            if ($template) {
                // Check if already exists in period config
                $exists = DB::table('period_peer_review_indicators')
                    ->where('period_id', $indicator->period_id)
                    ->where('template_id', $template->id)
                    ->exists();

                if (! $exists) {
                    DB::table('period_peer_review_indicators')->insert([
                        'period_id' => $indicator->period_id,
                        'template_id' => $template->id,
                        'sort_order' => $indicator->sort_order,
                        'created_at' => $indicator->created_at ?? now(),
                        'updated_at' => $indicator->updated_at ?? now(),
                    ]);
                }
            }
        }
    }

    private function migrateAssessmentScores(): void
    {
        // Get all assessment scores
        $scores = DB::table('assessment_scores')->get();

        foreach ($scores as $score) {
            // Find the old component
            $oldComponent = DB::table('assessment_components')
                ->where('id', $score->component_id)
                ->first();

            if ($oldComponent) {
                // Find the template
                $template = DB::table('assessment_component_templates')
                    ->where('code', $oldComponent->code)
                    ->first();

                if ($template) {
                    // Find the period component
                    $periodComponent = DB::table('period_assessment_components')
                        ->where('period_id', $oldComponent->period_id)
                        ->where('type', $oldComponent->type)
                        ->where('template_id', $template->id)
                        ->first();

                    if ($periodComponent) {
                        // Update the score with period_component_id
                        DB::table('assessment_scores')
                            ->where('id', $score->id)
                            ->update([
                                'period_component_id' => $periodComponent->id,
                            ]);
                    }
                }
            }
        }
    }

    private function migratePeerReviews(): void
    {
        // Get all peer reviews
        $reviews = DB::table('peer_reviews')->get();

        foreach ($reviews as $review) {
            // Find the old indicator
            $oldIndicator = DB::table('peer_review_indicators')
                ->where('id', $review->indicator_id)
                ->first();

            if ($oldIndicator) {
                // Find the template
                $template = DB::table('peer_review_indicator_templates')
                    ->where('name', $oldIndicator->name)
                    ->first();

                if ($template) {
                    // Find the period indicator
                    $periodIndicator = DB::table('period_peer_review_indicators')
                        ->where('period_id', $oldIndicator->period_id)
                        ->where('template_id', $template->id)
                        ->first();

                    if ($periodIndicator) {
                        // Update the review with period_indicator_id
                        DB::table('peer_reviews')
                            ->where('id', $review->id)
                            ->update([
                                'period_indicator_id' => $periodIndicator->id,
                            ]);
                    }
                }
            }
        }
    }

    public function down(): void
    {
        // This migration cannot be reversed as it migrates data
        // The data is still available in the old tables
    }
};
