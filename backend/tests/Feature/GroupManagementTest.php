<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Period;
use App\Models\Title;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Role;

class GroupManagementTest extends TestCase
{
    use RefreshDatabase;

    protected Period $period;
    protected Role $studentRole;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Setup Roles
        $this->studentRole = Role::firstOrCreate(['name' => 'Mahasiswa', 'slug' => 'mahasiswa']);
        Role::firstOrCreate(['name' => 'Dosen', 'slug' => 'dosen']);
        Role::firstOrCreate(['name' => 'Admin', 'slug' => 'admin']);

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

    private function createStudent(array $attributes = []): User
    {
        $user = User::factory()->create(array_merge(['role' => 'mahasiswa'], $attributes));
        $user->roles()->attach($this->studentRole->id);
        return $user;
    }

    public function test_student_can_create_group()
    {
        $student = $this->createStudent();

        $response = $this->actingAs($student)->postJson('/api/mahasiswa/group');

        $response->assertStatus(201);
        $this->assertDatabaseHas('groups', [
            'period_id' => $this->period->id,
            'status' => 'FORMING_SOLO',
        ]);
        $this->assertDatabaseHas('group_members', [
            'student_id' => $student->id,
            'is_leader' => true,
        ]);
    }

    public function test_leader_can_add_member()
    {
        $leader = $this->createStudent();
        $memberToAdd = $this->createStudent(['email' => 'newmember@test.com']);

        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'FORMING',
        ]);

        GroupMember::create([
            'group_id' => $group->id,
            'student_id' => $leader->id,
            'is_leader' => true,
            'period_id' => $this->period->id,
        ]);

        $response = $this->actingAs($leader)->postJson('/api/mahasiswa/group/add-member', [
            'email' => 'newmember@test.com',
        ]);

        $response->assertStatus(200);
        
        $this->assertDatabaseHas('group_invitations', [
            'group_id' => $group->id,
            'student_id' => $memberToAdd->id,
            'status' => 'PENDING'
        ]);

        $invite = \App\Models\GroupInvitation::where('student_id', $memberToAdd->id)->first();
        $acceptResponse = $this->actingAs($memberToAdd)->postJson("/api/mahasiswa/group-invitations/{$invite->id}/accept");
        $acceptResponse->assertStatus(200);

        $this->assertDatabaseHas('group_members', [
            'group_id' => $group->id,
            'student_id' => $memberToAdd->id,
            'is_leader' => false,
        ]);
        
        $this->assertEquals('READY_FOR_BIDDING', $group->fresh()->status);
    }

    public function test_cannot_add_member_if_quota_full()
    {
        $leader = $this->createStudent();
        $member1 = $this->createStudent();
        $member2 = $this->createStudent();
        $memberToAdd = $this->createStudent(['email' => 'overflow@test.com']);

        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'FORMING',
        ]);

        GroupMember::create(['group_id' => $group->id, 'student_id' => $leader->id, 'is_leader' => true, 'period_id' => $this->period->id]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $member1->id, 'is_leader' => false, 'period_id' => $this->period->id]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $member2->id, 'is_leader' => false, 'period_id' => $this->period->id]);

        $response = $this->actingAs($leader)->postJson('/api/mahasiswa/group/add-member', [
            'email' => 'overflow@test.com',
        ]);

        $response->assertStatus(400);
        $this->assertDatabaseMissing('group_members', ['student_id' => $memberToAdd->id]);
    }

    public function test_leader_can_remove_member()
    {
        $leader = $this->createStudent();
        $member = $this->createStudent();

        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'FORMING',
        ]);

        $membershipLeader = GroupMember::create(['group_id' => $group->id, 'student_id' => $leader->id, 'is_leader' => true, 'period_id' => $this->period->id]);
        $membershipMember = GroupMember::create(['group_id' => $group->id, 'student_id' => $member->id, 'is_leader' => false, 'period_id' => $this->period->id]);

        $response = $this->actingAs($leader)->deleteJson("/api/mahasiswa/group/members/{$membershipMember->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('group_members', ['id' => $membershipMember->id]);
    }

    public function test_non_leader_cannot_add_member()
    {
        $leader = $this->createStudent();
        $member = $this->createStudent();
        $outsider = $this->createStudent(['email' => 'outsider@test.com']);

        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'FORMING',
        ]);

        GroupMember::create(['group_id' => $group->id, 'student_id' => $leader->id, 'is_leader' => true, 'period_id' => $this->period->id]);
        GroupMember::create(['group_id' => $group->id, 'student_id' => $member->id, 'is_leader' => false, 'period_id' => $this->period->id]);

        $response = $this->actingAs($member)->postJson('/api/mahasiswa/group/add-member', [
            'email' => 'outsider@test.com',
        ]);

        $response->assertStatus(403);
    }
}
