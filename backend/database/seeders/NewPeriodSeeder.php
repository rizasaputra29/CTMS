<?php

namespace Database\Seeders;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Role;
use App\Models\Title;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class NewPeriodSeeder extends Seeder
{
    public function run(): void
    {
        $password = Hash::make('password');
        $roleIds = Role::query()->pluck('id', 'slug');

        $period = $this->createPeriod();
        $dosen = $this->createDosen($password, $roleIds);
        $students = $this->createStudents($password, $roleIds);
        $this->createPeriodRegistrations($students, $period->id);
        $this->createTitles($dosen, $period->id);
        $this->createGroups($students, $period->id);

        $this->command->info('NewPeriodSeeder completed: period ID '.$period->id.', 4 titles, 2 groups, 8 ungrouped students.');
    }

    private function createPeriod(): Period
    {
        $now = Carbon::now();

        return Period::updateOrCreate(['id' => 4], [
            'name' => 'TA 2026/2027 Genap',
            'start_date' => $now->copy()->subMonths(2)->toDateString(),
            'end_date' => $now->copy()->addMonths(5)->toDateString(),
            'is_active' => true,
            'is_finalized' => false,
            'allow_solo' => true,
            'min_group_size' => 3,
            'max_group_size' => 4,
            'max_supervise_load' => 6,
            'require_all_students_grouped' => true,
            'bidding_start' => $now->copy()->subDays(5),
            'bidding_end' => $now->copy()->addDays(25),
            'pdc1_start' => $now->copy()->addDays(35)->toDateString(),
            'pdc1_end' => $now->copy()->addDays(50)->toDateString(),
            'pdc2_start' => $now->copy()->addDays(70)->toDateString(),
            'pdc2_end' => $now->copy()->addDays(85)->toDateString(),
            'expo_date' => $now->copy()->addDays(100)->toDateString(),
            'ta_start' => $now->copy()->addDays(105)->toDateString(),
            'ta_end' => $now->copy()->addDays(130)->toDateString(),
            'phase_dates' => [
                'bidding' => ['start' => $now->copy()->subDays(5)->toDateString(), 'end' => $now->copy()->addDays(25)->toDateString()],
                'pdc1' => ['start' => $now->copy()->addDays(35)->toDateString(), 'end' => $now->copy()->addDays(50)->toDateString()],
                'pdc2' => ['start' => $now->copy()->addDays(70)->toDateString(), 'end' => $now->copy()->addDays(85)->toDateString()],
                'expo' => ['start' => $now->copy()->addDays(100)->toDateString(), 'end' => $now->copy()->addDays(100)->toDateString()],
                'ta' => ['start' => $now->copy()->addDays(105)->toDateString(), 'end' => $now->copy()->addDays(130)->toDateString()],
            ],
        ]);
    }

    private function createDosen(string $password, $roleIds): User
    {
        $user = User::updateOrCreate(
            ['email' => 'dosen1@ctms.com'],
            [
                'name' => 'Dosen 1',
                'password' => $password,
                'email_verified_at' => Carbon::now(),
                'role' => 'dosen',
                'is_active' => true,
            ]
        );

        $roleId = $roleIds->get('dosen');
        if ($roleId) {
            $user->roles()->sync([$roleId]);
        }

        return $user;
    }

    /**
     * @return \Illuminate\Support\Collection<int, User>
     */
    private function createStudents(string $password, $roleIds): \Illuminate\Support\Collection
    {
        $students = collect();
        $roleId = $roleIds->get('mahasiswa');

        for ($i = 1; $i <= 14; $i++) {
            $user = User::updateOrCreate(
                ['email' => "mahasiswa{$i}@ctms.com"],
                [
                    'name' => "Mahasiswa {$i}",
                    'password' => $password,
                    'email_verified_at' => Carbon::now(),
                    'role' => 'mahasiswa',
                    'nim' => sprintf('2021%04d', $i),
                    'is_active' => true,
                ]
            );

            if ($roleId) {
                $user->roles()->sync([$roleId]);
            }

            $students->push($user);
        }

        return $students;
    }

    private function createPeriodRegistrations(\Illuminate\Support\Collection $students, int $periodId): void
    {
        foreach ($students as $student) {
            DB::table('period_registrations')->updateOrInsert(
                ['user_id' => $student->id, 'period_id' => $periodId],
                ['updated_at' => now(), 'created_at' => now()]
            );
        }
    }

    private function createTitles(User $dosen, int $periodId): void
    {
        $titles = [
            [
                'title' => 'Sistem Informasi Manajemen Inventaris Berbasis Web',
                'description' => 'Aplikasi web untuk manajemen inventaris barang dengan fitur tracking stok otomatis.',
                'problem_statement' => 'Pengelolaan inventaris manual rentan kesalahan dan sulit dilacak.',
                'scope' => 'Web application, barcode scanning, laporan inventaris.',
            ],
            [
                'title' => 'Aplikasi Prediksi Cuaca Menggunakan Machine Learning',
                'description' => 'Sistem prediksi cuaca lokal berbasis data historis dan model machine learning.',
                'problem_statement' => 'Prediksi cuaca akurat sulit diakses untuk daerah pedesaan.',
                'scope' => 'Model ML, integrasi data BMKG, mobile app.',
            ],
            [
                'title' => 'Platform E-Commerce UMKM dengan Fitur Pembayaran Digital',
                'description' => 'Platform jual-beli online khusus UMKM dengan integrasi payment gateway.',
                'problem_statement' => 'UMKM kesulitan go digital karena keterbatasan teknologi.',
                'scope' => 'Web platform, payment gateway, manajemen produk.',
            ],
            [
                'title' => 'Sistem Deteksi Anomali Jaringan Berbasis Deep Learning',
                'description' => 'Sistem keamanan jaringan yang mendeteksi aktivitas mencurigakan menggunakan deep learning.',
                'problem_statement' => 'Serangan siber semakin kompleks dan sulit dideteksi secara manual.',
                'scope' => 'Model deep learning, analisis traffic jaringan, dashboard monitoring.',
            ],
        ];

        foreach ($titles as $idx => $row) {
            Title::updateOrCreate(
                ['id' => $idx + 1],
                array_merge($row, [
                    'lecturer_id' => $dosen->id,
                    'period_id' => $periodId,
                    'quota' => 2,
                    'status' => 'OPEN',
                    'approved_by_admin' => true,
                    'title_source' => 'LECTURER',
                    'proposed_by_group_id' => null,
                    'proposed_supervisor_id' => null,
                    'supervisor_approval_status' => null,
                    'rejection_reason' => null,
                ])
            );
        }
    }

    private function createGroups(\Illuminate\Support\Collection $students, int $periodId): void
    {
        $groupData = [
            [
                'id' => 17,
                'members' => [$students[0], $students[1], $students[2]],
            ],
            [
                'id' => 18,
                'members' => [$students[3], $students[4], $students[5]],
            ],
        ];

        foreach ($groupData as $group) {
            Group::updateOrCreate(
                ['id' => $group['id']],
                [
                    'period_id' => $periodId,
                    'status' => 'READY_FOR_BIDDING',
                    'group_mode' => 'GROUP',
                    'is_solo' => false,
                    'has_existing_group' => true,
                    'has_active_proposal' => false,
                    'assignment_type' => null,
                ]
            );

            foreach ($group['members'] as $idx => $student) {
                GroupMember::updateOrCreate(
                    ['group_id' => $group['id'], 'student_id' => $student->id],
                    [
                        'period_id' => $periodId,
                        'is_leader' => $idx === 0,
                    ]
                );
            }
        }
    }
}
