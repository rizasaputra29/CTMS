<?php

namespace Database\Seeders;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\PhaseDocumentRequirement;
use App\Models\Role;
use App\Models\Title;
use App\Models\User;
use Illuminate\Database\Seeder;

class CTMSDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding CTMS Base Data...');

        $this->seedRoles();
        $this->seedUsers();
        $this->seedPeriods();
        $this->seedTitles();
        $this->seedGroups();

        $this->command->info('Base data seeded successfully!');
        $this->command->info('');
        $this->command->info('=== TESTING ACCOUNTS ===');
        $this->command->info('Password for all accounts: password');
        $this->command->info('');
        $this->command->info('ADMIN:');
        $this->command->info('  - admin@ctms.com');
        $this->command->info('');
        $this->command->info('DOSEN:');
        $this->command->info('  - dosen1@ctms.com (Dr. Ahmad Fauzi)');
        $this->command->info('  - dosen2@ctms.com (Prof. Budi Santoso)');
        $this->command->info('  - dosen3@ctms.com (Dr. Clara Dewi)');
        $this->command->info('');
        $this->command->info('MAHASISWA:');
        $this->command->info('  - mahasiswa1@ctms.com - mahasiswa10@ctms.com');
        $this->command->info('');
        $this->command->info('MULTI-ROLE:');
        $this->command->info('  - admindosen@ctms.com (Admin + Dosen)');
    }

    protected function seedRoles(): void
    {
        $roles = [
            ['name' => 'Admin', 'slug' => 'admin'],
            ['name' => 'Dosen', 'slug' => 'dosen'],
            ['name' => 'Mahasiswa', 'slug' => 'mahasiswa'],
        ];

        foreach ($roles as $role) {
            Role::firstOrCreate(['slug' => $role['slug']], ['name' => $role['name']]);
        }

        $this->command->info('- Roles seeded');
    }

    protected function seedUsers(): void
    {
        $adminRole = Role::where('slug', 'admin')->first();
        $dosenRole = Role::where('slug', 'dosen')->first();
        $mahasiswaRole = Role::where('slug', 'mahasiswa')->first();

        // =====================
        // ADMIN
        // =====================
        $admin = User::updateOrCreate(
            ['email' => 'admin@ctms.com'],
            [
                'name' => 'Admin CTMS',
                'password' => bcrypt('password'),
                'role' => 'admin',
            ]
        );
        $admin->roles()->sync([$adminRole->id]);

        // =====================
        // DOSEN (Lecturers)
        // =====================
        $dosen1 = User::updateOrCreate(
            ['email' => 'dosen1@ctms.com'],
            [
                'name' => 'Dr. Ahmad Fauzi',
                'password' => bcrypt('password'),
                'role' => 'dosen',
            ]
        );
        $dosen1->roles()->sync([$dosenRole->id]);

        $dosen2 = User::updateOrCreate(
            ['email' => 'dosen2@ctms.com'],
            [
                'name' => 'Prof. Budi Santoso',
                'password' => bcrypt('password'),
                'role' => 'dosen',
            ]
        );
        $dosen2->roles()->sync([$dosenRole->id]);

        $dosen3 = User::updateOrCreate(
            ['email' => 'dosen3@ctms.com'],
            [
                'name' => 'Dr. Clara Dewi',
                'password' => bcrypt('password'),
                'role' => 'dosen',
            ]
        );
        $dosen3->roles()->sync([$dosenRole->id]);

        // =====================
        // MAHASISWA (Students)
        // =====================
        $studentNames = [
            'Andi Pratama',
            'Bella Susanti',
            'Citra Kirana',
            'Dedi Kurniawan',
            'Eka Wahyuni',
            'Fajar Nugroho',
            'Gita Saraswati',
            'Hadi Wijaya',
            'Ira Melati',
            'Joko Hermawan',
        ];

        $students = [];
        for ($i = 0; $i < 10; $i++) {
            $student = User::updateOrCreate(
                ['email' => 'mahasiswa'.($i + 1).'@ctms.com'],
                [
                    'name' => $studentNames[$i],
                    'password' => bcrypt('password'),
                    'role' => 'mahasiswa',
                ]
            );
            $student->roles()->sync([$mahasiswaRole->id]);
            $students[] = $student;
        }

        // =====================
        // MULTI-ROLE USER
        // =====================
        $adminDosen = User::updateOrCreate(
            ['email' => 'admindosen@ctms.com'],
            [
                'name' => 'Super Admin',
                'password' => bcrypt('password'),
                'role' => 'admin',
            ]
        );
        $adminDosen->roles()->sync([$adminRole->id, $dosenRole->id]);

        $this->command->info('- Users seeded: 1 admin, 3 dosen, 10 mahasiswa, 1 multi-role');
    }

    protected function seedPeriods(): void
    {
        // Active Period
        $period1 = Period::updateOrCreate(
            ['name' => 'Ganjil 2025/2026'],
            [
                'start_date' => '2025-08-01',
                'end_date' => '2026-01-31',
                'is_active' => true,
                'bidding_start' => now()->subDays(5),
                'bidding_end' => now()->addDays(10),
                'min_group_size' => 3,
                'max_group_size' => 4,
                'max_supervise_load' => 5,
                'phase_dates' => [
                    'bidding' => ['start' => '2025-08-01', 'end' => '2025-08-15'],
                    'pdc1' => ['start' => '2025-08-16', 'end' => '2025-09-15'],
                    'sempro' => ['start' => '2025-09-16', 'end' => '2025-10-15'],
                    'pdc2' => ['start' => '2025-10-16', 'end' => '2025-11-15'],
                    'expo' => ['start' => '2025-11-20', 'end' => '2025-11-22'],
                    'ta' => ['start' => '2025-11-23', 'end' => '2026-01-15'],
                    'sidang' => ['start' => '2026-01-16', 'end' => '2026-01-31'],
                ],
            ]
        );

        // Inactive Period (for multi-period testing)
        $period2 = Period::updateOrCreate(
            ['name' => 'Genap 2024/2025'],
            [
                'start_date' => '2025-02-01',
                'end_date' => '2025-07-31',
                'is_active' => false,
                'bidding_start' => '2025-02-01',
                'bidding_end' => '2025-02-15',
                'min_group_size' => 3,
                'max_group_size' => 4,
                'max_supervise_load' => 5,
                'is_finalized' => true,
            ]
        );

        // Document Requirements for Active Period
        $requirements = [
            ['phase' => 'PDC1', 'name' => 'Proposal', 'description' => 'Dokumen proposal TA', 'is_required' => true],
            ['phase' => 'PDC1', 'name' => 'Gantt Chart', 'description' => 'Timeline proyek', 'is_required' => true],
            ['phase' => 'PDC1', 'name' => 'Risk Assessment', 'description' => 'Analisis risiko', 'is_required' => false],
            ['phase' => 'SEMPRO', 'name' => 'Buku Sempro', 'description' => 'Buku panduan seminar proposal', 'is_required' => true],
            ['phase' => 'SEMPRO', 'name' => 'Slide Presentasi', 'description' => 'Materi presentasi sempro', 'is_required' => true],
            ['phase' => 'PDC2', 'name' => 'Laporan Kemajuan', 'description' => 'Laporan kemajuan PDC2', 'is_required' => true],
            ['phase' => 'PDC2', 'name' => 'Bukti Kemajuan', 'description' => 'Bukti pengembangan sistem', 'is_required' => true],
            ['phase' => 'EXPO', 'name' => 'Poster', 'description' => 'Poster expo', 'is_required' => true],
            ['phase' => 'EXPO', 'name' => 'Demo Video', 'description' => 'Video demonstrasi', 'is_required' => false],
            ['phase' => 'TA', 'name' => 'Draft Laporan', 'description' => 'Draft laporan TA', 'is_required' => true],
            ['phase' => 'TA', 'name' => 'Source Code', 'description' => 'Kode sumber', 'is_required' => false],
            ['phase' => 'SIDANG', 'name' => 'Buku TA Final', 'description' => 'Laporan TA final', 'is_required' => true],
            ['phase' => 'SIDANG', 'name' => 'CD Program', 'description' => 'Media penyimpanan program', 'is_required' => true],
        ];

        foreach ($requirements as $req) {
            PhaseDocumentRequirement::updateOrCreate(
                [
                    'period_id' => $period1->id,
                    'phase' => $req['phase'],
                    'name' => $req['name'],
                ],
                [
                    'description' => $req['description'],
                    'is_required' => $req['is_required'],
                ]
            );
        }

        $this->command->info('- Periods seeded: 1 active, 1 inactive');
    }

    protected function seedTitles(): void
    {
        $dosen1 = User::where('email', 'dosen1@ctms.com')->first();
        $dosen2 = User::where('email', 'dosen2@ctms.com')->first();
        $dosen3 = User::where('email', 'dosen3@ctms.com')->first();

        if (! $dosen1 || ! $dosen2 || ! $dosen3) {
            $this->command->error('Dosen not found. Run seed in correct order.');

            return;
        }

        // Titles from Dosen 1
        $titles1 = [
            [
                'title' => 'Smart IoT Gateway untuk Monitor Lingkungan Kampus',
                'description' => 'Rancang sistem gateway IoT pintar untuk mengumpulkan data lingkungan (suhu, kelembaban, kualitas udara) di gedung-gedung kampus menggunakan sensor ESP32 dan komunikasi LoRa.',
                'lecturer_id' => $dosen1->id,
                'quota' => 2,
                'status' => 'APPROVED',
            ],
            [
                'title' => 'AI-Powered Academic Advisory Chatbot Menggunakan RAG',
                'description' => 'Bangun chatbot cerdas untuk konsultasi akademik menggunakan Retrieval-Augmented Generation (RAG) dengan data kurikulum universitas.',
                'lecturer_id' => $dosen1->id,
                'quota' => 1,
                'status' => 'APPROVED',
            ],
        ];

        // Titles from Dosen 2
        $titles2 = [
            [
                'title' => 'Sistem Verifikasi Sertifikat Berbasis Blockchain',
                'description' => 'Kembangkan sistem terdesentralisasi untuk menerbitkan dan memverifikasi sertifikat akademik menggunakan smart contract Ethereum.',
                'lecturer_id' => $dosen2->id,
                'quota' => 2,
                'status' => 'APPROVED',
            ],
            [
                'title' => 'Prediksi Arus Lalu Lintas Real-Time Menggunakan GNN',
                'description' => 'Implementasikan model Graph Neural Network untuk memprediksi pola arus lalu lintas di persimpangan kota menggunakan data sensor real-time.',
                'lecturer_id' => $dosen2->id,
                'quota' => 1,
                'status' => 'APPROVED',
            ],
        ];

        // Titles from Dosen 3
        $titles3 = [
            [
                'title' => 'Federated Learning untuk Privacy-Preserving Healthcare Analytics',
                'description' => 'Bangun framework federated learning untuk analisis data medis kolaboratif tanpa membagikan data pasien mentah.',
                'lecturer_id' => $dosen3->id,
                'quota' => 1,
                'status' => 'APPROVED',
            ],
        ];

        $allTitles = array_merge($titles1, $titles2, $titles3);

        foreach ($allTitles as $t) {
            Title::updateOrCreate(['title' => $t['title']], $t);
        }

        $this->command->info('- Titles seeded: 5 lecturer titles');
    }

    protected function seedGroups(): void
    {
        $period1 = Period::where('is_active', true)->first();

        // Get students
        $mhs1 = User::where('email', 'mahasiswa1@ctms.com')->first();
        $mhs2 = User::where('email', 'mahasiswa2@ctms.com')->first();
        $mhs3 = User::where('email', 'mahasiswa3@ctms.com')->first();
        $mhs4 = User::where('email', 'mahasiswa4@ctms.com')->first();
        $mhs5 = User::where('email', 'mahasiswa5@ctms.com')->first();
        $mhs6 = User::where('email', 'mahasiswa6@ctms.com')->first();
        $mhs7 = User::where('email', 'mahasiswa7@ctms.com')->first();
        $mhs8 = User::where('email', 'mahasiswa8@ctms.com')->first();
        $mhs9 = User::where('email', 'mahasiswa9@ctms.com')->first();
        $mhs10 = User::where('email', 'mahasiswa10@ctms.com')->first();

        $dosen1 = User::where('email', 'dosen1@ctms.com')->first();

        // GROUP 1: Regular group (3 members) - Ready for bidding
        $group1 = Group::create([
            'period_id' => $period1->id,
            'status' => 'READY_FOR_BIDDING',
            'group_mode' => 'GROUP',
        ]);

        GroupMember::create(['group_id' => $group1->id, 'student_id' => $mhs1->id, 'is_leader' => true, 'period_id' => $period1->id]);
        GroupMember::create(['group_id' => $group1->id, 'student_id' => $mhs2->id, 'is_leader' => false, 'period_id' => $period1->id]);
        GroupMember::create(['group_id' => $group1->id, 'student_id' => $mhs3->id, 'is_leader' => false, 'period_id' => $period1->id]);

        // GROUP 2: Solo Seeker (1 member with proposed title - PRE_APPROVED for Bursa Ide)
        $soloGroup = Group::create([
            'period_id' => $period1->id,
            'status' => 'WAITING_SUPERVISOR_APPROVAL',
            'group_mode' => 'INDIVIDUAL',
        ]);

        GroupMember::create(['group_id' => $soloGroup->id, 'student_id' => $mhs4->id, 'is_leader' => true, 'period_id' => $period1->id]);

        // Create proposed title for solo seeker (auto PRE_APPROVED so they can recruit)
        $proposedTitle = Title::create([
            'title' => 'Mobile App untuk Monitoring Kesehatan Mahasiswa berbasis AI',
            'description' => 'Aplikasi mobile untuk monitoring kesehatan mental dan fisik mahasiswa dengan fitur AI-powered recommendation.',
            'problem_statement' => 'Mahasiswa sering mengalami stres dan kurang sadar akan kondisi kesehatan mereka.',
            'scope' => 'Mobile app (Android/iOS), AI analytics, notification system',
            'specializations' => ['Software', 'AI'],
            'lecturer_id' => $dosen1->id,
            'proposed_supervisor_id' => $dosen1->id,
            'quota' => 1,
            'status' => 'open',
            'title_source' => 'STUDENT',
            'proposed_by_group_id' => $soloGroup->id,
            'supervisor_approval_status' => 'UNDER_REVIEW',
            'period_id' => $period1->id,
        ]);

        // Update group with the title
        $soloGroup->update(['title_id' => $proposedTitle->id]);

        // GROUP 3: Multi-period testing - Active period
        $group3 = Group::create([
            'period_id' => $period1->id,
            'status' => 'FORMING',
            'group_mode' => 'GROUP',
        ]);

        GroupMember::create(['group_id' => $group3->id, 'student_id' => $mhs7->id, 'is_leader' => true, 'period_id' => $period1->id]);
        GroupMember::create(['group_id' => $group3->id, 'student_id' => $mhs8->id, 'is_leader' => false, 'period_id' => $period1->id]);
        GroupMember::create(['group_id' => $group3->id, 'student_id' => $mhs9->id, 'is_leader' => false, 'period_id' => $period1->id]);

        // GROUP 4: Multi-period testing - Inactive period
        $period2 = Period::where('is_active', false)->first();

        if ($period2) {
            $group4 = Group::create([
                'period_id' => $period2->id,
                'status' => 'PDC1_ACTIVE',
                'group_mode' => 'GROUP',
            ]);

            GroupMember::create(['group_id' => $group4->id, 'student_id' => $mhs10->id, 'is_leader' => true, 'period_id' => $period2->id]);
        }

        $this->command->info('- Groups seeded: 1 regular (bidding), 1 solo seeker (with title), 2 multi-period');
    }
}
