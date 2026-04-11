<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('periods', function (Blueprint $table) {
            // Reminder dates for each phase (separate from lock dates)
            $table->dateTime('bidding_reminder_at')->nullable()->after('bidding_locked_at')->comment('When to send reminder before bidding ends');
            $table->dateTime('pdc1_reminder_at')->nullable()->after('pdc1_end')->comment('When to send reminder for PDC1');
            $table->dateTime('pdc2_reminder_at')->nullable()->after('pdc2_end')->comment('When to send reminder for PDC2');
            $table->dateTime('expo_reminder_at')->nullable()->after('expo_date')->comment('When to send reminder for EXPO');
            $table->dateTime('ta_reminder_at')->nullable()->after('ta_end')->comment('When to send reminder for TA');
            
            // Lock dates for phases (when submissions are locked)
            $table->dateTime('pdc1_locked_at')->nullable()->after('pdc1_reminder_at')->comment('When PDC1 submissions are locked');
            $table->dateTime('pdc2_locked_at')->nullable()->after('pdc2_reminder_at')->comment('When PDC2 submissions are locked');
            $table->dateTime('expo_locked_at')->nullable()->after('expo_reminder_at')->comment('When EXPO submissions are locked');
            $table->dateTime('ta_locked_at')->nullable()->after('ta_reminder_at')->comment('When TA submissions are locked');
        });
    }

    public function down(): void
    {
        Schema::table('periods', function (Blueprint $table) {
            $table->dropColumn([
                'bidding_reminder_at',
                'pdc1_reminder_at',
                'pdc2_reminder_at',
                'expo_reminder_at',
                'ta_reminder_at',
                'pdc1_locked_at',
                'pdc2_locked_at',
                'expo_locked_at',
                'ta_locked_at',
            ]);
        });
    }
};
