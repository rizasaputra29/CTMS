<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seminar_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_id')->constrained('seminar_schedules')->onDelete('cascade');
            $table->foreignId('examiner_id')->constrained('users')->onDelete('restrict');
            $table->json('rubric_json')->nullable(); // snapshot of rubric at submission time
            $table->decimal('score', 5, 2)->nullable();
            $table->string('status')->default('PENDING'); // PENDING, SUBMITTED
            $table->timestamps();

            $table->unique(['schedule_id', 'examiner_id']); // one eval per examiner per schedule
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seminar_evaluations');
    }
};
