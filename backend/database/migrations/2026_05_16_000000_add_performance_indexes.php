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
        // Groups table indexes
        Schema::table('groups', function (Blueprint $table) {
            if (!Schema::hasIndex('groups', 'idx_groups_status')) {
                $table->index('status', 'idx_groups_status');
            }
            if (!Schema::hasIndex('groups', 'idx_groups_period_id')) {
                $table->index('period_id', 'idx_groups_period_id');
            }
            if (!Schema::hasIndex('groups', 'idx_groups_is_finalized')) {
                $table->index('is_finalized', 'idx_groups_is_finalized');
            }
            if (!Schema::hasIndex('groups', 'idx_groups_supervisor1_id')) {
                $table->index('supervisor1_id', 'idx_groups_supervisor1_id');
            }
            if (!Schema::hasIndex('groups', 'idx_groups_supervisor2_id')) {
                $table->index('supervisor2_id', 'idx_groups_supervisor2_id');
            }
        });

        // Group members indexes
        Schema::table('group_members', function (Blueprint $table) {
            if (!Schema::hasIndex('group_members', 'idx_group_members_group_id')) {
                $table->index('group_id', 'idx_group_members_group_id');
            }
            if (!Schema::hasIndex('group_members', 'idx_group_members_user_id')) {
                $table->index('user_id', 'idx_group_members_user_id');
            }
        });

        // Schedules indexes
        Schema::table('schedules', function (Blueprint $table) {
            if (!Schema::hasIndex('schedules', 'idx_schedules_group_id')) {
                $table->index('group_id', 'idx_schedules_group_id');
            }
            if (!Schema::hasIndex('schedules', 'idx_schedules_date')) {
                $table->index('date', 'idx_schedules_date');
            }
        });

        // Seminar schedules indexes
        Schema::table('seminar_schedules', function (Blueprint $table) {
            if (!Schema::hasIndex('seminar_schedules', 'idx_seminar_schedules_group_id')) {
                $table->index('group_id', 'idx_seminar_schedules_group_id');
            }
            if (!Schema::hasIndex('seminar_schedules', 'idx_seminar_schedules_date')) {
                $table->index('date', 'idx_seminar_schedules_date');
            }
            if (!Schema::hasIndex('seminar_schedules', 'idx_seminar_schedules_status')) {
                $table->index('status', 'idx_seminar_schedules_status');
            }
        });

        // TA Defense schedules indexes
        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            if (!Schema::hasIndex('ta_defense_schedules', 'idx_ta_defense_group_id')) {
                $table->index('group_id', 'idx_ta_defense_group_id');
            }
            if (!Schema::hasIndex('ta_defense_schedules', 'idx_ta_defense_date')) {
                $table->index('date', 'idx_ta_defense_date');
            }
        });

        // Evaluations indexes
        Schema::table('evaluations', function (Blueprint $table) {
            if (!Schema::hasIndex('evaluations', 'idx_evaluations_schedule_id')) {
                $table->index('schedule_id', 'idx_evaluations_schedule_id');
            }
            if (!Schema::hasIndex('evaluations', 'idx_evaluations_examiner_id')) {
                $table->index('examiner_id', 'idx_evaluations_examiner_id');
            }
        });

        // Documents indexes
        Schema::table('documents', function (Blueprint $table) {
            if (!Schema::hasIndex('documents', 'idx_documents_group_id')) {
                $table->index('group_id', 'idx_documents_group_id');
            }
            if (!Schema::hasIndex('documents', 'idx_documents_document_type_id')) {
                $table->index('document_type_id', 'idx_documents_document_type_id');
            }
        });

        // Notifications indexes
        Schema::table('notifications', function (Blueprint $table) {
            if (!Schema::hasIndex('notifications', 'idx_notifications_user_id')) {
                $table->index('user_id', 'idx_notifications_user_id');
            }
            if (!Schema::hasIndex('notifications', 'idx_notifications_read_at')) {
                $table->index('read_at', 'idx_notifications_read_at');
            }
        });

        // Periods indexes
        Schema::table('periods', function (Blueprint $table) {
            if (!Schema::hasIndex('periods', 'idx_periods_is_active')) {
                $table->index('is_active', 'idx_periods_is_active');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->dropIndex(['idx_groups_status']);
            $table->dropIndex(['idx_groups_period_id']);
            $table->dropIndex(['idx_groups_is_finalized']);
            $table->dropIndex(['idx_groups_supervisor1_id']);
            $table->dropIndex(['idx_groups_supervisor2_id']);
        });

        Schema::table('group_members', function (Blueprint $table) {
            $table->dropIndex(['idx_group_members_group_id']);
            $table->dropIndex(['idx_group_members_user_id']);
        });

        Schema::table('schedules', function (Blueprint $table) {
            $table->dropIndex(['idx_schedules_group_id']);
            $table->dropIndex(['idx_schedules_date']);
        });

        Schema::table('seminar_schedules', function (Blueprint $table) {
            $table->dropIndex(['idx_seminar_schedules_group_id']);
            $table->dropIndex(['idx_seminar_schedules_date']);
            $table->dropIndex(['idx_seminar_schedules_status']);
        });

        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            $table->dropIndex(['idx_ta_defense_group_id']);
            $table->dropIndex(['idx_ta_defense_date']);
        });

        Schema::table('evaluations', function (Blueprint $table) {
            $table->dropIndex(['idx_evaluations_schedule_id']);
            $table->dropIndex(['idx_evaluations_examiner_id']);
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['idx_documents_group_id']);
            $table->dropIndex(['idx_documents_document_type_id']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['idx_notifications_user_id']);
            $table->dropIndex(['idx_notifications_read_at']);
        });

        Schema::table('periods', function (Blueprint $table) {
            $table->dropIndex(['idx_periods_is_active']);
        });
    }
};
