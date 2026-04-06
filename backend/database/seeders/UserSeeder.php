<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();
        $password = Hash::make('password');
        $roleIds = Role::query()->pluck('id', 'slug');

        $users = [
            ['name' => 'Admin CTMS', 'email' => 'admin@ctms.com', 'role' => 'admin'],

            ['name' => 'Dr. Budi Santoso', 'email' => 'budi@ctms.com', 'role' => 'dosen'],
            ['name' => 'Dr. Siti Rahayu', 'email' => 'siti@ctms.com', 'role' => 'dosen'],
            ['name' => 'Prof. Ahmad Fauzi', 'email' => 'ahmad@ctms.com', 'role' => 'dosen'],
            ['name' => 'Dr. Dewi Kusuma', 'email' => 'dewi@ctms.com', 'role' => 'dosen'],
            ['name' => 'Dr. Rudi Hartono', 'email' => 'rudi@ctms.com', 'role' => 'dosen'],
            ['name' => 'Dr. Maya Indah', 'email' => 'maya@ctms.com', 'role' => 'dosen'],
            ['name' => 'Prof. Hendra Gunawan', 'email' => 'hendra@ctms.com', 'role' => 'dosen'],
            ['name' => 'Dr. Rina Wulandari', 'email' => 'rina@ctms.com', 'role' => 'dosen'],

            ['name' => 'Andi Wijaya', 'email' => 'andi@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Bela Permata', 'email' => 'bela@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Citra Dewi', 'email' => 'citra@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Dodi Pratama', 'email' => 'dodi@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Eva Safitri', 'email' => 'eva@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Fahmi Rizki', 'email' => 'fahmi@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Gita Nuraini', 'email' => 'gita@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Hendra Saputra', 'email' => 'hendra@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Indra Lesmana', 'email' => 'indra@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Joko Susilo', 'email' => 'joko@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Kartika Sari', 'email' => 'kartika@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Lukman Hakim', 'email' => 'lukman@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Mira Andriani', 'email' => 'mira@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Nanda Putra', 'email' => 'nanda@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Oky Firmansyah', 'email' => 'oky@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Putri Handayani', 'email' => 'putri@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Qori Ramadhan', 'email' => 'qori@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Reza Pahlevi', 'email' => 'reza@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Sari Wahyuni', 'email' => 'sari@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Tono Wibowo', 'email' => 'tono@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Udin Setiawan', 'email' => 'udin@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Vina Maharani', 'email' => 'vina@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Wawan Kurniawan', 'email' => 'wawan@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Xena Pratiwi', 'email' => 'xena@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Yoga Aditya', 'email' => 'yoga@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Zara Anindita', 'email' => 'zara@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Aldo Firmansyah', 'email' => 'aldo@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Bella Cantika', 'email' => 'bella@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Candra Wijaya', 'email' => 'candra@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Dani Saputro', 'email' => 'dani@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Eka Ratnasari', 'email' => 'eka@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Fani Kusuma', 'email' => 'fani@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Gilang Ramadhan', 'email' => 'gilang@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Hani Pratiwi', 'email' => 'hani@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Ivan Setiawan', 'email' => 'ivan@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Jaka Santoso', 'email' => 'jaka@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Kiki Amalia', 'email' => 'kiki@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Lina Marlina', 'email' => 'lina@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Miko Prasetyo', 'email' => 'miko@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Nina Susanti', 'email' => 'nina@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Omar Abdullah', 'email' => 'omar@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Pita Sanjaya', 'email' => 'pita@ctms.com', 'role' => 'mahasiswa'],
            ['name' => 'Quin Mahardhika', 'email' => 'quin@ctms.com', 'role' => 'mahasiswa'],
        ];

        foreach ($users as $entry) {
            $user = User::updateOrCreate(
                ['email' => $entry['email']],
                [
                    'name' => $entry['name'],
                    'password' => $password,
                    'email_verified_at' => $now,
                    'role' => $entry['role'],
                ]
            );

            $roleId = $roleIds->get($entry['role']);
            if ($roleId) {
                $user->roles()->sync([$roleId]);
            }

            // Assign koordinator role to specific dosen (multi-role: dosen + admin)
            if ($entry['email'] === 'rudi@ctms.com') {
                $adminRoleId = $roleIds->get('admin');
                if ($adminRoleId) {
                    $user->roles()->sync([$roleId, $adminRoleId]);
                }
            }
        }

        $this->seedPeriodRegistrations();
        $this->command->info('Seeded QA users and role mappings.');
    }

    private function seedPeriodRegistrations(): void
    {
        $periodStudents = [
            1 => [
                'andi@ctms.com', 'bela@ctms.com', 'citra@ctms.com', 'dodi@ctms.com',
                'eva@ctms.com', 'fahmi@ctms.com', 'gita@ctms.com', 'hendra@ctms.com',
                'indra@ctms.com', 'joko@ctms.com', 'kartika@ctms.com', 'lukman@ctms.com',
                'mira@ctms.com', 'nanda@ctms.com', 'oky@ctms.com', 'putri@ctms.com',
                'qori@ctms.com', 'reza@ctms.com', 'sari@ctms.com', 'tono@ctms.com',
                'udin@ctms.com', 'vina@ctms.com', 'wawan@ctms.com', 'xena@ctms.com',
                'yoga@ctms.com', 'zara@ctms.com', 'aldo@ctms.com', 'bella@ctms.com',
                'candra@ctms.com', 'dani@ctms.com', 'eka@ctms.com', 'fani@ctms.com',
                'gilang@ctms.com', 'hani@ctms.com', 'ivan@ctms.com',
            ],
            2 => ['jaka@ctms.com', 'kiki@ctms.com', 'lina@ctms.com', 'miko@ctms.com', 'nina@ctms.com'],
            3 => ['omar@ctms.com', 'pita@ctms.com', 'quin@ctms.com'],
        ];

        foreach ($periodStudents as $periodId => $emails) {
            foreach ($emails as $email) {
                $userId = User::where('email', $email)->value('id');
                if (!$userId) {
                    continue;
                }

                DB::table('period_registrations')->updateOrInsert(
                    ['user_id' => $userId, 'period_id' => $periodId],
                    ['updated_at' => now(), 'created_at' => now()]
                );
            }
        }
    }
}
