<?php

namespace Database\Seeders;

use App\Models\AssessmentComponent;
use App\Models\AssessmentComponentTemplate;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\PhaseDocumentRequirement;
use App\Models\Role;
use App\Models\Supervision;
use App\Models\Title;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class S1T26Seeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $this->command->info('Starting S1T26 seeding...');

        // 1. Create or get roles
        $dosenRole = Role::query()->firstOrCreate(['slug' => 'dosen'], ['name' => 'Dosen']);
        $mahasiswaRole = Role::query()->firstOrCreate(['slug' => 'mahasiswa'], ['name' => 'Mahasiswa']);

        // 2. Create period (always create new, with unique name)
        $baseName = 'Capstone TA S1T26';
        $name = $baseName;
        $counter = 2;
        while (Period::where('name', $name)->exists()) {
            $name = $baseName.' #'.$counter;
            $counter++;
        }

        $period = Period::create([
            'name' => $name,
            'start_date' => $now->copy()->subMonths(1)->toDateString(),
            'end_date' => $now->copy()->addMonths(6)->toDateString(),
            'is_active' => true,
            'is_finalized' => false,
            'allow_solo' => false,
            'min_group_size' => 3,
            'max_group_size' => 4,
            'max_supervise_load' => 6,
            'max_supervisor_load' => 6,
            'require_all_students_grouped' => true,
            'bidding_start' => $now->copy()->subDays(5),
            'bidding_end' => $now->copy()->addDays(25),
            'bidding_reminder_at' => null,
            'pdc1_start' => $now->copy()->addDays(30)->toDateString(),
            'pdc1_end' => $now->copy()->addDays(45)->toDateString(),
            'pdc1_reminder_at' => null,
            'pdc2_start' => $now->copy()->addDays(60)->toDateString(),
            'pdc2_end' => $now->copy()->addDays(80)->toDateString(),
            'pdc2_reminder_at' => null,
            'expo_date' => $now->copy()->addDays(90)->toDateString(),
            'expo_reminder_at' => null,
            'ta_start' => $now->copy()->addDays(95)->toDateString(),
            'ta_end' => $now->copy()->addDays(120)->toDateString(),
            'ta_reminder_at' => null,
            'grade_configuration' => json_encode([
                'pdc1' => ['SEMPRO' => 50, 'BIMBINGAN_SEMPRO' => 50],
                'pdc2' => ['NILAI_DOSEN' => 25, 'MILESTONE' => 25, 'EXPO' => 25, 'PEER_REVIEW' => 25],
                'ta' => ['BIMBINGAN_TA' => 50, 'SIDANG_TA' => 50],
            ]),
            'phase_dates' => json_encode([
                'bidding' => ['start' => $now->copy()->subDays(5)->toDateString(), 'end' => $now->copy()->addDays(25)->toDateString()],
                'pdc1' => ['start' => $now->copy()->addDays(30)->toDateString(), 'end' => $now->copy()->addDays(45)->toDateString()],
                'pdc2' => ['start' => $now->copy()->addDays(60)->toDateString(), 'end' => $now->copy()->addDays(80)->toDateString()],
                'expo' => ['start' => $now->copy()->addDays(90)->toDateString(), 'end' => $now->copy()->addDays(90)->toDateString()],
                'ta' => ['start' => $now->copy()->addDays(95)->toDateString(), 'end' => $now->copy()->addDays(120)->toDateString()],
            ]),
        ]);

        $periodId = $period->id;
        $this->command->info("Period S1T26 created/updated with ID: {$periodId}");

        // 3. Seed dosen
        $dosenData = [
            ['code' => 'AFR', 'name' => 'Prof. Dr. Adian Fatchur Rochim, S.T., M.T.', 'email' => 'adian.fatchur.rochim@sicata.com', 'keahlian' => 'Jaringan Komputer Cerdas dan Sciencetometrics'],
            ['code' => 'RZI', 'name' => 'Prof. Dr. Ir. R. Rizal Isnanto, S.T., M.M., M.T., IPU, ASEAN Eng.', 'email' => 'rizal.isnanto@sicata.com', 'keahlian' => 'Pengolahan Citra'],
            ['code' => 'MMS', 'name' => 'Dr. Maman Somantri, S.T., M.T.', 'email' => 'maman.somantri@sicata.com', 'keahlian' => 'Internet of Things dan WSN, Perencanaan dan Audit SI/TI, Kecerdasan Buatan, Teknologi Informasi, Sensor Cerdas'],
            ['code' => 'ODN', 'name' => 'Dr. Oky Dwi Nurhayati, S.T., M.T.', 'email' => 'oky.dwi.nurhayati@sicata.com', 'keahlian' => 'Multimedia, Kecerdasan Buatan'],
            ['code' => 'ABP', 'name' => 'Agung Budi Prasetijo, S.T., M.I.T., Ph.D.', 'email' => 'agung.budi.prasetijo@sicata.com', 'keahlian' => 'Kecerdasan Buatan, Internet of Things dan WSN'],
            ['code' => 'RKL', 'name' => 'Rinta Kridalukmana, S.Kom., M.T., Ph.D.', 'email' => 'rinta.kridalukmana@sicata.com', 'keahlian' => 'Sensor Cerdas'],
            ['code' => 'KAN', 'name' => 'Kuntoro Adi Nugroho, S.T., M.Eng., Ph.D.', 'email' => 'kuntoro.adi.nugroho@sicata.com', 'keahlian' => 'Kecerdasan Buatan'],
            ['code' => 'YEW', 'name' => 'Yudi Eko Windarto, S.T., M.Kom.', 'email' => 'yudi.eko.windarto@sicata.com', 'keahlian' => 'Kecerdasan Buatan, Teknologi Informasi'],
            ['code' => 'DHG', 'name' => 'Dr. Delphi Hanggoro, S.T., M.T.', 'email' => 'delphi.hanggoro@sicata.com', 'keahlian' => 'Internet of Things dan WSN'],
            ['code' => 'DED', 'name' => 'Dania Eridani, S.T., M.Eng.', 'email' => 'dania.eridani@sicata.com', 'keahlian' => 'Sensor Cerdas'],
            ['code' => 'IPW', 'name' => 'Ike Pertiwi Windasari, S.T., M.T.', 'email' => 'ike.pertiwi.windasari@sicata.com', 'keahlian' => 'Teknologi Informasi'],
            ['code' => 'EDW', 'name' => 'Eko Didik Widianto, S.T., M.T.', 'email' => 'eko.didik.widianto@sicata.com', 'keahlian' => 'Sensor Cerdas, Teknik Komputasi'],
            ['code' => 'KTM', 'name' => 'Kurniawan Teguh Martono, S.T., M.T.', 'email' => 'kurniawan.teguh.martono@sicata.com', 'keahlian' => 'Augmented Reality dan Virtual Reality, Kecerdasan Buatan'],
            ['code' => 'ADF', 'name' => 'Adnan Fauzi, S.T., M.Kom.', 'email' => 'adnan.fauzi@sicata.com', 'keahlian' => 'Keamanan Jaringan Komputer dan Sistem Informasi'],
            ['code' => 'PEM', 'name' => 'Patricia Evericho Mountaines, S.T., M.Cs.', 'email' => 'patricia.evericho.mountaines@sicata.com', 'keahlian' => 'Human Machine System dan Situation Awareness'],
            ['code' => 'BDC', 'name' => 'Bellia Dwi Cahya Putri, S.T., M.T.', 'email' => 'bellia.dwi.cahya@sicata.com', 'keahlian' => 'Keamanan Jaringan Komputer dan Sistem Informasi, Teknologi Informasi'],
            ['code' => 'IFH', 'name' => 'Ilmam Fauzi Hashbil Alim, S.T., M.Kom.', 'email' => 'ilmam.fauzi.hashbil@sicata.com', 'keahlian' => 'Renewable Technology, Teknologi Informasi'],
            ['code' => 'ERA', 'name' => 'Erwin Adriono, S.T., M.T.', 'email' => 'erwin.adriono@sicata.com', 'keahlian' => 'Internet of Things dan WSN'],
            ['code' => 'ASN', 'name' => 'Arseto Satriyo Nugroho, S.T., M.Eng.', 'email' => 'arseto.satriyo.nugroho@sicata.com', 'keahlian' => 'Teknologi Informasi, Renewable Technology'],
        ];

        $dosenByCode = [];
        foreach ($dosenData as $dosen) {
            $user = User::updateOrCreate(
                ['email' => $dosen['email']],
                [
                    'name' => $dosen['name'],
                    'password' => Hash::make('password'),
                    'email_verified_at' => $now,
                    'role' => 'dosen',
                    'nip' => null,
                    'nim' => null,
                    'is_active' => true,
                ]
            );
            $user->roles()->sync([$dosenRole->id]);
            $dosenByCode[$dosen['code']] = $user->id;
        }

        $this->command->info('Seeded '.count($dosenData).' dosen users.');

        // 4. Seed mahasiswa
        $mahasiswaData = $this->getMahasiswaData();
        $mahasiswaByNim = [];
        foreach ($mahasiswaData as $mhs) {
            $user = User::updateOrCreate(
                ['email' => $mhs['sso_email']],
                [
                    'name' => $mhs['name'],
                    'password' => Hash::make($mhs['nim']),
                    'email_verified_at' => $now,
                    'role' => 'mahasiswa',
                    'nip' => null,
                    'nim' => $mhs['nim'],
                    'is_active' => true,
                ]
            );
            $user->roles()->sync([$mahasiswaRole->id]);
            $mahasiswaByNim[$mhs['nim']] = $user->id;
        }

        $this->command->info('Seeded '.count($mahasiswaData).' mahasiswa users.');

        // 5. Period registrations
        foreach ($mahasiswaByNim as $nim => $userId) {
            DB::table('period_registrations')->updateOrInsert(
                ['user_id' => $userId, 'period_id' => $periodId],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }
        $this->command->info('Seeded period registrations.');

        // Ensure admin user exists for supervision assignments
        $adminUser = User::where('email', 'admin@ctms.com')->first();
        if (! $adminUser) {
            $adminUser = User::updateOrCreate(
                ['email' => 'admin@ctms.com'],
                [
                    'name' => 'Admin CTMS',
                    'password' => Hash::make('password'),
                    'email_verified_at' => $now,
                    'role' => 'admin',
                    'nip' => null,
                    'nim' => null,
                    'is_active' => true,
                ]
            );
            $adminRole = Role::query()->firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);
            $adminUser->roles()->sync([$adminRole->id]);
        }
        $adminUserId = $adminUser->id;

        // 6. Seed groups and titles
        $groupsData = $this->getGroupsData();
        $titleOffset = 0;

        foreach ($groupsData as $groupData) {
            $hasTitle = ! in_array(mb_strtolower(trim($groupData['title'])), ['belum ada judul', '', '-'], true);
            $status = $hasTitle ? 'KELOMPOK_FINAL' : 'READY_FOR_BIDDING';

            $s1Id = $dosenByCode[$groupData['supervisor_1']] ?? null;
            $s2Id = $dosenByCode[$groupData['supervisor_2']] ?? null;

            $titleId = null;
            if ($hasTitle) {
                $titleOffset++;
                $title = Title::updateOrCreate(
                    [
                        'title' => $groupData['title'],
                        'lecturer_id' => $s1Id,
                        'period_id' => $periodId,
                    ],
                    [
                        'quota' => 1,
                        'status' => 'CLOSED',
                        'approved_by_admin' => true,
                        'title_source' => 'LECTURER',
                        'description' => $groupData['title'],
                        'problem_statement' => null,
                        'scope' => null,
                        'specializations' => null,
                        'proposed_by_group_id' => null,
                        'proposed_supervisor_id' => null,
                        'supervisor_approval_status' => null,
                        'rejection_reason' => null,
                    ]
                );
                $titleId = $title->id;
            } else {
                $placeholderTitle = Title::updateOrCreate(
                    [
                        'title' => 'tanpa judul, silahkan kontak administrator untuk melakukan update',
                        'lecturer_id' => $s1Id,
                        'period_id' => $periodId,
                    ],
                    [
                        'quota' => 1,
                        'status' => 'CLOSED',
                        'approved_by_admin' => true,
                        'title_source' => 'LECTURER',
                        'description' => 'Placeholder judul. Mahasiswa harus menghubungi admin untuk update judul.',
                        'problem_statement' => null,
                        'scope' => null,
                        'specializations' => null,
                        'proposed_by_group_id' => null,
                        'proposed_supervisor_id' => null,
                        'supervisor_approval_status' => null,
                        'rejection_reason' => null,
                    ]
                );
                $titleId = $placeholderTitle->id;
            }

            $group = Group::updateOrCreate(
                [
                    'period_id' => $periodId,
                    'code' => 'S1T26-'.str_pad((string) $groupData['number'], 2, '0', STR_PAD_LEFT),
                ],
                [
                    'status' => $status,
                    'group_mode' => 'GROUP',
                    'is_solo' => false,
                    'has_existing_group' => true,
                    'has_active_proposal' => false,
                    'title_id' => $titleId,
                    'supervisor_1_id' => $s1Id,
                    'supervisor_2_id' => $s2Id,
                    'assignment_type' => $hasTitle ? 'DIRECT' : null,
                ]
            );

            // Create group members
            $groupMemberIds = [];
            foreach ($groupData['members'] as $idx => $member) {
                $studentId = $mahasiswaByNim[$member['nim']] ?? null;
                if (! $studentId) {
                    $this->command->warn("Student NIM {$member['nim']} not found.");
                    continue;
                }

                GroupMember::updateOrCreate(
                    ['group_id' => $group->id, 'student_id' => $studentId],
                    ['period_id' => $periodId, 'is_leader' => $idx === 0]
                );
                $groupMemberIds[] = $studentId;
            }

            // Cleanup old members not in current list
            GroupMember::query()
                ->where('group_id', $group->id)
                ->whereNotIn('student_id', $groupMemberIds)
                ->delete();

            // Create supervisions
            if ($s1Id) {
                Supervision::updateOrCreate(
                    ['group_id' => $group->id, 'role' => 'SUPERVISOR_1'],
                    ['supervisor_id' => $s1Id, 'assigned_by' => $adminUserId]
                );
            }
            if ($s2Id) {
                Supervision::updateOrCreate(
                    ['group_id' => $group->id, 'role' => 'SUPERVISOR_2'],
                    ['supervisor_id' => $s2Id, 'assigned_by' => $adminUserId]
                );
            }
        }

        $this->command->info('S1T26 seeding completed successfully!');

        // 7. Seed phase document requirements for this period
        $this->seedPhaseDocumentRequirements($periodId, $now);

        // 8. Seed assessment components (legacy) for this period
        $this->seedAssessmentComponents($periodId, $now);
    }

    private function getMahasiswaData(): array
    {
        return [
            ['nim' => '21120123120038', 'name' => 'Dimas Agus Saputra', 'sso_email' => 'dimasagussaputra@students.undip.ac.id'],
            ['nim' => '21120123140171', 'name' => 'A Faidhullah Farros Basykailakh', 'sso_email' => 'ahmadfarros@students.undip.ac.id'],
            ['nim' => '21120123140143', 'name' => 'Yudha Indra Praja', 'sso_email' => 'yudhaindrap@students.undip.ac.id'],
            ['nim' => '21120123130100', 'name' => 'Ryan Sukma Purwojanarko', 'sso_email' => 'ryansukma@students.undip.ac.id'],
            ['nim' => '21120123120012', 'name' => 'Sekar Mitayani', 'sso_email' => 'sekarmitayani@students.undip.ac.id'],
            ['nim' => '21120123120020', 'name' => 'Celino Matande Wardana', 'sso_email' => 'celinomatandewardana@students.undip.ac.id'],
            ['nim' => '21120123130107', 'name' => 'Jaziel Abyaz Audrio', 'sso_email' => 'jazielaudrio@students.undip.ac.id'],
            ['nim' => '21120123120022', 'name' => 'Fadia Nur Fatimah', 'sso_email' => 'fadianf@students.undip.ac.id'],
            ['nim' => '21120123140048', 'name' => 'Rafi Nur Ardiansyah', 'sso_email' => 'rafinurardiansyah@students.undip.ac.id'],
            ['nim' => '21120123140056', 'name' => 'Faiza Tanjia', 'sso_email' => 'faizatanjia@students.undip.ac.id'],
            ['nim' => '21120123140176', 'name' => 'Cetta Masinda Amany', 'sso_email' => 'cettamasindaamany@students.undip.ac.id'],
            ['nim' => '21120123140136', 'name' => 'Elvina Nasywa Ariyani', 'sso_email' => 'elvinasywariyani@students.undip.ac.id'],
            ['nim' => '21120123140141', 'name' => 'Andhinee Chlarissa Tanassale', 'sso_email' => 'andhineetigabelas@students.undip.ac.id'],
            ['nim' => '21120123140146', 'name' => 'M. Azyan Naufan Rosada', 'sso_email' => 'azyannaufan@students.undip.ac.id'],
            ['nim' => '21120123120014', 'name' => 'Althaf Muhammad Taftazani', 'sso_email' => 'althafmuhammad@students.undip.ac.id'],
            ['nim' => '21120123120010', 'name' => 'Izac Luthfi Pranowo', 'sso_email' => 'izacluthfipranowo@students.undip.ac.id'],
            ['nim' => '21120123120018', 'name' => 'Dhinda Cahya Ramadhani', 'sso_email' => 'dhindachyaa@students.undip.ac.id'],
            ['nim' => '21120123120007', 'name' => 'Rafael Ardiansyah', 'sso_email' => 'rafaelardiansyah@students.undip.ac.id'],
            ['nim' => '21120123120027', 'name' => 'Lady Triana Surbakti', 'sso_email' => 'ladytrianasurbakti@students.undip.ac.id'],
            ['nim' => '21120123130096', 'name' => 'Damai Raya Fakhruddin', 'sso_email' => 'damairayafakhruddin@students.undip.ac.id'],
            ['nim' => '21120123140058', 'name' => 'Sabiq Habiburrahman Zarkasi', 'sso_email' => 'sabiqhabiburrahmanz@students.undip.ac.id'],
            ['nim' => '21120123130101', 'name' => "Farrel Alfat'han", 'sso_email' => 'farrelalfathan0305@students.undip.ac.id'],
            ['nim' => '21120123140165', 'name' => 'Rahmadian Setyo Purnomo', 'sso_email' => 'rahmadiansp234@students.undip.ac.id'],
            ['nim' => '21120123140157', 'name' => 'Muhammad Ardan Fadli', 'sso_email' => 'muhardanfadli@students.undip.ac.id'],
            ['nim' => '21120123140130', 'name' => 'Josh Frederich Irawady', 'sso_email' => 'joshfrederichirawady@students.undip.ac.id'],
            ['nim' => '21120123140045', 'name' => 'Awallin Yusuf Ikrar Putra', 'sso_email' => 'awallinyusufikrarput@students.undip.ac.id'],
            ['nim' => '21120123120004', 'name' => 'Radhito Pramudya Adrie', 'sso_email' => 'radhitopramudyaadrie@students.undip.ac.id'],
            ['nim' => '21120123140116', 'name' => 'Ezar Hardin Wiratama', 'sso_email' => 'ezarhardin@students.undip.ac.id'],
            ['nim' => '21120123130085', 'name' => 'Redista Rakha Izza', 'sso_email' => 'redistarakhaizza@students.undip.ac.id'],
            ['nim' => '21120123130073', 'name' => 'Rafi Rai Pasha Afandi', 'sso_email' => 'rafiraipasha@students.undip.ac.id'],
            ['nim' => '21120123130065', 'name' => 'Arga Mulyana Saputra', 'sso_email' => 'argamulyanasaputra@students.undip.ac.id'],
            ['nim' => '21120123130062', 'name' => 'Caesar Deva Irfan Putra', 'sso_email' => 'caesardevairfanputra@students.undip.ac.id'],
            ['nim' => '21120123140138', 'name' => 'Faiz Abdul Hanif', 'sso_email' => 'faizabdulhanif@students.undip.ac.id'],
            ['nim' => '21120123130088', 'name' => 'Rhea Alya Khaerunnisa', 'sso_email' => 'rheaalya@students.undip.ac.id'],
            ['nim' => '21120123130080', 'name' => 'Anisa Anastasya', 'sso_email' => 'anisaanastasya@students.undip.ac.id'],
            ['nim' => '21120123140114', 'name' => 'Arrasyid Atma Wijaya', 'sso_email' => 'atmawijaya@students.undip.ac.id'],
            ['nim' => '21120123120024', 'name' => 'Defdava Anandhia Haryadi', 'sso_email' => 'defdavaanandhiaharya@students.undip.ac.id'],
            ['nim' => '21120123120031', 'name' => 'Justin Advani', 'sso_email' => 'justinadvani@students.undip.ac.id'],
            ['nim' => '21120123140175', 'name' => 'Iqbal Ghifari', 'sso_email' => 'iqbalghifari@students.undip.ac.id'],
            ['nim' => '21120123140181', 'name' => 'Muhammad Farhan Efendi', 'sso_email' => 'muhammadfarhanefendi@students.undip.ac.id'],
            ['nim' => '21120123140167', 'name' => 'Howard Amadeus Tjong', 'sso_email' => 'howardamadeus@students.undip.ac.id'],
            ['nim' => '21120123130053', 'name' => 'Rayvan Bayu Abhinowo', 'sso_email' => 'rayvanbayu@students.undip.ac.id'],
            ['nim' => '21120123130067', 'name' => 'Essa Bintang Nur Athallah', 'sso_email' => 'essabintang@students.undip.ac.id'],
            ['nim' => '21120123120032', 'name' => 'Sultan Alexander Sarumpaet', 'sso_email' => 'sultanalexanders@students.undip.ac.id'],
            ['nim' => '21120123120021', 'name' => 'Hanum Jati Rahmaningrum', 'sso_email' => 'hanumjati@students.undip.ac.id'],
            ['nim' => '21120123120033', 'name' => 'Vira Nurul Hayati', 'sso_email' => 'viranurulhayati@students.undip.ac.id'],
            ['nim' => '21120123140159', 'name' => 'Nayla Widya Shafira', 'sso_email' => 'naylawidyashafira@students.undip.ac.id'],
            ['nim' => '21120123120036', 'name' => 'Rafie Waldan Valerie', 'sso_email' => 'rafiewaldanvalerie@students.undip.ac.id'],
            ['nim' => '21120123130057', 'name' => 'Zulfa Salsabila', 'sso_email' => 'zulfasalsa@students.undip.ac.id'],
            ['nim' => '21120123130060', 'name' => 'Salsabila Luthfiyani', 'sso_email' => 'salsabilaluthfiyani@students.undip.ac.id'],
            ['nim' => '21120123120034', 'name' => 'Mustofa Ahmad Rusli', 'sso_email' => 'mustofaahmadrusli@students.undip.ac.id'],
            ['nim' => '21120123120035', 'name' => 'Azzam Syaiful Islam', 'sso_email' => 'azzamsyaifulislam@students.undip.ac.id'],
            ['nim' => '21120123120023', 'name' => 'Nandito Adi Syahputra', 'sso_email' => 'nanditoadisyahputra@students.undip.ac.id'],
            ['nim' => '21120123130061', 'name' => 'Muhammad Danial Irfani', 'sso_email' => 'irfanimuhammad@students.undip.ac.id'],
            ['nim' => '21120123140108', 'name' => 'Farrel Razaan Rabbani', 'sso_email' => 'farrelrazaanrabbani@students.undip.ac.id'],
            ['nim' => '21120123140160', 'name' => 'Izzat Farras Albar', 'sso_email' => 'izzatfarrasalbar@students.undip.ac.id'],
            ['nim' => '21120123140184', 'name' => 'Muhammad Bintang Al Harits', 'sso_email' => 'bintanghrts@students.undip.ac.id'],
            ['nim' => '21120123140150', 'name' => 'Wan Azka Khairi Muhammad', 'sso_email' => 'wanazkakhairimuhamma@students.undip.ac.id'],
            ['nim' => '21120123130087', 'name' => 'Nathanael Rico Setiawan', 'sso_email' => 'nathanaelrico@students.undip.ac.id'],
            ['nim' => '21120123130076', 'name' => 'Nicola Adhi Pratama', 'sso_email' => 'nicolaadhi@students.undip.ac.id'],
            ['nim' => '21120123120001', 'name' => 'Darren Nathanael Melakha', 'sso_email' => 'melakha@students.undip.ac.id'],
            ['nim' => '21120123130072', 'name' => 'Sekar Bestari Nindita Yasmin', 'sso_email' => 'sekarbestariny@students.undip.ac.id'],
            ['nim' => '21120123130051', 'name' => 'Syafik Barda', 'sso_email' => 'syafikbarda@students.undip.ac.id'],
            ['nim' => '21120123120011', 'name' => 'Bambang Irawan', 'sso_email' => 'bambangirawan@students.undip.ac.id'],
            ['nim' => '21120123120002', 'name' => 'Farrell Farros Fausto', 'sso_email' => 'farrellfausto@students.undip.ac.id'],
            ['nim' => '21120123140145', 'name' => 'Jasmine Saputra', 'sso_email' => 'jasminesaputra@students.undip.ac.id'],
            ['nim' => '21120123130094', 'name' => 'Muhammad Hafiizh Prasetiaan', 'sso_email' => 'muhammadhafiizh05@students.undip.ac.id'],
            ['nim' => '21120123120013', 'name' => 'Ananda Prida Yusuf Septiawan', 'sso_email' => 'anandaprida@students.undip.ac.id'],
            ['nim' => '21120123120040', 'name' => 'Fayyadh Muhammad Habibie', 'sso_email' => 'fayyadhhabibie@students.undip.ac.id'],
            ['nim' => '21120123140117', 'name' => 'Muhammad Riza Saputra', 'sso_email' => 'muhammadrizasaputra@students.undip.ac.id'],
            ['nim' => '21120123120006', 'name' => 'Yosua Kevan Unggul Budihardjo', 'sso_email' => 'yosuakevan@students.undip.ac.id'],
            ['nim' => '21120123130091', 'name' => 'Rajwa Vourza Tsaqifa', 'sso_email' => 'rajwavour@students.undip.ac.id'],
            ['nim' => '21120123130054', 'name' => 'Daris Muhammad Ilham', 'sso_email' => 'darismuhammadilham@students.undip.ac.id'],
            ['nim' => '21120123120005', 'name' => 'Naila Azizah Berliani', 'sso_email' => 'nailazza@students.undip.ac.id'],
            ['nim' => '21120123140154', 'name' => 'Syasha Chikal Aldila', 'sso_email' => 'syashachikalaldila@students.undip.ac.id'],
            ['nim' => '21120123140173', 'name' => 'Fawnia Belvandrya Naira Aqla', 'sso_email' => 'fawniabelva@students.undip.ac.id'],
            ['nim' => '21120123120028', 'name' => 'Gibson Lasoni Gea', 'sso_email' => 'gibsongea@students.undip.ac.id'],
            ['nim' => '21120123140133', 'name' => 'Muhammad Fadly Evanto Prabowo', 'sso_email' => 'muhammadfadlyevantop@students.undip.ac.id'],
            ['nim' => '21120123140151', 'name' => 'Muhammad Romeo Raffael', 'sso_email' => 'muhammadromeoraffael@students.undip.ac.id'],
            ['nim' => '21120123140043', 'name' => 'Gyda Marva Adriono', 'sso_email' => 'gydaadriono@students.undip.ac.id'],
            ['nim' => '21120123130111', 'name' => 'Muhammad Arif Maulana', 'sso_email' => 'redzzaddict@students.undip.ac.id'],
            ['nim' => '21120123130075', 'name' => 'Gavrila Samana Ahmad', 'sso_email' => 'gavrilasa@students.undip.ac.id'],
            ['nim' => '21120123140144', 'name' => 'Putri Bilqis Nasywa A', 'sso_email' => 'putribilqisnasywaari@students.undip.ac.id'],
            ['nim' => '21120123140153', 'name' => 'Yasmin Dini Akmila P', 'sso_email' => 'yasminakmila@students.undip.ac.id'],
            ['nim' => '21120123130071', 'name' => 'Desca Rahma Kholisa', 'sso_email' => 'descarahmakholisa@students.undip.ac.id'],
            ['nim' => '21120123140168', 'name' => 'Riyarakhma Febriana', 'sso_email' => 'riyarakhmafebriana@students.undip.ac.id'],
            ['nim' => '21120123140139', 'name' => 'Aufa Ika Paramesti', 'sso_email' => 'aufaikaparamesti@students.undip.ac.id'],
            ['nim' => '21120123120030', 'name' => 'Carlos Abram Sirait', 'sso_email' => 'carlos@students.undip.ac.id'],
            ['nim' => '21120123140142', 'name' => 'Fajar Herdiansyah', 'sso_email' => 'fajar85@students.undip.ac.id'],
            ['nim' => '21120123130049', 'name' => 'Saiful Mustofa', 'sso_email' => 'saifulmustf@students.undip.ac.id'],
            ['nim' => '21120123120009', 'name' => 'Marsel Muleri', 'sso_email' => 'marselmuleri@students.undip.ac.id'],
            ['nim' => '21120123120037', 'name' => 'Muhammad Abdul Majid', 'sso_email' => 'muhammadabdulmajid19@students.undip.ac.id'],
            ['nim' => '21120123130069', 'name' => 'Muhammad Rafi Athallah', 'sso_email' => 'mhmmdrafiath@students.undip.ac.id'],
            ['nim' => '21120123130068', 'name' => 'Dzaki Eka Atmaja', 'sso_email' => 'dzakiekaatmaja@students.undip.ac.id'],
            ['nim' => '21120123130086', 'name' => 'Evan Adkara Christian Putra', 'sso_email' => 'evanadkarachristianp@students.undip.ac.id'],
            ['nim' => '21120123120029', 'name' => 'Bimo Kusumo Putro Wicaksono', 'sso_email' => 'bimokusumoputrowicak@students.undip.ac.id'],
            ['nim' => '21120123140121', 'name' => 'Nabil Bintang Ardiansyah Purwanto', 'sso_email' => 'nabilbintang@students.undip.ac.id'],
            ['nim' => '21120123140132', 'name' => 'Dervarlo Rahadyan Razan', 'sso_email' => 'devarlorahadyanrazan@students.undip.ac.id'],
            ['nim' => '21120123140126', 'name' => 'Muhamad Reswara Suryawan', 'sso_email' => 'reswarasuryawan@students.undip.ac.id'],
            ['nim' => '21120123140135', 'name' => 'Surya hari putra', 'sso_email' => 'suryahariputra@students.undip.ac.id'],
            ['nim' => '21120123140180', 'name' => 'Syahbana Hatab', 'sso_email' => 'syahbanahatab@students.undip.ac.id'],
            ['nim' => '21120123130099', 'name' => 'Falahafizh Razzaqi Vio Aldira', 'sso_email' => 'vioaldira@students.undip.ac.id'],
            ['nim' => '21120123120015', 'name' => 'Revo Risky Pratama', 'sso_email' => 'pratama48@students.undip.ac.id'],
            ['nim' => '21120123120041', 'name' => 'Aisyah Aulia Azzahra Putri', 'sso_email' => 'aisyahauliaazzahrapu@students.undip.ac.id'],
            ['nim' => '21120123130084', 'name' => 'Ainaya Zahra Putridiyanti', 'sso_email' => 'ayyaazzahra@students.undip.ac.id'],
            ['nim' => '21120123130098', 'name' => 'Kevin Ilham Ramadhan', 'sso_email' => 'kevinir@students.undip.ac.id'],
            ['nim' => '21120123140113', 'name' => 'Nicholas Anindya Dinata', 'sso_email' => 'nicholasdinata@students.undip.ac.id'],
            ['nim' => '21120123140178', 'name' => 'Aqila Niam Faza', 'sso_email' => 'aqilafazaid@students.undip.ac.id'],
            ['nim' => '21120123130079', 'name' => "M. Adnan Abdu Rafi'a", 'sso_email' => 'madnanrafia@students.undip.ac.id'],
            ['nim' => '21120123140125', 'name' => 'Muhammad Azka Wijasena', 'sso_email' => 'viberoptic@students.undip.ac.id'],
            ['nim' => '21120123130078', 'name' => 'Hasna Auliannisa Wahono', 'sso_email' => 'hasnaauliannisa@students.undip.ac.id'],
            ['nim' => '21120123140123', 'name' => "M. Ma'ruf Sabili Riziq", 'sso_email' => 'mmarufsabiliriziq@students.undip.ac.id'],
            ['nim' => '21120123140044', 'name' => 'Salsabila Diva', 'sso_email' => 'salsabiladiva@students.undip.ac.id'],
            ['nim' => '21120123130104', 'name' => 'Bima Saputra Aji', 'sso_email' => 'bimasaputraaji@students.undip.ac.id'],
            ['nim' => '21120123130089', 'name' => 'Endika Aryandhi', 'sso_email' => 'endikaaryandhi@students.undip.ac.id'],
            ['nim' => '21120123140055', 'name' => 'Hanif Fikri Irfansyah', 'sso_email' => 'haniffikriirfansyah@students.undip.ac.id'],
            ['nim' => '21120123140166', 'name' => 'Maulana Yusuf Muhammad', 'sso_email' => 'mlnyusufm@students.undip.ac.id'],
            ['nim' => '21120123120025', 'name' => 'Nabilah Brina Assyifa', 'sso_email' => 'nabilahbrinaassyifa@students.undip.ac.id'],
            ['nim' => '21120123120008', 'name' => 'Okfan Subekti', 'sso_email' => 'okfansubekti@students.undip.ac.id'],
            ['nim' => '21120123120026', 'name' => 'Ananda Dwiki Bayu Widiatama', 'sso_email' => 'anandadwiki@students.undip.ac.id'],
            ['nim' => '21120123130092', 'name' => 'Cielo Reksana Jaya', 'sso_email' => 'cieloreksanajaya@students.undip.ac.id'],
            ['nim' => '21120123130109', 'name' => 'Naufal Labib Nugroho', 'sso_email' => 'bibbb@students.undip.ac.id'],
            ['nim' => '21120123130102', 'name' => 'Radja Fisabililah', 'sso_email' => 'radjafisabilillah@students.undip.ac.id'],
            ['nim' => '21120123140155', 'name' => "Hasnaa' Amalia Qurratu'aini", 'sso_email' => 'hasnaaamalia@students.undip.ac.id'],
            ['nim' => '21120123140149', 'name' => 'Insani Amalia Riarta', 'sso_email' => 'insaniamalia@students.undip.ac.id'],
            ['nim' => '21120123140156', 'name' => 'Laurentcia Dormauli Harianja', 'sso_email' => 'laurentciaharianja@students.undip.ac.id'],
            ['nim' => '21120123120017', 'name' => 'Batis Satriani Omar Ramadhan', 'sso_email' => 'batissatriani@students.undip.ac.id'],
            ['nim' => '21120123120039', 'name' => 'Farhan Nasrullah', 'sso_email' => 'farhannasrullah@students.undip.ac.id'],
            ['nim' => '21120123140137', 'name' => 'Ian Widi Antaressa', 'sso_email' => 'ianwidiantaressa@students.undip.ac.id'],
            ['nim' => '21120123140148', 'name' => 'Hafizh Ridha Putra Wijaya', 'sso_email' => 'hafizhridhapw@students.undip.ac.id'],
            ['nim' => '21120123130081', 'name' => 'Muhammad Nur Rizky Putro Haryono', 'sso_email' => 'muhammadnurrizky@students.undip.ac.id'],
            ['nim' => '21120123130082', 'name' => 'Nevin Aldora Kayana', 'sso_email' => 'nevinaldorakayana@students.undip.ac.id'],
            ['nim' => '21120123140124', 'name' => 'Asrofi Anam Mahendra', 'sso_email' => 'asrofianammahendra@students.undip.ac.id'],
            ['nim' => '21120121140163', 'name' => 'Andrew Yehezkiel', 'sso_email' => 'andrewy@students.undip.ac.id'],
            ['nim' => '21120123130083', 'name' => 'Akmal Fadli Sifa', 'sso_email' => 'akmalfadli@students.undip.ac.id'],
            ['nim' => '21120121140097', 'name' => 'Arradhin Zidan Ilyasa Subiyantoro', 'sso_email' => 'arradhingoestozidan@students.undip.ac.id'],
            ['nim' => '21120123140122', 'name' => 'Rafi Ardian Putra', 'sso_email' => 'rafiardianputra@students.undip.ac.id'],
            ['nim' => '21120123140046', 'name' => 'Janottama Ale Prasetyo', 'sso_email' => 'janottamaaleprasetyo@students.undip.ac.id'],
            ['nim' => '21120123140120', 'name' => 'Muhammad Baihaqi', 'sso_email' => 'mbaihaqq@students.undip.ac.id'],
            ['nim' => '21120123140110', 'name' => 'Rhyo Wisnuwardhana', 'sso_email' => 'rhyowisnu@students.undip.ac.id'],
            ['nim' => '21120123140112', 'name' => 'Herdika Putra Devara', 'sso_email' => 'herdikaputradevara@students.undip.ac.id'],
            ['nim' => '21120123140162', 'name' => 'Jeremy Cavellino Sulistyo', 'sso_email' => 'jeremycavellino@students.undip.ac.id'],
            ['nim' => '21120123130093', 'name' => 'Raihan Sahaja', 'sso_email' => 'raihansahaja@students.undip.ac.id'],
            ['nim' => '21120123120016', 'name' => 'Razzaq Permana', 'sso_email' => 'razzaqpermana@students.undip.ac.id'],
            ['nim' => '21120122140154', 'name' => 'Louis David Verges Tarigan', 'sso_email' => 'louisdavidtrg@students.undip.ac.id'],
        ];
    }

    private function getGroupsData(): array
    {
        return [
            [
                'number' => 1,
                'title' => 'SISTEM OTOMASI KANDANG MAGGOT BERBASIS COMPUTER VISION UNTUK OTOMASI PAKAN DAN MODEL LSTM UNTUK PREDIKSI SUHU LINGKUNGAN',
                'supervisor_1' => 'AFR',
                'supervisor_2' => 'BDC',
                'members' => [
                    ['nim' => '21120123120038'],
                    ['nim' => '21120123140171'],
                    ['nim' => '21120123140143'],
                    ['nim' => '21120123130100'],
                ],
            ],
            [
                'number' => 2,
                'title' => 'Pengembangan Timesheet Management Berbasis Website',
                'supervisor_1' => 'BDC',
                'supervisor_2' => 'IFH',
                'members' => [
                    ['nim' => '21120123120012'],
                    ['nim' => '21120123120020'],
                    ['nim' => '21120123130107'],
                ],
            ],
            [
                'number' => 3,
                'title' => 'Perancangan Sistem Marketplace UMKM Berbasis Distributed System, IoT dan Kubernetes untuk Mendukung Mobilitas Usaha Mikro',
                'supervisor_1' => 'DED',
                'supervisor_2' => 'IFH',
                'members' => [
                    ['nim' => '21120123120022'],
                    ['nim' => '21120123140048'],
                    ['nim' => '21120123140056'],
                ],
            ],
            [
                'number' => 4,
                'title' => 'Perancangan Website Teknik Komputer - Capstone dan TA',
                'supervisor_1' => 'MMS',
                'supervisor_2' => 'DHG',
                'members' => [
                    ['nim' => '21120123140176'],
                    ['nim' => '21120123140136'],
                    ['nim' => '21120123140141'],
                ],
            ],
            [
                'number' => 5,
                'title' => 'Perancangan Tongkat Pintar Tunanetra Berbasis IoT dan Computer Vision untuk Deteksi Objek dan Pemantauan Lokasi Real-Time',
                'supervisor_1' => 'DED',
                'supervisor_2' => 'EDW',
                'members' => [
                    ['nim' => '21120123140146'],
                    ['nim' => '21120123120014'],
                    ['nim' => '21120123120010'],
                ],
            ],
            [
                'number' => 6,
                'title' => 'Inovasi Pemantauan Kualitas Udara & Energi Terbarukan Berbasis IoT dan AI di Wisata Arenan Kalikesek',
                'supervisor_1' => 'DED',
                'supervisor_2' => 'ADF',
                'members' => [
                    ['nim' => '21120123120018'],
                    ['nim' => '21120123120007'],
                    ['nim' => '21120123120027'],
                ],
            ],
            [
                'number' => 7,
                'title' => 'Rancang Bangun Smart Vision untuk Monitoring Aktivitas Bayi Berbasis Kecerdasan Buatan dan Internet of Things',
                'supervisor_1' => 'DED',
                'supervisor_2' => 'ABP',
                'members' => [
                    ['nim' => '21120123130096'],
                    ['nim' => '21120123140058'],
                    ['nim' => '21120123130101'],
                ],
            ],
            [
                'number' => 8,
                'title' => 'Pengembangan Sistem EWS (Early Warning Sistem) Kebencanaan wilayah Semarang',
                'supervisor_1' => 'ERA',
                'supervisor_2' => 'IFH',
                'members' => [
                    ['nim' => '21120123140165'],
                    ['nim' => '21120123140157'],
                    ['nim' => '21120123140130'],
                    ['nim' => '21120123140045'],
                ],
            ],
            [
                'number' => 9,
                'title' => 'Pengembangan Aplikasi Sistem Pemantauan Kualitas Udara (AeroSensev3)',
                'supervisor_1' => 'ERA',
                'supervisor_2' => 'PEM',
                'members' => [
                    ['nim' => '21120123120004'],
                    ['nim' => '21120123140116'],
                    ['nim' => '21120123130085'],
                ],
            ],
            [
                'number' => 10,
                'title' => 'Pembuatan ROV untuk Sampling Kualitas air dan pengambilan Sampel Air',
                'supervisor_1' => 'ERA',
                'supervisor_2' => 'ABP',
                'members' => [
                    ['nim' => '21120123130073'],
                    ['nim' => '21120123130065'],
                    ['nim' => '21120123130062'],
                    ['nim' => '21120123140138'],
                ],
            ],
            [
                'number' => 11,
                'title' => 'Pengembangan Sensor Wearable Gula darah (Non Invasive) menggunakan Sensor NIR (Near Infrared)',
                'supervisor_1' => 'ERA',
                'supervisor_2' => 'KAN',
                'members' => [
                    ['nim' => '21120123130088'],
                    ['nim' => '21120123130080'],
                    ['nim' => '21120123140114'],
                ],
            ],
            [
                'number' => 12,
                'title' => 'Pengembangan aplikasi Digital Twin area parkir di KST Samaun BRIN Bandung dengan integrasi deteksi AI, 3D VR dan Website',
                'supervisor_1' => 'KAN',
                'supervisor_2' => 'YEW',
                'members' => [
                    ['nim' => '21120123120024'],
                    ['nim' => '21120123120031'],
                    ['nim' => '21120123140175'],
                ],
            ],
            [
                'number' => 13,
                'title' => 'Pengembangan Aplikasi Mitigasi Komunikasi Bencana Gunung Berapi Berbasis AI',
                'supervisor_1' => 'KTM',
                'supervisor_2' => 'ASN',
                'members' => [
                    ['nim' => '21120123140181'],
                    ['nim' => '21120123140167'],
                    ['nim' => '21120123130053'],
                    ['nim' => '21120123130067'],
                ],
            ],
            [
                'number' => 14,
                'title' => 'Pengembangan Website Martketplace Parfum Decant Temcy Menggunakan Chatbot Berbasis Halo AI',
                'supervisor_1' => 'RZI',
                'supervisor_2' => 'RKL',
                'members' => [
                    ['nim' => '21120123120032'],
                    ['nim' => '21120123120021'],
                    ['nim' => '21120123120033'],
                    ['nim' => '21120123140159'],
                ],
            ],
            [
                'number' => 15,
                'title' => 'Perancangan Algoritma Deteksi Ringan dalam Identifikasi Kematangan Buah Stroberi',
                'supervisor_1' => 'YEW',
                'supervisor_2' => 'BDC',
                'members' => [
                    ['nim' => '21120123120036'],
                    ['nim' => '21120123130057'],
                    ['nim' => '21120123130060'],
                ],
            ],
            [
                'number' => 16,
                'title' => 'Arsitektur Ekosistem SIDIK Terintegrasi: Transformasi Digital Pengawasan dan Pelayanan Beasiswa KIP Kuliah Melalui Artificial Intelligence Sebagai Supporting Human dan Collaborative Governance',
                'supervisor_1' => 'YEW',
                'supervisor_2' => 'ASN',
                'members' => [
                    ['nim' => '21120123120034'],
                    ['nim' => '21120123120035'],
                    ['nim' => '21120123120023'],
                    ['nim' => '21120123130061'],
                ],
            ],
            [
                'number' => 17,
                'title' => 'Perancangan Sistem Web untuk Segmentasi Mikroorganisme Berbasis Web dan YOLOv12',
                'supervisor_1' => 'YEW',
                'supervisor_2' => 'PEM',
                'members' => [
                    ['nim' => '21120123140108'],
                    ['nim' => '21120123140160'],
                    ['nim' => '21120123140184'],
                ],
            ],
            [
                'number' => 19,
                'title' => 'Sistem Deteksi Mikroplastik Berbasis Deep Learning Multimodel dengan Optimasi Small Object Detection dan Integrasi Aplikasi Web',
                'supervisor_1' => 'YEW',
                'supervisor_2' => 'IPW',
                'members' => [
                    ['nim' => '21120123140150'],
                    ['nim' => '21120123130087'],
                    ['nim' => '21120123130076'],
                ],
            ],
            [
                'number' => 20,
                'title' => 'Early-Detection Chatbot untuk Kesehatan Mental Berbasis Semantic Routing untuk Deteksi Depresi Mahasiswa',
                'supervisor_1' => 'YEW',
                'supervisor_2' => 'ASN',
                'members' => [
                    ['nim' => '21120123120001'],
                    ['nim' => '21120123130072'],
                    ['nim' => '21120123130051'],
                ],
            ],
            [
                'number' => 21,
                'title' => 'Pengembangan Smart Industri Berbasis LoRa dengan Teknologi Radio Frekuensi',
                'supervisor_1' => 'ASN',
                'supervisor_2' => 'ADF',
                'members' => [
                    ['nim' => '21120123120011'],
                    ['nim' => '21120123120002'],
                    ['nim' => '21120123140145'],
                    ['nim' => '21120123130094'],
                ],
            ],
            [
                'number' => 22,
                'title' => 'Perancangan Website Teknik Komputer - KP, Ruang Baca, dan Portal SSO',
                'supervisor_1' => 'MMS',
                'supervisor_2' => 'DHG',
                'members' => [
                    ['nim' => '21120123120013'],
                    ['nim' => '21120123120040'],
                    ['nim' => '21120123140117'],
                ],
            ],
            [
                'number' => 23,
                'title' => 'Rancang Bangun Website Monitoring Ancaman Siber untuk Virtual Machine di Lingkungan ICT Universitas Diponegoro',
                'supervisor_1' => 'KTM',
                'supervisor_2' => 'DHG',
                'members' => [
                    ['nim' => '21120123120006'],
                    ['nim' => '21120123130091'],
                    ['nim' => '21120123130054'],
                ],
            ],
            [
                'number' => 24,
                'title' => 'Implementasi Sistem Monitoring Real-Time Informasi Lokasi dan Jumlah Penumpang Bus Dipyo (Diponegoro Tayo) dan Dimtrik (Dipyo Listrik) Berbasis Internet of Things dan Aplikasi Mobile',
                'supervisor_1' => 'RKL',
                'supervisor_2' => 'IFH',
                'members' => [
                    ['nim' => '21120123120005'],
                    ['nim' => '21120123140154'],
                    ['nim' => '21120123140173'],
                ],
            ],
            [
                'number' => 25,
                'title' => 'Pembuatan sensor sungai berbasis IoT',
                'supervisor_1' => 'ERA',
                'supervisor_2' => 'ASN',
                'members' => [
                    ['nim' => '21120123120028'],
                    ['nim' => '21120123140133'],
                    ['nim' => '21120123140151'],
                ],
            ],
            [
                'number' => 26,
                'title' => 'Sinkronisasi PLTMH Kincang (banjarnegara) menggunakan Sensor Sungai',
                'supervisor_1' => 'ERA',
                'supervisor_2' => 'EDW',
                'members' => [
                    ['nim' => '21120123140043'],
                    ['nim' => '21120123130111'],
                    ['nim' => '21120123130075'],
                ],
            ],
            [
                'number' => 27,
                'title' => 'Project Pak Erwin',
                'supervisor_1' => 'ERA',
                'supervisor_2' => 'KAN',
                'members' => [
                    ['nim' => '21120123140144'],
                    ['nim' => '21120123140153'],
                    ['nim' => '21120123130071'],
                    ['nim' => '21120123140168'],
                ],
            ],
            [
                'number' => 28,
                'title' => 'Rancang Bangun Sistem Informasi Manajemen Penelitian dan Pengabdian Universitas Diponegoro Berbasis Microservice dengan Orkestrasi Layanan dan AI sebagai Decision Support',
                'supervisor_1' => 'KTM',
                'supervisor_2' => 'RKL',
                'members' => [
                    ['nim' => '21120123140139'],
                    ['nim' => '21120123120030'],
                    ['nim' => '21120123140142'],
                    ['nim' => '21120123130049'],
                ],
            ],
            [
                'number' => 29,
                'title' => 'Penggunaan AI untuk Membuat Analisis OBE (Outcome-Based Education)',
                'supervisor_1' => 'KTM',
                'supervisor_2' => 'BDC',
                'members' => [
                    ['nim' => '21120123120009'],
                    ['nim' => '21120123120037'],
                    ['nim' => '21120123130069'],
                ],
            ],
            [
                'number' => 30,
                'title' => 'Perancangan Website Teknik Komputer - Pengembangan Bank Soal Berbasis Website di Departemen Teknik Komputer',
                'supervisor_1' => 'PEM',
                'supervisor_2' => 'ASN',
                'members' => [
                    ['nim' => '21120123130068'],
                    ['nim' => '21120123130086'],
                    ['nim' => '21120123120029'],
                    ['nim' => '21120123140121'],
                ],
            ],
            [
                'number' => 31,
                'title' => 'Perancangan Website Teknik Komputer - Sistem Manajemen Kemahasiswaan dan Alumni Teknik Komputer Berbasis Web dengan Integrasi Dashboard Analitik',
                'supervisor_1' => 'PEM',
                'supervisor_2' => 'MMS',
                'members' => [
                    ['nim' => '21120123140132'],
                    ['nim' => '21120123140126'],
                    ['nim' => '21120123140135'],
                    ['nim' => '21120123140180'],
                ],
            ],
            [
                'number' => 32,
                'title' => 'Pengembangan Aplikasi "Jelajah Desa": Website Desa Wisata Terong Belitung Berbasis AI Chatbot dan Virtual Reality (VR)',
                'supervisor_1' => 'RZI',
                'supervisor_2' => 'ODN',
                'members' => [
                    ['nim' => '21120123130099'],
                    ['nim' => '21120123120015'],
                    ['nim' => '21120123120041'],
                ],
            ],
            [
                'number' => 33,
                'title' => 'Sistem Pemesanan dan Manajemen Stok Kue Berbasis Web dengan Integrasi Chatbot sebagai Layanan Pelanggan',
                'supervisor_1' => 'IPW',
                'supervisor_2' => 'PEM',
                'members' => [
                    ['nim' => '21120123130084'],
                    ['nim' => '21120123130098'],
                    ['nim' => '21120123140113'],
                ],
            ],
            [
                'number' => 34,
                'title' => 'Project Pak Yudi',
                'supervisor_1' => 'YEW',
                'supervisor_2' => 'RZI',
                'members' => [
                    ['nim' => '21120123140178'],
                    ['nim' => '21120123130079'],
                    ['nim' => '21120123140125'],
                ],
            ],
            [
                'number' => 35,
                'title' => 'Project Pak Yudi',
                'supervisor_1' => 'YEW',
                'supervisor_2' => 'ODN',
                'members' => [
                    ['nim' => '21120123130078'],
                    ['nim' => '21120123140123'],
                    ['nim' => '21120123140044'],
                ],
            ],
            [
                'number' => 36,
                'title' => 'Pengembangan Platform Koreksi Teknik Memanah Berbasis IoT dan Computer Vision untuk Evaluasi Presisi Gerakan Sesuai Standar Atlet Profesional',
                'supervisor_1' => 'RKL',
                'supervisor_2' => 'MMS',
                'members' => [
                    ['nim' => '21120123130104'],
                    ['nim' => '21120123130089'],
                    ['nim' => '21120123140055'],
                ],
            ],
            [
                'number' => 37,
                'title' => 'Sistem Absensi Siswa Berbasis Kartu Pelajar dengan Pencatatan Kehadiran Otomatis',
                'supervisor_1' => 'IPW',
                'supervisor_2' => 'KTM',
                'members' => [
                    ['nim' => '21120123140166'],
                    ['nim' => '21120123120025'],
                    ['nim' => '21120123120008'],
                    ['nim' => '21120123120026'],
                ],
            ],
            [
                'number' => 38,
                'title' => 'Rancang Bangun Sistem Aerator Portabel Berbasis PLTS dan Sensor Water Monitoring untuk Budidaya Udang Vaname',
                'supervisor_1' => 'ERA',
                'supervisor_2' => 'PEM',
                'members' => [
                    ['nim' => '21120123130092'],
                    ['nim' => '21120123130109'],
                    ['nim' => '21120123130102'],
                ],
            ],
            [
                'number' => 39,
                'title' => 'Pengembangan Sistem Informasi untuk Memetakan Jurnal Indonesia Berdasarkan Penerbit dan Subjek dari Basis Data SINTA',
                'supervisor_1' => 'AFR',
                'supervisor_2' => 'EDW',
                'members' => [
                    ['nim' => '21120123140155'],
                    ['nim' => '21120123140149'],
                    ['nim' => '21120123140156'],
                ],
            ],
            [
                'number' => 40,
                'title' => 'Belum ada judul',
                'supervisor_1' => 'ABP',
                'supervisor_2' => 'KAN',
                'members' => [
                    ['nim' => '21120123120017'],
                    ['nim' => '21120123120039'],
                    ['nim' => '21120123140137'],
                    ['nim' => '21120123140148'],
                ],
            ],
            [
                'number' => 41,
                'title' => 'Belum ada judul',
                'supervisor_1' => 'IPW',
                'supervisor_2' => 'BDC',
                'members' => [
                    ['nim' => '21120123130081'],
                    ['nim' => '21120123130082'],
                    ['nim' => '21120123140124'],
                ],
            ],
            [
                'number' => 42,
                'title' => 'Belum ada judul',
                'supervisor_1' => 'ODN',
                'supervisor_2' => 'IFH',
                'members' => [
                    ['nim' => '21120121140163'],
                    ['nim' => '21120123130083'],
                    ['nim' => '21120121140097'],
                    ['nim' => '21120122140154'],
                ],
            ],
            [
                'number' => 43,
                'title' => 'Belum ada judul',
                'supervisor_1' => 'EDW',
                'supervisor_2' => 'IFH',
                'members' => [
                    ['nim' => '21120123140122'],
                    ['nim' => '21120123140046'],
                    ['nim' => '21120123140120'],
                    ['nim' => '21120123140110'],
                ],
            ],
            [
                'number' => 44,
                'title' => 'Belum ada judul',
                'supervisor_1' => 'ADF',
                'supervisor_2' => 'RKL',
                'members' => [
                    ['nim' => '21120123140112'],
                    ['nim' => '21120123140162'],
                    ['nim' => '21120123130093'],
                    ['nim' => '21120123120016'],
                ],
            ],
        ];
    }

    private function seedPhaseDocumentRequirements(int $periodId, Carbon $now): void
    {
        $requirements = [
            ['phase' => 'PDC1', 'name' => 'C100', 'description' => 'Dokumen CPL C100', 'is_required' => true],
            ['phase' => 'PDC1', 'name' => 'C200', 'description' => 'Dokumen CPL C200', 'is_required' => true],
            ['phase' => 'PDC1', 'name' => 'C300', 'description' => 'Dokumen CPL C300', 'is_required' => true],
            ['phase' => 'SEMPRO', 'name' => 'PPT Presentasi', 'description' => 'Slide presentasi seminar proposal', 'is_required' => true],
            ['phase' => 'PDC2', 'name' => 'C400', 'description' => 'Dokumen CPL C400', 'is_required' => true],
            ['phase' => 'PDC2', 'name' => 'C500', 'description' => 'Dokumen CPL C500', 'is_required' => true],
            ['phase' => 'PDC2', 'name' => 'HKI', 'description' => 'Dokumen Hak Kekayaan Intelektual', 'is_required' => true],
            ['phase' => 'TA', 'name' => 'TA Draft', 'description' => 'Draft laporan tugas akhir', 'is_required' => true],
            ['phase' => 'EXPO', 'name' => 'Absen Kehadiran Pengunjung', 'description' => 'Dokumen absensi kehadiran pengunjung expo', 'is_required' => true],
            ['phase' => 'EXPO', 'name' => 'Nilai Pengunjung', 'description' => 'Form nilai dari pengunjung (di upload di form nilai Expo)', 'is_required' => true],
            ['phase' => 'SIDANG', 'name' => 'TOEFL/IELTS', 'description' => 'Sertifikat bahasa Inggris TOEFL/IELTS', 'is_required' => true],
            ['phase' => 'SIDANG', 'name' => 'Turnitin', 'description' => 'Laporan similarity Turnitin', 'is_required' => true],
            ['phase' => 'SIDANG', 'name' => 'Bukti Nilai', 'description' => 'Dokumen bukti nilai fase sebelumnya', 'is_required' => true],
        ];

        foreach ($requirements as $req) {
            PhaseDocumentRequirement::updateOrCreate(
                [
                    'period_id' => $periodId,
                    'phase' => $req['phase'],
                    'name' => $req['name'],
                ],
                [
                    'description' => $req['description'],
                    'is_required' => $req['is_required'],
                ]
            );
        }

        $this->command->info('Seeded '.count($requirements).' phase document requirements for period_id='.$periodId);
    }

    private function seedAssessmentComponents(int $periodId, Carbon $now): void
    {
        $this->call(AssessmentComponentTemplateSeeder::class);

        $templates = AssessmentComponentTemplate::all()->keyBy('code');

        $mappings = [
            'SEMPRO' => ['C100-CPMK1', 'C100-CPMK2', 'C100-CPMK3', 'C100-CPMK4', 'C100-CPMK5'],
            'BIMBINGAN_SEMPRO' => ['C100-CPMK1', 'C100-CPMK2', 'C100-CPMK3', 'C100-CPMK4', 'C100-CPMK5'],
            'NILAI_DOSEN' => ['C400-CPMK1', 'C400-CPMK2', 'C400-CPMK3'],
            'MILESTONE' => ['CPMK5-WAKTU', 'CPMK5-DANA', 'CPMK5-KEBUTUHAN'],
            'EXPO' => ['PEER-1', 'PEER-2', 'PEER-3', 'PEER-4', 'PEER-5', 'PEER-6', 'PEER-7', 'PEER-8', 'PEER-9', 'PEER-10'],
            'BIMBINGAN_TA' => ['C100-CPMK1', 'C100-CPMK2', 'C100-CPMK3', 'C100-CPMK4', 'C100-CPMK5'],
            'SIDANG_TA' => ['C400-CPMK1', 'C400-CPMK2', 'C400-CPMK3'],
        ];

        $count = 0;
        foreach ($mappings as $type => $codes) {
            foreach ($codes as $sortOrder => $code) {
                $template = $templates->get($code);
                if (! $template) {
                    $this->command->warn("Template {$code} not found, skipping.");
                    continue;
                }

                AssessmentComponent::updateOrCreate(
                    [
                        'period_id' => $periodId,
                        'type' => $type,
                        'code' => $template->code,
                    ],
                    [
                        'name' => $template->name,
                        'description' => $template->description,
                        'weight' => $template->weight,
                        'sort_order' => $sortOrder + 1,
                    ]
                );
                $count++;
            }
        }

        $this->command->info("Seeded {$count} assessment components (legacy) for period_id={$periodId}");
    }
}
