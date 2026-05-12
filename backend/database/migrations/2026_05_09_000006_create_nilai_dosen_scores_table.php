<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create Nilai Dosen Scores Table
 * 
 * Stores assessment scores for NILAI_DOSEN evaluation type.
 * This replaces the evaluation_type='NILAI_DOSEN' records from assessment_scores table.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('nilai_dosen_scores', function (Blueprint $table) {
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
                'uq_nilai_dosen_scores_component_evaluator_student'
            );
            
            $table->index(['group_id', 'evaluator_id'], 'idx_nilai_dosen_scores_group_evaluator');
            $table->index(['student_id'], 'idx_nilai_dosen_scores_student');
            $table->index(['evaluator_id'], 'idx_nilai_dosen_scores_evaluator');
            $table->index(['created_at'], 'idx_nilai_dosen_scores_created_at');
            $table->index(['group_id', 'created_at'], 'idx_nilai_dosen_scores_group_created');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('nilai_dosen_scores');
    }
};
