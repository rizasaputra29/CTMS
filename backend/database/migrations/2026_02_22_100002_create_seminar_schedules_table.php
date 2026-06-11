<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seminar_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained('groups')->onDelete('cascade');
            $table->string('type'); // SEMPRO, EXPO
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('room')->nullable();
            $table->foreignId('examiner_1_id')->constrained('users')->onDelete('restrict');
            $table->foreignId('examiner_2_id')->constrained('users')->onDelete('restrict');
            $table->string('status')->default('SCHEDULED'); // SCHEDULED, COMPLETED, CANCELLED
            $table->timestamps();

            $table->unique(['group_id', 'type']); // one SEMPRO and one EXPO per group
            $table->index(['date', 'start_time', 'end_time']); // for overlap queries
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seminar_schedules');
    }
};
