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
        // Helper function to check if index exists
        $indexExists = function (string $table, string $indexName): bool {
            $driver = \Illuminate\Support\Facades\DB::getDriverName();

            if ($driver === 'sqlite') {
                $existingIndexes = \Illuminate\Support\Facades\DB::select("PRAGMA index_list('$table')");
                $existingIndexNames = array_map(fn ($idx) => $idx->name, $existingIndexes);

                return in_array($indexName, $existingIndexNames, true);
            }

            if ($driver === 'mysql') {
                $existingIndexes = \Illuminate\Support\Facades\DB::select(
                    'SELECT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ?',
                    [$table]
                );
                $existingIndexNames = array_map(fn ($idx) => $idx->index_name, $existingIndexes);

                return in_array($indexName, $existingIndexNames, true);
            }

            $existingIndexes = \Illuminate\Support\Facades\DB::select(
                'SELECT indexname FROM pg_indexes WHERE tablename = ?',
                [$table]
            );
            $existingIndexNames = array_map(fn ($idx) => $idx->indexname, $existingIndexes);

            return in_array($indexName, $existingIndexNames, true);
        };

        // Indexes for seminar_schedules
        Schema::table('seminar_schedules', function (Blueprint $table) use ($indexExists) {
            if (! Schema::hasColumn('seminar_schedules', 'date')) {
                return;
            }

            if (! $indexExists('seminar_schedules', 'idx_seminar_schedules_date')) {
                $table->index('date', 'idx_seminar_schedules_date');
            }
            if (! $indexExists('seminar_schedules', 'idx_seminar_schedules_start_time')) {
                $table->index('start_time', 'idx_seminar_schedules_start_time');
            }
            if (! $indexExists('seminar_schedules', 'idx_seminar_schedules_end_time')) {
                $table->index('end_time', 'idx_seminar_schedules_end_time');
            }
            if (! $indexExists('seminar_schedules', 'idx_seminar_schedules_status_date')) {
                $table->index(['status', 'date'], 'idx_seminar_schedules_status_date');
            }
            if (! $indexExists('seminar_schedules', 'idx_seminar_schedules_examiner1_date')) {
                $table->index(['examiner_1_id', 'date'], 'idx_seminar_schedules_examiner1_date');
            }
            if (! $indexExists('seminar_schedules', 'idx_seminar_schedules_examiner2_date')) {
                $table->index(['examiner_2_id', 'date'], 'idx_seminar_schedules_examiner2_date');
            }
        });

        // Indexes for ta_defense_schedules
        Schema::table('ta_defense_schedules', function (Blueprint $table) use ($indexExists) {
            if (! Schema::hasColumn('ta_defense_schedules', 'date')) {
                return;
            }

            if (! $indexExists('ta_defense_schedules', 'idx_ta_defense_schedules_date')) {
                $table->index('date', 'idx_ta_defense_schedules_date');
            }
            if (! $indexExists('ta_defense_schedules', 'idx_ta_defense_schedules_start_time')) {
                $table->index('start_time', 'idx_ta_defense_schedules_start_time');
            }
            if (! $indexExists('ta_defense_schedules', 'idx_ta_defense_schedules_end_time')) {
                $table->index('end_time', 'idx_ta_defense_schedules_end_time');
            }
            if (! $indexExists('ta_defense_schedules', 'idx_ta_defense_schedules_status_date')) {
                $table->index(['status', 'date'], 'idx_ta_defense_schedules_status_date');
            }
            if (! $indexExists('ta_defense_schedules', 'idx_ta_defense_schedules_examiner1_date')) {
                $table->index(['examiner_1_id', 'date'], 'idx_ta_defense_schedules_examiner1_date');
            }
            if (! $indexExists('ta_defense_schedules', 'idx_ta_defense_schedules_examiner2_date')) {
                $table->index(['examiner_2_id', 'date'], 'idx_ta_defense_schedules_examiner2_date');
            }
        });

        // Indexes for schedules (BIMBINGAN)
        Schema::table('schedules', function (Blueprint $table) use ($indexExists) {
            if (! Schema::hasColumn('schedules', 'date')) {
                return;
            }

            if (! $indexExists('schedules', 'idx_schedules_date_type')) {
                $table->index(['date', 'type'], 'idx_schedules_date_type');
            }

            if (! $indexExists('schedules', 'idx_schedules_group_type')) {
                $table->index(['group_id', 'type'], 'idx_schedules_group_type');
            }
        });

        // Indexes for groups
        Schema::table('groups', function (Blueprint $table) use ($indexExists) {
            if (! Schema::hasColumn('groups', 'period_id')) {
                return;
            }

            if (! $indexExists('groups', 'idx_groups_period_status')) {
                $table->index(['period_id', 'status'], 'idx_groups_period_status');
            }
        });

        // Indexes for periods
        Schema::table('periods', function (Blueprint $table) use ($indexExists) {
            if (! $indexExists('periods', 'idx_periods_active_finalized')) {
                $table->index(['is_active', 'is_finalized'], 'idx_periods_active_finalized');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove indexes from seminar_schedules
        Schema::table('seminar_schedules', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_seminar_schedules_date');
            $table->dropIndexIfExists('idx_seminar_schedules_start_time');
            $table->dropIndexIfExists('idx_seminar_schedules_end_time');
            $table->dropIndexIfExists('idx_seminar_schedules_status_date');
            $table->dropIndexIfExists('idx_seminar_schedules_examiner1_date');
            $table->dropIndexIfExists('idx_seminar_schedules_examiner2_date');
        });

        // Remove indexes from ta_defense_schedules
        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_ta_defense_schedules_date');
            $table->dropIndexIfExists('idx_ta_defense_schedules_start_time');
            $table->dropIndexIfExists('idx_ta_defense_schedules_end_time');
            $table->dropIndexIfExists('idx_ta_defense_schedules_status_date');
            $table->dropIndexIfExists('idx_ta_defense_schedules_examiner1_date');
            $table->dropIndexIfExists('idx_ta_defense_schedules_examiner2_date');
        });

        // Remove indexes from schedules
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_schedules_date_type');
            $table->dropIndexIfExists('idx_schedules_group_type');
        });

        // Remove indexes from groups
        Schema::table('groups', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_groups_period_status');
        });

        // Remove indexes from periods
        Schema::table('periods', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_periods_active_finalized');
        });
    }
};
