<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Step 1: Add nullable column first (safe)
        Schema::table('ta_defense_evaluations', function (Blueprint $table) {
            $table->foreignId('student_id')->nullable()->after('schedule_id')->constrained('users');
        });

        // Step 2: Populate student_id from schedule's student_id (PostgreSQL syntax)
        DB::statement('
            UPDATE ta_defense_evaluations tde
            SET student_id = tds.student_id
            FROM ta_defense_schedules tds
            WHERE tde.schedule_id = tds.id
            AND tde.student_id IS NULL
        ');
    }

    public function down(): void
    {
        Schema::table('ta_defense_evaluations', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
            $table->dropColumn('student_id');
        });
    }
};
