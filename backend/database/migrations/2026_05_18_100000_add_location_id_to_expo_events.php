<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expo_events', function (Blueprint $table) {
            $table->foreignId('location_id')
                ->nullable()
                ->after('end_time')
                ->constrained('locations')
                ->nullOnDelete();
        });

        // Make room nullable now that location_id is the primary location field
        Schema::table('expo_events', function (Blueprint $table) {
            $table->string('room')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('expo_events', function (Blueprint $table) {
            $table->dropForeign(['location_id']);
            $table->dropColumn('location_id');
        });

        // Revert room back to required
        DB::statement("UPDATE expo_events SET room = 'Unknown' WHERE room IS NULL");
        Schema::table('expo_events', function (Blueprint $table) {
            $table->string('room')->nullable(false)->change();
        });
    }
};
