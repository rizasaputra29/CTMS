<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Migrate existing student_id data to pivot table
        $schedules = DB::table('ta_defense_schedules')
            ->whereNotNull('student_id')
            ->select('id', 'student_id', 'created_at', 'updated_at')
            ->get();

        foreach ($schedules as $schedule) {
            // Check if pivot record already exists
            $exists = DB::table('ta_defense_schedule_student')
                ->where('schedule_id', $schedule->id)
                ->where('student_id', $schedule->student_id)
                ->exists();

            if (! $exists) {
                DB::table('ta_defense_schedule_student')->insert([
                    'schedule_id' => $schedule->id,
                    'student_id' => $schedule->student_id,
                    'created_at' => $schedule->created_at ?? now(),
                    'updated_at' => $schedule->updated_at ?? now(),
                ]);
            }
        }

        // Note: We keep student_id column for backward compatibility
        // It will be deprecated in future migration
    }

    public function down(): void
    {
        // Clear pivot table (data will be lost if rolled back)
        DB::table('ta_defense_schedule_student')->truncate();
    }
};
