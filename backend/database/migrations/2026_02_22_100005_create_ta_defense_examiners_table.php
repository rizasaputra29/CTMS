<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ta_defense_examiners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_id')->constrained('ta_defense_schedules')->onDelete('cascade');
            $table->foreignId('examiner_id')->constrained('users')->onDelete('restrict');
            $table->string('role'); // SUPERVISOR_1, SUPERVISOR_2, EXAMINER_1, EXAMINER_2
            $table->timestamps();

            $table->unique(['schedule_id', 'role']);        // one person per role per schedule
            $table->unique(['schedule_id', 'examiner_id']); // no duplicate examiner per schedule
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ta_defense_examiners');
    }
};
