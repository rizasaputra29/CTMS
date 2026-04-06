<?php

namespace Database\Seeders;

use App\Models\Bid;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Title;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class GroupSeeder extends Seeder
{
    public function run(): void
    {
        $userByEmail = User::query()->pluck('id', 'email');

        $groups = [
            ['id' => 1, 'period_id' => 1, 'status' => 'READY_FOR_BIDDING', 'is_solo' => false, 'has_active_proposal' => false],
            ['id' => 2, 'period_id' => 1, 'status' => 'READY_FOR_BIDDING', 'is_solo' => false, 'has_active_proposal' => false],
            ['id' => 3, 'period_id' => 1, 'status' => 'READY_FOR_BIDDING', 'is_solo' => false, 'has_active_proposal' => false],
            ['id' => 4, 'period_id' => 1, 'status' => 'WAITING_SUPERVISOR_APPROVAL', 'is_solo' => false, 'has_active_proposal' => true],
            ['id' => 5, 'period_id' => 1, 'status' => 'READY_FOR_BIDDING', 'is_solo' => false, 'has_active_proposal' => false],
            ['id' => 6, 'period_id' => 1, 'status' => 'FORMING', 'is_solo' => false, 'has_active_proposal' => false],
            ['id' => 7, 'period_id' => 1, 'status' => 'READY_FOR_FINALIZATION', 'is_solo' => false, 'has_active_proposal' => false],
            ['id' => 8, 'period_id' => 1, 'status' => 'READY_FOR_BIDDING', 'is_solo' => false, 'has_active_proposal' => false],
            ['id' => 9, 'period_id' => 1, 'status' => 'READY_FOR_FINALIZATION', 'is_solo' => false, 'has_active_proposal' => false],
            ['id' => 10, 'period_id' => 1, 'status' => 'READY_FOR_BIDDING', 'is_solo' => true, 'has_active_proposal' => false],
            ['id' => 11, 'period_id' => 1, 'status' => 'WAITING_SUPERVISOR_APPROVAL', 'is_solo' => true, 'has_active_proposal' => true],
            ['id' => 12, 'period_id' => 1, 'status' => 'TITLE_APPROVED', 'is_solo' => true, 'has_active_proposal' => false],
            ['id' => 13, 'period_id' => 1, 'status' => 'READY_FOR_BIDDING', 'is_solo' => true, 'has_active_proposal' => false],
            ['id' => 14, 'period_id' => 2, 'status' => 'READY_FOR_BIDDING', 'is_solo' => false, 'has_active_proposal' => false],
            ['id' => 15, 'period_id' => 2, 'status' => 'FORMING', 'is_solo' => true, 'has_active_proposal' => false],
            ['id' => 16, 'period_id' => 3, 'status' => 'PDC1_ACTIVE', 'is_solo' => false, 'has_active_proposal' => false],
        ];

        foreach ($groups as $group) {
            Group::query()->updateOrCreate(
                ['id' => $group['id']],
                [
                    'period_id' => $group['period_id'],
                    'status' => $group['status'],
                    'group_mode' => $group['is_solo'] ? 'INDIVIDUAL' : 'GROUP',
                    'is_solo' => $group['is_solo'],
                    'has_existing_group' => !$group['is_solo'],
                    'has_active_proposal' => $group['has_active_proposal'],
                    'assignment_type' => null,
                ]
            );
        }

        $members = [
            1 => ['andi@ctms.com', 'bela@ctms.com', 'citra@ctms.com'],
            2 => ['dodi@ctms.com', 'eva@ctms.com', 'fahmi@ctms.com'],
            3 => ['gita@ctms.com', 'hendra@ctms.com', 'indra@ctms.com', 'joko@ctms.com'],
            4 => ['kartika@ctms.com', 'lukman@ctms.com', 'mira@ctms.com'],
            5 => ['nanda@ctms.com', 'oky@ctms.com', 'putri@ctms.com'],
            6 => ['qori@ctms.com', 'reza@ctms.com'],
            7 => ['sari@ctms.com', 'tono@ctms.com', 'udin@ctms.com', 'vina@ctms.com'],
            8 => ['dani@ctms.com', 'eka@ctms.com', 'fani@ctms.com'],
            9 => ['gilang@ctms.com', 'hani@ctms.com', 'ivan@ctms.com'],
            10 => ['zara@ctms.com'],
            11 => ['aldo@ctms.com'],
            12 => ['bella@ctms.com'],
            13 => ['candra@ctms.com'],
            14 => ['jaka@ctms.com', 'kiki@ctms.com', 'lina@ctms.com'],
            15 => ['miko@ctms.com'],
            16 => ['omar@ctms.com', 'pita@ctms.com', 'quin@ctms.com'],
        ];

        foreach ($members as $groupId => $emails) {
            $periodId = (int) Group::query()->whereKey($groupId)->value('period_id');
            if (!$periodId) {
                throw new RuntimeException("Group {$groupId} not found while seeding members.");
            }

            foreach ($emails as $email) {
                $studentId = $userByEmail->get($email);
                if (!$studentId) {
                    throw new RuntimeException("User {$email} not found while seeding group members.");
                }

                GroupMember::query()
                    ->where('student_id', $studentId)
                    ->where('period_id', $periodId)
                    ->where('group_id', '!=', $groupId)
                    ->delete();
            }

            $this->syncMembers($groupId, $periodId, $emails, $userByEmail);
        }

        $dosen = [
            'budi' => $this->requireUser($userByEmail, 'budi@ctms.com'),
            'siti' => $this->requireUser($userByEmail, 'siti@ctms.com'),
            'ahmad' => $this->requireUser($userByEmail, 'ahmad@ctms.com'),
            'dewi' => $this->requireUser($userByEmail, 'dewi@ctms.com'),
            'rudi' => $this->requireUser($userByEmail, 'rudi@ctms.com'),
            'maya' => $this->requireUser($userByEmail, 'maya@ctms.com'),
            'hendra' => $this->requireUser($userByEmail, 'hendra@ctms.com'),
            'rina' => $this->requireUser($userByEmail, 'rina@ctms.com'),
        ];

        $this->seedStudentProposalTitles($dosen);
        $this->seedBids($dosen);

        $this->command->info('Seeded groups, memberships, student proposals, and bids for QA scenarios.');
    }

    private function syncMembers(int $groupId, int $periodId, array $emails, $userByEmail): void
    {
        $studentIds = [];
        foreach ($emails as $email) {
            $studentIds[] = $this->requireUser($userByEmail, $email);
        }

        GroupMember::query()
            ->where('group_id', $groupId)
            ->whereNotIn('student_id', $studentIds)
            ->delete();

        foreach ($studentIds as $idx => $studentId) {
            GroupMember::query()->updateOrCreate(
                ['group_id' => $groupId, 'student_id' => $studentId],
                ['period_id' => $periodId, 'is_leader' => $idx === 0]
            );
        }
    }

    private function seedStudentProposalTitles(array $dosen): void
    {
        $rows = [
            [
                'id' => 11,
                'lecturer_id' => $dosen['maya'],
                'title' => 'Sistem Manajemen Tugas Berbasis Kanban dengan Fitur AI',
                'description' => 'Aplikasi manajemen tugas yang memanfaatkan AI untuk saran prioritas otomatis.',
                'problem_statement' => 'Tim pengembang kesulitan mengelola prioritas tugas yang dinamis.',
                'scope' => 'Web application, AI task prioritization, integrasi Slack.',
                'title_source' => 'STUDENT',
                'proposed_by_group_id' => 4,
                'proposed_supervisor_id' => $dosen['maya'],
                'supervisor_approval_status' => 'PENDING',
                'rejection_reason' => null,
                'period_id' => 1,
                'quota' => 1,
                'status' => 'CLOSED',
                'approved_by_admin' => false,
            ],
            [
                'id' => 12,
                'lecturer_id' => $dosen['rudi'],
                'title' => 'Platform Crowdfunding untuk UMKM Lokal',
                'description' => 'Sistem crowdfunding khusus UMKM dengan verifikasi ketat.',
                'problem_statement' => 'UMKM sulit mendapatkan pendanaan dari jalur konvensional.',
                'scope' => 'Platform web, payment gateway, verifikasi KYC.',
                'title_source' => 'STUDENT',
                'proposed_by_group_id' => 5,
                'proposed_supervisor_id' => $dosen['rudi'],
                'supervisor_approval_status' => 'REJECTED',
                'rejection_reason' => 'Tidak sesuai ruang lingkup keilmuan.',
                'period_id' => 1,
                'quota' => 1,
                'status' => 'CLOSED',
                'approved_by_admin' => false,
            ],
            [
                'id' => 13,
                'lecturer_id' => $dosen['budi'],
                'title' => 'Sistem Deteksi Plagiarisme Kode Program Berbasis AST',
                'description' => 'Deteksi plagiarisme kode dengan membandingkan Abstract Syntax Tree antar submission.',
                'problem_statement' => 'Plagiarisme kode sulit dideteksi hanya dari perbandingan teks.',
                'scope' => 'Parser multi-bahasa, algoritma tree similarity, laporan deteksi.',
                'title_source' => 'STUDENT',
                'proposed_by_group_id' => 11,
                'proposed_supervisor_id' => $dosen['budi'],
                'supervisor_approval_status' => 'PENDING',
                'rejection_reason' => null,
                'period_id' => 1,
                'quota' => 1,
                'status' => 'CLOSED',
                'approved_by_admin' => false,
            ],
            [
                'id' => 14,
                'lecturer_id' => $dosen['siti'],
                'title' => 'Aplikasi Diagnosa Awal Penyakit Tanaman Padi dengan CNN',
                'description' => 'Sistem diagnosa penyakit tanaman padi menggunakan foto daun dan model CNN.',
                'problem_statement' => 'Petani tidak memiliki akses mudah ke pakar untuk diagnosa penyakit tanaman.',
                'scope' => 'Model CNN, mobile app, database penyakit tanaman.',
                'title_source' => 'STUDENT',
                'proposed_by_group_id' => 12,
                'proposed_supervisor_id' => $dosen['siti'],
                'supervisor_approval_status' => 'APPROVED',
                'rejection_reason' => null,
                'period_id' => 1,
                'quota' => 1,
                'status' => 'OPEN',
                'approved_by_admin' => true,
            ],
            [
                'id' => 15,
                'lecturer_id' => $dosen['ahmad'],
                'title' => 'Sistem Rekomendasi Wisata Berbasis Collaborative Filtering',
                'description' => 'Aplikasi rekomendasi destinasi wisata personal menggunakan data preferensi pengguna.',
                'problem_statement' => 'Wisatawan kesulitan menemukan destinasi yang sesuai selera dan budget.',
                'scope' => 'Algoritma CF, integrasi Google Maps, mobile app.',
                'title_source' => 'STUDENT',
                'proposed_by_group_id' => 13,
                'proposed_supervisor_id' => $dosen['ahmad'],
                'supervisor_approval_status' => 'REJECTED',
                'rejection_reason' => 'Perlu pendalaman metodologi.',
                'period_id' => 1,
                'quota' => 1,
                'status' => 'CLOSED',
                'approved_by_admin' => false,
            ],
        ];

        foreach ($rows as $row) {
            Title::query()->updateOrCreate(['id' => $row['id']], $row);
        }
    }

    private function seedBids(array $dosen): void
    {
        $rows = [
            [
                'group_id' => 2,
                'title_id' => 1,
                'priority' => 1,
                'status' => 'PENDING',
                'lecturer_recommendation' => null,
                'proposed_supervisor_1_id' => $dosen['budi'],
                'proposed_supervisor_2_id' => null,
            ],
            [
                'group_id' => 3,
                'title_id' => 2,
                'priority' => 1,
                'status' => 'PENDING',
                'lecturer_recommendation' => null,
                'proposed_supervisor_1_id' => $dosen['siti'],
                'proposed_supervisor_2_id' => $dosen['budi'],
            ],
            [
                'group_id' => 3,
                'title_id' => 3,
                'priority' => 2,
                'status' => 'PENDING',
                'lecturer_recommendation' => null,
                'proposed_supervisor_1_id' => $dosen['ahmad'],
                'proposed_supervisor_2_id' => null,
            ],
            [
                'group_id' => 3,
                'title_id' => 4,
                'priority' => 3,
                'status' => 'PENDING',
                'lecturer_recommendation' => null,
                'proposed_supervisor_1_id' => $dosen['dewi'],
                'proposed_supervisor_2_id' => null,
            ],
            [
                'group_id' => 7,
                'title_id' => 5,
                'priority' => 1,
                'status' => 'ACCEPTED',
                'lecturer_recommendation' => 'ACCEPT',
                'proposed_supervisor_1_id' => $dosen['rudi'],
                'proposed_supervisor_2_id' => $dosen['maya'],
            ],
            [
                'group_id' => 9,
                'title_id' => 6,
                'priority' => 1,
                'status' => 'ACCEPTED',
                'lecturer_recommendation' => 'ACCEPT',
                'proposed_supervisor_1_id' => $dosen['maya'],
                'proposed_supervisor_2_id' => $dosen['budi'],
            ],
            [
                'group_id' => 9,
                'title_id' => 7,
                'priority' => 2,
                'status' => 'REJECTED',
                'lecturer_recommendation' => 'REJECT',
                'proposed_supervisor_1_id' => $dosen['hendra'],
                'proposed_supervisor_2_id' => null,
            ],
        ];

        foreach ($rows as $row) {
            Bid::query()->updateOrCreate(
                ['group_id' => $row['group_id'], 'title_id' => $row['title_id']],
                $row
            );
        }
    }

    private function requireUser($userByEmail, string $email): int
    {
        $id = $userByEmail->get($email);
        if (!$id) {
            throw new RuntimeException("Required user {$email} not found for seeding.");
        }

        return (int) $id;
    }
}
