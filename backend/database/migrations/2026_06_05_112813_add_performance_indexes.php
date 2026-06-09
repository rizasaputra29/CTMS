<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Helper function to safely add indexes
        $safeIndex = function (string $tableName, string $column, string $indexName): void {
            try {
                Schema::table($tableName, function (Blueprint $table) use ($column, $indexName) {
                    $table->index($column, $indexName);
                });
            } catch (\Exception $e) {
                // Index already exists, skip
            }
        };

        // Helper function to safely add composite indexes
        $safeCompositeIndex = function (string $tableName, array $columns, string $indexName): void {
            try {
                Schema::table($tableName, function (Blueprint $table) use ($columns, $indexName) {
                    $table->index($columns, $indexName);
                });
            } catch (\Exception $e) {
                // Index already exists, skip
            }
        };

        // Groups - most queried table
        $safeIndex('groups', 'status', 'idx_groups_status');
        $safeIndex('groups', 'period_id', 'idx_groups_period');
        $safeCompositeIndex('groups', ['status', 'period_id'], 'idx_groups_status_period');
        $safeIndex('groups', 'title_id', 'idx_groups_title');
        $safeIndex('groups', 'supervisor_1_id', 'idx_groups_supervisor1');
        $safeIndex('groups', 'supervisor_2_id', 'idx_groups_supervisor2');
        $safeIndex('groups', 'created_at', 'idx_groups_created');

        // Group members
        $safeCompositeIndex('group_members', ['student_id', 'group_id'], 'idx_group_members_student_group');
        $safeIndex('group_members', 'is_leader', 'idx_group_members_leader');

        // Titles
        $safeIndex('titles', 'lecturer_id', 'idx_titles_lecturer');
        $safeIndex('titles', 'status', 'idx_titles_status');
        $safeIndex('titles', 'period_id', 'idx_titles_period');
        $safeCompositeIndex('titles', ['status', 'period_id'], 'idx_titles_status_period');

        // Users
        $safeIndex('users', 'role', 'idx_users_role');
        $safeIndex('users', 'email', 'idx_users_email');

        // Bids
        $safeCompositeIndex('bids', ['group_id', 'status'], 'idx_bids_group_status');
        $safeIndex('bids', 'title_id', 'idx_bids_title');

        // Periods
        $safeIndex('periods', 'is_active', 'idx_periods_active');
        $safeIndex('periods', 'is_finalized', 'idx_periods_finalized');

        // Period registrations
        $safeCompositeIndex('period_registrations', ['user_id', 'period_id'], 'idx_period_reg_user_period');

        // Group supervisor proposals
        $safeIndex('group_supervisor_proposals', 'group_id', 'idx_gsp_group');
        $safeCompositeIndex('group_supervisor_proposals', ['group_id', 'status'], 'idx_gsp_group_status');

        // Seminar schedules
        $safeIndex('seminar_schedules', 'group_id', 'idx_seminar_group');
        $safeCompositeIndex('seminar_schedules', ['examiner_1_id', 'examiner_2_id'], 'idx_seminar_examiners');
        $safeIndex('seminar_schedules', 'date', 'idx_seminar_date');

        // TA defense schedules
        $safeIndex('ta_defense_schedules', 'group_id', 'idx_defense_group');
        $safeCompositeIndex('ta_defense_schedules', ['examiner_1_id', 'examiner_2_id'], 'idx_defense_examiners');
        $safeIndex('ta_defense_schedules', 'date', 'idx_defense_date');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Groups
        Schema::table('groups', function (Blueprint $table) {
            $table->dropIndex(['idx_groups_status']);
            $table->dropIndex(['idx_groups_period']);
            $table->dropIndex(['idx_groups_status_period']);
            $table->dropIndex(['idx_groups_title']);
            $table->dropIndex(['idx_groups_supervisor1']);
            $table->dropIndex(['idx_groups_supervisor2']);
            $table->dropIndex(['idx_groups_created']);
        });

        // Group members
        Schema::table('group_members', function (Blueprint $table) {
            $table->dropIndex(['idx_group_members_student_group']);
            $table->dropIndex(['idx_group_members_leader']);
        });

        // Titles
        Schema::table('titles', function (Blueprint $table) {
            $table->dropIndex(['idx_titles_lecturer']);
            $table->dropIndex(['idx_titles_status']);
            $table->dropIndex(['idx_titles_period']);
            $table->dropIndex(['idx_titles_status_period']);
        });

        // Users
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['idx_users_role']);
            $table->dropIndex(['idx_users_email']);
        });

        // Bids
        Schema::table('bids', function (Blueprint $table) {
            $table->dropIndex(['idx_bids_group_status']);
            $table->dropIndex(['idx_bids_title']);
        });

        // Periods
        Schema::table('periods', function (Blueprint $table) {
            $table->dropIndex(['idx_periods_active']);
            $table->dropIndex(['idx_periods_finalized']);
        });

        // Period registrations
        Schema::table('period_registrations', function (Blueprint $table) {
            $table->dropIndex(['idx_period_reg_user_period']);
        });

        // Group supervisor proposals
        Schema::table('group_supervisor_proposals', function (Blueprint $table) {
            $table->dropIndex(['idx_gsp_group']);
            $table->dropIndex(['idx_gsp_group_status']);
        });

        // Seminar schedules
        Schema::table('seminar_schedules', function (Blueprint $table) {
            $table->dropIndex(['idx_seminar_group']);
            $table->dropIndex(['idx_seminar_examiners']);
            $table->dropIndex(['idx_seminar_date']);
        });

        // TA defense schedules
        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            $table->dropIndex(['idx_defense_group']);
            $table->dropIndex(['idx_defense_examiners']);
            $table->dropIndex(['idx_defense_date']);
        });
    }
};
