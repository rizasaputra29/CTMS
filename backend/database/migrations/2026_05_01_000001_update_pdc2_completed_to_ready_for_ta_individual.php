<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Update existing groups from PDC2_COMPLETED to READY_FOR_TA_INDIVIDUAL
        DB::table('groups')
            ->where('status', 'PDC2_COMPLETED')
            ->update(['status' => 'READY_FOR_TA_INDIVIDUAL']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert back to PDC2_COMPLETED
        DB::table('groups')
            ->where('status', 'READY_FOR_TA_INDIVIDUAL')
            ->update(['status' => 'PDC2_COMPLETED']);
    }
};
