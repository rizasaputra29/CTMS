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

    protected function setUp(): void
    {
        parent::setUp();

        // Seed active period
        Period::create([
            'name' => 'Ganjil 2023/2024', // Added missing name
            'academic_year' => '2023/2024',
            'semester' => 'odd',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
        ]);
    }

    public function test_student_can_bid_and_create_group()
    {
        $lecturer = User::factory()->create(['role' => 'dosen']);
        $student = User::factory()->create(['role' => 'mahasiswa']);
        $title = Title::create([
            'title' => 'Test Thesis Title',
            'description' => 'Test Desc', // Added description (nullable in migration but let's be safe)
            'lecturer_id' => $lecturer->id,
            'quota' => 2, // Quota = 2 members
            'status' => 'open',
        ]);

        $response = $this->actingAs($student)->postJson('/api/mahasiswa/group', [
            'title_id' => $title->id,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('groups', ['title_id' => $title->id]);
        $this->assertDatabaseHas('group_members', [
            'student_id' => $student->id,
            'is_leader' => true, // First member is leader
        ]);
    }

    public function test_leader_can_add_member()
    {
        // Setup existing group with leader
        $lecturer = User::factory()->create(['role' => 'dosen']);
        $leader = User::factory()->create(['role' => 'mahasiswa']);
        $memberToAdd = User::factory()->create(['role' => 'mahasiswa', 'email' => 'newmember@test.com']);

        $title = Title::create([
            'title' => 'Test Thesis Title',
            'description' => 'Desc',
            'lecturer_id' => $lecturer->id,
            'quota' => 3,
            'status' => 'open',
        ]);

        // Create group manually first
        $period = Period::first();
        $group = Group::create([
            'title_id' => $title->id,
            'period_id' => $period->id,
            'status' => 'PENDING',
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
        $lecturer = User::factory()->create(['role' => 'dosen']);
        $leader = User::factory()->create(['role' => 'mahasiswa']);
        $member1 = User::factory()->create(['role' => 'mahasiswa']);
        $memberToAdd = User::factory()->create(['role' => 'mahasiswa', 'email' => 'overflow@test.com']);

        $title = Title::create([
            'title' => 'Small Quota Title',
            'description' => 'Desc',
            'lecturer_id' => $lecturer->id,
            'quota' => 2, // Max 2 members
            'status' => 'open',
        ]);

        $period = Period::first();
        $group = Group::create([
            'title_id' => $title->id,
            'period_id' => $period->id,
            'status' => 'PENDING',
        ]);

        GroupMember::create(['group_id' => $group->id, 'student_id' => $leader->id, 'is_leader' => true]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $member1->id, 'is_leader' => false]);

        // Act: Try to add a 3rd member
        $response = $this->actingAs($leader)->postJson('/api/mahasiswa/group/add-member', [
            'email' => 'overflow@test.com',
        ]);

        $response->assertStatus(400); // Expect bad request due to quota
        $this->assertDatabaseMissing('group_members', ['student_id' => $memberToAdd->id]);
    }

    public function test_leader_can_remove_member()
    {
        $lecturer = User::factory()->create(['role' => 'dosen']);
        $leader = User::factory()->create(['role' => 'mahasiswa']);
        $member = User::factory()->create(['role' => 'mahasiswa']);

        $title = Title::create([
            'title' => 'Test Title',
            'description' => 'Desc',
            'lecturer_id' => $lecturer->id,
            'quota' => 3,
            'status' => 'open',
        ]);

        $period = Period::first();
        $group = Group::create([
            'title_id' => $title->id,
            'period_id' => $period->id,
            'status' => 'PENDING',
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
        $lecturer = User::factory()->create(['role' => 'dosen']);
        $leader = User::factory()->create(['role' => 'mahasiswa']);
        $member = User::factory()->create(['role' => 'mahasiswa']); // Regular member
        $outsider = User::factory()->create(['role' => 'mahasiswa', 'email' => 'outsider@test.com']);

        $title = Title::create([
            'title' => 'Test Title',
            'description' => 'Desc',
            'lecturer_id' => $lecturer->id,
            'quota' => 3,
            'status' => 'open',
        ]);

        $period = Period::first();
        $group = Group::create([
            'title_id' => $title->id,
            'period_id' => $period->id,
            'status' => 'PENDING',
        ]);

        GroupMember::create(['group_id' => $group->id, 'student_id' => $leader->id, 'is_leader' => true]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $member->id, 'is_leader' => false]);

        // Act: Non-leader member tries to add someone
        $response = $this->actingAs($member)->postJson('/api/mahasiswa/group/add-member', [
            'email' => 'outsider@test.com',
        ]);

        // The implementation logic check:
        // "Find leader's group" via `GroupMember::where('student_id', $user->id)->first()`
        // But logic relies on permissions? The controller currently doesn't restrict addMember to ONLY leader, 
        // it just checks if the user is in the group. Wait, let me check the controller logic again.
        // It says:
        /*
        $leaderMembership = GroupMember::where('student_id', $user->id)->first();
        if (!$leaderMembership) ...
        */
        // It doesn't check if $leaderMembership->is_leader is true!
        // Ah, bug found via test planning! I need to fix the controller first.

        // I will write the test assuming it SHOULD fail (403), then I'll fix the controller.
        $response->assertStatus(403);
    }
}
