<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ta_defense_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('group_id')->constrained('groups')->onDelete('cascade');
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('room')->nullable();
            $table->string('status')->default('SCHEDULED'); // SCHEDULED, COMPLETED, CANCELLED
            $table->timestamps();

            $table->unique('student_id'); // one defense per student
            $table->index(['date', 'start_time', 'end_time']); // for overlap queries
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ta_defense_schedules');
    }
};
