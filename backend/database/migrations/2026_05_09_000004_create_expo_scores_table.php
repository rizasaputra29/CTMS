<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create Expo Scores Table
 *
 * Stores assessment scores for EXPO evaluation type.
 * This replaces the evaluation_type='EXPO' records from assessment_scores table.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('expo_scores', function (Blueprint $table) {
            $table->id();

            // Foreign keys with Laravel 10+ syntax
            $table->foreignId('component_id')
                ->nullable()
                ->constrained('assessment_components')
                ->cascadeOnDelete();

            $table->foreignId('period_component_id')
                ->nullable()
                ->constrained('period_assessment_components')
                ->nullOnDelete();

            $table->foreignId('evaluator_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->foreignId('group_id')
                ->constrained('groups')
                ->cascadeOnDelete();

            $table->foreignId('student_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            // Score data
            $table->decimal('score', 5, 2); // nilai 0-100
            $table->text('notes')->nullable();

            $table->timestamps();

            // Named indexes following best practices
            $table->unique(
                ['component_id', 'evaluator_id', 'student_id'],
                'uq_expo_scores_component_evaluator_student'
            );

            $table->index(['group_id', 'evaluator_id'], 'idx_expo_scores_group_evaluator');
            $table->index(['student_id'], 'idx_expo_scores_student');
            $table->index(['evaluator_id'], 'idx_expo_scores_evaluator');
            $table->index(['created_at'], 'idx_expo_scores_created_at');
            $table->index(['group_id', 'created_at'], 'idx_expo_scores_group_created');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('expo_scores');
    }
};
