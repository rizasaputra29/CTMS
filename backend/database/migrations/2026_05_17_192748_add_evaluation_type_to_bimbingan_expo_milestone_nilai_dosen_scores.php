<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bimbingan_sempro_scores', function (Blueprint $table) {
            $table->string('evaluation_type', 50)->default('BIMBINGAN_SEMPRO')->after('notes');
        });

        Schema::table('bimbingan_ta_scores', function (Blueprint $table) {
            $table->string('evaluation_type', 50)->default('BIMBINGAN_TA')->after('notes');
        });

        Schema::table('expo_scores', function (Blueprint $table) {
            $table->string('evaluation_type', 50)->default('EXPO')->after('notes');
        });

        Schema::table('milestone_scores', function (Blueprint $table) {
            $table->string('evaluation_type', 50)->default('MILESTONE')->after('notes');
        });

        Schema::table('nilai_dosen_scores', function (Blueprint $table) {
            $table->string('evaluation_type', 50)->default('NILAI_DOSEN')->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('bimbingan_sempro_scores', fn ($t) => $t->dropColumn('evaluation_type'));
        Schema::table('bimbingan_ta_scores', fn ($t) => $t->dropColumn('evaluation_type'));
        Schema::table('expo_scores', fn ($t) => $t->dropColumn('evaluation_type'));
        Schema::table('milestone_scores', fn ($t) => $t->dropColumn('evaluation_type'));
        Schema::table('nilai_dosen_scores', fn ($t) => $t->dropColumn('evaluation_type'));
    }
};
