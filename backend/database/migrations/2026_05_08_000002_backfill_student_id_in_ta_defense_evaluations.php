<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migration.
     * Backfill student_id for existing ta_defense_evaluations records from ta_defense_schedules.
     */
    public function up(): void
    {
        // Update ta_defense_evaluations with student_id from ta_defense_schedules
        DB::statement('
            UPDATE ta_defense_evaluations 
            SET student_id = ta_defense_schedules.student_id
            FROM ta_defense_schedules
            WHERE ta_defense_evaluations.schedule_id = ta_defense_schedules.id
            AND ta_defense_evaluations.student_id IS NULL
        ');

        // Log the backfill operation
        $updatedCount = DB::table('ta_defense_evaluations')
            ->whereNotNull('student_id')
            ->count();

        \Illuminate\Support\Facades\Log::info("Backfilled student_id for {$updatedCount} ta_defense_evaluations records");
    }

    /**
     * Reverse the migration.
     * Note: This will set student_id back to NULL for all records.
     * Use with caution - data will be lost.
     */
    public function down(): void
    {
        // Reset student_id to NULL
        DB::table('ta_defense_evaluations')
            ->update(['student_id' => null]);

        \Illuminate\Support\Facades\Log::info("Rolled back student_id backfill - set to NULL for all records");
    }
};
