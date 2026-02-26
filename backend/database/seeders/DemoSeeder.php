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
        $dosen3 = User::create([
            'name' => 'Dr. Lecturer Three',
            'email' => 'dosen3@ctms.com',
            'password' => bcrypt('password'),
            'role' => 'dosen',
        ]);

        $students = [];
        for ($i = 3; $i <= 12; $i++) {
            $students[] = User::create([
                'name' => "Student {$i}",
                'email' => "student{$i}@ctms.com",
                'password' => bcrypt('password'),
                'role' => 'mahasiswa',
            ]);
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
            AssessmentComponent::create([
                'period_id' => $period->id,
                'type' => $type,
                'code' => 'CPMK-1',
                'name' => 'Kemampuan Presentasi',
                'description' => 'Kemampuan menyampaikan ide secara jelas dan terstruktur',
                'weight' => 25.00,
                'sort_order' => 1,
            ]);
            AssessmentComponent::create([
                'period_id' => $period->id,
                'type' => $type,
                'code' => 'CPMK-2',
                'name' => 'Penguasaan Materi',
                'description' => 'Pemahaman mendalam terhadap topik yang dibahas',
                'weight' => 30.00,
                'sort_order' => 2,
            ]);
            AssessmentComponent::create([
                'period_id' => $period->id,
                'type' => $type,
                'code' => 'CPMK-3',
                'name' => 'Metodologi Penelitian',
                'description' => 'Ketepatan metode yang digunakan dalam penelitian',
                'weight' => 25.00,
                'sort_order' => 3,
            ]);
            AssessmentComponent::create([
                'period_id' => $period->id,
                'type' => $type,
                'code' => 'CPMK-4',
                'name' => 'Kualitas Dokumen',
                'description' => 'Tata tulis, referensi, dan kelengkapan dokumen',
                'weight' => 20.00,
                'sort_order' => 4,
            ]);
        }

        // ══════════════════════════════════════
        // V5: Peer Review Indicators
        // ══════════════════════════════════════
        PeerReviewIndicator::create([
            'period_id' => $period->id,
            'name' => 'Kontribusi Teknis',
            'description' => 'Seberapa besar kontribusi teknis anggota dalam pengerjaan proyek',
            'weight' => 30.00,
            'sort_order' => 1,
        ]);
        PeerReviewIndicator::create([
            'period_id' => $period->id,
            'name' => 'Kerja Sama Tim',
            'description' => 'Kemampuan bekerja sama dan berkoordinasi dengan anggota lain',
            'weight' => 25.00,
            'sort_order' => 2,
        ]);
        PeerReviewIndicator::create([
            'period_id' => $period->id,
            'name' => 'Tanggung Jawab',
            'description' => 'Kedisiplinan dalam menyelesaikan tugas yang diberikan',
            'weight' => 25.00,
            'sort_order' => 3,
        ]);
        PeerReviewIndicator::create([
            'period_id' => $period->id,
            'name' => 'Inisiatif & Kreativitas',
            'description' => 'Kemampuan memberikan ide dan solusi inovatif',
            'weight' => 20.00,
            'sort_order' => 4,
        ]);

        // ══════════════════════════════════════
        // V5: Dynamic Document Types
        // ══════════════════════════════════════
        $docType1 = DocumentType::create(['name' => 'HKI', 'description' => 'Hak Kekayaan Intelektual', 'phase' => 'TA']);
        $docType2 = DocumentType::create(['name' => 'Hak Cipta', 'description' => 'Sertifikat Hak Cipta', 'phase' => 'TA']);
        $docType3 = DocumentType::create(['name' => 'Surat Keterangan', 'description' => 'Surat keterangan dari instansi terkait', 'phase' => null]);
        $docType4 = DocumentType::create(['name' => 'Logbook Bimbingan', 'description' => 'Catatan bimbingan dengan dosen pembimbing', 'phase' => null]);
        // Fix booleans for PostgreSQL
        \Illuminate\Support\Facades\DB::statement('UPDATE document_types SET is_active = TRUE WHERE id IN (?, ?, ?, ?)', [$docType1->id, $docType2->id, $docType3->id, $docType4->id]);

        // ══════════════════════════════════════
        // V5: Phase Document Requirements
        // ══════════════════════════════════════
        $pdr1 = PhaseDocumentRequirement::create(['period_id' => $period->id, 'phase' => 'PDC1', 'name' => 'Proposal', 'description' => 'Dokumen proposal awal']);
        $pdr2 = PhaseDocumentRequirement::create(['period_id' => $period->id, 'phase' => 'PDC2', 'name' => 'Laporan Kemajuan', 'description' => 'Laporan kemajuan PDC2']);
        $pdr3 = PhaseDocumentRequirement::create(['period_id' => $period->id, 'phase' => 'TA', 'name' => 'Draft Laporan', 'description' => 'Draft laporan tugas akhir']);
        $pdr4 = PhaseDocumentRequirement::create(['period_id' => $period->id, 'phase' => 'TA', 'name' => 'Makalah', 'description' => 'Makalah ilmiah']);
        \Illuminate\Support\Facades\DB::statement('UPDATE phase_document_requirements SET is_required = TRUE WHERE id IN (?, ?, ?, ?)', [$pdr1->id, $pdr2->id, $pdr3->id, $pdr4->id]);

        // ── Titles ──
        $title1 = Title::create([
            'title' => 'Smart IoT Gateway for Campus Environmental Monitoring',
            'description' => 'Design and implement a smart IoT gateway system that collects environmental data (temperature, humidity, air quality) across campus buildings using ESP32 sensors and LoRa communication.',
            'lecturer_id' => $dosen1->id,
            'quota' => 2,
            'status' => 'APPROVED',
        ]);

        $title2 = Title::create([
            'title' => 'AI-Powered Academic Advisory Chatbot Using RAG',
            'description' => 'Build an intelligent chatbot for academic advising using Retrieval-Augmented Generation (RAG) with university curriculum data.',
            'lecturer_id' => $dosen1->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        $title3 = Title::create([
            'title' => 'Blockchain-Based Certificate Verification System',
            'description' => 'Develop a decentralized system for issuing and verifying academic certificates using Ethereum smart contracts.',
            'lecturer_id' => $dosen2->id,
            'quota' => 2,
            'status' => 'APPROVED',
        ]);

        $title4 = Title::create([
            'title' => 'Real-Time Traffic Flow Prediction Using GNN',
            'description' => 'Implement a Graph Neural Network model for predicting traffic flow patterns in urban intersections using real sensor data.',
            'lecturer_id' => $dosen2->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        $title5 = Title::create([
            'title' => 'Federated Learning for Privacy-Preserving Healthcare Analytics',
            'description' => 'Build a federated learning framework for collaborative medical data analysis without sharing raw patient data.',
            'lecturer_id' => $dosen3->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        // ── Group 1: GROUP mode, READY_FOR_BIDDING with bids ──
        $group1 = Group::create([
            'period_id' => $period->id,
            'status' => 'READY_FOR_BIDDING',
            'group_mode' => 'GROUP',
        ]);
        \Illuminate\Support\Facades\DB::statement('UPDATE groups SET has_existing_group = TRUE WHERE id = ?', [$group1->id]);
        $gm = GroupMember::create(['group_id' => $group1->id, 'student_id' => $student1->id, 'period_id' => $period->id]);
        \Illuminate\Support\Facades\DB::statement('UPDATE group_members SET is_leader = TRUE WHERE id = ?', [$gm->id]);
        GroupMember::create(['group_id' => $group1->id, 'student_id' => $student2->id, 'period_id' => $period->id]);
        GroupMember::create(['group_id' => $group1->id, 'student_id' => $students[0]->id, 'period_id' => $period->id]);

        Bid::create(['group_id' => $group1->id, 'title_id' => $title1->id, 'priority' => 1, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen1->id, 'proposed_supervisor_2_id' => $dosen2->id]);
        Bid::create(['group_id' => $group1->id, 'title_id' => $title3->id, 'priority' => 2, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen2->id, 'proposed_supervisor_2_id' => $dosen3->id]);
        Bid::create(['group_id' => $group1->id, 'title_id' => $title5->id, 'priority' => 3, 'status' => 'PENDING', 'proposed_supervisor_1_id' => $dosen3->id]);

        // ── Group 2: GROUP mode, READY_FOR_BIDDING with bids ──
        $group2 = Group::create([
            'period_id' => $period->id,
            'status' => 'READY_FOR_BIDDING',
            'group_mode' => 'GROUP',
        ]);
        \Illuminate\Support\Facades\DB::statement('UPDATE groups SET has_existing_group = TRUE WHERE id = ?', [$group2->id]);
        $gm2 = GroupMember::create(['group_id' => $group2->id, 'student_id' => $students[1]->id, 'period_id' => $period->id]);
        \Illuminate\Support\Facades\DB::statement('UPDATE group_members SET is_leader = TRUE WHERE id = ?', [$gm2->id]);
        GroupMember::create(['group_id' => $group2->id, 'student_id' => $students[2]->id, 'period_id' => $period->id]);

        Bid::create(['group_id' => $group2->id, 'title_id' => $title1->id, 'priority' => 1, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen1->id]);
        Bid::create(['group_id' => $group2->id, 'title_id' => $title2->id, 'priority' => 2, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen1->id, 'proposed_supervisor_2_id' => $dosen2->id]);

        // ── Group 3: INDIVIDUAL mode, FORMING ──
        $group3 = Group::create([
            'period_id' => $period->id,
            'status' => 'FORMING',
            'group_mode' => 'INDIVIDUAL',
        ]);
        $gm3 = GroupMember::create(['group_id' => $group3->id, 'student_id' => $students[3]->id, 'period_id' => $period->id]);
        \Illuminate\Support\Facades\DB::statement('UPDATE group_members SET is_leader = TRUE WHERE id = ?', [$gm3->id]);

        // ── Group 4: GROUP mode, READY_FOR_BIDDING ──
        $group4 = Group::create([
            'period_id' => $period->id,
            'status' => 'READY_FOR_BIDDING',
            'group_mode' => 'GROUP',
        ]);
        $gm4 = GroupMember::create(['group_id' => $group4->id, 'student_id' => $students[4]->id, 'period_id' => $period->id]);
        \Illuminate\Support\Facades\DB::statement('UPDATE group_members SET is_leader = TRUE WHERE id = ?', [$gm4->id]);
        GroupMember::create(['group_id' => $group4->id, 'student_id' => $students[5]->id, 'period_id' => $period->id]);
        GroupMember::create(['group_id' => $group4->id, 'student_id' => $students[6]->id, 'period_id' => $period->id]);

        Bid::create(['group_id' => $group4->id, 'title_id' => $title4->id, 'priority' => 1, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen2->id]);
        Bid::create(['group_id' => $group4->id, 'title_id' => $title3->id, 'priority' => 2, 'status' => 'PENDING', 'proposed_supervisor_1_id' => $dosen2->id, 'proposed_supervisor_2_id' => $dosen1->id]);

        // ── Group 5: GROUP mode, READY_FOR_BIDDING ──
        $group5 = Group::create([
            'period_id' => $period->id,
            'status' => 'READY_FOR_BIDDING',
            'group_mode' => 'GROUP',
        ]);
        \Illuminate\Support\Facades\DB::statement('UPDATE groups SET has_existing_group = TRUE WHERE id = ?', [$group5->id]);
        $gm5 = GroupMember::create(['group_id' => $group5->id, 'student_id' => $students[7]->id, 'period_id' => $period->id]);
        \Illuminate\Support\Facades\DB::statement('UPDATE group_members SET is_leader = TRUE WHERE id = ?', [$gm5->id]);
        GroupMember::create(['group_id' => $group5->id, 'student_id' => $students[8]->id, 'period_id' => $period->id]);
        GroupMember::create(['group_id' => $group5->id, 'student_id' => $students[9]->id, 'period_id' => $period->id]);

        Bid::create(['group_id' => $group5->id, 'title_id' => $title5->id, 'priority' => 1, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen3->id, 'proposed_supervisor_2_id' => $dosen1->id]);
        Bid::create(['group_id' => $group5->id, 'title_id' => $title1->id, 'priority' => 2, 'status' => 'PENDING', 'proposed_supervisor_1_id' => $dosen1->id]);

        $this->command->info('V5 Demo data seeded: 5 titles, 5 groups (incl. 1 INDIVIDUAL), assessment components (CPMK), peer review indicators, document types, phase requirements');
    }
}
