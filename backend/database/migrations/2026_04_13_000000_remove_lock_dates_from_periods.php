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
        $columns = ['bidding_locked_at', 'pdc1_locked_at', 'pdc2_locked_at', 'expo_locked_at', 'ta_locked_at'];
        $toDrop = array_filter($columns, fn($col) => Schema::hasColumn('periods', $col));
        
        if (!empty($toDrop)) {
            Schema::table('periods', function (Blueprint $table) use ($toDrop) {
                $table->dropColumn($toDrop);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('periods', function (Blueprint $table) {
            $table->timestamp('bidding_locked_at')->nullable()->after('bidding_reminder_at');
            $table->timestamp('pdc1_locked_at')->nullable()->after('pdc1_reminder_at');
            $table->timestamp('pdc2_locked_at')->nullable()->after('pdc2_reminder_at');
            $table->timestamp('expo_locked_at')->nullable()->after('expo_reminder_at');
            $table->timestamp('ta_locked_at')->nullable()->after('ta_reminder_at');
        });
    }
};