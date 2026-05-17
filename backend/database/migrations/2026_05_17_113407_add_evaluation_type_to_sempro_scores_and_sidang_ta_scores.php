<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sempro_scores', function (Blueprint $table) {
            $table->string('evaluation_type', 50)->default('SEMPRO')->after('notes');
        });

        Schema::table('sidang_ta_scores', function (Blueprint $table) {
            $table->string('evaluation_type', 50)->default('SIDANG_TA')->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('sempro_scores', function (Blueprint $table) {
            $table->dropColumn('evaluation_type');
        });

        Schema::table('sidang_ta_scores', function (Blueprint $table) {
            $table->dropColumn('evaluation_type');
        });
    }
};
