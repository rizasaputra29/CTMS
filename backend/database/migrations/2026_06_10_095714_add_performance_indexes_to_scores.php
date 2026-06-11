<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $scoreTables = [
            'sempro_scores',
            'bimbingan_sempro_scores',
            'expo_scores',
            'bimbingan_ta_scores',
            'sidang_ta_scores',
            'milestone_scores',
            'nilai_dosen_scores',
        ];

        foreach ($scoreTables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    $table->index(['group_id', 'student_id'], "idx_{$tableName}_group_student");
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $scoreTables = [
            'sempro_scores',
            'bimbingan_sempro_scores',
            'expo_scores',
            'bimbingan_ta_scores',
            'sidang_ta_scores',
            'milestone_scores',
            'nilai_dosen_scores',
        ];

        foreach ($scoreTables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    $table->dropIndexIfExists("idx_{$tableName}_group_student");
                });
            }
        }
    }
};
