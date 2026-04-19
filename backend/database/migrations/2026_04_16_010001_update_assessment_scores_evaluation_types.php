<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // For MySQL, we need to modify the enum column
        // First, we need to check what type of database is being used
        $driver = DB::connection()->getDriverName();
        
        if ($driver === 'mysql') {
            // MySQL specific - modify enum
            DB::statement("ALTER TABLE assessment_scores MODIFY evaluation_type ENUM('SEMPRO', 'SIDANG_TA', 'EXPO', 'BIMBINGAN_SEMPRO', 'BIMBINGAN_EXPO', 'BIMBINGAN_TA', 'MILESTONE', 'PEER_REVIEW') NOT NULL");
        } else {
            // For other databases (PostgreSQL, SQLite), we'll use string
            Schema::table('assessment_scores', function (Blueprint $table) {
                $table->string('evaluation_type', 50)->change();
            });
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();
        
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE assessment_scores MODIFY evaluation_type ENUM('SEMPRO', 'SIDANG_TA', 'EXPO', 'BIMBINGAN') NOT NULL");
        } else {
            Schema::table('assessment_scores', function (Blueprint $table) {
                $table->string('evaluation_type', 50)->change();
            });
        }
    }
};
