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
        // Add final_score column to seminar_schedules table
        Schema::table('seminar_schedules', function (Blueprint $table) {
            if (!Schema::hasColumn('seminar_schedules', 'final_score')) {
                $table->decimal('final_score', 5, 2)->nullable()->after('status');
            }
        });

        // Add final_score column to ta_defense_schedules table
        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            if (!Schema::hasColumn('ta_defense_schedules', 'final_score')) {
                $table->decimal('final_score', 5, 2)->nullable()->after('status');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('seminar_schedules', function (Blueprint $table) {
            if (Schema::hasColumn('seminar_schedules', 'final_score')) {
                $table->dropColumn('final_score');
            }
        });

        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            if (Schema::hasColumn('ta_defense_schedules', 'final_score')) {
                $table->dropColumn('final_score');
            }
        });
    }
};