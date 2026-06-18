<?php

namespace Tests\Feature\Admin;

use App\Models\AssessmentComponentTemplate;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\PeriodAssessmentComponent;
use App\Models\Role;
use App\Models\SeminarSchedule;
use App\Models\SemproScore;
use App\Models\SidangTaScore;
use App\Models\TaDefenseSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseEvaluatorScoresTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $supervisor1;

    private User $supervisor2;

    private User $examiner1;

    private User $examiner2;

    private User $student;

    private Period $period;

    private Group $group;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);
        $dosenRole = Role::firstOrCreate(['slug' => 'dosen'], ['name' => 'Dosen']);
        $mahasiswaRole = Role::firstOrCreate(['slug' => 'mahasiswa'], ['name' => 'Mahasiswa']);

        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->admin->roles()->sync([$adminRole->id]);

        $this->supervisor1 = User::factory()->create(['role' => 'dosen']);
        $this->supervisor1->roles()->sync([$dosenRole->id]);

        $this->supervisor2 = User::factory()->create(['role' => 'dosen']);
        $this->supervisor2->roles()->sync([$dosenRole->id]);

        $this->examiner1 = User::factory()->create(['role' => 'dosen']);
        $this->examiner1->roles()->sync([$dosenRole->id]);

        $this->examiner2 = User::factory()->create(['role' => 'dosen']);
        $this->examiner2->roles()->sync([$dosenRole->id]);

        $this->student = User::factory()->create(['role' => 'mahasiswa', 'nim' => '123456']);
        $this->student->roles()->sync([$mahasiswaRole->id]);

        $this->period = Period::create([
            'name' => 'Phase Evaluator Test Period',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
            'min_group_size' => 1,
            'max_group_size' => 4,
        ]);

        $this->group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'READY_FOR_TA_INDIVIDUAL',
            'supervisor_1_id' => $this->supervisor1->id,
            'supervisor_2_id' => $this->supervisor2->id,
        ]);

        GroupMember::create([
            'group_id' => $this->group->id,
            'student_id' => $this->student->id,
            'is_leader' => true,
            'period_id' => $this->period->id,
        ]);
    }

    public function test_pdc1_returns_evaluator_scores_mapped_to_roles(): void
    {
        // Create a SEMPRO schedule so examiner1 gets mapped to EXAMINER_1
        SeminarSchedule::create([
            'group_id' => $this->group->id,
            'type' => 'SEMPRO',
            'date' => now()->addDays(3)->format('Y-m-d'),
            'start_time' => '09:00',
            'end_time' => '11:00',
            'room' => 'Room B',
            'examiner_1_id' => $this->examiner1->id,
            'examiner_2_id' => $this->examiner2->id,
            'status' => 'SCHEDULED',
        ]);

        $template = AssessmentComponentTemplate::create([
            'name' => 'Penyajian',
            'code' => 'PENYAJIAN',
            'weight' => 1.0,
            'category' => 'SEMPRO',
            'is_active' => true,
        ]);

        $component = PeriodAssessmentComponent::create([
            'period_id' => $this->period->id,
            'template_id' => $template->id,
            'weight' => 1.0,
            'type' => 'SEMPRO',
        ]);

        SemproScore::create([
            'student_id' => $this->student->id,
            'group_id' => $this->group->id,
            'period_component_id' => $component->id,
            'examiner_id' => $this->examiner1->id,
            'score' => 85,
        ]);

        SemproScore::create([
            'student_id' => $this->student->id,
            'group_id' => $this->group->id,
            'period_component_id' => $component->id,
            'examiner_id' => $this->supervisor1->id,
            'score' => 80,
        ]);

        $response = $this->actingAs($this->admin)->getJson('/api/admin/reports/phase-evaluations?period_id='.$this->period->id.'&phase=pdc1');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(1, $data);

        $evaluations = $data[0]['evaluations'];
        $this->assertArrayHasKey('SEMPRO', $evaluations);

        $roles = collect($evaluations['SEMPRO']['evaluators'])->pluck('role')->toArray();
        $this->assertContains('EXAMINER_1', $roles);
        $this->assertContains('SUPERVISOR_1', $roles);
    }

    public function test_ta_returns_examiner_roles_from_defense_schedule(): void
    {
        $template = AssessmentComponentTemplate::create([
            'name' => 'Sidang TA',
            'code' => 'SIDANG_TA',
            'weight' => 1.0,
            'category' => 'SIDANG_TA',
            'is_active' => true,
        ]);

        $component = PeriodAssessmentComponent::create([
            'period_id' => $this->period->id,
            'template_id' => $template->id,
            'weight' => 1.0,
            'type' => 'SEMPRO',
        ]);

        $schedule = TaDefenseSchedule::create([
            'group_id' => $this->group->id,
            'period_id' => $this->period->id,
            'examiner_1_id' => $this->examiner1->id,
            'examiner_2_id' => $this->examiner2->id,
            'student_id' => $this->student->id,
            'date' => now()->addDays(7)->format('Y-m-d'),
            'start_time' => '10:00',
            'end_time' => '12:00',
            'room' => 'Room A',
            'status' => 'SCHEDULED',
        ]);

        $schedule->students()->attach($this->student->id);

        SidangTaScore::create([
            'student_id' => $this->student->id,
            'group_id' => $this->group->id,
            'period_component_id' => $component->id,
            'examiner_id' => $this->examiner1->id,
            'score' => 90,
        ]);

        SidangTaScore::create([
            'student_id' => $this->student->id,
            'group_id' => $this->group->id,
            'period_component_id' => $component->id,
            'examiner_id' => $this->examiner2->id,
            'score' => 88,
        ]);

        $response = $this->actingAs($this->admin)->getJson('/api/admin/reports/phase-evaluations?period_id='.$this->period->id.'&phase=ta');

        $response->assertStatus(200);
        $data = $response->json('data');
        $evaluations = $data[0]['evaluations'];

        $evaluators = collect($evaluations['SIDANG_TA']['evaluators'])->keyBy('role');
        $this->assertEquals(90, $evaluators['EXAMINER_1']['score']);
        $this->assertEquals(88, $evaluators['EXAMINER_2']['score']);
    }

    public function test_unauthorized_user_cannot_access_phase_evaluations(): void
    {
        $mahasiswaRole = Role::firstOrCreate(['slug' => 'mahasiswa'], ['name' => 'Mahasiswa']);
        $student = User::factory()->create(['role' => 'mahasiswa']);
        $student->roles()->sync([$mahasiswaRole->id]);

        $response = $this->actingAs($student)->getJson('/api/admin/reports/phase-evaluations?period_id='.$this->period->id.'&phase=pdc1');

        $response->assertStatus(403);
    }
}
