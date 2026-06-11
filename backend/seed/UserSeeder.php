<?php

namespace Database\Seeders;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();
        $pass = Hash::make('password');

        // ════════════════════════════════════════════
        // ADMIN (1 user)
        // ════════════════════════════════════════════
        $admin = User::create([
            'name' => 'Admin CTMS',
            'email' => 'admin@ctms.com',
            'password' => $pass,
            'email_verified_at' => $now,
            'role' => 'admin',
        ]);
        $admin->assignRole('admin');

        // ════════════════════════════════════════════
        // DOSEN (8 dosen)
        // ════════════════════════════════════════════
        $dosenData = [
            ['name' => 'Dr. Budi Santoso',      'email' => 'budi@ctms.com',      'nidn' => '0001010101'],
            ['name' => 'Dr. Siti Rahayu',       'email' => 'siti@ctms.com',      'nidn' => '0001010102'],
            ['name' => 'Prof. Ahmad Fauzi',     'email' => 'ahmad@ctms.com',     'nidn' => '0001010103'],
            ['name' => 'Dr. Dewi Kusuma',       'email' => 'dewi@ctms.com',      'nidn' => '0001010104'],
            ['name' => 'Dr. Rudi Hartono',      'email' => 'rudi@ctms.com',      'nidn' => '0001010105'],
            ['name' => 'Dr. Maya Indah',        'email' => 'maya@ctms.com',      'nidn' => '0001010106'],
            ['name' => 'Prof. Hendra Gunawan',  'email' => 'hendra@ctms.com',    'nidn' => '0001010107'],
            ['name' => 'Dr. Rina Wulandari',    'email' => 'rina@ctms.com',      'nidn' => '0001010108'],
        ];

        $dosens = [];
        foreach ($dosenData as $d) {
            $user = User::create([
                'name' => $d['name'],
                'email' => $d['email'],
                'password' => $pass,
                'email_verified_at' => $now,
                'role' => 'dosen',
                'nidn' => $d['nidn'],
            ]);
            $user->assignRole('dosen');
            $dosens[$d['email']] = $user;
        }

        // ════════════════════════════════════════════
        // MAHASISWA — Period 1 (allow_solo = true)
        // ════════════════════════════════════════════

        // Grup A: READY_FOR_BIDDING, belum punya bid/propose
        $mhsP1 = [];
        $p1students = [
            // Grup A (3 org) - READY_FOR_BIDDING, idle
            ['name' => 'Andi Wijaya',       'email' => 'andi@ctms.com',    'nim' => '2021001'],
            ['name' => 'Bela Permata',      'email' => 'bela@ctms.com',    'nim' => '2021002'],
            ['name' => 'Citra Dewi',        'email' => 'citra@ctms.com',   'nim' => '2021003'],

            // Grup B (3 org) - sudah punya 1 bid PENDING
            ['name' => 'Dodi Pratama',      'email' => 'dodi@ctms.com',    'nim' => '2021004'],
            ['name' => 'Eva Safitri',       'email' => 'eva@ctms.com',     'nim' => '2021005'],
            ['name' => 'Fahmi Rizki',       'email' => 'fahmi@ctms.com',   'nim' => '2021006'],

            // Grup C (4 org) - sudah punya 3 bid (kuota penuh)
            ['name' => 'Gita Nuraini',      'email' => 'gita@ctms.com',    'nim' => '2021007'],
            ['name' => 'Hendra Saputra',    'email' => 'hendra@ctms.com',  'nim' => '2021008'],
            ['name' => 'Indra Lesmana',     'email' => 'indra@ctms.com',   'nim' => '2021009'],
            ['name' => 'Joko Susilo',       'email' => 'joko@ctms.com',    'nim' => '2021010'],

            // Grup D (3 org) - WAITING_SUPERVISOR_APPROVAL (propose)
            ['name' => 'Kartika Sari',      'email' => 'kartika@ctms.com', 'nim' => '2021011'],
            ['name' => 'Lukman Hakim',      'email' => 'lukman@ctms.com',  'nim' => '2021012'],
            ['name' => 'Mira Andriani',     'email' => 'mira@ctms.com',    'nim' => '2021013'],

            // Grup E (3 org) - proposal REJECTED, quota bebas kembali
            ['name' => 'Nanda Putra',       'email' => 'nanda@ctms.com',   'nim' => '2021014'],
            ['name' => 'Oky Firmansyah',    'email' => 'oky@ctms.com',     'nim' => '2021015'],
            ['name' => 'Putri Handayani',   'email' => 'putri@ctms.com',   'nim' => '2021016'],

            // Grup F (2 org) - FORMING (kurang anggota)
            ['name' => 'Qori Ramadhan',     'email' => 'qori@ctms.com',    'nim' => '2021017'],
            ['name' => 'Reza Pahlevi',      'email' => 'reza@ctms.com',    'nim' => '2021018'],

            // Grup G (4 org) - KELOMPOK_FINAL (bid accepted, siap finalisasi)
            ['name' => 'Sari Wahyuni',      'email' => 'sari@ctms.com',    'nim' => '2021019'],
            ['name' => 'Tono Wibowo',       'email' => 'tono@ctms.com',    'nim' => '2021020'],
            ['name' => 'Udin Setiawan',     'email' => 'udin@ctms.com',    'nim' => '2021021'],
            ['name' => 'Vina Maharani',     'email' => 'vina@ctms.com',    'nim' => '2021022'],

            // Mahasiswa ghost (tidak punya grup) - period 1
            ['name' => 'Wawan Kurniawan',   'email' => 'wawan@ctms.com',   'nim' => '2021023'],
            ['name' => 'Xena Pratiwi',      'email' => 'xena@ctms.com',    'nim' => '2021024'],
            ['name' => 'Yoga Aditya',       'email' => 'yoga@ctms.com',    'nim' => '2021025'],

            // Solo seeker A - READY_FOR_BIDDING (allow_solo=true)
            ['name' => 'Zara Anindita',     'email' => 'zara@ctms.com',    'nim' => '2021026'],

            // Solo seeker B - WAITING_SUPERVISOR_APPROVAL (propose ke dosen)
            ['name' => 'Aldo Firmansyah',   'email' => 'aldo@ctms.com',    'nim' => '2021027'],

            // Solo seeker C - TITLE_APPROVED (judul di marketplace)
            ['name' => 'Bella Cantika',     'email' => 'bella@ctms.com',   'nim' => '2021028'],

            // Solo seeker D - proposal REJECTED, quota bebas
            ['name' => 'Candra Wijaya',     'email' => 'candra@ctms.com',  'nim' => '2021029'],

            // Grup H (3 org) - ingin bid ke judul solo seeker C
            ['name' => 'Dani Saputro',      'email' => 'dani@ctms.com',    'nim' => '2021030'],
            ['name' => 'Eka Ratnasari',     'email' => 'eka@ctms.com',     'nim' => '2021031'],
            ['name' => 'Fani Kusuma',       'email' => 'fani@ctms.com',    'nim' => '2021032'],

            // Grup I (3 org, period 1) - bid ACCEPTED by dosen, siap finalisasi
            ['name' => 'Gilang Ramadhan',   'email' => 'gilang@ctms.com',  'nim' => '2021033'],
            ['name' => 'Hani Pratiwi',      'email' => 'hani@ctms.com',    'nim' => '2021034'],
            ['name' => 'Ivan Setiawan',     'email' => 'ivan@ctms.com',    'nim' => '2021035'],
        ];

        foreach ($p1students as $s) {
            $user = User::create([
                'name' => $s['name'],
                'email' => $s['email'],
                'password' => $pass,
                'email_verified_at' => $now,
                'role' => 'mahasiswa',
                'nim' => $s['nim'],
            ]);
            $user->assignRole('mahasiswa');
            $mhsP1[$s['email']] = $user;
        }

        // ════════════════════════════════════════════
        // MAHASISWA — Period 2 (allow_solo = false)
        // ════════════════════════════════════════════
        $mhsP2 = [];
        $p2students = [
            // Grup J (3 org) - period 2, READY_FOR_BIDDING
            ['name' => 'Jaka Santoso',      'email' => 'jaka@ctms.com',    'nim' => '2022001'],
            ['name' => 'Kiki Amalia',       'email' => 'kiki@ctms.com',    'nim' => '2022002'],
            ['name' => 'Lina Marlina',      'email' => 'lina@ctms.com',    'nim' => '2022003'],

            // Solo seeker period 2 - harus ditolak karena allow_solo=false
            ['name' => 'Miko Prasetyo',     'email' => 'miko@ctms.com',    'nim' => '2022004'],

            // Ghost period 2
            ['name' => 'Nina Susanti',      'email' => 'nina@ctms.com',    'nim' => '2022005'],
        ];

        foreach ($p2students as $s) {
            $user = User::create([
                'name' => $s['name'],
                'email' => $s['email'],
                'password' => $pass,
                'email_verified_at' => $now,
                'role' => 'mahasiswa',
                'nim' => $s['nim'],
            ]);
            $user->assignRole('mahasiswa');
            $mhsP2[$s['email']] = $user;
        }

        // ════════════════════════════════════════════
        // MAHASISWA — Period 3 (finalized, historical)
        // ════════════════════════════════════════════
        $p3students = [
            ['name' => 'Omar Abdullah',     'email' => 'omar@ctms.com',    'nim' => '2020001'],
            ['name' => 'Pita Sanjaya',      'email' => 'pita@ctms.com',    'nim' => '2020002'],
            ['name' => 'Quin Mahardhika',   'email' => 'quin@ctms.com',    'nim' => '2020003'],
        ];

        foreach ($p3students as $s) {
            $user = User::create([
                'name' => $s['name'],
                'email' => $s['email'],
                'password' => $pass,
                'email_verified_at' => $now,
                'role' => 'mahasiswa',
                'nim' => $s['nim'],
            ]);
            $user->assignRole('mahasiswa');
        }

        // Simpan referensi untuk dipakai GroupSeeder & TitleSeeder
        // via DB langsung karena seeder terpisah
        $this->command->info('✅ UserSeeder done — '.User::count().' users created');
    }
}
