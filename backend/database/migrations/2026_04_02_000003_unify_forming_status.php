<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration {
    public function up(): void
    {
        // One-time status unification
        $affected = DB::table('groups')
            ->where('status', 'FORMING_SOLO')
            ->update(['status' => 'FORMING']);

        Log::info('migration.groups.unify_status.forming', ['affected' => $affected]);
    }

    public function down(): void
    {
        // Rollback strategy: revert 1-member groups to FORMING_SOLO
        // Note: This is an approximation as we lost the explicit state.
        $affected = DB::update("
            UPDATE groups 
            SET status = 'FORMING_SOLO' 
            WHERE status = 'FORMING' 
            AND (SELECT count(*) FROM group_members WHERE group_id = groups.id) = 1
        ");

        Log::info('migration.groups.rollback_status.forming_solo', ['affected' => $affected]);
    }
};
