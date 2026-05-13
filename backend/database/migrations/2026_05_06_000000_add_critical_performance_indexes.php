<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Critical performance indexes addressing N+1 slow queries.
 *
 * 1. role_user pivot — every auth check joins this table (GET /user).
 * 2. bids — dosen dashboard filter on proposed_supervisor_*_id.
 * 3. titles — dosen dashboard filter on lecturer_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('role_user', function (Blueprint $table) {
            $table->index('user_id', 'idx_role_user_user_id');
            $table->index('role_id', 'idx_role_user_role_id');
        });

        Schema::table('bids', function (Blueprint $table) {
            $table->index(
                ['proposed_supervisor_1_id', 'status'],
                'idx_bids_supervisor1_status'
            );
            $table->index(
                ['proposed_supervisor_2_id', 'status'],
                'idx_bids_supervisor2_status'
            );
        });

        // idx_titles_lecturer_period already created by 2026_04_07 migration
    }

    public function down(): void
    {
        Schema::table('role_user', function (Blueprint $table) {
            $table->dropIndex('idx_role_user_user_id');
            $table->dropIndex('idx_role_user_role_id');
        });

        Schema::table('bids', function (Blueprint $table) {
            $table->dropIndex('idx_bids_supervisor1_status');
            $table->dropIndex('idx_bids_supervisor2_status');
        });

        Schema::table('titles', function (Blueprint $table) {
            $table->dropIndexIfExists('idx_titles_lecturer_period');
        });
    }
};
