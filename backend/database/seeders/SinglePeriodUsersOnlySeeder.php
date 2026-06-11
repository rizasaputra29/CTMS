<?php

namespace Database\Seeders;

use App\Models\Period;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class SinglePeriodUsersOnlySeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Resetting data for users-only flow testing...');

        $this->wipeExistingData();
        $this->call(RoleSeeder::class);

        $period = $this->createSingleActivePeriod();
        $this->seedUsersForPeriod($period);

        $this->command->info('Done. Seeded users-only dataset for 1 period.');
        $this->command->info('Admin: admin@ctms.com / password');
        $this->command->info('Dosen: dosen1@ctms.com ... dosen6@ctms.com / password');
        $this->command->info('Mahasiswa: mahasiswa1@ctms.com ... mahasiswa24@ctms.com / password');
    }

    private function wipeExistingData(): void
    {
        $tables = [
            'assessment_scores',
            'ta_defense_evaluations',
            'ta_defense_examiners',
            'ta_defense_schedules',
            'seminar_evaluations',
            'seminar_schedules',
            'student_peer_review_status',
            'peer_reviews',
            'grade_consistency_checks',
            'digital_signatures',
            'documents',
            'ta_submissions',
            'schedules',
            'evaluations',
            'group_supervisor_proposals',
            'supervisions',
            'group_members',
            'group_invitations',
            'join_requests',
            'expo_registrations',
            'expo_events',
            'bids',
            'title_approval_audits',
            'titles',
            'groups',
            'period_assessment_components',
            'period_peer_review_indicators',
            'phase_document_requirements',
            'finalization_audits',
            'notifications',
            'audit_logs',
            'period_registrations',
            'role_user',
            'users',
            'periods',
        ];

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            DB::table($table)->delete();
        }
    }

    private function createSingleActivePeriod(): Period
    {
        $now = Carbon::now();

        return Period::create([
            'name' => 'TA Seed Test '.$now->format('Y').'/'.$now->copy()->addYear()->format('Y'),
            'start_date' => $now->copy()->subWeeks(2)->toDateString(),
            'end_date' => $now->copy()->addMonths(5)->toDateString(),
            'is_active' => true,
            'is_finalized' => false,
            'allow_solo' => true,
            'min_group_size' => 3,
            'max_group_size' => 4,
            'max_supervise_load' => 6,
            'require_all_students_grouped' => true,
            'bidding_start' => $now->copy()->subDays(3),
            'bidding_end' => $now->copy()->addDays(21),
            'bidding_locked_at' => null,
            'pdc1_start' => $now->copy()->addDays(30)->toDateString(),
            'pdc1_end' => $now->copy()->addDays(45)->toDateString(),
            'pdc2_start' => $now->copy()->addDays(60)->toDateString(),
            'pdc2_end' => $now->copy()->addDays(75)->toDateString(),
            'expo_date' => $now->copy()->addDays(90)->toDateString(),
            'ta_start' => $now->copy()->addDays(95)->toDateString(),
            'ta_end' => $now->copy()->addDays(120)->toDateString(),
            'phase_dates' => [
                'bidding' => ['start' => $now->copy()->subDays(3)->toDateString(), 'end' => $now->copy()->addDays(21)->toDateString()],
                'pdc1' => ['start' => $now->copy()->addDays(30)->toDateString(), 'end' => $now->copy()->addDays(45)->toDateString()],
                'pdc2' => ['start' => $now->copy()->addDays(60)->toDateString(), 'end' => $now->copy()->addDays(75)->toDateString()],
                'expo' => ['start' => $now->copy()->addDays(90)->toDateString(), 'end' => $now->copy()->addDays(90)->toDateString()],
                'ta' => ['start' => $now->copy()->addDays(95)->toDateString(), 'end' => $now->copy()->addDays(120)->toDateString()],
            ],
        ]);
    }

    private function seedUsersForPeriod(Period $period): void
    {
        $now = Carbon::now();
        $password = Hash::make('password');
        $roleIds = Role::query()->pluck('id', 'slug');

        $users = [
            ['name' => 'Admin CTMS', 'email' => 'admin@ctms.com', 'role' => 'admin', 'nip' => 'ADM001'],
        ];

        for ($i = 1; $i <= 6; $i++) {
            $users[] = [
                'name' => "Dosen {$i}",
                'email' => "dosen{$i}@ctms.com",
                'role' => 'dosen',
                'nip' => sprintf('DSN%03d', $i),
            ];
        }

        for ($i = 1; $i <= 24; $i++) {
            $users[] = [
                'name' => "Mahasiswa {$i}",
                'email' => "mahasiswa{$i}@ctms.com",
                'role' => 'mahasiswa',
                'nim' => sprintf('2021%04d', $i),
            ];
        }

        foreach ($users as $entry) {
            $user = User::create([
                'name' => $entry['name'],
                'email' => $entry['email'],
                'password' => $password,
                'email_verified_at' => $now,
                'role' => $entry['role'],
                'nip' => $entry['nip'] ?? null,
                'nim' => $entry['nim'] ?? null,
                'is_active' => true,
            ]);

            $roleId = $roleIds->get($entry['role']);
            if ($roleId) {
                $user->roles()->sync([$roleId]);
            }

            if ($entry['role'] === 'mahasiswa') {
                DB::table('period_registrations')->insert([
                    'user_id' => $user->id,
                    'period_id' => $period->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }
}
