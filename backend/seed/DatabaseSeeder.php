<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        $this->truncateAll();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $this->call([
            RoleSeeder::class,
            PeriodSeeder::class,
            UserSeeder::class,
            TitleSeeder::class,
            GroupSeeder::class,
        ]);
    }

    private function truncateAll(): void
    {
        $tables = [
            'bids', 'titles', 'group_members', 'groups',
            'period_user', 'periods', 'model_has_roles',
            'roles', 'permissions', 'model_has_permissions',
            'role_has_permissions', 'users',
        ];
        foreach ($tables as $table) {
            DB::table($table)->truncate();
        }
    }
}
