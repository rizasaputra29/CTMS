<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Admin
        User::create([
            'name' => 'Admin System',
            'email' => 'admin@ctms.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);

        // Dosen
        User::create([
            'name' => 'Dr. Lecturer One',
            'email' => 'dosen1@ctms.com',
            'password' => bcrypt('password'),
            'role' => 'dosen',
        ]);

        User::create([
            'name' => 'Prof. Lecturer Two',
            'email' => 'dosen2@ctms.com',
            'password' => bcrypt('password'),
            'role' => 'dosen',
        ]);

        // Mahasiswa
        User::create([
            'name' => 'Student One',
            'email' => 'student1@ctms.com',
            'password' => bcrypt('password'),
            'role' => 'mahasiswa',
        ]);

        User::create([
            'name' => 'Student Two',
            'email' => 'student2@ctms.com',
            'password' => bcrypt('password'),
            'role' => 'mahasiswa',
        ]);
    }
}
