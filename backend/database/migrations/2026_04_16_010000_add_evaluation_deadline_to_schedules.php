<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dateTime('evaluation_deadline')->nullable()->after('room')
                ->comment('Deadline untuk pengisian nilai oleh examiner/dosbing');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn('evaluation_deadline');
        });
    }
};
