<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migration.
     * Make student_id required (NOT NULL) after backfill is complete.
     */
    public function up(): void
    {
        Schema::table('ta_defense_evaluations', function (Blueprint $table) {
            // Make student_id required (NOT NULL)
            $table->foreignId('student_id')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migration.
     * Make student_id nullable again.
     */
    public function down(): void
    {
        Schema::table('ta_defense_evaluations', function (Blueprint $table) {
            // Make student_id nullable again
            $table->foreignId('student_id')->nullable()->change();
        });
    }
};
