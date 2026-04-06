<?php

namespace Database\Seeders;

use App\Models\Period;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class PeriodSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $periods = [
            [
                'id' => 1,
                'name' => 'TA 2025/2026 Genap',
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
                'id' => 2,
                'name' => 'TA 2025/2026 Ganjil',
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
            [
                'id' => 3,
                'name' => 'TA 2024/2025 Genap',
                'start_date' => $now->copy()->subMonths(12)->toDateString(),
                'end_date' => $now->copy()->subMonths(6)->toDateString(),
                'is_active' => false,
                'is_finalized' => true,
                'allow_solo' => false,
                'min_group_size' => 3,
                'max_group_size' => 4,
                'max_supervise_load' => 6,
                'require_all_students_grouped' => true,
                'bidding_start' => $now->copy()->subMonths(11),
                'bidding_end' => $now->copy()->subMonths(10),
                'bidding_locked_at' => $now->copy()->subMonths(10),
                'pdc1_start' => $now->copy()->subMonths(10)->toDateString(),
                'pdc1_end' => $now->copy()->subMonths(9)->toDateString(),
                'pdc2_start' => $now->copy()->subMonths(8)->toDateString(),
                'pdc2_end' => $now->copy()->subMonths(7)->toDateString(),
                'expo_date' => $now->copy()->subMonths(7)->toDateString(),
                'ta_start' => $now->copy()->subMonths(7)->toDateString(),
                'ta_end' => $now->copy()->subMonths(6)->toDateString(),
                'phase_dates' => [
                    'bidding' => ['start' => $now->copy()->subMonths(11)->toDateString(), 'end' => $now->copy()->subMonths(10)->toDateString()],
                    'pdc1' => ['start' => $now->copy()->subMonths(10)->toDateString(), 'end' => $now->copy()->subMonths(9)->toDateString()],
                    'pdc2' => ['start' => $now->copy()->subMonths(8)->toDateString(), 'end' => $now->copy()->subMonths(7)->toDateString()],
                    'expo' => ['start' => $now->copy()->subMonths(7)->toDateString(), 'end' => $now->copy()->subMonths(7)->toDateString()],
                    'ta' => ['start' => $now->copy()->subMonths(7)->toDateString(), 'end' => $now->copy()->subMonths(6)->toDateString()],
                ],
            ],
        ];

        foreach ($periods as $periodData) {
            Period::updateOrCreate(['id' => $periodData['id']], $periodData);
        }

        $this->command->info('Seeded periods for QA scenarios.');
    }
}
