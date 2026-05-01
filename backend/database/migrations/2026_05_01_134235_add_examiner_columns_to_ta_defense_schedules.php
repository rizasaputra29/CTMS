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
        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            // Add period_id if missing
            if (!Schema::hasColumn('ta_defense_schedules', 'period_id')) {
                $table->foreignId('period_id')->constrained('periods')->onDelete('cascade')->after('group_id');
            }
            // Add examiner columns if they don't exist
            if (!Schema::hasColumn('ta_defense_schedules', 'examiner_1_id')) {
                $table->foreignId('examiner_1_id')->constrained('users')->onDelete('cascade')->after('period_id');
            }
            if (!Schema::hasColumn('ta_defense_schedules', 'examiner_2_id')) {
                $table->foreignId('examiner_2_id')->constrained('users')->onDelete('cascade')->after('examiner_1_id');
            }
            // Add evaluation_deadline if missing
            if (!Schema::hasColumn('ta_defense_schedules', 'evaluation_deadline')) {
                $table->timestamp('evaluation_deadline')->nullable()->after('status');
            }
            // Add notes if missing
            if (!Schema::hasColumn('ta_defense_schedules', 'notes')) {
                $table->text('notes')->nullable()->after('evaluation_deadline');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            if (Schema::hasColumn('ta_defense_schedules', 'notes')) {
                $table->dropColumn('notes');
            }
            if (Schema::hasColumn('ta_defense_schedules', 'evaluation_deadline')) {
                $table->dropColumn('evaluation_deadline');
            }
            if (Schema::hasColumn('ta_defense_schedules', 'examiner_2_id')) {
                $table->dropForeign(['examiner_2_id']);
                $table->dropColumn('examiner_2_id');
            }
            if (Schema::hasColumn('ta_defense_schedules', 'examiner_1_id')) {
                $table->dropForeign(['examiner_1_id']);
                $table->dropColumn('examiner_1_id');
            }
            if (Schema::hasColumn('ta_defense_schedules', 'period_id')) {
                $table->dropForeign(['period_id']);
                $table->dropColumn('period_id');
            }
        });
    }
};
