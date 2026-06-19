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
        $tables = [
            'groups' => ['status', 'period_id'],
            'group_members' => ['group_id', 'student_id'],
            'schedules' => ['group_id', 'date'],
            'seminar_schedules' => ['group_id', 'date', 'status'],
            'ta_defense_schedules' => ['group_id', 'date'],
            'evaluations' => ['schedule_id', 'examiner_id'],
            'documents' => ['group_id', 'document_type_id'],
            'notifications' => ['user_id', 'read_at'],
            'periods' => ['is_active'],
        ];

        foreach ($tables as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $table) use ($columns) {
                foreach ($columns as $column) {
                    if (! Schema::hasColumn($table->getTable(), $column)) {
                        continue;
                    }

                    $indexName = 'idx_'.$table->getTable().'_'.$column;
                    if (! Schema::hasIndex($table->getTable(), $indexName)) {
                        $table->index($column, $indexName);
                    }
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->dropIndex(['idx_groups_status']);
            $table->dropIndex(['idx_groups_period_id']);
        });

        Schema::table('group_members', function (Blueprint $table) {
            $table->dropIndex(['idx_group_members_group_id']);
            $table->dropIndex(['idx_group_members_student_id']);
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
