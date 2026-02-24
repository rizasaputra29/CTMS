<?php

namespace Tests\Unit;

use App\Models\Bid;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Supervision;
use App\Models\Title;
use App\Models\User;
use App\Services\FinalizationService;
use App\Services\GroupStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class FinalizationServiceTest extends TestCase
{
    use RefreshDatabase;

    protected FinalizationService $service;
    protected Period $period;
    protected User $admin;
    protected User $dosen1;
    protected User $dosen2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(FinalizationService::class);

        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@test.com',
            'password' => bcrypt('pw'),
            'role' => 'admin',
        ]);

        $this->dosen1 = User::create([
            'name' => 'Dosen 1',
            'email' => 'dosen1@test.com',
            'password' => bcrypt('pw'),
            'role' => 'dosen',
        ]);

        $this->dosen2 = User::create([
            'name' => 'Dosen 2',
            'email' => 'dosen2@test.com',
            'password' => bcrypt('pw'),
            'role' => 'dosen',
        ]);

        $this->period = Period::create([
            'name' => 'Test Period',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
            'min_group_size' => 2,
            'max_group_size' => 4,
            'max_supervise_load' => 5,
            'bidding_start' => now()->subDays(7),
            'bidding_end' => now()->addDays(7),
        ]);
    }

    private function makeGroupWithBid(string $titleId = null): array
    {
        $student1 = User::create([
            'name' => 'S' . rand(100, 999),
            'email' => 's' . rand(100, 999) . '@test.com',
            'password' => bcrypt('pw'),
            'role' => 'mahasiswa',
        ]);
        $student2 = User::create([
            'name' => 'S' . rand(100, 999),
            'email' => 's' . rand(100, 999) . '@test.com',
            'password' => bcrypt('pw'),
            'role' => 'mahasiswa',
        ]);

        $title = Title::create([
            'title' => 'Test Title ' . rand(100, 999),
            'description' => 'A test title',
            'lecturer_id' => $this->dosen1->id,
            'period_id' => $this->period->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'READY_FOR_BIDDING',
        ]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $student1->id, 'is_leader' => true]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $student2->id, 'is_leader' => false]);

        $bid = Bid::create([
            'group_id' => $group->id,
            'title_id' => $title->id,
            'priority' => 1,
            'status' => 'PENDING',
            'lecturer_recommendation' => 'ACCEPT',
        ]);

        return ['group' => $group, 'bid' => $bid, 'title' => $title];
    }

    // ══════════════════════════════════════════
    // Successful allocation
    // ══════════════════════════════════════════

    public function test_allocate_group_succeeds(): void
    {
        ['bid' => $bid, 'title' => $title, 'group' => $group] = $this->makeGroupWithBid();

        $result = $this->service->allocateGroup(
            $bid->id,
            $this->dosen1->id,
            $this->dosen2->id,
            $this->admin->id
        );

        // Group should be in PDC1_ACTIVE
        $group->refresh();
        $this->assertEquals('PDC1_ACTIVE', $group->status);
        $this->assertEquals($title->id, $group->title_id);
        $this->assertEquals('BIDDING', $group->assignment_type);

        // Bid should be ACCEPTED
        $bid->refresh();
        $this->assertEquals('ACCEPTED', $bid->status);

        // Supervisions should exist (SOT)
        $this->assertEquals(2, Supervision::where('group_id', $group->id)->count());

        // Cache fields should be set
        $this->assertEquals($this->dosen1->id, $group->supervisor_1_id);
        $this->assertEquals($this->dosen2->id, $group->supervisor_2_id);
    }

    public function test_allocate_rejects_other_bids_for_same_title(): void
    {
        ['bid' => $winningBid, 'title' => $title] = $this->makeGroupWithBid();

        // Create a competing bid from another group
        $student3 = User::create([
            'name' => 'S999',
            'email' => 's999@test.com',
            'password' => bcrypt('pw'),
            'role' => 'mahasiswa',
        ]);
        $group2 = Group::create([
            'period_id' => $this->period->id,
            'status' => 'READY_FOR_BIDDING',
        ]);
        GroupMember::create(['group_id' => $group2->id, 'student_id' => $student3->id, 'is_leader' => true]);

        $losingBid = Bid::create([
            'group_id' => $group2->id,
            'title_id' => $title->id,
            'priority' => 1,
            'status' => 'PENDING',
            'lecturer_recommendation' => 'ACCEPT',
        ]);

        $this->service->allocateGroup(
            $winningBid->id,
            $this->dosen1->id,
            null,
            $this->admin->id
        );

        $losingBid->refresh();
        $this->assertEquals('REJECTED', $losingBid->status);
    }

    public function test_allocate_rejects_other_bids_from_same_group(): void
    {
        ['bid' => $winningBid, 'group' => $group] = $this->makeGroupWithBid();

        $otherTitle = Title::create([
            'title' => 'Other Title',
            'description' => 'Another test title',
            'lecturer_id' => $this->dosen2->id,
            'period_id' => $this->period->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        $otherBid = Bid::create([
            'group_id' => $group->id,
            'title_id' => $otherTitle->id,
            'priority' => 2,
            'status' => 'PENDING',
            'lecturer_recommendation' => 'ACCEPT',
        ]);

        $this->service->allocateGroup(
            $winningBid->id,
            $this->dosen1->id,
            null,
            $this->admin->id
        );

        $otherBid->refresh();
        $this->assertEquals('REJECTED', $otherBid->status);
    }

    // ══════════════════════════════════════════
    // Quota enforcement
    // ══════════════════════════════════════════

    public function test_allocate_fails_when_quota_full(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('quota is full');

        // Create title with quota 1
        $title = Title::create([
            'title' => 'Single Quota Title',
            'description' => 'Only one group allowed',
            'lecturer_id' => $this->dosen1->id,
            'period_id' => $this->period->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        // Fill the quota: create a group already allocated to this title
        $existingGroup = Group::create([
            'period_id' => $this->period->id,
            'status' => 'PDC1_ACTIVE',
        ]);
        $existingGroup->assignTitleFromFinalization($title->id);
        $existingGroup->save();

        // Now try to allocate another group to same title
        $student = User::create([
            'name' => 'QuotaTest',
            'email' => 'quota@test.com',
            'password' => bcrypt('pw'),
            'role' => 'mahasiswa',
        ]);
        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'READY_FOR_BIDDING',
        ]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $student->id, 'is_leader' => true]);

        $bid = Bid::create([
            'group_id' => $group->id,
            'title_id' => $title->id,
            'priority' => 1,
            'status' => 'PENDING',
            'lecturer_recommendation' => 'ACCEPT',
        ]);

        $this->service->allocateGroup(
            $bid->id,
            $this->dosen1->id,
            null,
            $this->admin->id
        );
    }

    // ══════════════════════════════════════════
    // Student-proposed allocation
    // ══════════════════════════════════════════

    public function test_allocate_student_proposed_succeeds(): void
    {
        $student = User::create([
            'name' => 'PropStudent',
            'email' => 'prop@test.com',
            'password' => bcrypt('pw'),
            'role' => 'mahasiswa',
        ]);

        $title = Title::create([
            'title' => 'Student Proposed Title',
            'description' => 'Proposed by student',
            'lecturer_id' => $this->dosen1->id,
            'period_id' => $this->period->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'READY_FOR_BIDDING',
        ]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $student->id, 'is_leader' => true]);

        $result = $this->service->allocateStudentProposed(
            $group->id,
            $title->id,
            $this->dosen1->id,
            $this->dosen2->id,
            $this->admin->id
        );

        $group->refresh();
        $this->assertEquals('PDC1_ACTIVE', $group->status);
        $this->assertEquals('STUDENT_PROPOSED', $group->assignment_type);
        $this->assertEquals($title->id, $group->title_id);
    }

    // ══════════════════════════════════════════
    // Audit log created
    // ══════════════════════════════════════════

    public function test_allocation_creates_audit_log(): void
    {
        ['bid' => $bid] = $this->makeGroupWithBid();

        $this->service->allocateGroup(
            $bid->id,
            $this->dosen1->id,
            null,
            $this->admin->id
        );

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->admin->id,
            'action' => 'FINALIZATION_ALLOCATE',
        ]);
    }
}
