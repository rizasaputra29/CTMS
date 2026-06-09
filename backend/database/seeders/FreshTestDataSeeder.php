<?php

namespace Database\Seeders;

use App\Models\Period;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class FreshTestDataSeeder extends Seeder
{
    public function run(): void
    {
        // Step 1: Delete all dependent tables in cascade order
        $this->command->info('Deleting all data tables...');
        $this->deleteAllData();

        // Step 2: Create fresh periods
        $this->command->info('Creating fresh periods...');
        $this->createFreshPeriods();

        // Step 3: Create fresh users
        $this->command->info('Creating fresh users...');
        $this->createFreshUsers();

        $this->command->info('Fresh test data seeded successfully!');
        $this->command->info('- Created 2 periods (Ganjil & Genap)');
        $this->command->info('- Created 1 admin user');
        $this->command->info('- Created 6 dosen users');
        $this->command->info('- Created 30 mahasiswa users (unregistered to periods)');
    }

    private function deleteAllData(): void
    {
        // Delete in cascade order (respecting foreign key constraints)
        // Tables that reference groups
        DB::table('group_invitations')->delete();
        DB::table('expo_registrations')->delete();
        DB::table('ta_defense_schedules')->delete();
        DB::table('seminar_schedules')->delete();
        DB::table('ta_submissions')->delete();
        DB::table('supervisions')->delete();
        DB::table('group_supervisor_proposals')->delete();
        DB::table('bids')->delete();
        DB::table('evaluations')->delete();
        DB::table('schedules')->delete();
        DB::table('documents')->delete();
        DB::table('group_members')->delete();

        // Tables that reference groups and periods
        DB::table('groups')->delete();
        DB::table('expo_events')->delete();
        DB::table('phase_document_requirements')->delete();

        // Tables that reference users (lecturers)
        DB::table('titles')->delete();

        // Base tables
        DB::table('period_registrations')->delete();
        DB::table('periods')->delete();
        DB::table('users')->delete();
    }

    private function createFreshPeriods(): void
    {
        $now = Carbon::now();
        $year = $now->year;
        $nextYear = $year + 1;

        $periods = [
            [
                'name' => "Genap {$year}/{$nextYear}",
                'start_date' => $now->copy()->subMonths(2)->toDateString(),
                'end_date' => $now->copy()->addMonths(5)->toDateString(),
                'is_active' => true,
                'is_finalized' => false,
                'allow_solo' => true,
                'min_group_size' => 3,
                'max_group_size' => 4,
                'max_supervise_load' => 6,
                'require_all_students_grouped' => true,
                'bidding_start' => $now->copy()->subDays(10),
                'bidding_end' => $now->copy()->addDays(20),
                'bidding_locked_at' => null,
                'pdc1_start' => $now->copy()->addDays(30)->toDateString(),
                'pdc1_end' => $now->copy()->addDays(45)->toDateString(),
                'pdc2_start' => $now->copy()->addDays(60)->toDateString(),
                'pdc2_end' => $now->copy()->addDays(80)->toDateString(),
                'expo_date' => $now->copy()->addDays(90)->toDateString(),
                'ta_start' => $now->copy()->addDays(95)->toDateString(),
                'ta_end' => $now->copy()->addDays(120)->toDateString(),
                'phase_dates' => [
                    'bidding' => ['start' => $now->copy()->subDays(10)->toDateString(), 'end' => $now->copy()->addDays(20)->toDateString()],
                    'pdc1' => ['start' => $now->copy()->addDays(30)->toDateString(), 'end' => $now->copy()->addDays(45)->toDateString()],
                    'pdc2' => ['start' => $now->copy()->addDays(60)->toDateString(), 'end' => $now->copy()->addDays(80)->toDateString()],
                    'expo' => ['start' => $now->copy()->addDays(90)->toDateString(), 'end' => $now->copy()->addDays(90)->toDateString()],
                    'ta' => ['start' => $now->copy()->addDays(95)->toDateString(), 'end' => $now->copy()->addDays(120)->toDateString()],
                ],
            ],
            [
                'name' => "Ganjil {$year}/{$nextYear}",
                'start_date' => $now->copy()->subMonth()->toDateString(),
                'end_date' => $now->copy()->addMonths(6)->toDateString(),
                'is_active' => true,
                'is_finalized' => false,
                'allow_solo' => false,
                'min_group_size' => 3,
                'max_group_size' => 4,
                'max_supervise_load' => 6,
                'require_all_students_grouped' => true,
                'bidding_start' => $now->copy()->subDays(5),
                'bidding_end' => $now->copy()->addDays(25),
                'bidding_locked_at' => null,
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
            ],
        ];

        foreach ($periods as $periodData) {
            Period::create($periodData);
        }
    }

    private function createFreshUsers(): void
    {
        $now = Carbon::now();
        $password = Hash::make('password');
        $roleIds = Role::query()->pluck('id', 'slug');

        $users = [
            ['name' => 'admin', 'email' => 'admin@ctms.com', 'role' => 'admin'],
        ];

        // Create dosen users (1-6)
        for ($i = 1; $i <= 6; $i++) {
            $users[] = [
                'name' => "Dosen $i",
                'email' => "dosen$i@ctms.com",
                'role' => 'dosen',
            ];
        }

        // Create mahasiswa users (1-30)
        for ($i = 1; $i <= 30; $i++) {
            $users[] = [
                'name' => "Mahasiswa $i",
                'email' => "mahasiswa$i@ctms.com",
                'role' => 'mahasiswa',
                'nim' => sprintf('2021%04d', $i), // Pattern: 20210001 - 20210030
            ];
        }

        // Insert all users and assign roles
        foreach ($users as $entry) {
            $user = User::create([
                'name' => $entry['name'],
                'email' => $entry['email'],
                'password' => $password,
                'email_verified_at' => $now,
                'role' => $entry['role'],
                'nim' => $entry['nim'] ?? null,
                'is_active' => true,
            ]);

            // Assign role from roles table
            $roleId = $roleIds->get($entry['role']);
            if ($roleId) {
                $user->roles()->sync([$roleId]);
            }
        }
    }
}
