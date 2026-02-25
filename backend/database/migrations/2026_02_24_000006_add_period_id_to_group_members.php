<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('group_members', function (Blueprint $table) {
            $table->foreignId('period_id')->nullable()->after('group_id')->constrained()->cascadeOnDelete();

            // ⚠ DB-level unique: student cannot belong to 2 groups in same period
            $table->unique(['student_id', 'period_id']);
        });

        // Backfill period_id from groups table for existing records
        \Illuminate\Support\Facades\DB::statement('
            UPDATE group_members 
            SET period_id = (SELECT period_id FROM groups WHERE groups.id = group_members.group_id)
            WHERE period_id IS NULL
        ');
    }

    public function down(): void
    {
        Schema::table('group_members', function (Blueprint $table) {
            $table->dropUnique(['student_id', 'period_id']);
            $table->dropConstrainedForeignId('period_id');
        });
    }
};
