<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Drop Assessment Scores Table
 * 
 * Removes the old unified assessment_scores table after successful migration
 * to separate evaluation type tables.
 * 
 * WARNING: Ensure all data has been migrated and verified before running this migration!
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Drop the old table - all data should be migrated by now
        Schema::dropIfExists('assessment_scores');
        
        // Note: If you need to restore, check the backup file:
        // storage/app/backups/assessment_scores_backup_*.json
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Recreate the old table structure (for rollback purposes)
        Schema::create('assessment_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('component_id')->constrained('assessment_components')->cascadeOnDelete();
            $table->foreignId('period_component_id')->nullable()->constrained('period_assessment_components')->nullOnDelete();
            $table->foreignId('evaluator_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
            $table->foreignId('student_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('score', 5, 2);
            $table->text('notes')->nullable();
            $table->string('evaluation_type'); // BIMBINGAN_SEMPRO, BIMBINGAN_TA, EXPO, MILESTONE, NILAI_DOSEN
            $table->timestamps();
            
            $table->unique(['component_id', 'evaluator_id', 'student_id'], 'uq_assessment_scores_component_evaluator_student');
            $table->index(['group_id', 'evaluation_type'], 'idx_assessment_scores_group_type');
            $table->index(['evaluation_type'], 'idx_assessment_scores_type');
        });
    }
};
