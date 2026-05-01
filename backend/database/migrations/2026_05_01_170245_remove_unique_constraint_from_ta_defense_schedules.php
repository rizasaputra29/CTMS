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
            // Remove unique constraint to allow rescheduling cancelled students
            $table->dropUnique(['student_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            // Restore unique constraint
            $table->unique('student_id');
        });
    }
};
