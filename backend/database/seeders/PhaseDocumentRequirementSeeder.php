<?php

namespace Database\Seeders;

use App\Models\Period;
use App\Models\PhaseDocumentRequirement;
use Illuminate\Database\Seeder;

class PhaseDocumentRequirementSeeder extends Seeder
{
    public function run(?int $periodId = null): void
    {
        if ($periodId === null) {
            $period = Period::where('is_active', true)->latest()->first();

            if (! $period) {
                $this->command->error('No active period found. Please create an active period first.');

                return;
            }

            $periodId = $period->id;
        }

        $requirements = [
            // PDC1 (3 dokumen)
            ['phase' => 'PDC1', 'name' => 'C100', 'description' => 'Dokumen CPL C100', 'is_required' => true],
            ['phase' => 'PDC1', 'name' => 'C200', 'description' => 'Dokumen CPL C200', 'is_required' => true],
            ['phase' => 'PDC1', 'name' => 'C300', 'description' => 'Dokumen CPL C300', 'is_required' => true],

            // SEMPRO (1 dokumen)
            ['phase' => 'SEMPRO', 'name' => 'PPT Presentasi', 'description' => 'Slide presentasi seminar proposal', 'is_required' => true],

            // PDC2 (3 dokumen)
            ['phase' => 'PDC2', 'name' => 'C400', 'description' => 'Dokumen CPL C400', 'is_required' => true],
            ['phase' => 'PDC2', 'name' => 'C500', 'description' => 'Dokumen CPL C500', 'is_required' => true],
            ['phase' => 'PDC2', 'name' => 'HKI', 'description' => 'Dokumen Hak Kekayaan Intelektual', 'is_required' => true],

            // TA Draft (1 dokumen)
            ['phase' => 'TA', 'name' => 'TA Draft', 'description' => 'Draft laporan tugas akhir', 'is_required' => true],

            // EXPO (2 dokumen)
            ['phase' => 'EXPO', 'name' => 'Absen Kehadiran Pengunjung', 'description' => 'Dokumen absensi kehadiran pengunjung expo', 'is_required' => true],
            ['phase' => 'EXPO', 'name' => 'Nilai Pengunjung', 'description' => 'Form nilai dari pengunjung (di upload di form nilai Expo)', 'is_required' => true],

            // SIDANG / TA Final (3 dokumen terpisah)
            ['phase' => 'SIDANG', 'name' => 'TOEFL/IELTS', 'description' => 'Sertifikat bahasa Inggris TOEFL/IELTS', 'is_required' => true],
            ['phase' => 'SIDANG', 'name' => 'Turnitin', 'description' => 'Laporan similarity Turnitin', 'is_required' => true],
            ['phase' => 'SIDANG', 'name' => 'Bukti Nilai', 'description' => 'Dokumen bukti nilai fase sebelumnya', 'is_required' => true],
        ];

        foreach ($requirements as $req) {
            PhaseDocumentRequirement::updateOrCreate(
                [
                    'period_id' => $periodId,
                    'phase' => $req['phase'],
                    'name' => $req['name'],
                ],
                [
                    'description' => $req['description'],
                    'is_required' => $req['is_required'],
                ]
            );
        }

        if ($this->command) {
            $this->command->info('Seeded '.count($requirements).' phase document requirements for period_id='.$periodId);
        }
    }
}
