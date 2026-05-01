<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seminar_schedules', function (Blueprint $table) {
            $table->foreignId('examiner_1_id')->nullable()->change();
            $table->foreignId('examiner_2_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('seminar_schedules', function (Blueprint $table) {
            $table->foreignId('examiner_1_id')->nullable(false)->change();
            $table->foreignId('examiner_2_id')->nullable(false)->change();
        });
    }
};
