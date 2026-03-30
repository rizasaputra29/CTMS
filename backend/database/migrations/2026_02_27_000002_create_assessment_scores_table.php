<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('assessment_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('component_id')->constrained('assessment_components')->cascadeOnDelete();
            $table->foreignId('evaluator_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
            $table->foreignId('student_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('score', 5, 2);    // nilai 0-100
            $table->text('notes')->nullable();
            $table->string('evaluation_type'); // SEMPRO, SIDANG_TA, EXPO, BIMBINGAN
            $table->timestamps();

            $table->unique(['component_id', 'evaluator_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assessment_scores');
    }
};
