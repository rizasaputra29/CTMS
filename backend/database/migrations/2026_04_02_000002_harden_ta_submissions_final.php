<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add period_id as nullable first
        if (! Schema::hasColumn('ta_submissions', 'period_id')) {
            Schema::table('ta_submissions', function (Blueprint $table) {
                $table->foreignId('period_id')->nullable()->after('group_id')->constrained()->onDelete('cascade');
            });
        }

        // 2. Portable PHP Batch Update (Safety for Large Tables)
        do {
            $affected = DB::update('
                UPDATE ta_submissions 
                SET period_id = (
                    SELECT period_id FROM groups WHERE groups.id = ta_submissions.group_id
                )
                WHERE id IN (
                    SELECT id FROM ta_submissions 
                    WHERE period_id IS NULL 
                    ORDER BY id 
                    LIMIT 1000
                )
            ');

            if ($affected > 0) {
                Log::info('migration.ta_submissions.period_backfill.progress', ['affected' => $affected]);
            }
        } while ($affected > 0);

        // 3. Set NOT NULL and add constraints
        Schema::table('ta_submissions', function (Blueprint $table) {
            $table->unsignedBigInteger('period_id')->nullable(false)->change();

            // Covering Index & Domain Invariant: 1 Student = 1 TA per Period
            $table->unique(['student_id', 'period_id']);

            // Performance Index for Joins
            $table->index('period_id');
        });
    }

    public function down(): void
    {
        Schema::table('ta_submissions', function (Blueprint $table) {
            $table->dropUnique(['student_id', 'period_id']);
            $table->dropIndex(['period_id']);
            $table->dropConstrainedForeignId('period_id');
        });
    }
};
