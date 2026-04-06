<?php

namespace Tests\Feature;

use App\Models\Bid;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Role;
use App\Models\Title;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GroupMarketplaceTest extends TestCase
{
    use RefreshDatabase;

    protected User $leader;
    protected User $student2;
    protected User $student3;
    protected User $dosen;
    protected Group $group;
    protected Period $period;
    protected Title $facultyTitle;

    protected function setUp(): void
    {
        parent::setUp();

        $mahasiswaRole = Role::firstOrCreate(['name' => 'Mahasiswa', 'slug' => 'mahasiswa']);
        $dosenRole = Role::firstOrCreate(['name' => 'Dosen', 'slug' => 'dosen']);

        $this->dosen = User::create(['name' => 'Dosen', 'email' => 'dosen@test.com', 'password' => bcrypt('pw'), 'role' => 'dosen']);
        $this->dosen->roles()->attach($dosenRole->id);

        $this->leader = User::create(['name' => 'Leader', 'email' => 'leader@test.com', 'password' => bcrypt('pw'), 'role' => 'mahasiswa']);
        $this->leader->roles()->attach($mahasiswaRole->id);

        $this->student2 = User::create(['name' => 'S2', 'email' => 's2@test.com', 'password' => bcrypt('pw'), 'role' => 'mahasiswa']);
        $this->student2->roles()->attach($mahasiswaRole->id);

        $this->student3 = User::create(['name' => 'S3', 'email' => 's3@test.com', 'password' => bcrypt('pw'), 'role' => 'mahasiswa']);
        $this->student3->roles()->attach($mahasiswaRole->id);

        $this->period = Period::create([
            'name' => 'Test',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
            'is_finalized' => false,
            'min_group_size' => 3,
            'max_group_size' => 4,
            'bidding_start' => now()->subDays(1),
            'bidding_end' => now()->addDays(7),
        ]);

        $this->facultyTitle = Title::create([
            'title' => 'Faculty Title',
            'description' => 'Desc',
            'lecturer_id' => $this->dosen->id,
            'period_id' => $this->period->id,
            'quota' => 2,
            'status' => 'APPROVED',
        ]);

        $this->group = Group::create(['period_id' => $this->period->id, 'status' => 'READY_FOR_BIDDING']);
        GroupMember::create(['group_id' => $this->group->id, 'student_id' => $this->leader->id, 'is_leader' => true, 'period_id' => $this->period->id]);
    }

    public function test_bid_rejected_if_members_less_than_3(): void
    {
        // Currently only 1 member (the leader)
        $response = $this->actingAs($this->leader)->postJson('/api/mahasiswa/bids', [
            'title_id' => $this->facultyTitle->id,
            'priority' => 1,
            'proposed_supervisor_1_id' => $this->dosen->id,
        ]);

        $response->assertStatus(403);
        $response->assertJsonFragment(['message' => 'Kelompok Anda memiliki 1 anggota. Minimal 3 anggota diperlukan untuk melakukan bidding pada judul Dosen.']);
    }

    public function test_bid_allowed_if_members_are_3(): void
    {
        // Add 2 more members
        GroupMember::create(['group_id' => $this->group->id, 'student_id' => $this->student2->id, 'is_leader' => false, 'period_id' => $this->period->id]);
        GroupMember::create(['group_id' => $this->group->id, 'student_id' => $this->student3->id, 'is_leader' => false, 'period_id' => $this->period->id]);

        $response = $this->actingAs($this->leader)->postJson('/api/mahasiswa/bids', [
            'title_id' => $this->facultyTitle->id,
            'priority' => 1,
            'proposed_supervisor_1_id' => $this->dosen->id,
        ]);

        $response->assertStatus(201);
    }

    public function test_bid_rejected_if_period_finalized(): void
    {
        // Add 2 more members to satisfy count check
        GroupMember::create(['group_id' => $this->group->id, 'student_id' => $this->student2->id, 'is_leader' => false, 'period_id' => $this->period->id]);
        GroupMember::create(['group_id' => $this->group->id, 'student_id' => $this->student3->id, 'is_leader' => false, 'period_id' => $this->period->id]);

        // Finalize the period
        $this->period->update(['is_finalized' => true]);

        $response = $this->actingAs($this->leader)->postJson('/api/mahasiswa/bids', [
            'title_id' => $this->facultyTitle->id,
            'priority' => 1,
            'proposed_supervisor_1_id' => $this->dosen->id,
        ]);

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'Pendaftaran untuk periode ini sudah ditutup.']);
    }

    public function test_join_request_rejected_if_period_finalized(): void
    {
        $soloLeader = User::create(['name' => 'Solo', 'email' => 'solo@test.com', 'password' => bcrypt('pw'), 'role' => 'mahasiswa']);
        $soloGroup = Group::create(['period_id' => $this->period->id, 'status' => 'FORMING']);
        GroupMember::create(['group_id' => $soloGroup->id, 'student_id' => $soloLeader->id, 'is_leader' => true, 'period_id' => $this->period->id]);

        // Finalize period
        $this->period->update(['is_finalized' => true]);

        $response = $this->actingAs($this->leader)->postJson("/api/mahasiswa/bursa-ide/{$soloGroup->id}/request-join", [
            'message' => 'Let me in',
        ]);

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'Pendaftaran untuk periode ini sudah ditutup.']);
    }
}
