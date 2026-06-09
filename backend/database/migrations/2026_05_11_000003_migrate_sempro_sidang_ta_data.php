<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->migrateSemproData();
        $this->migrateSidangTaData();
    }

    public function down(): void
    {
        Log::info('sempro_scores/sidang_ta_scores data migration rollback - manual restore required');
    }

    private function migrateSemproData(): void
    {
        if (! Schema::hasTable('seminar_evaluations')) {
            return;
        }

        $evaluations = DB::table('seminar_evaluations')
            ->join('seminar_schedules', 'seminar_evaluations.schedule_id', '=', 'seminar_schedules.id')
            ->where('seminar_schedules.type', 'SEMPRO')
            ->whereIn('seminar_evaluations.status', ['SUBMITTED', 'COMPLETED'])
            ->whereNotNull('seminar_evaluations.rubric_json')
            ->select(
                'seminar_evaluations.id as eval_id',
                'seminar_evaluations.schedule_id',
                'seminar_evaluations.examiner_id',
                'seminar_evaluations.rubric_json',
                'seminar_schedules.group_id',
            )
            ->get();

        Log::info("Migrating {$evaluations->count()} SEMPRO evaluations...");

        $inserted = 0;

        foreach ($evaluations as $eval) {
            $rubric = json_decode($eval->rubric_json, true);
            $scores = $rubric['scores'] ?? [];

            foreach ($scores as $key => $scoreValue) {
                $parts = explode('_', (string) $key);
                $periodComponentId = (int) ($parts[0] ?? 0);
                $studentId = (int) ($parts[1] ?? 0);

                if ($periodComponentId <= 0 || $studentId <= 0) {
                    continue;
                }

                DB::table('sempro_scores')->insert([
                    'period_component_id' => $periodComponentId,
                    'examiner_id' => $eval->examiner_id,
                    'group_id' => $eval->group_id,
                    'student_id' => $studentId,
                    'score' => (float) $scoreValue,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $inserted++;
            }
        }

        Log::info("SEMPRO migration complete: {$inserted} scores inserted");
    }

    private function migrateSidangTaData(): void
    {
        if (! Schema::hasTable('ta_defense_evaluations')) {
            return;
        }

        $evaluations = DB::table('ta_defense_evaluations')
            ->join('ta_defense_schedules', 'ta_defense_evaluations.schedule_id', '=', 'ta_defense_schedules.id')
            ->whereIn('ta_defense_evaluations.status', ['SUBMITTED', 'COMPLETED'])
            ->whereNotNull('ta_defense_evaluations.rubric_json')
            ->select(
                'ta_defense_evaluations.id as eval_id',
                'ta_defense_evaluations.schedule_id',
                'ta_defense_evaluations.examiner_id',
                'ta_defense_evaluations.student_id',
                'ta_defense_evaluations.rubric_json',
                'ta_defense_evaluations.score as eval_score',
                'ta_defense_schedules.group_id',
            )
            ->get();

        Log::info("Migrating {$evaluations->count()} SIDANG_TA evaluations...");

        $inserted = 0;
        $now = now();

        foreach ($evaluations as $eval) {
            $rubric = json_decode($eval->rubric_json, true);
            $scores = $rubric['scores'] ?? [];

            if (empty($scores)) {
                // No component scores in rubric — insert single score from eval
                DB::table('sidang_ta_scores')->insert([
                    'examiner_id' => $eval->examiner_id,
                    'group_id' => $eval->group_id,
                    'student_id' => $eval->student_id,
                    'score' => (float) $eval->eval_score,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $inserted++;

                continue;
            }

            foreach ($scores as $key => $scoreValue) {
                $parts = explode('_', (string) $key);
                $periodComponentId = (int) ($parts[0] ?? 0);
                $studentId = (int) ($parts[1] ?? 0);

                if ($periodComponentId <= 0 || $studentId <= 0) {
                    continue;
                }

                DB::table('sidang_ta_scores')->insert([
                    'period_component_id' => $periodComponentId,
                    'examiner_id' => $eval->examiner_id,
                    'group_id' => $eval->group_id,
                    'student_id' => $studentId,
                    'score' => (float) $scoreValue,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $inserted++;
            }
        }

        Log::info("SIDANG_TA migration complete: {$inserted} scores inserted");
    }
};
