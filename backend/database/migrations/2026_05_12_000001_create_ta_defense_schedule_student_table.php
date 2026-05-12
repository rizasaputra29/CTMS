<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ta_defense_schedule_student', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_id')->constrained('ta_defense_schedules')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            
            $table->unique(['schedule_id', 'student_id'], 'uq_ta_defense_schedule_student');
            $table->index('schedule_id', 'idx_ta_defense_schedule_student_schedule');
            $table->index('student_id', 'idx_ta_defense_schedule_student_student');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ta_defense_schedule_student');
    }
};
