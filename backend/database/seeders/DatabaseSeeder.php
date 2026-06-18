<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            PeriodSeeder::class,
            UserSeeder::class,
            DosenHomebaseSeeder::class,
            TitleSeeder::class,
            GroupSeeder::class,
            AssessmentComponentTemplateSeeder::class,
        ]);
    }
}
