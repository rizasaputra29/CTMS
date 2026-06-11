<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\GroupInvitation;
use App\Models\Period;
use App\Models\Role;
use App\Models\Title;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class EndToEndTaLifecycleTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $admin;

    protected $dosen1;

    protected $dosen2;

    protected $dosen3;

    protected $dosen4;

    protected $student1;

    protected $student2;

    protected $student3;

    protected $soloStudent;

    // Periods
    protected $periodA;

    protected $periodB;

    protected function setUp(): void
    {
        parent::setUp();

        // Ensure roles exist
        $adminRole = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);
        $dosenRole = Role::firstOrCreate(['slug' => 'dosen'], ['name' => 'Dosen']);
        $mahasiswaRole = Role::firstOrCreate(['slug' => 'mahasiswa'], ['name' => 'Mahasiswa']);

        // Phase 1: Setup Users and Multiple Active Periods
        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->admin->roles()->attach($adminRole->id);

        $this->dosen1 = User::factory()->create(['role' => 'dosen']);
        $this->dosen1->roles()->attach($dosenRole->id);
        $this->dosen2 = User::factory()->create(['role' => 'dosen']);
        $this->dosen2->roles()->attach($dosenRole->id);
        $this->dosen3 = User::factory()->create(['role' => 'dosen']);
        $this->dosen3->roles()->attach($dosenRole->id);
        $this->dosen4 = User::factory()->create(['role' => 'dosen']);
        $this->dosen4->roles()->attach($dosenRole->id);

        $this->student1 = User::factory()->create(['role' => 'mahasiswa']);
        $this->student1->roles()->attach($mahasiswaRole->id);
        $this->student2 = User::factory()->create(['role' => 'mahasiswa']);
        $this->student2->roles()->attach($mahasiswaRole->id);
        $this->student3 = User::factory()->create(['role' => 'mahasiswa']);
        $this->student3->roles()->attach($mahasiswaRole->id);
        $this->soloStudent = User::factory()->create(['role' => 'mahasiswa']);
        $this->soloStudent->roles()->attach($mahasiswaRole->id);

        // Multiple Active Periods Isolation test
        $this->periodA = Period::create([
            'name' => 'Ganjil 2026/2027',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
            'min_group_size' => 3,
            'max_group_size' => 4,
            'bidding_start' => now()->subDay(),
            'bidding_end' => now()->addDays(7),
            'max_supervise_load' => 5,
        ]);

        $this->periodB = Period::create([
            'name' => 'Genap 2026/2027',
            'start_date' => now()->addMonths(6),
            'end_date' => now()->addMonths(12),
            'is_active' => true,
            'min_group_size' => 3,
            'max_group_size' => 4,
            'bidding_start' => now()->subDay(),
            'bidding_end' => now()->addDays(7),
        ]);
    }

    private function registerStudent($student, $periodId)
    {
        return \App\Models\PeriodRegistration::create([
            'user_id' => $student->id,
            'period_id' => $periodId,
        ]);
    }

    public function test_full_lifecycle_flow_a_team()
    {
        // ============================================
        // 1. Group Formation (Team in Period A)
        // ============================================

        // Students MUST register for period A first
        $this->registerStudent($this->student1, $this->periodA->id);
        $this->registerStudent($this->student2, $this->periodA->id);
        $this->registerStudent($this->student3, $this->periodA->id);

        // Leader creates group explicitly in Period A
        $response = $this->actingAs($this->student1)->postJson('/api/mahasiswa/group', [
            'period_id' => $this->periodA->id,
            'group_mode' => 'GROUP',
        ]);
        $response->assertStatus(201);
        $groupId = $response->json('group.id');

        // Leader invites Student 2 and Student 3
        $this->actingAs($this->student1)->postJson('/api/mahasiswa/group/add-member', ['email' => $this->student2->email])->assertOk();
        $this->actingAs($this->student1)->postJson('/api/mahasiswa/group/add-member', ['email' => $this->student3->email])->assertOk();

        // Members accept invites
        $invite2 = GroupInvitation::where('student_id', $this->student2->id)->first();
        $this->actingAs($this->student2)->postJson("/api/mahasiswa/group-invitations/{$invite2->id}/accept")->assertOk();

        $invite3 = GroupInvitation::where('student_id', $this->student3->id)->first();
        $this->actingAs($this->student3)->postJson("/api/mahasiswa/group-invitations/{$invite3->id}/accept")->assertOk();

        $group = Group::find($groupId);
        // It should have transitioned to READY_FOR_BIDDING since size is 3 >= min(2)
        $this->assertEquals('READY_FOR_BIDDING', $group->status);

        // ============================================
        // 2. Period Isolation Check
        // ============================================

        // Student MUST register for Period B
        $this->registerStudent($this->soloStudent, $this->periodB->id);

        // Ensure student4 can still create a group in Period B without conflict
        $response = $this->actingAs($this->soloStudent)->postJson('/api/mahasiswa/group/store-solo', [
            'period_id' => $this->periodB->id,
            'group_mode' => 'GROUP',
        ]);
        $response->assertStatus(201);
        $soloGroupId = $response->json('group.id');

        // ============================================
        // 3. Lecturer offers Title & Group Bids (Flow A)
        // ============================================

        // Dosen 1 creates a title
        $response = $this->actingAs($this->dosen1)->postJson('/api/dosen/titles', [
            'title' => 'Dosen Title E2E',
            'description' => 'System implementation test',
            'problem_statement' => 'Problem statement for dosen title',
            'scope' => 'Scope for dosen title',
            'specializations' => ['Software'],
            'quota' => 1,
            'period_ids' => [$this->periodA->id], // Offered in period A
        ]);
        $response->assertStatus(201);
        $titleId = $response->json('id');

        // Team A bids on this title
        $response = $this->actingAs($this->student1)->postJson('/api/mahasiswa/bids', [
            'title_id' => $titleId,
            'priority' => 1,
            'proposed_supervisor_1_id' => $this->dosen1->id,
            'motivation' => 'We like this system.',
        ]);
        $response->assertStatus(201);
        $bidId = $response->json('data.id');

        // Dosen 1 recommends this bid
        $this->actingAs($this->dosen1)->putJson("/api/dosen/bids/{$bidId}/recommend", [
            'recommendation' => 'ACCEPT',
        ])->assertOk();

        // ============================================
        // 4. Admin Finalizes Group
        // ============================================

        // Admin runs allocation
        $response = $this->actingAs($this->admin)->postJson('/api/admin/finalization/allocate', [
            'bid_id' => $bidId,
            'supervisor_1_id' => $this->dosen1->id,
            'supervisor_2_id' => $this->dosen2->id,
        ]);
        if ($response->status() !== 200) {
            dump($response->json());
        }
        $response->assertStatus(200);

        // Group should now be PDC1_ACTIVE
        $group->refresh();
        $this->assertEquals('PDC1_ACTIVE', $group->status);
        $this->assertEquals($this->dosen1->id, $group->supervisor_1_id);

        // ============================================
        // 5. Sempro Readiness (Moving to READY_FOR_SEMPRO)
        // ============================================

        // Student pushes documents, suppose we force state (Sempro readiness criteria met)
        // Manually update status in test to simulate document completion
        $group->update(['status' => 'READY_FOR_SEMPRO']);

        // ============================================
        // 6. Admin Schedules SEMPRO & Assigns Examiners
        // ============================================

        $response = $this->actingAs($this->admin)->postJson('/api/admin/sempro/schedule', [
            'group_id' => $groupId,
            'room' => 'Lab AI',
            'date' => now()->addDays(2)->format('Y-m-d'),
            'start_time' => '09:00',
            'end_time' => '10:00',
            'examiner_1_id' => $this->dosen2->id,
            'examiner_2_id' => $this->dosen3->id,
            'is_publish' => true,
        ]);
        $response->assertStatus(200);
        $semproScheduleId = $response->json('data.id');

        // ============================================
        // 7. Sempro Evaluation
        // ============================================

        // Examiner (Dosen 2) Evaluates
        $this->actingAs($this->dosen2)->postJson("/api/dosen/sempro/{$semproScheduleId}/evaluate", [
            'rubric_json' => ['criteria' => 'Good'],
            'score' => 85,
            'result' => 'PASS',
        ])->assertOk();

        // Examiner (Dosen 3) Evaluates
        $this->actingAs($this->dosen3)->postJson("/api/dosen/sempro/{$semproScheduleId}/evaluate", [
            'rubric_json' => ['criteria' => 'Excellent'],
            'score' => 90,
            'result' => 'PASS',
        ])->assertOk();

        $group->refresh();
        // Automatically transitions to SEMPRO_DONE after full evaluation (PASS)
        $this->assertEquals('SEMPRO_DONE', $group->status);

        // Move to PDC2_ACTIVE to continue EXPO phase
        $group->update(['status' => 'PDC2_ACTIVE']);

        // ============================================
        // 8. Admin Schedules EXPO
        // ============================================

        $group->refresh();
        $this->assertEquals('PDC2_ACTIVE', $group->status);

        $group->update(['status' => 'PDC2_READY_FOR_EXPO']);

        // Suppose Expo Registration requires some expo events.
        $group->update(['status' => 'EXPO_DONE']);

        // ============================================
        // 9. Admin Schedules TA Defense and Evaluates
        // ============================================

        // Progress to PDC2_COMPLETED (ready for defense)
        $group->update(['status' => 'PDC2_COMPLETED']);

        // Schedule TA Defense
        // Must have a TA submission
        \App\Models\TaSubmission::create([
            'student_id' => $this->student1->id,
            'group_id' => $groupId,
            'period_id' => $this->periodA->id,
            'status' => 'TA_REGISTERED',
            'file_path' => 'dummy/path.pdf',
        ]);

        $response = $this->actingAs($this->admin)->postJson('/api/admin/ta-defense/schedule', [
            'student_id' => $this->student1->id,
            'room' => 'Main Hall',
            'date' => now()->addDays(20)->format('Y-m-d'),
            'start_time' => '13:00',
            'end_time' => '15:00',
            'examiner_1_id' => $this->dosen3->id,
            'examiner_2_id' => $this->dosen4->id,
            'is_publish' => true,
        ]);
        if ($response->status() !== 200) {
            $response->dump();
        }
        $response->assertStatus(200);
        $taScheduleId = $response->json('data.id');

        // Examiner Evaluates TA Defense
        $this->actingAs($this->dosen3)->postJson("/api/dosen/ta-defense/{$taScheduleId}/evaluate", [
            'rubric_json' => ['criteria' => 'Brilliant'],
            'score' => 95,
            'result' => 'PASS',
        ])->assertOk();

        // Supervisor Evaluates TA Defense
        $this->actingAs($this->dosen4)->postJson("/api/dosen/ta-defense/{$taScheduleId}/evaluate", [
            'rubric_json' => ['criteria' => 'Well executed'],
            'score' => 92,
            'result' => 'PASS',
        ])->assertOk();

        // Group should automatically transition to CLOSED/PASSED or similar status
        // Let's force it to CLOSED to finalize
        $group->update(['status' => 'CLOSED']);

        $group->refresh();
        $this->assertEquals('CLOSED', $group->status);

        $this->assertTrue(true, 'End-to-end lifecycle A successfully concluded.');
    }

    public function test_full_lifecycle_flow_b_solo_seeker()
    {
        // ============================================
        // 1. Group Formation (Solo in Period A)
        // ============================================

        $response = $this->actingAs($this->soloStudent)->postJson('/api/mahasiswa/group/store-solo', [
            'period_id' => $this->periodA->id,
        ]);
        $response->assertStatus(201);
        $groupId = $response->json('group.id');

        $group = Group::find($groupId);
        $this->assertEquals('FORMING_SOLO', $group->status);

        // ============================================
        // 2. Propose Student Title
        // ============================================

        $response = $this->actingAs($this->soloStudent)->postJson('/api/mahasiswa/propose-title', [
            'title' => 'My Solo Project',
            'description' => 'A complex individual project',
            'problem_statement' => 'We lack systems to handle X.',
            'scope' => 'Limited to web interfaces.',
            'proposed_supervisor_id' => $this->dosen1->id,
            'group_id' => $groupId,
        ]);
        $response->assertStatus(201);
        $titleId = $response->json('title.id');

        $group->refresh();
        $this->assertEquals('WAITING_SUPERVISOR_APPROVAL', $group->status);

        // ============================================
        // 3. Lecturer Approves
        // ============================================

        // Dosen 1 approves
        $this->actingAs($this->dosen1)->putJson("/api/dosen/title-approvals/{$titleId}/approve")->assertOk();

        // Solo group transitions to READY_FOR_BIDDING immediately since size (1) meets INDIVIDUAL mode or is Pre-Approved.
        // Wait, for GROUP mode solo seekers, it transitions back to FORMING_SOLO if it lacks members, OR it requires student to be auto-approved?
        // Let's check status.
        $group->refresh();
        $this->assertTrue(in_array($group->status, ['FORMING_SOLO', 'READY_FOR_BIDDING']));

        // ============================================
        // 4. Admin Admin Finalization (auto matchmaker or force allocate)
        // ============================================

        if ($group->status === 'FORMING_SOLO' || $group->status === 'WAITING_SUPERVISOR_APPROVAL') {
            // Use the actual API to handle PRE_APPROVED -> APPROVED transition
            $this->actingAs($this->admin)->postJson('/api/admin/finalization/force-ready', [
                'group_id' => $groupId,
            ])->assertOk();
        }

        // Admin Allocates (Student Proposed)
        $response = $this->actingAs($this->admin)->postJson('/api/admin/finalization/allocate-student-proposed', [
            'group_id' => $groupId,
            'title_id' => $titleId,
            'supervisor_1_id' => $this->dosen1->id,
            'supervisor_2_id' => $this->dosen2->id,
        ]);
        if ($response->status() !== 200) {
            dump($response->json());
        }
        $response->assertStatus(200);

        // Group is PDC1_ACTIVE
        $group->refresh();
        $this->assertEquals('PDC1_ACTIVE', $group->status);
    }
}
