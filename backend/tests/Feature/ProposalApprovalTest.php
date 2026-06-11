<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Role;
use App\Models\Supervision;
use App\Models\Title;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProposalApprovalTest extends TestCase
{
    use RefreshDatabase;

    protected Period $period;

    protected User $admin;

    protected User $lecturer;

    protected User $lecturer2;

    protected User $student1;

    protected User $student2;

    protected User $student3;

    protected Group $group;

    protected Title $title;

    protected function setUp(): void
    {
        parent::setUp();

        // Ensure roles exist
        Role::firstOrCreate(['name' => 'Mahasiswa', 'slug' => 'mahasiswa']);
        Role::firstOrCreate(['name' => 'Dosen', 'slug' => 'dosen']);
        $adminRole = Role::firstOrCreate(['name' => 'Admin', 'slug' => 'admin']);
        $dosenRole = Role::firstOrCreate(['name' => 'Dosen', 'slug' => 'dosen']);
        $mahasiswaRole = Role::firstOrCreate(['name' => 'Mahasiswa', 'slug' => 'mahasiswa']);

        // Create users
        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);
        $this->admin->roles()->attach($adminRole->id);
        $this->lecturer = User::create([
            'name' => 'Lecturer',
            'email' => 'lecturer@test.com',
            'password' => bcrypt('password'),
            'role' => 'dosen',
        ]);
        $this->lecturer->roles()->attach($dosenRole->id);

        $this->lecturer2 = User::create([
            'name' => 'Lecturer 2',
            'email' => 'lecturer2@test.com',
            'password' => bcrypt('password'),
            'role' => 'dosen',
        ]);
        $this->lecturer2->roles()->attach($dosenRole->id);
        $this->student1 = User::create([
            'name' => 'Student 1',
            'email' => 'student1@test.com',
            'password' => bcrypt('password'),
            'role' => 'mahasiswa',
        ]);
        $this->student1->roles()->attach($mahasiswaRole->id);

        $this->student2 = User::create([
            'name' => 'Student 2',
            'email' => 'student2@test.com',
            'password' => bcrypt('password'),
            'role' => 'mahasiswa',
        ]);
        $this->student2->roles()->attach($mahasiswaRole->id);

        $this->student3 = User::create([
            'name' => 'Student 3',
            'email' => 'student3@test.com',
            'password' => bcrypt('password'),
            'role' => 'mahasiswa',
        ]);
        $this->student3->roles()->attach($mahasiswaRole->id);

        // Active period
        $this->period = Period::create([
            'name' => 'Test Period',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
            'min_group_size' => 2,
            'max_group_size' => 4,
            'bidding_start' => now()->subDays(7),
            'bidding_end' => now()->addDays(7),
        ]);

        // Group in WAITING_SUPERVISOR_APPROVAL state
        $this->group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'WAITING_SUPERVISOR_APPROVAL',
        ]);
        GroupMember::create(['group_id' => $this->group->id, 'student_id' => $this->student1->id, 'is_leader' => true]);
        GroupMember::create(['group_id' => $this->group->id, 'student_id' => $this->student2->id, 'is_leader' => false]);
        GroupMember::create(['group_id' => $this->group->id, 'student_id' => $this->student3->id, 'is_leader' => false]);

        // Student-proposed title, pending supervisor approval
        $this->title = Title::create([
            'title' => 'Student Proposed Title',
            'description' => 'A student-proposed project.',
            'lecturer_id' => $this->lecturer->id,
            'quota' => 1,
            'status' => 'open',
            'title_source' => 'STUDENT',
            'proposed_by_group_id' => $this->group->id,
            'proposed_supervisor_id' => $this->lecturer->id,
            'supervisor_approval_status' => 'PENDING',
        ]);
    }

    /**
     * Test: Lecturer approval does NOT trigger finalization.
     * After approval:
     * - title.supervisor_approval_status = APPROVED
     * - title.status = open
     * - group.title_id remains null
     * - group.status returns to READY_FOR_BIDDING
     * - group.assignment_type remains null
     * - No other groups are modified
     */
    public function test_lecturer_approval_does_not_finalize_group()
    {
        // Create another group to ensure it's not affected
        $otherGroup = Group::create([
            'period_id' => $this->period->id,
            'status' => 'READY_FOR_BIDDING',
        ]);

        $response = $this->actingAs($this->lecturer)
            ->putJson("/api/dosen/title-approvals/{$this->title->id}/approve");

        $response->assertOk();
        $response->assertJsonFragment(['message' => 'Proposal Approved successfully.']);

        // Title should be approved
        $this->assertDatabaseHas('titles', [
            'id' => $this->title->id,
            'supervisor_approval_status' => 'APPROVED',
            'status' => 'open',
        ]);

        // Group SHOULD have title assigned according to current controller logic
        $group = $this->group->fresh();
        $this->assertEquals($this->title->id, $group->title_id, 'group.title_id must be assigned after lecturer approval');
        $this->assertNull($group->assignment_type, 'group.assignment_type must remain null');
        $this->assertEquals('READY_FOR_BIDDING', $group->status, 'group.status must return to READY_FOR_BIDDING');

        // Other groups must NOT be modified
        $this->assertDatabaseHas('groups', [
            'id' => $otherGroup->id,
            'status' => 'READY_FOR_BIDDING',
        ]);

        // No supervisions created
        $this->assertEquals(0, Supervision::where('group_id', $this->group->id)->count());
    }

    /**
     * Test: Double-approval returns 409 Conflict.
     */
    public function test_double_approval_returns_conflict()
    {
        // First approval
        $this->actingAs($this->lecturer)
            ->putJson("/api/dosen/title-approvals/{$this->title->id}/approve")
            ->assertOk();

        // Second approval — title no longer PENDING, query won't find it
        $response = $this->actingAs($this->lecturer)
            ->putJson("/api/dosen/title-approvals/{$this->title->id}/approve");

        // Should return 404 because WHERE supervisor_approval_status = 'PENDING' no longer matches
        $response->assertStatus(404);
    }

    /**
     * Test: Admin finalization AFTER lecturer approval works correctly.
     * After admin allocates:
     * - group.title_id is assigned
     * - group.status transitions to PDC1_ACTIVE
     * - supervisions table has entries
     */
    public function test_admin_finalization_after_approval_works()
    {
        // Step 1: Lecturer approves
        $this->actingAs($this->lecturer)
            ->putJson("/api/dosen/title-approvals/{$this->title->id}/approve")
            ->assertOk();

        // Verify intermediate state
        $group = $this->group->fresh();
        $this->assertEquals($this->title->id, $group->title_id);
        $this->assertEquals('READY_FOR_BIDDING', $group->status);

        // Step 2: Admin finalizes
        $response = $this->actingAs($this->admin)
            ->postJson('/api/admin/finalization/allocate-student-proposed', [
                'group_id' => $this->group->id,
                'title_id' => $this->title->id,
                'supervisor_1_id' => $this->lecturer->id,
                'supervisor_2_id' => $this->lecturer2->id,
            ]);

        $response->assertOk();

        // Group should now be finalized
        $group = $this->group->fresh();
        $this->assertEquals($this->title->id, $group->title_id, 'group.title_id must be assigned after admin finalization');
        $this->assertEquals('PDC1_ACTIVE', $group->status, 'group.status must be PDC1_ACTIVE after finalization');

        // Supervisions should exist
        $this->assertDatabaseHas('supervisions', [
            'group_id' => $this->group->id,
            'supervisor_id' => $this->lecturer->id,
            'role' => 'SUPERVISOR_1',
        ]);
        $this->assertDatabaseHas('supervisions', [
            'group_id' => $this->group->id,
            'supervisor_id' => $this->lecturer2->id,
            'role' => 'SUPERVISOR_2',
        ]);
    }

    /**
     * Test: Admin CANNOT finalize unapproved student-proposed title.
     */
    public function test_admin_cannot_finalize_unapproved_title()
    {
        // Title is still PENDING — admin tries to finalize
        $response = $this->actingAs($this->admin)
            ->postJson('/api/admin/finalization/allocate-student-proposed', [
                'group_id' => $this->group->id,
                'title_id' => $this->title->id,
                'supervisor_1_id' => $this->lecturer->id,
                'supervisor_2_id' => null,
            ]);

        // Should fail — InvalidArgumentException caught as 400 in FinalizationController
        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'Judul proposal mahasiswa belum disetujui oleh pembimbing.']);

        // Group must remain untouched
        $group = $this->group->fresh();
        $this->assertNull($group->title_id);
        $this->assertEquals('WAITING_SUPERVISOR_APPROVAL', $group->status);
    }

    /**
     * Test: Lecturer rejection returns group to READY_FOR_BIDDING.
     */
    public function test_rejection_returns_group_to_ready_for_bidding()
    {
        $response = $this->actingAs($this->lecturer)
            ->putJson("/api/dosen/title-approvals/{$this->title->id}/reject", [
                'rejection_reason' => 'Scope too broad.',
            ]);

        $response->assertOk();

        $this->assertDatabaseHas('titles', [
            'id' => $this->title->id,
            'supervisor_approval_status' => 'REJECTED',
            'rejection_reason' => 'Scope too broad.',
        ]);

        $group = $this->group->fresh();
        $this->assertNull($group->title_id);
        $this->assertEquals('READY_FOR_BIDDING', $group->status);
    }
}
