<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Period;
use App\Models\PhaseDocumentRequirement;

class PeriodSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $period = Period::updateOrCreate(
            ['name' => 'Ganjil 2025/2026'],
            [
                'start_date' => '2025-08-01',
                'end_date' => '2026-01-31',
                'phase_dates' => [
                    'bidding' => ['start' => '2025-08-01', 'end' => '2025-08-15'],
                    'pdc1' => ['start' => '2025-08-16', 'end' => '2025-09-15'],
                    'sempro' => ['start' => '2025-09-16', 'end' => '2025-10-15'],
                    'pdc2' => ['start' => '2025-10-16', 'end' => '2025-11-15'],
                    'ta' => ['start' => '2025-11-16', 'end' => '2026-01-15'],
                    'sidang' => ['start' => '2026-01-16', 'end' => '2026-01-31'],
                ],
            ]
        );
        // Set is_active via raw SQL to avoid PostgreSQL boolean binding issue
        \Illuminate\Support\Facades\DB::statement(
            'UPDATE periods SET is_active = TRUE WHERE id = ?',
            [$period->id]
        );

        $requirements = [
            ['phase' => 'PDC1', 'name' => 'C100'],
            ['phase' => 'PDC1', 'name' => 'C200'],
            ['phase' => 'PDC1', 'name' => 'C300'],
            ['phase' => 'SEMPRO', 'name' => 'SEMPRO'],
            ['phase' => 'PDC2', 'name' => 'C400'],
            ['phase' => 'PDC2', 'name' => 'C500'],
            ['phase' => 'EXPO', 'name' => 'EXPO'],
            ['phase' => 'TA', 'name' => 'TA Draft'],
        ];

        foreach ($requirements as $req) {
            $phaseReq = PhaseDocumentRequirement::updateOrCreate(
                ['period_id' => $period->id, 'phase' => $req['phase'], 'name' => $req['name']],
                []
            );
            // Fix boolean for PostgreSQL
            \Illuminate\Support\Facades\DB::statement(
                'UPDATE phase_document_requirements SET is_required = TRUE WHERE id = ?',
                [$phaseReq->id]
            );
        }
    }
}
