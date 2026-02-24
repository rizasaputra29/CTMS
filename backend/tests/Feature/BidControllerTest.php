<?php

namespace Tests\Feature;

use App\Models\Bid;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Title;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BidControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $leader;
    protected User $member;
    protected User $dosen;
    protected Group $group;
    protected Period $period;
    protected Title $title1;
    protected Title $title2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dosen = User::create([
            'name' => 'Dosen',
            'email' => 'dosen@test.com',
            'password' => bcrypt('pw'),
            'role' => 'dosen',
        ]);

        $this->leader = User::create([
            'name' => 'Leader',
            'email' => 'leader@test.com',
            'password' => bcrypt('pw'),
            'role' => 'mahasiswa',
        ]);

        $this->member = User::create([
            'name' => 'Member',
            'email' => 'member@test.com',
            'password' => bcrypt('pw'),
            'role' => 'mahasiswa',
        ]);

        $this->period = Period::create([
            'name' => 'Test',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
            'min_group_size' => 2,
            'max_group_size' => 4,
            'bidding_start' => now()->subDays(1),
            'bidding_end' => now()->addDays(7),
        ]);

        $this->title1 = Title::create([
            'title' => 'Title A',
            'description' => 'Desc A',
            'lecturer_id' => $this->dosen->id,
            'period_id' => $this->period->id,
            'quota' => 2,
            'status' => 'APPROVED',
        ]);

        $this->title2 = Title::create([
            'title' => 'Title B',
            'description' => 'Desc B',
            'lecturer_id' => $this->dosen->id,
            'period_id' => $this->period->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        $this->group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'READY_FOR_BIDDING',
        ]);
        GroupMember::create(['group_id' => $this->group->id, 'student_id' => $this->leader->id, 'is_leader' => true]);
        GroupMember::create(['group_id' => $this->group->id, 'student_id' => $this->member->id, 'is_leader' => false]);
    }

    // ══════════════════════════════════════════
    // Bid CRUD
    // ══════════════════════════════════════════

    public function test_leader_can_submit_bid(): void
    {
        $response = $this->actingAs($this->leader)->postJson('/api/mahasiswa/bids', [
            'title_id' => $this->title1->id,
            'priority' => 1,
            'proposed_supervisor_1_id' => $this->dosen->id,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('bids', [
            'group_id' => $this->group->id,
            'title_id' => $this->title1->id,
            'priority' => 1,
            'status' => 'PENDING',
        ]);
    }

    public function test_non_leader_cannot_submit_bid(): void
    {
        $response = $this->actingAs($this->member)->postJson('/api/mahasiswa/bids', [
            'title_id' => $this->title1->id,
            'priority' => 1,
            'proposed_supervisor_1_id' => $this->dosen->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_leader_can_list_bids(): void
    {
        Bid::create([
            'group_id' => $this->group->id,
            'title_id' => $this->title1->id,
            'priority' => 1,
            'status' => 'PENDING',
        ]);

        $response = $this->actingAs($this->leader)->getJson('/api/mahasiswa/bids');
        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
    }

    public function test_leader_can_delete_pending_bid(): void
    {
        $bid = Bid::create([
            'group_id' => $this->group->id,
            'title_id' => $this->title1->id,
            'priority' => 1,
            'status' => 'PENDING',
        ]);

        $response = $this->actingAs($this->leader)->deleteJson("/api/mahasiswa/bids/{$bid->id}");
        $response->assertStatus(200);
        $this->assertDatabaseMissing('bids', ['id' => $bid->id]);
    }

    // ══════════════════════════════════════════
    // Duplicate prevention
    // ══════════════════════════════════════════

    public function test_duplicate_priority_rejected(): void
    {
        Bid::create([
            'group_id' => $this->group->id,
            'title_id' => $this->title1->id,
            'priority' => 1,
            'status' => 'PENDING',
        ]);

        $response = $this->actingAs($this->leader)->postJson('/api/mahasiswa/bids', [
            'title_id' => $this->title2->id,
            'priority' => 1, // Same priority
            'proposed_supervisor_1_id' => $this->dosen->id,
        ]);

        $response->assertStatus(400);
    }

    public function test_duplicate_title_rejected(): void
    {
        Bid::create([
            'group_id' => $this->group->id,
            'title_id' => $this->title1->id,
            'priority' => 1,
            'status' => 'PENDING',
        ]);

        $response = $this->actingAs($this->leader)->postJson('/api/mahasiswa/bids', [
            'title_id' => $this->title1->id, // Same title
            'priority' => 2,
            'proposed_supervisor_1_id' => $this->dosen->id,
        ]);

        $response->assertStatus(400);
    }

    // ══════════════════════════════════════════
    // Window / Lock enforcement
    // ══════════════════════════════════════════

    public function test_bid_blocked_when_locked(): void
    {
        $this->period->update(['bidding_locked_at' => now()]);

        $response = $this->actingAs($this->leader)->postJson('/api/mahasiswa/bids', [
            'title_id' => $this->title1->id,
            'priority' => 1,
            'proposed_supervisor_1_id' => $this->dosen->id,
        ]);

        $response->assertStatus(400);
        $response->assertJson(['message' => 'Bidding is locked.']);
    }

    public function test_bid_blocked_when_window_closed(): void
    {
        $this->period->update([
            'bidding_start' => now()->subDays(10),
            'bidding_end' => now()->subDays(1),
        ]);

        $response = $this->actingAs($this->leader)->postJson('/api/mahasiswa/bids', [
            'title_id' => $this->title1->id,
            'priority' => 1,
            'proposed_supervisor_1_id' => $this->dosen->id,
        ]);

        $response->assertStatus(400);
    }

    public function test_delete_blocked_when_locked(): void
    {
        $bid = Bid::create([
            'group_id' => $this->group->id,
            'title_id' => $this->title1->id,
            'priority' => 1,
            'status' => 'PENDING',
        ]);

        $this->period->update(['bidding_locked_at' => now()]);

        $response = $this->actingAs($this->leader)->deleteJson("/api/mahasiswa/bids/{$bid->id}");
        $response->assertStatus(400);
    }

    // ══════════════════════════════════════════
    // Status guard
    // ══════════════════════════════════════════

    public function test_bid_blocked_for_wrong_group_status(): void
    {
        $this->group->update(['status' => 'FORMING']);

        $response = $this->actingAs($this->leader)->postJson('/api/mahasiswa/bids', [
            'title_id' => $this->title1->id,
            'priority' => 1,
            'proposed_supervisor_1_id' => $this->dosen->id,
        ]);

        $response->assertStatus(400);
        $response->assertJson(['message' => 'Group must be in READY_FOR_BIDDING status to bid.']);
    }

    // ══════════════════════════════════════════
    // Lecturer recommendation
    // ══════════════════════════════════════════

    public function test_lecturer_can_recommend(): void
    {
        $bid = Bid::create([
            'group_id' => $this->group->id,
            'title_id' => $this->title1->id,
            'priority' => 1,
            'status' => 'PENDING',
        ]);

        $response = $this->actingAs($this->dosen)->putJson("/api/dosen/bids/{$bid->id}/recommend", [
            'recommendation' => 'ACCEPT',
        ]);

        $response->assertStatus(200);
        $bid->refresh();
        $this->assertEquals('ACCEPT', $bid->lecturer_recommendation);
    }

    public function test_wrong_lecturer_cannot_recommend(): void
    {
        $otherDosen = User::create([
            'name' => 'Other',
            'email' => 'other@test.com',
            'password' => bcrypt('pw'),
            'role' => 'dosen',
        ]);

        $bid = Bid::create([
            'group_id' => $this->group->id,
            'title_id' => $this->title1->id,
            'priority' => 1,
            'status' => 'PENDING',
        ]);

        $response = $this->actingAs($otherDosen)->putJson("/api/dosen/bids/{$bid->id}/recommend", [
            'recommendation' => 'ACCEPT',
        ]);

        $response->assertStatus(403);
    }
}
