<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Fix unique constraint on ta_defense_evaluations to include student_id
     * This allows multiple evaluations per examiner for different students in the same schedule.
     */
    public function up(): void
    {
        Schema::table('ta_defense_evaluations', function (Blueprint $table) {
            // Drop the old unique constraint that doesn't include student_id
            $table->dropUnique('ta_defense_evaluations_schedule_id_examiner_id_unique');
            // Add new unique constraint that includes student_id
            $table->unique(['schedule_id', 'examiner_id', 'student_id'], 'ta_defense_evals_schedule_examiner_student_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ta_defense_evaluations', function (Blueprint $table) {
            // Drop the new unique constraint
            $table->dropUnique('ta_defense_evals_schedule_examiner_student_unique');
            // Restore the old unique constraint
            $table->unique(['schedule_id', 'examiner_id'], 'ta_defense_evaluations_schedule_id_examiner_id_unique');
        });
    }
};
