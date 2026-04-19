<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdditionalStudentsSeeder extends Seeder
{
    public function run(): void
    {
        $password = Hash::make('password');
        $mahasiswaRole = Role::where('slug', 'mahasiswa')->first();
        
        // Mahasiswa 21-30
        $newStudents = [];
        for ($i = 21; $i <= 30; $i++) {
            $newStudents[] = [
                'name' => "Mahasiswa $i",
                'email' => "mahasiswa$i@ctms.com",
                'nim' => sprintf('2021%04d', $i), // Pattern: 20210021 - 20210030
            ];
        }

        foreach ($newStudents as $entry) {
            // Cek apakah user sudah ada
            $existingUser = User::where('email', $entry['email'])->first();
            if ($existingUser) {
                $this->command->info("User {$entry['email']} sudah ada, skip...");
                continue;
            }

            $user = User::create([
                'name' => $entry['name'],
                'email' => $entry['email'],
                'password' => $password,
                'email_verified_at' => now(),
                'role' => 'mahasiswa',
                'nim' => $entry['nim'],
                'is_active' => true,
            ]);
            
            // Assign role
            if ($mahasiswaRole) {
                $user->roles()->sync([$mahasiswaRole->id]);
            }

            $this->command->info("Created: {$entry['name']} ({$entry['email']}) - NIM: {$entry['nim']}");
        }

        $this->command->info('Additional students (21-30) seeded successfully!');
    }
}
