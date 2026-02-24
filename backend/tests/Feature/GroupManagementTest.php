<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Period;
use App\Models\Title;
use App\Models\Group;
use App\Models\GroupMember;

class GroupManagementTest extends TestCase
{
    use RefreshDatabase;

    protected Period $period;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed active period with group size config
        $this->period = Period::create([
            'name' => 'Ganjil 2023/2024',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
            'min_group_size' => 2,
            'max_group_size' => 3,
        ]);
    }

    public function test_student_can_create_group()
    {
        $student = User::factory()->create(['role' => 'mahasiswa']);

        $response = $this->actingAs($student)->postJson('/api/mahasiswa/group');

        $response->assertStatus(201);
        // Group starts in FORMING status without a title
        $this->assertDatabaseHas('groups', [
            'period_id' => $this->period->id,
            'status' => 'FORMING',
        ]);
        $this->assertDatabaseHas('group_members', [
            'student_id' => $student->id,
            'is_leader' => true,
        ]);
    }

    public function test_leader_can_add_member()
    {
        $leader = User::factory()->create(['role' => 'mahasiswa']);
        $memberToAdd = User::factory()->create(['role' => 'mahasiswa', 'email' => 'newmember@test.com']);

        // Create group in FORMING status
        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'FORMING',
        ]);

        GroupMember::create([
            'group_id' => $group->id,
            'student_id' => $leader->id,
            'is_leader' => true,
        ]);

        // Act: Leader adds member
        $response = $this->actingAs($leader)->postJson('/api/mahasiswa/group/add-member', [
            'email' => 'newmember@test.com',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('group_members', [
            'group_id' => $group->id,
            'student_id' => $memberToAdd->id,
            'is_leader' => false,
        ]);
    }

    public function test_cannot_add_member_if_quota_full()
    {
        $leader = User::factory()->create(['role' => 'mahasiswa']);
        $member1 = User::factory()->create(['role' => 'mahasiswa']);
        $member2 = User::factory()->create(['role' => 'mahasiswa']);
        $memberToAdd = User::factory()->create(['role' => 'mahasiswa', 'email' => 'overflow@test.com']);

        // Group already at max_group_size=3
        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'FORMING',
        ]);

        GroupMember::create(['group_id' => $group->id, 'student_id' => $leader->id, 'is_leader' => true]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $member1->id, 'is_leader' => false]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $member2->id, 'is_leader' => false]);

        // Act: Try to add a 4th member (max is 3)
        $response = $this->actingAs($leader)->postJson('/api/mahasiswa/group/add-member', [
            'email' => 'overflow@test.com',
        ]);

        $response->assertStatus(400);
        $this->assertDatabaseMissing('group_members', ['student_id' => $memberToAdd->id]);
    }

    public function test_leader_can_remove_member()
    {
        $leader = User::factory()->create(['role' => 'mahasiswa']);
        $member = User::factory()->create(['role' => 'mahasiswa']);

        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'FORMING',
        ]);

        GroupMember::create(['group_id' => $group->id, 'student_id' => $leader->id, 'is_leader' => true]);
        $membership = GroupMember::create(['group_id' => $group->id, 'student_id' => $member->id, 'is_leader' => false]);

        // Act: Remove member
        $response = $this->actingAs($leader)->deleteJson("/api/mahasiswa/group/members/{$membership->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('group_members', ['id' => $membership->id]);
    }

    public function test_non_leader_cannot_add_member()
    {
        $leader = User::factory()->create(['role' => 'mahasiswa']);
        $member = User::factory()->create(['role' => 'mahasiswa']);
        $outsider = User::factory()->create(['role' => 'mahasiswa', 'email' => 'outsider@test.com']);

        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'FORMING',
        ]);

        GroupMember::create(['group_id' => $group->id, 'student_id' => $leader->id, 'is_leader' => true]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $member->id, 'is_leader' => false]);

        // Act: Non-leader tries to add someone
        $response = $this->actingAs($member)->postJson('/api/mahasiswa/group/add-member', [
            'email' => 'outsider@test.com',
        ]);

        $response->assertStatus(403);
    }
}
