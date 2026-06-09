<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('periods', function (Blueprint $table) {
            if (! Schema::hasColumn('periods', 'bidding_reminder_at')) {
                $table->dateTime('bidding_reminder_at')->nullable();
            }

            if (! Schema::hasColumn('periods', 'pdc1_reminder_at')) {
                $table->dateTime('pdc1_reminder_at')->nullable();
            }

            if (! Schema::hasColumn('periods', 'pdc2_reminder_at')) {
                $table->dateTime('pdc2_reminder_at')->nullable();
            }

            if (! Schema::hasColumn('periods', 'expo_reminder_at')) {
                $table->dateTime('expo_reminder_at')->nullable();
            }

            if (! Schema::hasColumn('periods', 'ta_reminder_at')) {
                $table->dateTime('ta_reminder_at')->nullable();
            }

            if (! Schema::hasColumn('periods', 'max_supervisor_load')) {
                $table->integer('max_supervisor_load')->nullable();
            }
        });

        if (Schema::hasColumn('periods', 'max_supervise_load') && Schema::hasColumn('periods', 'max_supervisor_load')) {
            DB::table('periods')
                ->whereNull('max_supervisor_load')
                ->update([
                    'max_supervisor_load' => DB::raw('max_supervise_load'),
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('periods', function (Blueprint $table) {
            if (Schema::hasColumn('periods', 'bidding_reminder_at')) {
                $table->dropColumn('bidding_reminder_at');
            }

            if (Schema::hasColumn('periods', 'pdc1_reminder_at')) {
                $table->dropColumn('pdc1_reminder_at');
            }

            if (Schema::hasColumn('periods', 'pdc2_reminder_at')) {
                $table->dropColumn('pdc2_reminder_at');
            }

            if (Schema::hasColumn('periods', 'expo_reminder_at')) {
                $table->dropColumn('expo_reminder_at');
            }

            if (Schema::hasColumn('periods', 'ta_reminder_at')) {
                $table->dropColumn('ta_reminder_at');
            }

            if (Schema::hasColumn('periods', 'max_supervisor_load')) {
                $table->dropColumn('max_supervisor_load');
            }
        });
    }
};
