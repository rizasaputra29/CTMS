<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Delete existing examiner evaluations for EXPO schedules
        // EXPO now only requires supervisor evaluations
        $expoSchedules = DB::table('seminar_schedules')
            ->where('type', 'EXPO')
            ->pluck('id');

        if ($expoSchedules->isNotEmpty()) {
            DB::table('seminar_evaluations')
                ->whereIn('schedule_id', $expoSchedules)
                ->delete();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Cannot restore deleted evaluations
        // This would require backing up data before migration
    }
};