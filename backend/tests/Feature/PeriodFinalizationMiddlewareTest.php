<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\PeriodRegistration;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PeriodFinalizationMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    protected User $student;

    protected Period $period;

    protected function setUp(): void
    {
        parent::setUp();

        // Create mahasiswa role
        Role::firstOrCreate(['slug' => 'mahasiswa'], ['name' => 'Mahasiswa']);

        // Create student user
        $this->student = User::factory()->create([
            'role' => 'mahasiswa',
            'is_active' => true,
        ]);
        $this->student->roles()->attach(Role::where('slug', 'mahasiswa')->first()->id);

        // Create active period (not finalized)
        $this->period = Period::create([
            'name' => 'Test Period ' . now()->format('Y-m-d H:i:s'),
            'start_date' => now()->subMonth(),
            'end_date' => now()->addMonth(),
            'is_active' => true,
            'is_finalized' => false,
            'min_group_size' => 3,
            'max_group_size' => 4,
            'allow_solo' => true,
            'require_all_students_grouped' => true,
        ]);

        // Register student to period
        PeriodRegistration::create([
            'user_id' => $this->student->id,
            'period_id' => $this->period->id,
            'status' => 'active',
        ]);

        // Create a group for the student
        $group = Group::create([
            'period_id' => $this->period->id,
            'status' => 'FORMING',
            'code' => 'GRP-' . rand(1000, 9999),
        ]);

        GroupMember::create([
            'group_id' => $group->id,
            'student_id' => $this->student->id,
            'period_id' => $this->period->id,
            'is_leader' => true,
        ]);
    }

    public function test_allowed_routes_are_accessible_when_period_is_not_finalized(): void
    {
        $this->actingAs($this->student, 'sanctum');

        // Dashboard
        $response = $this->getJson('/api/mahasiswa/dashboard');
        $response->assertStatus(200);

        // My Period
        $response = $this->getJson('/api/mahasiswa/my-period');
        $response->assertStatus(200);

        // Titles
        $response = $this->getJson('/api/mahasiswa/titles');
        $response->assertStatus(200);

        // Group
        $response = $this->getJson('/api/mahasiswa/group');
        $response->assertStatus(200);

        // Bids
        $response = $this->getJson('/api/mahasiswa/bids');
        $response->assertStatus(200);

        // Propose Title
        $response = $this->getJson('/api/mahasiswa/lecturers');
        $response->assertStatus(200);

        // Period Registration Check
        $response = $this->getJson("/api/mahasiswa/periods/{$this->period->id}/check-registration");
        $response->assertStatus(200);
    }

    public function test_restricted_routes_return_403_when_period_is_not_finalized(): void
    {
        $this->actingAs($this->student, 'sanctum');

        // Documents
        $response = $this->getJson('/api/mahasiswa/documents');
        $response->assertStatus(403);
        $response->assertJson(['message' => 'Akses ditolak. Menu ini tersedia setelah periode di-finalisasi.']);

        // Schedules
        $response = $this->getJson('/api/mahasiswa/schedules');
        $response->assertStatus(403);

        // TA Submission
        $response = $this->getJson('/api/mahasiswa/ta-submission');
        $response->assertStatus(403);

        // Peer Review
        $response = $this->getJson('/api/mahasiswa/peer-review');
        $response->assertStatus(403);

        // My Grades
        $response = $this->getJson('/api/mahasiswa/my-grades');
        $response->assertStatus(403);

        // TA Status
        $response = $this->getJson('/api/mahasiswa/ta-status');
        $response->assertStatus(403);

        // Expo Events
        $response = $this->getJson('/api/mahasiswa/expo-events');
        $response->assertStatus(403);

        // All Schedules
        $response = $this->getJson('/api/mahasiswa/all-schedules');
        $response->assertStatus(403);
    }

    public function test_restricted_routes_are_accessible_when_period_is_finalized(): void
    {
        // Finalize the period
        $this->period->update(['is_finalized' => true]);

        $this->actingAs($this->student, 'sanctum');

        // Documents
        $response = $this->getJson('/api/mahasiswa/documents');
        $response->assertStatus(200);

        // Schedules
        $response = $this->getJson('/api/mahasiswa/schedules');
        $response->assertStatus(200);

        // TA Submission
        $response = $this->getJson('/api/mahasiswa/ta-submission');
        $response->assertStatus(200);

        // Peer Review
        $response = $this->getJson('/api/mahasiswa/peer-review');
        $response->assertStatus(200);

        // My Grades
        $response = $this->getJson('/api/mahasiswa/my-grades');
        $response->assertStatus(200);

        // TA Status
        $response = $this->getJson('/api/mahasiswa/ta-status');
        $response->assertStatus(200);

        // Expo Events
        $response = $this->getJson('/api/mahasiswa/expo-events');
        $response->assertStatus(200);
    }

    public function test_restricted_routes_return_403_when_student_has_no_period_registration(): void
    {
        // Remove period registration
        PeriodRegistration::where('user_id', $this->student->id)->delete();

        $this->actingAs($this->student, 'sanctum');

        // Documents
        $response = $this->getJson('/api/mahasiswa/documents');
        $response->assertStatus(403);
        $response->assertJson(['message' => 'Anda belum terdaftar pada periode aktif.']);
    }

    public function test_allowed_routes_work_even_without_period_registration(): void
    {
        // Remove period registration
        PeriodRegistration::where('user_id', $this->student->id)->delete();

        $this->actingAs($this->student, 'sanctum');

        // Dashboard
        $response = $this->getJson('/api/mahasiswa/dashboard');
        $response->assertStatus(200);

        // Titles
        $response = $this->getJson('/api/mahasiswa/titles');
        $response->assertStatus(200);
    }
}
