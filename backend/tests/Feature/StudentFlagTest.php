<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\PeriodRegistration;
use App\Models\Role;
use App\Models\SemproScore;
use App\Models\User;
use App\Services\StudentFlagService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentFlagTest extends TestCase
{
    use RefreshDatabase;

    protected Period $period;

    protected User $student;

    protected User $supervisor;

    protected Group $group;

    protected function setUp(): void
    {
        parent::setUp();

        $studentRole = Role::firstOrCreate(['name' => 'Mahasiswa', 'slug' => 'mahasiswa']);
        $dosenRole = Role::firstOrCreate(['name' => 'Dosen', 'slug' => 'dosen']);

        $this->period = Period::create([
            'name' => 'Ganjil 2026/2027',
            'start_date' => now()->subMonth(),
            'end_date' => now()->addMonth(),
            'is_active' => true,
            'min_group_size' => 2,
            'max_group_size' => 4,
            'grade_configuration' => [
                'pdc1' => ['SEMPRO' => 50, 'BIMBINGAN_SEMPRO' => 50],
                'pdc2' => ['NILAI_DOSEN' => 25, 'MILESTONE' => 25, 'EXPO' => 25, 'PEER_REVIEW' => 25],
                'ta' => ['BIMBINGAN_TA' => 50, 'SIDANG_TA' => 50],
            ],
        ]);

        $this->student = User::factory()->create([
            'role' => 'mahasiswa',
            'nim' => '200001',
        ]);
        $this->student->roles()->attach($studentRole->id);

        $this->supervisor = User::factory()->create([
            'role' => 'dosen',
            'nip' => '900001',
        ]);
        $this->supervisor->roles()->attach($dosenRole->id);

        $this->group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'FORMING',
            'code' => 'GRP-'.rand(1000, 9999),
            'supervisor_1_id' => $this->supervisor->id,
        ]);

        GroupMember::create([
            'group_id' => $this->group->id,
            'student_id' => $this->student->id,
            'period_id' => $this->period->id,
            'is_leader' => true,
        ]);

        PeriodRegistration::create([
            'user_id' => $this->student->id,
            'period_id' => $this->period->id,
            'status' => 'active',
        ]);
    }

    public function test_flagging_student_keeps_period_registration_as_flagged(): void
    {
        $service = app(StudentFlagService::class);

        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $this->assertDatabaseHas('period_registrations', [
            'user_id' => $this->student->id,
            'period_id' => $this->period->id,
            'status' => 'flagged',
        ]);

        $registration = PeriodRegistration::where('user_id', $this->student->id)
            ->where('period_id', $this->period->id)
            ->first();

        $this->assertNotNull($registration->flagged_at);
        $this->assertEquals($this->supervisor->id, $registration->flagged_by);
    }

    public function test_flagging_student_soft_deletes_group_membership(): void
    {
        $service = app(StudentFlagService::class);

        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $this->assertSoftDeleted('group_members', [
            'group_id' => $this->group->id,
            'student_id' => $this->student->id,
            'status' => 'flagged',
        ]);
    }

    public function test_flagged_student_cannot_be_scored(): void
    {
        $service = app(StudentFlagService::class);

        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $this->assertFalse($service->canBeScored($this->student->id, $this->group->id));
    }

    public function test_flagged_student_periods_returns_flagged_period(): void
    {
        $service = app(StudentFlagService::class);
        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $flaggedPeriods = $this->student->flaggedPeriods()->get();

        $this->assertCount(1, $flaggedPeriods);
        $this->assertEquals($this->period->id, $flaggedPeriods->first()->id);
    }

    public function test_flagged_student_cannot_register_for_same_period(): void
    {
        $service = app(StudentFlagService::class);
        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $response = $this->actingAs($this->student, 'sanctum')
            ->postJson('/api/mahasiswa/periods/register', [
                'period_id' => $this->period->id,
            ]);

        $response->assertStatus(403);
        $response->assertJson(['message' => 'You are flagged from this period and cannot register. Contact admin for assistance.']);
    }

    public function test_flagged_student_can_register_for_a_different_period(): void
    {
        $otherPeriod = Period::create([
            'name' => 'Genap 2026/2027',
            'start_date' => now()->addMonth(),
            'end_date' => now()->addMonths(7),
            'is_active' => true,
            'min_group_size' => 2,
            'max_group_size' => 4,
        ]);

        $service = app(StudentFlagService::class);
        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $response = $this->actingAs($this->student, 'sanctum')
            ->postJson('/api/mahasiswa/periods/register', [
                'period_id' => $otherPeriod->id,
            ]);

        $response->assertCreated();
        $this->assertDatabaseHas('period_registrations', [
            'user_id' => $this->student->id,
            'period_id' => $otherPeriod->id,
            'status' => 'active',
        ]);
    }

    public function test_flagged_student_is_not_reported_as_registered(): void
    {
        $service = app(StudentFlagService::class);
        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $response = $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/mahasiswa/periods/{$this->period->id}/check-registration");

        $response->assertOk();
        $response->assertJson(['is_registered' => false]);
    }

    public function test_unflagging_student_restores_active_registration_and_membership(): void
    {
        $service = app(StudentFlagService::class);
        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $service->unflagStudent($this->period, $this->student, $this->supervisor, 'Test unflagging');

        $this->assertDatabaseHas('period_registrations', [
            'user_id' => $this->student->id,
            'period_id' => $this->period->id,
            'status' => 'active',
        ]);

        $registration = PeriodRegistration::where('user_id', $this->student->id)
            ->where('period_id', $this->period->id)
            ->first();

        $this->assertNull($registration->flagged_at);
        $this->assertNull($registration->flagged_by);

        $this->assertDatabaseHas('group_members', [
            'group_id' => $this->group->id,
            'student_id' => $this->student->id,
            'status' => 'active',
            'deleted_at' => null,
        ]);
    }

    public function test_flagged_students_existing_scores_remain_for_reports(): void
    {
        SemproScore::create([
            'group_id' => $this->group->id,
            'student_id' => $this->student->id,
            'examiner_id' => $this->supervisor->id,
            'score' => 85.00,
            'component_id' => null,
            'period_component_id' => null,
        ]);

        $service = app(StudentFlagService::class);
        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $this->assertDatabaseHas('sempro_scores', [
            'group_id' => $this->group->id,
            'student_id' => $this->student->id,
            'score' => 85.00,
        ]);

        // Reports should still include the score even after the student is flagged.
        $this->assertDatabaseHas('group_members', [
            'group_id' => $this->group->id,
            'student_id' => $this->student->id,
            'status' => 'flagged',
        ]);
    }

    public function test_admin_can_still_view_grades_for_flagged_student(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $adminRole = Role::firstOrCreate(['name' => 'Admin', 'slug' => 'admin']);
        $admin->roles()->attach($adminRole->id);

        SemproScore::create([
            'group_id' => $this->group->id,
            'student_id' => $this->student->id,
            'examiner_id' => $this->supervisor->id,
            'score' => 85.00,
            'component_id' => null,
            'period_component_id' => null,
        ]);

        $service = app(StudentFlagService::class);
        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/student-grades/{$this->student->id}");

        $response->assertOk();
        $response->assertJsonPath('student.id', $this->student->id);
        $response->assertJsonPath('period.id', $this->period->id);
    }

    public function test_flagging_already_flagged_student_throws_error(): void
    {
        $service = app(StudentFlagService::class);
        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging');

        $this->expectException(\App\Exceptions\DomainRuleException::class);
        $service->flagStudent($this->period, $this->student, $this->supervisor, 'Test flagging again');
    }

    public function test_admin_can_flag_student_from_group_route(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $adminRole = Role::firstOrCreate(['name' => 'Admin', 'slug' => 'admin']);
        $admin->roles()->attach($adminRole->id);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/dosen/groups/{$this->group->id}/flag-student", [
                'student_id' => $this->student->id,
                'reason' => 'Flagged by admin',
            ]);

        $response->assertOk();
        $response->assertJson(['message' => 'Student flagged successfully.']);

        $this->assertDatabaseHas('period_registrations', [
            'user_id' => $this->student->id,
            'period_id' => $this->period->id,
            'status' => 'flagged',
        ]);
    }

    public function test_dosen_cannot_flag_student_without_supervisor_role(): void
    {
        $otherDosen = User::factory()->create(['role' => 'dosen', 'nip' => '900002']);
        $dosenRole = Role::firstOrCreate(['name' => 'Dosen', 'slug' => 'dosen']);
        $otherDosen->roles()->attach($dosenRole->id);

        $response = $this->actingAs($otherDosen, 'sanctum')
            ->postJson("/api/dosen/groups/{$this->group->id}/flag-student", [
                'student_id' => $this->student->id,
                'reason' => 'Flag attempt',
            ]);

        $response->assertStatus(403);
    }
}
