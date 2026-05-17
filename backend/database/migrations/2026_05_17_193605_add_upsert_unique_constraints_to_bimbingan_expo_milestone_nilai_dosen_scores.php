<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bimbingan_sempro_scores', function (Blueprint $table) {
            $table->unique(
                ['period_component_id', 'evaluator_id', 'student_id', 'group_id'],
                'uq_bimbingan_sempro_scores_period_evaluator_student_group'
            );
        });

        Schema::table('bimbingan_ta_scores', function (Blueprint $table) {
            $table->unique(
                ['period_component_id', 'evaluator_id', 'student_id', 'group_id'],
                'uq_bimbingan_ta_scores_period_evaluator_student_group'
            );
        });

        Schema::table('expo_scores', function (Blueprint $table) {
            $table->unique(
                ['period_component_id', 'evaluator_id', 'student_id', 'group_id'],
                'uq_expo_scores_period_evaluator_student_group'
            );
        });

        Schema::table('milestone_scores', function (Blueprint $table) {
            $table->unique(
                ['period_component_id', 'evaluator_id', 'student_id', 'group_id'],
                'uq_milestone_scores_period_evaluator_student_group'
            );
        });

        Schema::table('nilai_dosen_scores', function (Blueprint $table) {
            $table->unique(
                ['period_component_id', 'evaluator_id', 'student_id', 'group_id'],
                'uq_nilai_dosen_scores_period_evaluator_student_group'
            );
        });
    }

    public function down(): void
    {
        Schema::table('bimbingan_sempro_scores', fn ($t) => $t->dropUnique('uq_bimbingan_sempro_scores_period_evaluator_student_group'));
        Schema::table('bimbingan_ta_scores', fn ($t) => $t->dropUnique('uq_bimbingan_ta_scores_period_evaluator_student_group'));
        Schema::table('expo_scores', fn ($t) => $t->dropUnique('uq_expo_scores_period_evaluator_student_group'));
        Schema::table('milestone_scores', fn ($t) => $t->dropUnique('uq_milestone_scores_period_evaluator_student_group'));
        Schema::table('nilai_dosen_scores', fn ($t) => $t->dropUnique('uq_nilai_dosen_scores_period_evaluator_student_group'));
    }
};
