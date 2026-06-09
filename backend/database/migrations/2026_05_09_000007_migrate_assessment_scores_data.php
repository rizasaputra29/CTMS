<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * Migrate Assessment Scores Data
 *
 * Migrates data from the old assessment_scores table to new separate tables:
 * - BIMBINGAN_SEMPRO -> bimbingan_sempro_scores
 * - BIMBINGAN_TA -> bimbingan_ta_scores
 * - EXPO -> expo_scores
 * - MILESTONE -> milestone_scores
 * - NILAI_DOSEN -> nilai_dosen_scores
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Backup existing data before migration
        $this->backupData();

        // Check if old table exists
        if (! Schema::hasTable('assessment_scores')) {
            return;
        }

        // Get all records from old table
        $records = DB::table('assessment_scores')->get();

        Log::info("Migrating {$records->count()} assessment score records...");

        foreach ($records as $record) {
            $data = [
                'component_id' => $record->component_id,
                'period_component_id' => $record->period_component_id ?? null,
                'evaluator_id' => $record->evaluator_id,
                'group_id' => $record->group_id,
                'student_id' => $record->student_id,
                'score' => $record->score,
                'notes' => $record->notes,
                'created_at' => $record->created_at,
                'updated_at' => $record->updated_at,
            ];

            // Insert into appropriate table based on evaluation_type
            match ($record->evaluation_type) {
                'BIMBINGAN_SEMPRO' => DB::table('bimbingan_sempro_scores')->insert($data),
                'BIMBINGAN_TA' => DB::table('bimbingan_ta_scores')->insert($data),
                'EXPO' => DB::table('expo_scores')->insert($data),
                'MILESTONE' => DB::table('milestone_scores')->insert($data),
                'NILAI_DOSEN' => DB::table('nilai_dosen_scores')->insert($data),
                default => Log::warning("Unknown evaluation type: {$record->evaluation_type} for record ID {$record->id}")
            };
        }

        Log::info('Migration completed successfully!');

        // Verify counts
        $semproCount = DB::table('bimbingan_sempro_scores')->count();
        $taCount = DB::table('bimbingan_ta_scores')->count();
        $expoCount = DB::table('expo_scores')->count();
        $milestoneCount = DB::table('milestone_scores')->count();
        $nilaiDosenCount = DB::table('nilai_dosen_scores')->count();
        $totalMigrated = $semproCount + $taCount + $expoCount + $milestoneCount + $nilaiDosenCount;

        Log::info('Records migrated:', [
            'BIMBINGAN_SEMPRO' => $semproCount,
            'BIMBINGAN_TA' => $taCount,
            'EXPO' => $expoCount,
            'MILESTONE' => $milestoneCount,
            'NILAI_DOSEN' => $nilaiDosenCount,
            'total' => $totalMigrated,
            'original' => $records->count(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: We don't restore data to old table in down()
        // Use the backup file if needed
        Log::info('To restore data, check the backup file in: storage/app/backups/');
    }

    /**
     * Backup existing data to JSON file
     */
    private function backupData(): void
    {
        if (! Schema::hasTable('assessment_scores')) {
            return;
        }

        $records = DB::table('assessment_scores')->get();

        $backupPath = 'backups/assessment_scores_backup_'.now()->format('Y-m-d_H-i-s').'.json';
        Storage::put($backupPath, $records->toJson(JSON_PRETTY_PRINT));

        Log::info("Backup created: {$backupPath}");
    }
};
