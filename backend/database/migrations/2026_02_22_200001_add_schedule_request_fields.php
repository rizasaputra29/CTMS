<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seminar_schedules', function (Blueprint $table) {
            $table->foreignId('requested_by')->nullable()->after('status')->constrained('users')->onDelete('set null');
            $table->text('rejection_reason')->nullable()->after('requested_by');
        });

        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            $table->foreignId('requested_by')->nullable()->after('status')->constrained('users')->onDelete('set null');
            $table->text('rejection_reason')->nullable()->after('requested_by');
        });
    }

    public function down(): void
    {
        Schema::table('seminar_schedules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('requested_by');
            $table->dropColumn('rejection_reason');
        });

        Schema::table('ta_defense_schedules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('requested_by');
            $table->dropColumn('rejection_reason');
        });
    }
};
