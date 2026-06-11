<?php

namespace Tests\Feature;

use App\Models\Period;
use App\Models\Role;
use App\Models\Stakeholder;
use App\Models\Title;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StakeholderControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $lecturer;

    private Period $period;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);
        $dosenRole = Role::firstOrCreate(['slug' => 'dosen'], ['name' => 'Dosen']);

        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->admin->roles()->sync([$adminRole->id]);

        $this->lecturer = User::factory()->create(['role' => 'dosen']);
        $this->lecturer->roles()->sync([$dosenRole->id]);

        $this->period = Period::create([
            'name' => 'Stakeholder Test Period',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
        ]);
    }

    public function test_admin_can_attach_stakeholder_to_student_proposed_title(): void
    {
        $stakeholder = Stakeholder::create([
            'name' => 'PT Inovasi Nusantara',
            'type' => 'INDUSTRY',
        ]);

        $title = Title::create([
            'title' => 'Student Proposed Topic',
            'description' => 'desc',
            'problem_statement' => 'problem',
            'scope' => 'scope',
            'lecturer_id' => $this->lecturer->id,
            'proposed_supervisor_id' => $this->lecturer->id,
            'title_source' => 'STUDENT',
            'supervisor_approval_status' => 'PENDING',
            'period_id' => $this->period->id,
            'quota' => 1,
            'status' => 'open',
        ]);

        $response = $this->actingAs($this->admin)->postJson("/api/admin/titles/{$title->id}/stakeholders", [
            'stakeholder_id' => $stakeholder->id,
            'role' => 'ADVISOR',
            'notes' => 'External industry advisor',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('stakeholder_title', [
            'title_id' => $title->id,
            'stakeholder_id' => $stakeholder->id,
            'role' => 'ADVISOR',
        ]);
    }

    public function test_admin_cannot_attach_stakeholder_to_lecturer_title(): void
    {
        $stakeholder = Stakeholder::create([
            'name' => 'Komunitas Riset',
            'type' => 'COMMUNITY',
        ]);

        $title = Title::create([
            'title' => 'Lecturer Topic',
            'description' => 'desc',
            'problem_statement' => 'problem',
            'scope' => 'scope',
            'lecturer_id' => $this->lecturer->id,
            'title_source' => 'LECTURER',
            'period_id' => $this->period->id,
            'quota' => 1,
            'status' => 'open',
        ]);

        $response = $this->actingAs($this->admin)->postJson("/api/admin/titles/{$title->id}/stakeholders", [
            'stakeholder_id' => $stakeholder->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => 'Stakeholders can only be attached to student-proposed titles.']);

        $this->assertDatabaseMissing('stakeholder_title', [
            'title_id' => $title->id,
            'stakeholder_id' => $stakeholder->id,
        ]);
    }
}
