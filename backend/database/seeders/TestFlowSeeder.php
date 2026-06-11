<?php

namespace Database\Seeders;

use App\Models\Bid;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Title;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class TestFlowSeeder extends Seeder
{
    public function run(): void
    {
        $userByEmail = User::query()->pluck('id', 'email');

        $dosen = [
            'budi' => $this->requireUser($userByEmail, 'budi@ctms.com'),
            'siti' => $this->requireUser($userByEmail, 'siti@ctms.com'),
            'ahmad' => $this->requireUser($userByEmail, 'ahmad@ctms.com'),
            'dewi' => $this->requireUser($userByEmail, 'dewi@ctms.com'),
        ];

        // First, clean up existing memberships for test students in period 1
        $testStudentEmails = [
            'andi@ctms.com', 'bela@ctms.com', 'citra@ctms.com',
            'dani@ctms.com', 'eka@ctms.com', 'fani@ctms.com',
            'zara@ctms.com', 'gita@ctms.com', 'hendra@ctms.com',
            'joko@ctms.com', 'kartika@ctms.com', 'lukman@ctms.com',
            'nanda@ctms.com', 'oky@ctms.com', 'putri@ctms.com',
        ];

        $testStudentIds = [];
        foreach ($testStudentEmails as $email) {
            $testStudentIds[] = $this->requireUser($userByEmail, $email);
        }

        // Delete existing memberships for these students in period 1
        GroupMember::whereIn('student_id', $testStudentIds)
            ->where('period_id', 1)
            ->delete();

        // ========================================
        // TEST CASE 1: Bid ACCEPTED (should succeed)
        // Group 17: READY_FOR_BIDDING, 3 members, bid ACCEPTED
        // ========================================
        $this->createOrUpdateGroup(17, 1, 'READY_FOR_BIDDING', false);
        $this->syncMembers(17, 1, ['andi@ctms.com', 'bela@ctms.com', 'citra@ctms.com'], $userByEmail);

        Bid::updateOrCreate(
            ['group_id' => 17, 'title_id' => 1],
            [
                'priority' => 1,
                'status' => 'ACCEPTED',
                'lecturer_recommendation' => 'ACCEPT',
                'proposed_supervisor_1_id' => $dosen['budi'],
                'proposed_supervisor_2_id' => null,
            ]
        );

        // ========================================
        // TEST CASE 2: Proposal APPROVED (should succeed)
        // Group 18: READY_FOR_BIDDING, 3 members, proposal APPROVED
        // ========================================
        $this->createOrUpdateGroup(18, 1, 'READY_FOR_BIDDING', false);
        $this->syncMembers(18, 1, ['dani@ctms.com', 'eka@ctms.com', 'fani@ctms.com'], $userByEmail);

        Title::updateOrCreate(
            ['id' => 20],
            [
                'lecturer_id' => $dosen['siti'],
                'title' => '[TEST] Sistem Rekomendasi Buku dengan Machine Learning',
                'description' => 'Sistem rekomendasi buku personal menggunakan collaborative filtering.',
                'problem_statement' => 'Pengguna kesulitan menemukan buku yang sesuai minat.',
                'scope' => 'Web app, algoritma CF, database buku.',
                'title_source' => 'STUDENT',
                'proposed_by_group_id' => 18,
                'proposed_supervisor_id' => $dosen['siti'],
                'supervisor_approval_status' => 'APPROVED',
                'rejection_reason' => null,
                'period_id' => 1,
                'quota' => 1,
                'status' => 'OPEN',
                'approved_by_admin' => true,
            ]
        );

        // ========================================
        // TEST CASE 3: Solo TITLE_APPROVED (should succeed)
        // Group 19: TITLE_APPROVED, is_solo=1
        // ========================================
        $this->createOrUpdateGroup(19, 1, 'TITLE_APPROVED', true);
        $this->syncMembers(19, 1, ['zara@ctms.com'], $userByEmail);

        Title::updateOrCreate(
            ['id' => 21],
            [
                'lecturer_id' => $dosen['ahmad'],
                'title' => '[TEST] Aplikasi Pengenalan Handwriting dengan CNN',
                'description' => 'Aplikasi pengenalan tulisan tangan menggunakan Convolutional Neural Network.',
                'problem_statement' => 'Sistem OCR sulit mengenali tulisan tangan yang tidak rapi.',
                'scope' => 'Mobile app, model CNN, dataset handwriting.',
                'title_source' => 'STUDENT',
                'proposed_by_group_id' => 19,
                'proposed_supervisor_id' => $dosen['ahmad'],
                'supervisor_approval_status' => 'APPROVED',
                'rejection_reason' => null,
                'period_id' => 1,
                'quota' => 1,
                'status' => 'OPEN',
                'approved_by_admin' => true,
            ]
        );

        // ========================================
        // TEST CASE 4: Kurang Anggota (should FAIL)
        // Group 20: READY_FOR_BIDDING, only 2 members
        // ========================================
        $this->createOrUpdateGroup(20, 1, 'READY_FOR_BIDDING', false);
        $this->syncMembers(20, 1, ['gita@ctms.com', 'hendra@ctms.com'], $userByEmail); // only 2

        // ========================================
        // TEST CASE 5: Belum Ada Accept (should FAIL)
        // Group 21: READY_FOR_BIDDING, 3 members, bid PENDING
        // ========================================
        $this->createOrUpdateGroup(21, 1, 'READY_FOR_BIDDING', false);
        $this->syncMembers(21, 1, ['joko@ctms.com', 'kartika@ctms.com', 'lukman@ctms.com'], $userByEmail);

        Bid::updateOrCreate(
            ['group_id' => 21, 'title_id' => 2],
            [
                'priority' => 1,
                'status' => 'PENDING',
                'lecturer_recommendation' => 'PENDING', // NOT ACCEPT
                'proposed_supervisor_1_id' => $dosen['dewi'],
                'proposed_supervisor_2_id' => null,
            ]
        );

        // ========================================
        // TEST CASE 6: Bukan Leader (should FAIL)
        // Group 22: READY_FOR_BIDDING, 3 members, bid ACCEPTED
        // Leader is nanda@ctms.com, we'll test with non-leader (oky@ctms.com)
        // ========================================
        $this->createOrUpdateGroup(22, 1, 'READY_FOR_BIDDING', false);
        $this->syncMembers(22, 1, ['nanda@ctms.com', 'oky@ctms.com', 'putri@ctms.com'], $userByEmail); // nanda is leader

        Bid::updateOrCreate(
            ['group_id' => 22, 'title_id' => 3],
            [
                'priority' => 1,
                'status' => 'ACCEPTED',
                'lecturer_recommendation' => 'ACCEPT',
                'proposed_supervisor_1_id' => $dosen['ahmad'],
                'proposed_supervisor_2_id' => null,
            ]
        );

        $this->command->info('TestFlowSeeder completed: 6 test cases ready for testing mark-ready-for-finalization endpoint');
        $this->command->info('Test Case Summary:');
        $this->command->info('  1. Group 17 (andi,bela,citra) - Bid ACCEPTED - Should SUCCEED');
        $this->command->info('  2. Group 18 (dani,eka,fani) - Proposal APPROVED - Should SUCCEED');
        $this->command->info('  3. Group 19 (zara) - Solo TITLE_APPROVED - Should SUCCEED');
        $this->command->info('  4. Group 20 (gita,hendra) - Only 2 members - Should FAIL');
        $this->command->info('  5. Group 21 (joko,kartika,lukman) - Bid PENDING - Should FAIL');
        $this->command->info('  6. Group 22 (nanda,oky,putri) - Bid ACCEPTED, non-leader login - Should FAIL');
    }

    private function createOrUpdateGroup(int $id, int $periodId, string $status, bool $isSolo): void
    {
        Group::query()->updateOrCreate(
            ['id' => $id],
            [
                'period_id' => $periodId,
                'status' => $status,
                'group_mode' => $isSolo ? 'INDIVIDUAL' : 'GROUP',
                'is_solo' => $isSolo,
                'has_existing_group' => ! $isSolo,
                'has_active_proposal' => false,
                'assignment_type' => null,
                'title_id' => null,
                'supervisor_1_id' => null,
                'supervisor_2_id' => null,
            ]
        );
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

    private function requireUser($userByEmail, string $email): int
    {
        $id = $userByEmail->get($email);
        if (! $id) {
            throw new RuntimeException("Required user {$email} not found for seeding.");
        }

        return (int) $id;
    }
}
