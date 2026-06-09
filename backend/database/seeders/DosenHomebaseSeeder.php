<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DosenHomebaseSeeder extends Seeder
{
    public function run(): void
    {
        $password = Hash::make('password');
        $roleIds = Role::query()->pluck('id', 'slug');
        $dosenRoleId = $roleIds->get('dosen');

        $dosens = [
            [
                'name' => 'Prof. Dr. Adian Fatchur Rochim, S.T., M.T.',
                'email' => 'adianrochim@lecturer.undip.ac.id',
                'nip' => '197001012000011001',
            ],
            [
                'name' => 'Prof. Dr. Ir. R. Rizal Isnanto, S.T., M.M., M.T., IPU, ASEAN Eng.',
                'email' => 'rizalisnanto@lecturer.undip.ac.id',
                'nip' => '197001012000011002',
            ],
            [
                'name' => 'Dr. Maman Somantri, S.T., M.T.',
                'email' => 'mamansomantri@lecturer.undip.ac.id',
                'nip' => '197001012000011003',
            ],
            [
                'name' => 'Dr. Oky Dwi Nurhayati, S.T., M.T.',
                'email' => 'okydwinurhayati@lecturer.undip.ac.id',
                'nip' => '197001012000011004',
            ],
            [
                'name' => 'Agung Budi Prasetijo, S.T., M.I.T., Ph.D.',
                'email' => 'agungbudiprasetijo@lecturer.undip.ac.id',
                'nip' => '197001012000011005',
            ],
            [
                'name' => 'Rinta Kridalukmana, S.Kom., M.T., Ph.D.',
                'email' => 'rintakridalukmana@lecturer.undip.ac.id',
                'nip' => '197001012000011006',
            ],
            [
                'name' => 'Kuntoro Adi Nugroho, S.T., M.Eng., Ph.D.',
                'email' => 'kuntoroadinugroho@lecturer.undip.ac.id',
                'nip' => '197001012000011007',
            ],
            [
                'name' => 'Yudi Eko Windarto, S.T., M.Kom.',
                'email' => 'yudiekowindarto@lecturer.undip.ac.id',
                'nip' => '197001012000011008',
            ],
            [
                'name' => 'Dr. Delphi Hanggoro, S.T., M.T.',
                'email' => 'delphihanggoro@lecturer.undip.ac.id',
                'nip' => '197001012000011009',
            ],
            [
                'name' => 'Dania Eridani, S.T., M.Eng.',
                'email' => 'daniaeridani@lecturer.undip.ac.id',
                'nip' => '197001012000011010',
            ],
            [
                'name' => 'Ike Pertiwi Windasari, S.T., M.T.',
                'email' => 'ikepertiwiwindasari@lecturer.undip.ac.id',
                'nip' => '197001012000011011',
            ],
            [
                'name' => 'Eko Didik Widianto, S.T., M.T.',
                'email' => 'ekodidikwidianto@lecturer.undip.ac.id',
                'nip' => '197001012000011012',
            ],
            [
                'name' => 'Kurniawan Teguh Martono, S.T., M.T.',
                'email' => 'kurniawanteguhmartono@lecturer.undip.ac.id',
                'nip' => '197001012000011013',
            ],
            [
                'name' => 'Risma Septiana, S.T., M.Eng.',
                'email' => 'rismanseptiana@lecturer.undip.ac.id',
                'nip' => '197001012000011014',
            ],
            [
                'name' => 'Adnan Fauzi, S.T., M.Kom.',
                'email' => 'adnanfauzi@lecturer.undip.ac.id',
                'nip' => '197001012000011015',
            ],
            [
                'name' => 'Patricia Evericho Mountaines, S.T., M.Cs.',
                'email' => 'patriciaeverichomountaines@lecturer.undip.ac.id',
                'nip' => '197001012000011016',
            ],
            [
                'name' => 'Bellia Dwi Cahya Putri, S.T., M.T.',
                'email' => 'belliadwicahyaputri@lecturer.undip.ac.id',
                'nip' => '197001012000011017',
            ],
            [
                'name' => 'Ilmam Fauzi Hashbil Alim, S.T., M.Kom.',
                'email' => 'ilmamfauzihashbilalim@lecturer.undip.ac.id',
                'nip' => '197001012000011018',
            ],
            [
                'name' => 'Erwin Adriono, S.T., M.T.',
                'email' => 'erwinadriono@lecturer.undip.ac.id',
                'nip' => '197001012000011019',
            ],
            [
                'name' => 'Arseto Satriyo Nugroho, S.T., M.Eng.',
                'email' => 'arsetosatriyonugroho@lecturer.undip.ac.id',
                'nip' => '197001012000011020',
            ],
        ];

        foreach ($dosens as $entry) {
            $user = User::updateOrCreate(
                ['email' => $entry['email']],
                [
                    'name' => $entry['name'],
                    'password' => $password,
                    'email_verified_at' => now(),
                    'role' => 'dosen',
                    'nip' => $entry['nip'],
                    'is_active' => true,
                ]
            );

            if ($dosenRoleId) {
                $user->roles()->sync([$dosenRoleId]);
            }
        }

        $this->command->info('Seeded '.count($dosens).' dosen homebase accounts.');
    }
}
