<?php

namespace Database\Seeders;

use App\Models\AssessmentComponent;
use App\Models\Bid;
use App\Models\DocumentType;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\PeerReviewIndicator;
use App\Models\Period;
use App\Models\PhaseDocumentRequirement;
use App\Models\Title;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    /**
     * Seed a realistic demo scenario compatible with V5 schema updates.
     */
    public function run(): void
    {
        // ── Additional Users ──
        $dosen3 = User::updateOrCreate(
            ['email' => 'dosen3@ctms.com'],
            [
                'name' => 'Dr. Lecturer Three',
                'password' => bcrypt('password'),
                'role' => 'dosen',
            ]
        );

        $students = [];
        for ($i = 3; $i <= 12; $i++) {
            $students[] = User::updateOrCreate(
                ['email' => "student{$i}@ctms.com"],
                [
                    'name' => "Student {$i}",
                    'password' => bcrypt('password'),
                    'role' => 'mahasiswa',
                ]
            );
        }

        // ── Get existing seeded data ──
        $period = Period::latest()->first();
        $dosen1 = User::where('email', 'dosen1@ctms.com')->first();
        $dosen2 = User::where('email', 'dosen2@ctms.com')->first();
        $student1 = User::where('email', 'student1@ctms.com')->first();
        $student2 = User::where('email', 'student2@ctms.com')->first();

        if (!$period) {
            $this->command->warn('No active period found. Run PeriodSeeder first.');
            return;
        }

        // ── Update Period with bidding config ──
        $period->update([
            'bidding_start' => now()->subDays(7),
            'bidding_end' => now()->addDays(7),
            'min_group_size' => 2,
            'max_group_size' => 4,
            'max_supervise_load' => 5,
            'pdc1_start' => now()->addDays(14),
            'pdc1_end' => now()->addDays(44),
            'pdc2_start' => now()->addDays(60),
            'pdc2_end' => now()->addDays(90),
            'expo_date' => now()->addDays(100),
            'ta_start' => now()->addDays(100),
            'ta_end' => now()->addDays(150),
        ]);

        // ══════════════════════════════════════
        // V5: Assessment Components (CPMK/CPL)
        // ══════════════════════════════════════
        $assessmentTypes = ['SEMPRO', 'SIDANG_TA', 'BIMBINGAN'];
        foreach ($assessmentTypes as $type) {
            $components = [
                ['code' => 'CPMK-1', 'name' => 'Kemampuan Presentasi', 'description' => 'Kemampuan menyampaikan ide secara jelas dan terstruktur', 'weight' => 25.00, 'sort_order' => 1],
                ['code' => 'CPMK-2', 'name' => 'Penguasaan Materi', 'description' => 'Pemahaman mendalam terhadap topik yang dibahas', 'weight' => 30.00, 'sort_order' => 2],
                ['code' => 'CPMK-3', 'name' => 'Metodologi Penelitian', 'description' => 'Ketepatan metode yang digunakan dalam penelitian', 'weight' => 25.00, 'sort_order' => 3],
                ['code' => 'CPMK-4', 'name' => 'Kualitas Dokumen', 'description' => 'Tata tulis, referensi, and kelengkapan dokumen', 'weight' => 20.00, 'sort_order' => 4],
            ];

            foreach ($components as $comp) {
                AssessmentComponent::updateOrCreate(
                    ['period_id' => $period->id, 'type' => $type, 'code' => $comp['code']],
                    $comp
                );
            }
        }

        // ══════════════════════════════════════
        // V5: Peer Review Indicators
        // ══════════════════════════════════════
        $indicators = [
            ['name' => 'Kontribusi Teknis', 'description' => 'Seberapa besar kontribusi teknis anggota dalam pengerjaan proyek', 'weight' => 30.00, 'sort_order' => 1],
            ['name' => 'Kerja Sama Tim', 'description' => 'Kemampuan bekerja sama dan berkoordinasi dengan anggota lain', 'weight' => 25.00, 'sort_order' => 2],
            ['name' => 'Tanggung Jawab', 'description' => 'Kedisiplinan dalam menyelesaikan tugas yang diberikan', 'weight' => 25.00, 'sort_order' => 3],
            ['name' => 'Inisiatif & Kreativitas', 'description' => 'Kemampuan memberikan ide dan solusi inovatif', 'weight' => 20.00, 'sort_order' => 4],
        ];

        foreach ($indicators as $ind) {
            PeerReviewIndicator::updateOrCreate(
                ['period_id' => $period->id, 'name' => $ind['name']],
                $ind
            );
        }

        // ══════════════════════════════════════
        // V5: Dynamic Document Types
        // ══════════════════════════════════════
        $docTypes = [
            ['name' => 'HKI', 'description' => 'Hak Kekayaan Intelektual', 'phase' => 'TA'],
            ['name' => 'Hak Cipta', 'description' => 'Sertifikat Hak Cipta', 'phase' => 'TA'],
            ['name' => 'Surat Keterangan', 'description' => 'Surat keterangan dari instansi terkait', 'phase' => null],
            ['name' => 'Logbook Bimbingan', 'description' => 'Catatan bimbingan dengan dosen pembimbing', 'phase' => null],
        ];

        foreach ($docTypes as $dt) {
            $docType = DocumentType::updateOrCreate(['name' => $dt['name']], $dt);
            \Illuminate\Support\Facades\DB::statement('UPDATE document_types SET is_active = TRUE WHERE id = ?', [$docType->id]);
        }

        // ══════════════════════════════════════
        // V5: Phase Document Requirements
        // ══════════════════════════════════════
        $pdrData = [
            ['phase' => 'PDC1', 'name' => 'Proposal', 'description' => 'Dokumen proposal awal'],
            ['phase' => 'PDC2', 'name' => 'Laporan Kemajuan', 'description' => 'Laporan kemajuan PDC2'],
            ['phase' => 'TA', 'name' => 'Draft Laporan', 'description' => 'Draft laporan tugas akhir'],
            ['phase' => 'TA', 'name' => 'Makalah', 'description' => 'Makalah ilmiah'],
        ];

        foreach ($pdrData as $pdr) {
            $phaseReq = PhaseDocumentRequirement::updateOrCreate(
                ['period_id' => $period->id, 'phase' => $pdr['phase'], 'name' => $pdr['name']],
                $pdr
            );
            \Illuminate\Support\Facades\DB::statement('UPDATE phase_document_requirements SET is_required = TRUE WHERE id = ?', [$phaseReq->id]);
        }

        // ── Titles ──
        $titles = [
            [
                'title' => 'Smart IoT Gateway for Campus Environmental Monitoring',
                'description' => 'Design and implement a smart IoT gateway system that collects environmental data (temperature, humidity, air quality) across campus buildings using ESP32 sensors and LoRa communication.',
                'lecturer_id' => $dosen1->id,
                'quota' => 2,
                'status' => 'APPROVED',
            ],
            [
                'title' => 'AI-Powered Academic Advisory Chatbot Using RAG',
                'description' => 'Build an intelligent chatbot for academic advising using Retrieval-Augmented Generation (RAG) with university curriculum data.',
                'lecturer_id' => $dosen1->id,
                'quota' => 1,
                'status' => 'APPROVED',
            ],
            [
                'title' => 'Blockchain-Based Certificate Verification System',
                'description' => 'Develop a decentralized system for issuing and verifying academic certificates using Ethereum smart contracts.',
                'lecturer_id' => $dosen2->id,
                'quota' => 2,
                'status' => 'APPROVED',
            ],
            [
                'title' => 'Real-Time Traffic Flow Prediction Using GNN',
                'description' => 'Implement a Graph Neural Network model for predicting traffic flow patterns in urban intersections using real sensor data.',
                'lecturer_id' => $dosen2->id,
                'quota' => 1,
                'status' => 'APPROVED',
            ],
            [
                'title' => 'Federated Learning for Privacy-Preserving Healthcare Analytics',
                'description' => 'Build a federated learning framework for collaborative medical data analysis without sharing raw patient data.',
                'lecturer_id' => $dosen3->id,
                'quota' => 1,
                'status' => 'APPROVED',
            ],
        ];

        $seededTitles = [];
        foreach ($titles as $t) {
            $seededTitles[] = Title::updateOrCreate(['title' => $t['title']], $t);
        }

        // ── Group 1: GROUP mode, READY_FOR_BIDDING with bids ──
        $group1 = Group::where('period_id', $period->id)
            ->where('group_mode', 'GROUP')
            ->first();

        if (!$group1) {
            $group1 = Group::create([
                'period_id' => $period->id,
                'status' => 'READY_FOR_BIDDING',
                'group_mode' => 'GROUP',
            ]);
        }
        \Illuminate\Support\Facades\DB::statement('UPDATE groups SET has_existing_group = TRUE WHERE id = ?', [$group1->id]);
        
        // Free up students from any existing groups in this period
        $studentIdsToClean = array_merge(
            [$student1->id, $student2->id],
            collect($students)->pluck('id')->toArray()
        );
        GroupMember::whereIn('student_id', $studentIdsToClean)
            ->where('period_id', $period->id)
            ->delete();

        // Clear existing bids for seeded groups
        Bid::where('group_id', $group1->id)->delete();

        $gm = GroupMember::create(['student_id' => $student1->id, 'period_id' => $period->id, 'group_id' => $group1->id]);
        \Illuminate\Support\Facades\DB::statement('UPDATE group_members SET is_leader = TRUE WHERE id = ?', [$gm->id]);
        GroupMember::create(['student_id' => $student2->id, 'period_id' => $period->id, 'group_id' => $group1->id]);
        GroupMember::create(['student_id' => $students[0]->id, 'period_id' => $period->id, 'group_id' => $group1->id]);

        Bid::create(['group_id' => $group1->id, 'priority' => 1, 'title_id' => $seededTitles[0]->id, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen1->id, 'proposed_supervisor_2_id' => $dosen2->id]);
        Bid::create(['group_id' => $group1->id, 'priority' => 2, 'title_id' => $seededTitles[2]->id, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen2->id, 'proposed_supervisor_2_id' => $dosen3->id]);
        Bid::create(['group_id' => $group1->id, 'priority' => 3, 'title_id' => $seededTitles[4]->id, 'status' => 'PENDING', 'proposed_supervisor_1_id' => $dosen3->id]);

        // ── Group 2: GROUP mode, READY_FOR_BIDDING with bids ──
        if (Group::where('period_id', $period->id)->count() < 2) {
             $group2 = Group::create(['period_id' => $period->id, 'status' => 'READY_FOR_BIDDING', 'group_mode' => 'GROUP']);
        } else {
             $group2 = Group::where('period_id', $period->id)->skip(1)->first();
        }

        \Illuminate\Support\Facades\DB::statement('UPDATE groups SET has_existing_group = TRUE WHERE id = ?', [$group2->id]);
        
        // Clear existing bids for idempotency
        Bid::where('group_id', $group2->id)->delete();

        $gm2 = GroupMember::create(['student_id' => $students[1]->id, 'period_id' => $period->id, 'group_id' => $group2->id]);
        \Illuminate\Support\Facades\DB::statement('UPDATE group_members SET is_leader = TRUE WHERE id = ?', [$gm2->id]);
        GroupMember::create(['student_id' => $students[2]->id, 'period_id' => $period->id, 'group_id' => $group2->id]);

        Bid::create(['group_id' => $group2->id, 'priority' => 1, 'title_id' => $seededTitles[0]->id, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen1->id]);
        Bid::create(['group_id' => $group2->id, 'priority' => 2, 'title_id' => $seededTitles[1]->id, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen1->id, 'proposed_supervisor_2_id' => $dosen2->id]);

        $this->command->info('V5 Demo data seeded: 5 titles, multiple groups, assessment components (CPMK), peer review indicators, document types, phase requirements');
    }
}
