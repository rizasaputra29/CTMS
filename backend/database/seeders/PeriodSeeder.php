<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Period;

class PeriodSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Period::create([
            'name' => 'Ganjil 2025/2026',
            'start_date' => '2025-08-01',
            'end_date' => '2026-01-31',
            'phase_dates' => json_encode([
                'bidding' => ['start' => '2025-08-01', 'end' => '2025-08-15'],
                'pdc1' => ['start' => '2025-08-16', 'end' => '2025-09-15'],
                'sempro' => ['start' => '2025-09-16', 'end' => '2025-10-15'],
                'pdc2' => ['start' => '2025-10-16', 'end' => '2025-11-15'],
                'ta' => ['start' => '2025-11-16', 'end' => '2026-01-15'],
                'sidang' => ['start' => '2026-01-16', 'end' => '2026-01-31'],
            ]),
            'is_active' => true,
        ]);
    }
}
