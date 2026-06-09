<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Create missing TaDefenseExaminer records for existing schedules
        $schedules = DB::table('ta_defense_schedules')
            ->whereIn('status', ['SCHEDULED', 'DONE'])
            ->get();

        foreach ($schedules as $schedule) {
            // Check if examiner 1 record exists
            $examiner1Exists = DB::table('ta_defense_examiners')
                ->where('schedule_id', $schedule->id)
                ->where('examiner_id', $schedule->examiner_1_id)
                ->exists();

            if (! $examiner1Exists && $schedule->examiner_1_id) {
                DB::table('ta_defense_examiners')->insert([
                    'schedule_id' => $schedule->id,
                    'examiner_id' => $schedule->examiner_1_id,
                    'role' => 'EXAMINER_1',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Check if examiner 2 record exists
            $examiner2Exists = DB::table('ta_defense_examiners')
                ->where('schedule_id', $schedule->id)
                ->where('examiner_id', $schedule->examiner_2_id)
                ->exists();

            if (! $examiner2Exists && $schedule->examiner_2_id) {
                DB::table('ta_defense_examiners')->insert([
                    'schedule_id' => $schedule->id,
                    'examiner_id' => $schedule->examiner_2_id,
                    'role' => 'EXAMINER_2',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No need to reverse - this is a data fix migration
    }
};
