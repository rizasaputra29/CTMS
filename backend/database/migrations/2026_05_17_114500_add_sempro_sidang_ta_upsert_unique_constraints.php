<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sempro_scores', function (Blueprint $table) {
            $table->unique(
                ['period_component_id', 'examiner_id', 'student_id', 'group_id'],
                'uq_sempro_scores_period_component_examiner_student_group'
            );
        });

        Schema::table('sidang_ta_scores', function (Blueprint $table) {
            $table->unique(
                ['period_component_id', 'examiner_id', 'student_id', 'group_id'],
                'uq_sidang_ta_scores_period_component_examiner_student_group'
            );
        });
    }

    public function down(): void
    {
        Schema::table('sempro_scores', function (Blueprint $table) {
            $table->dropUnique('uq_sempro_scores_period_component_examiner_student_group');
        });

        Schema::table('sidang_ta_scores', function (Blueprint $table) {
            $table->dropUnique('uq_sidang_ta_scores_period_component_examiner_student_group');
        });
    }
};
