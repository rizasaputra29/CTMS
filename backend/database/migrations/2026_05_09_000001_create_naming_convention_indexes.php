<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Naming Convention Refactor - Part 1
 * 
 * Adds explicit index names to existing tables following best practices:
 * - Pattern: idx_{table}_{column1}_{column2}
 * - All indexes should have explicit names for easier management
 * 
 * This migration complements existing performance indexes while standardizing naming.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // groups table - add explicit names to existing indexes if not already named
        Schema::table('groups', function (Blueprint $table) {
            // These indexes likely exist from earlier migrations, skip if they do
            // Adding any missing indexes with proper naming
            if (!$this->indexExists('groups', 'idx_groups_period_id')) {
                $table->index('period_id', 'idx_groups_period_id');
            }
            if (!$this->indexExists('groups', 'idx_groups_title_id')) {
                $table->index('title_id', 'idx_groups_title_id');
            }
        });

        // group_members table
        Schema::table('group_members', function (Blueprint $table) {
            if (!$this->indexExists('group_members', 'idx_group_members_student_id')) {
                $table->index('student_id', 'idx_group_members_student_id');
            }
            if (!$this->indexExists('group_members', 'idx_group_members_group_id')) {
                $table->index('group_id', 'idx_group_members_group_id');
            }
        });

        // titles table
        Schema::table('titles', function (Blueprint $table) {
            if (!$this->indexExists('titles', 'idx_titles_lecturer_id')) {
                $table->index('lecturer_id', 'idx_titles_lecturer_id');
            }
            if (!$this->indexExists('titles', 'idx_titles_period_id')) {
                $table->index('period_id', 'idx_titles_period_id');
            }
        });

        // documents table
        Schema::table('documents', function (Blueprint $table) {
            if (!$this->indexExists('documents', 'idx_documents_group_id')) {
                $table->index('group_id', 'idx_documents_group_id');
            }
            if (!$this->indexExists('documents', 'idx_documents_student_id')) {
                $table->index('student_id', 'idx_documents_student_id');
            }
            if (!$this->indexExists('documents', 'idx_documents_phase')) {
                $table->index('phase', 'idx_documents_phase');
            }
        });

        // evaluations table
        Schema::table('evaluations', function (Blueprint $table) {
            if (!$this->indexExists('evaluations', 'idx_evaluations_evaluator_id')) {
                $table->index('evaluator_id', 'idx_evaluations_evaluator_id');
            }
            if (!$this->indexExists('evaluations', 'idx_evaluations_group_id')) {
                $table->index('group_id', 'idx_evaluations_group_id');
            }
            if (!$this->indexExists('evaluations', 'idx_evaluations_type')) {
                $table->index('type', 'idx_evaluations_type');
            }
        });

        // bids table
        Schema::table('bids', function (Blueprint $table) {
            if (!$this->indexExists('bids', 'idx_bids_group_id')) {
                $table->index('group_id', 'idx_bids_group_id');
            }
            if (!$this->indexExists('bids', 'idx_bids_title_id')) {
                $table->index('title_id', 'idx_bids_title_id');
            }
        });

        // supervisions table
        Schema::table('supervisions', function (Blueprint $table) {
            if (!$this->indexExists('supervisions', 'idx_supervisions_group_id')) {
                $table->index('group_id', 'idx_supervisions_group_id');
            }
            if (!$this->indexExists('supervisions', 'idx_supervisions_supervisor_id')) {
                $table->index('supervisor_id', 'idx_supervisions_supervisor_id');
            }
        });

        // assessment_components table
        Schema::table('assessment_components', function (Blueprint $table) {
            if (!$this->indexExists('assessment_components', 'idx_assessment_components_period_id')) {
                $table->index('period_id', 'idx_assessment_components_period_id');
            }
            if (!$this->indexExists('assessment_components', 'idx_assessment_components_type')) {
                $table->index('type', 'idx_assessment_components_type');
            }
        });

        // notifications table
        Schema::table('notifications', function (Blueprint $table) {
            if (!$this->indexExists('notifications', 'idx_notifications_user_id')) {
                $table->index('user_id', 'idx_notifications_user_id');
            }
            if (!$this->indexExists('notifications', 'idx_notifications_is_read')) {
                $table->index('is_read', 'idx_notifications_is_read');
            }
        });

        // audit_logs table
        Schema::table('audit_logs', function (Blueprint $table) {
            if (!$this->indexExists('audit_logs', 'idx_audit_logs_user_id')) {
                $table->index('user_id', 'idx_audit_logs_user_id');
            }
            if (!$this->indexExists('audit_logs', 'idx_audit_logs_action')) {
                $table->index('action', 'idx_audit_logs_action');
            }
            if (!$this->indexExists('audit_logs', 'idx_audit_logs_target_type_target_id')) {
                $table->index(['target_type', 'target_id'], 'idx_audit_logs_target_type_target_id');
            }
        });

        // peer_reviews table
        Schema::table('peer_reviews', function (Blueprint $table) {
            if (!$this->indexExists('peer_reviews', 'idx_peer_reviews_group_id')) {
                $table->index('group_id', 'idx_peer_reviews_group_id');
            }
            if (!$this->indexExists('peer_reviews', 'idx_peer_reviews_reviewer_id')) {
                $table->index('reviewer_id', 'idx_peer_reviews_reviewer_id');
            }
            if (!$this->indexExists('peer_reviews', 'idx_peer_reviews_reviewee_id')) {
                $table->index('reviewee_id', 'idx_peer_reviews_reviewee_id');
            }
        });

        // ta_submissions table
        Schema::table('ta_submissions', function (Blueprint $table) {
            if (!$this->indexExists('ta_submissions', 'idx_ta_submissions_student_id')) {
                $table->index('student_id', 'idx_ta_submissions_student_id');
            }
            if (!$this->indexExists('ta_submissions', 'idx_ta_submissions_group_id')) {
                $table->index('group_id', 'idx_ta_submissions_group_id');
            }
            if (!$this->indexExists('ta_submissions', 'idx_ta_submissions_status')) {
                $table->index('status', 'idx_ta_submissions_status');
            }
        });

        // ta_defense_schedules table
        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            if (!$this->indexExists('ta_defense_schedules', 'idx_ta_defense_schedules_student_id')) {
                $table->index('student_id', 'idx_ta_defense_schedules_student_id');
            }
            if (!$this->indexExists('ta_defense_schedules', 'idx_ta_defense_schedules_group_id')) {
                $table->index('group_id', 'idx_ta_defense_schedules_group_id');
            }
            if (!$this->indexExists('ta_defense_schedules', 'idx_ta_defense_schedules_status')) {
                $table->index('status', 'idx_ta_defense_schedules_status');
            }
        });

        // schedules table
        Schema::table('schedules', function (Blueprint $table) {
            if (!$this->indexExists('schedules', 'idx_schedules_group_id')) {
                $table->index('group_id', 'idx_schedules_group_id');
            }
            if (!$this->indexExists('schedules', 'idx_schedules_type')) {
                $table->index('type', 'idx_schedules_type');
            }
            // Note: evaluator_id column may be added in later migration
            if (Schema::hasColumn('schedules', 'evaluator_id')) {
                if (!$this->indexExists('schedules', 'idx_schedules_evaluator_id')) {
                    $table->index('evaluator_id', 'idx_schedules_evaluator_id');
                }
            }
        });

        // seminar_schedules table
        Schema::table('seminar_schedules', function (Blueprint $table) {
            if (!$this->indexExists('seminar_schedules', 'idx_seminar_schedules_group_id')) {
                $table->index('group_id', 'idx_seminar_schedules_group_id');
            }
            if (!$this->indexExists('seminar_schedules', 'idx_seminar_schedules_type')) {
                $table->index('type', 'idx_seminar_schedules_type');
            }
        });

        // expo_events table
        Schema::table('expo_events', function (Blueprint $table) {
            if (!$this->indexExists('expo_events', 'idx_expo_events_period_id')) {
                $table->index('period_id', 'idx_expo_events_period_id');
            }
            if (!$this->indexExists('expo_events', 'idx_expo_events_is_published')) {
                $table->index('is_published', 'idx_expo_events_is_published');
            }
        });

        // expo_registrations table
        Schema::table('expo_registrations', function (Blueprint $table) {
            if (!$this->indexExists('expo_registrations', 'idx_expo_registrations_expo_event_id')) {
                $table->index('expo_event_id', 'idx_expo_registrations_expo_event_id');
            }
            if (!$this->indexExists('expo_registrations', 'idx_expo_registrations_group_id')) {
                $table->index('group_id', 'idx_expo_registrations_group_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop all indexes created in this migration
        Schema::table('groups', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_groups_period_id');
            $table->dropIndexIfExists('idx_groups_title_id');
        });

        Schema::table('group_members', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_group_members_student_id');
            $table->dropIndexIfExists('idx_group_members_group_id');
        });

        Schema::table('titles', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_titles_lecturer_id');
            $table->dropIndexIfExists('idx_titles_period_id');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_documents_group_id');
            $table->dropIndexIfExists('idx_documents_student_id');
            $table->dropIndexIfExists('idx_documents_phase');
        });

        Schema::table('evaluations', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_evaluations_evaluator_id');
            $table->dropIndexIfExists('idx_evaluations_group_id');
            $table->dropIndexIfExists('idx_evaluations_type');
        });

        Schema::table('bids', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_bids_group_id');
            $table->dropIndexIfExists('idx_bids_title_id');
        });

        Schema::table('supervisions', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_supervisions_group_id');
            $table->dropIndexIfExists('idx_supervisions_supervisor_id');
        });

        Schema::table('assessment_components', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_assessment_components_period_id');
            $table->dropIndexIfExists('idx_assessment_components_type');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_notifications_user_id');
            $table->dropIndexIfExists('idx_notifications_is_read');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_audit_logs_user_id');
            $table->dropIndexIfExists('idx_audit_logs_action');
            $table->dropIndexIfExists('idx_audit_logs_target_type_target_id');
        });

        Schema::table('peer_reviews', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_peer_reviews_group_id');
            $table->dropIndexIfExists('idx_peer_reviews_reviewer_id');
            $table->dropIndexIfExists('idx_peer_reviews_reviewee_id');
        });

        Schema::table('ta_submissions', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_ta_submissions_student_id');
            $table->dropIndexIfExists('idx_ta_submissions_group_id');
            $table->dropIndexIfExists('idx_ta_submissions_status');
        });

        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_ta_defense_schedules_student_id');
            $table->dropIndexIfExists('idx_ta_defense_schedules_group_id');
            $table->dropIndexIfExists('idx_ta_defense_schedules_status');
        });

        Schema::table('schedules', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_schedules_group_id');
            $table->dropIndexIfExists('idx_schedules_type');
            $table->dropIndexIfExists('idx_schedules_evaluator_id');
        });

        Schema::table('seminar_schedules', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_seminar_schedules_group_id');
            $table->dropIndexIfExists('idx_seminar_schedules_type');
        });

        Schema::table('expo_events', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_expo_events_period_id');
            $table->dropIndexIfExists('idx_expo_events_is_published');
        });

        Schema::table('expo_registrations', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_expo_registrations_expo_event_id');
            $table->dropIndexIfExists('idx_expo_registrations_group_id');
        });
    }

    /**
     * Check if an index exists on a table
     */
    private function indexExists(string $table, string $index): bool
    {
        $indexes = \DB::select("SELECT indexname FROM pg_indexes WHERE tablename = ?", [$table]);
        $indexNames = array_map(fn($i) => $i->indexname, $indexes);
        return in_array($index, $indexNames);
    }
};
