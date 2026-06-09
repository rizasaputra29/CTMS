<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PeriodSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        DB::table('periods')->insert([
            // ─── PERIOD 1: Aktif, allow_solo = true ───────────────────────
            [
                'id' => 1,
                'name' => 'TA 2025/2026 Genap',
                'academic_year' => '2025/2026',
                'semester' => 'Genap',
                'is_active' => true,
                'is_finalized' => false,
                'bidding_open' => true,
                'bidding_locked' => false,
                'allow_solo' => true,          // ← solo seeker aktif
                'min_group_size' => 3,
                'max_group_size' => 4,
                'max_supervise_load' => 6,
                'bidding_start' => $now->copy()->subDays(10),
                'bidding_end' => $now->copy()->addDays(20),
                'registration_start' => $now->copy()->subDays(30),
                'registration_end' => $now->copy()->addDays(30),
                'created_at' => $now,
                'updated_at' => $now,
            ],

            // ─── PERIOD 2: Aktif, allow_solo = false ──────────────────────
            [
                'id' => 2,
                'name' => 'TA 2025/2026 Ganjil',
                'academic_year' => '2025/2026',
                'semester' => 'Ganjil',
                'is_active' => true,
                'is_finalized' => false,
                'bidding_open' => true,
                'bidding_locked' => false,
                'allow_solo' => false,         // ← solo seeker tidak aktif
                'min_group_size' => 3,
                'max_group_size' => 4,
                'max_supervise_load' => 6,
                'bidding_start' => $now->copy()->subDays(5),
                'bidding_end' => $now->copy()->addDays(25),
                'registration_start' => $now->copy()->subDays(20),
                'registration_end' => $now->copy()->addDays(40),
                'created_at' => $now,
                'updated_at' => $now,
            ],

            // ─── PERIOD 3: Sudah difinalisasi (historical) ────────────────
            [
                'id' => 3,
                'name' => 'TA 2024/2025 Genap',
                'academic_year' => '2024/2025',
                'semester' => 'Genap',
                'is_active' => false,
                'is_finalized' => true,
                'bidding_open' => false,
                'bidding_locked' => true,
                'allow_solo' => false,
                'min_group_size' => 3,
                'max_group_size' => 4,
                'max_supervise_load' => 6,
                'bidding_start' => $now->copy()->subMonths(6),
                'bidding_end' => $now->copy()->subMonths(5),
                'registration_start' => $now->copy()->subMonths(7),
                'registration_end' => $now->copy()->subMonths(5),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }
}
