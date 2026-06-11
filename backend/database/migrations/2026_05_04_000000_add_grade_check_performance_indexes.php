<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Performance indexes for Grade Check queries.
 *
 * These indexes address N+1 query issues and slow queries in GradeCheckController
 * for filtering and aggregating assessment scores, peer reviews, and TA defense data.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Assessment scores indexes for grade check queries
        Schema::table('assessment_scores', function (Blueprint $table) {
            // Composite index for student + evaluation_type lookups (getStudentAllData)
            $table->index(['student_id', 'evaluation_type'], 'idx_assessment_scores_student_type');

            // Composite index for group + evaluation_type lookups (getAssessmentData)
            $table->index(['group_id', 'evaluation_type'], 'idx_assessment_scores_group_type');

            // Index for evaluation_type filtering
            $table->index('evaluation_type', 'idx_assessment_scores_type');
        });

        // Peer reviews indexes
        Schema::table('peer_reviews', function (Blueprint $table) {
            // Composite index for reviewee + final submission status (getStudentAllData)
            $table->index(['reviewee_id', 'is_final_submission'], 'idx_peer_reviews_reviewee_final');

            // Index for group_id filtering
            $table->index('group_id', 'idx_peer_reviews_group');
        });

        // Add period_id to ta_defense_schedules if not exists (for efficient filtering)
        if (! Schema::hasColumn('ta_defense_schedules', 'period_id')) {
            Schema::table('ta_defense_schedules', function (Blueprint $table) {
                $table->foreignId('period_id')->nullable()->constrained()->after('group_id');
                $table->index(['student_id', 'period_id'], 'idx_ta_defense_schedules_student_period');
            });
        } else {
            // Just add the index if column already exists
            Schema::table('ta_defense_schedules', function (Blueprint $table) {
                $table->index(['student_id', 'period_id'], 'idx_ta_defense_schedules_student_period');
            });
        }

        // Schedules index for getEvaluatorRole method
        Schema::table('schedules', function (Blueprint $table) {
            // Composite index for group + type lookups (used in getEvaluatorRole)
            $table->index(['group_id', 'type'], 'idx_schedules_group_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Assessment scores indexes
        Schema::table('assessment_scores', function (Blueprint $table) {
            $table->dropIndex('idx_assessment_scores_student_type');
            $table->dropIndex('idx_assessment_scores_group_type');
            $table->dropIndex('idx_assessment_scores_type');
        });

        // Peer reviews indexes
        Schema::table('peer_reviews', function (Blueprint $table) {
            $table->dropIndex('idx_peer_reviews_reviewee_final');
            $table->dropIndex('idx_peer_reviews_group');
        });

        // TA defense schedules index
        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            $table->dropIndex('idx_ta_defense_schedules_student_period');
        });

        // Schedules index
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropIndex('idx_schedules_group_type');
        });
    }
};
