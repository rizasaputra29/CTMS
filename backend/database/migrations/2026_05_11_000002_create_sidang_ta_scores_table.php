<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sidang_ta_scores', function (Blueprint $table) {
            $table->id();

            $table->foreignId('component_id')
                ->nullable()
                ->constrained('assessment_components')
                ->cascadeOnDelete();

            $table->foreignId('period_component_id')
                ->nullable()
                ->constrained('period_assessment_components')
                ->nullOnDelete();

            $table->foreignId('examiner_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->foreignId('group_id')
                ->constrained('groups')
                ->cascadeOnDelete();

            $table->foreignId('student_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->decimal('score', 5, 2);
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->unique(
                ['component_id', 'examiner_id', 'student_id'],
                'uq_sidang_ta_scores_component_examiner_student'
            );

            $table->index(['group_id', 'examiner_id'], 'idx_sidang_ta_scores_group_examiner');
            $table->index(['student_id'], 'idx_sidang_ta_scores_student');
            $table->index(['examiner_id'], 'idx_sidang_ta_scores_examiner');
            $table->index(['created_at'], 'idx_sidang_ta_scores_created_at');
            $table->index(['group_id', 'created_at'], 'idx_sidang_ta_scores_group_created');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sidang_ta_scores');
    }
};
