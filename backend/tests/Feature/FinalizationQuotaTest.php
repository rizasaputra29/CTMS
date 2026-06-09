<?php

namespace Tests\Feature;

use App\Models\Bid;
use App\Models\Group;
use App\Models\Period;
use App\Models\Role;
use App\Models\Title;
use App\Models\User;
use App\Services\FinalizationService;
use App\Services\GroupStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinalizationQuotaTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;

    protected $lecturer;

    protected $period;

    protected $service;

    protected function setUp(): void
    {
        parent::setUp();

        // Setup Roles
        Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);
        Role::firstOrCreate(['slug' => 'dosen'], ['name' => 'Dosen']);
        Role::firstOrCreate(['slug' => 'mahasiswa'], ['name' => 'Mahasiswa']);

        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@ctms.com',
            'password' => bcrypt('password'),
        ]);
        $this->admin->roles()->attach(Role::where('slug', 'admin')->first());

        $this->lecturer = User::create([
            'name' => 'Dosen',
            'email' => 'dosen@ctms.com',
            'role' => 'dosen',
            'password' => bcrypt('password'),
        ]);
        $this->lecturer->roles()->attach(Role::where('slug', 'dosen')->first());

        $this->period = Period::create([
            'name' => 'Ganjil 2025',
            'is_active' => true,
            'is_finalized' => false,
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
        ]);

        $this->service = new FinalizationService(new GroupStateMachine);
    }

    public function test_cannot_allocate_group_if_quota_is_full()
    {
        // 1. Create a title with quota 1
        $title = Title::create([
            'title' => 'IoT Smart City',
            'lecturer_id' => $this->lecturer->id,
            'quota' => 1,
            'status' => 'OPEN',
            'title_source' => 'LECTURER',
        ]);

        // 2. Create Group A and allocate it to the title
        $groupA = Group::create(['period_id' => $this->period->id, 'status' => 'PDC1_ACTIVE', 'title_id' => $title->id]);

        // 3. Create Group B and a bid for the same title
        $groupB = Group::create(['period_id' => $this->period->id, 'status' => 'READY_FOR_BIDDING']);
        $bidB = Bid::create([
            'group_id' => $groupB->id,
            'title_id' => $title->id,
            'priority' => 1,
            'lecturer_recommendation' => 'ACCEPT',
            'status' => 'PENDING',
        ]);

        // 4. Try to allocate Group B
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage("Kuota judul 'IoT Smart City' sudah penuh (1/1).");

        $this->service->allocateGroup($bidB->id, $this->lecturer->id, null, $this->admin->id);
    }

    public function test_cannot_allocate_student_proposed_if_quota_is_full()
    {
        // 1. Create a title with quota 1 (proposed by Group A)
        $groupA = Group::create(['period_id' => $this->period->id, 'status' => 'PDC1_ACTIVE']);
        $title = Title::create([
            'title' => 'Blockchain IoT',
            'lecturer_id' => $this->lecturer->id,
            'proposed_by_group_id' => $groupA->id,
            'quota' => 1,
            'status' => 'OPEN',
            'title_source' => 'STUDENT',
            'supervisor_approval_status' => 'APPROVED',
        ]);
        $groupA->update(['title_id' => $title->id]);

        // 2. Create Group B and try to take the same student-proposed title
        $groupB = Group::create(['period_id' => $this->period->id, 'status' => 'READY_FOR_BIDDING']);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage("Kuota judul 'Blockchain IoT' sudah penuh (1/1).");

        $this->service->allocateStudentProposed($groupB->id, $title->id, $this->lecturer->id, null, $this->admin->id);
    }
}
