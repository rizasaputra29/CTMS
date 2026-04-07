<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Performance indexes for Neon PostgreSQL production environment.
 * 
 * These indexes address N+1 query issues and slow queries identified
 * during performance analysis for CTMS on Neon PostgreSQL.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // group_members table indexes
        Schema::table('group_members', function (Blueprint $table) {
            // Composite index for student lookups by period (common query pattern)
            $table->index(['student_id', 'period_id'], 'idx_group_members_student_period');
            
            // Composite index for group membership lookups
            $table->index(['group_id', 'period_id'], 'idx_group_members_group_period');
        });

        // groups table indexes
        Schema::table('groups', function (Blueprint $table) {
            // Composite index for period + status queries (finalization queries)
            $table->index(['period_id', 'status'], 'idx_groups_period_status');
            
            // Composite index for title allocation queries
            $table->index(['title_id', 'status'], 'idx_groups_title_status');
        });

        // bids table indexes
        Schema::table('bids', function (Blueprint $table) {
            // Composite index for bid lookups by group and recommendation
            $table->index(['group_id', 'lecturer_recommendation'], 'idx_bids_group_recommendation');
            
            // Composite index for title-based bid queries
            $table->index(['title_id', 'lecturer_recommendation'], 'idx_bids_title_recommendation');
        });

        // notifications table indexes
        Schema::table('notifications', function (Blueprint $table) {
            // Composite index for unread notifications by user
            $table->index(['user_id', 'is_read'], 'idx_notifications_user_read');
            
            // Index for notification type filtering
            $table->index(['user_id', 'type'], 'idx_notifications_user_type');
        });

        // titles table indexes
        Schema::table('titles', function (Blueprint $table) {
            // Index for lecturer title lookups
            $table->index(['lecturer_id', 'period_id'], 'idx_titles_lecturer_period');
        });

        // supervisions table indexes
        Schema::table('supervisions', function (Blueprint $table) {
            // Composite index for supervisor lookups
            $table->index(['supervisor_id', 'role'], 'idx_supervisions_supervisor_role');
        });

        // period_registrations table indexes
        Schema::table('period_registrations', function (Blueprint $table) {
            // Composite index for period registration lookups
            $table->index(['period_id', 'user_id'], 'idx_registrations_period_user');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // group_members table
        Schema::table('group_members', function (Blueprint $table) {
            $table->dropIndex('idx_group_members_student_period');
            $table->dropIndex('idx_group_members_group_period');
        });

        // groups table
        Schema::table('groups', function (Blueprint $table) {
            $table->dropIndex('idx_groups_period_status');
            $table->dropIndex('idx_groups_title_status');
        });

        // bids table
        Schema::table('bids', function (Blueprint $table) {
            $table->dropIndex('idx_bids_group_recommendation');
            $table->dropIndex('idx_bids_title_recommendation');
        });

        // notifications table
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('idx_notifications_user_read');
            $table->dropIndex('idx_notifications_user_type');
        });

        // titles table
        Schema::table('titles', function (Blueprint $table) {
            $table->dropIndex('idx_titles_lecturer_period');
        });

        // supervisions table
        Schema::table('supervisions', function (Blueprint $table) {
            $table->dropIndex('idx_supervisions_supervisor_role');
        });

        // period_registrations table
        Schema::table('period_registrations', function (Blueprint $table) {
            $table->dropIndex('idx_registrations_period_user');
        });
    }
};
