<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'Admin', 'slug' => 'admin'],
            ['name' => 'Dosen', 'slug' => 'dosen'],
            ['name' => 'Mahasiswa', 'slug' => 'mahasiswa'],
        ];

        foreach ($roles as $role) {
            Role::query()->updateOrCreate(['slug' => $role['slug']], ['name' => $role['name']]);
        }

        $this->command->info('Seeded roles.');
    }
}
