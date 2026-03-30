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
        User::updateOrCreate(
            ['email' => 'admin@ctms.com'],
            [
                'name' => 'Admin System',
                'password' => bcrypt('password'),
                'role' => 'admin',
            ]
        );

        // Dosen
        User::updateOrCreate(
            ['email' => 'dosen1@ctms.com'],
            [
                'name' => 'Dr. Lecturer One',
                'password' => bcrypt('password'),
                'role' => 'dosen',
            ]
        );

        User::updateOrCreate(
            ['email' => 'dosen2@ctms.com'],
            [
                'name' => 'Prof. Lecturer Two',
                'password' => bcrypt('password'),
                'role' => 'dosen',
            ]
        );

        // Mahasiswa
        User::updateOrCreate(
            ['email' => 'student1@ctms.com'],
            [
                'name' => 'Student One',
                'password' => bcrypt('password'),
                'role' => 'mahasiswa',
            ]
        );

        User::updateOrCreate(
            ['email' => 'student2@ctms.com'],
            [
                'name' => 'Student Two',
                'password' => bcrypt('password'),
                'role' => 'mahasiswa',
            ]
        );
    }
}
