<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Role;
use App\Models\TaDefenseEvaluation;
use App\Models\TaSubmission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class TaDefenseMultiStudentTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $admin;

    protected $dosen1;

    protected $dosen2;

    protected $student1;

    protected $student2;

    protected $period;

    protected $group;

    protected function setUp(): void
    {
        parent::setUp();

        // Ensure roles exist
        $adminRole = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);
        $dosenRole = Role::firstOrCreate(['slug' => 'dosen'], ['name' => 'Dosen']);
        $mahasiswaRole = Role::firstOrCreate(['slug' => 'mahasiswa'], ['name' => 'Mahasiswa']);

        // Create users - use roles relationship only
        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->admin->roles()->sync([$adminRole->id]);

        $this->dosen1 = User::factory()->create(['role' => 'dosen']);
        $this->dosen1->roles()->sync([$dosenRole->id]);

        $this->dosen2 = User::factory()->create(['role' => 'dosen']);
        $this->dosen2->roles()->sync([$dosenRole->id]);

        $this->student1 = User::factory()->create(['role' => 'mahasiswa']);
        $this->student1->roles()->sync([$mahasiswaRole->id]);

        $this->student2 = User::factory()->create(['role' => 'mahasiswa']);
        $this->student2->roles()->sync([$mahasiswaRole->id]);

        // Create period
        $this->period = Period::create([
            'name' => 'Test Period',
            'start_date' => now(),
            'end_date' => now()->addMonths(6),
            'is_active' => true,
            'min_group_size' => 2,
            'max_group_size' => 4,
        ]);

        // Create group with students
        $this->group = Group::create([
            'name' => 'Test Group',
            'period_id' => $this->period->id,
            'status' => 'READY_FOR_TA_INDIVIDUAL',
            'supervisor_1_id' => $this->dosen1->id,
        ]);

        GroupMember::create([
            'group_id' => $this->group->id,
            'student_id' => $this->student1->id,
            'is_leader' => true,
            'period_id' => $this->period->id,
        ]);

        GroupMember::create([
            'group_id' => $this->group->id,
            'student_id' => $this->student2->id,
            'is_leader' => false,
            'period_id' => $this->period->id,
        ]);

        // Create TA submissions for both students with TA_DOCUMENTS_APPROVED status
        TaSubmission::create([
            'student_id' => $this->student1->id,
            'group_id' => $this->group->id,
            'period_id' => $this->period->id,
            'status' => 'TA_DOCUMENTS_APPROVED',
            'file_path' => 'path1.pdf',
        ]);

        TaSubmission::create([
            'student_id' => $this->student2->id,
            'group_id' => $this->group->id,
            'period_id' => $this->period->id,
            'status' => 'TA_DOCUMENTS_APPROVED',
            'file_path' => 'path2.pdf',
        ]);
    }

    public function test_ta_defense_schedule_is_visible_to_all_students_in_schedule()
    {
        // Create schedule with multiple students via API
        $response = $this->actingAs($this->admin)->postJson('/api/admin/ta-defense-schedules', [
            'group_id' => $this->group->id,
            'student_ids' => [$this->student1->id, $this->student2->id],
            'period_id' => $this->period->id,
            'examiner_1_id' => $this->dosen1->id,
            'examiner_2_id' => $this->dosen2->id,
            'date' => now()->addDays(7)->format('Y-m-d'),
            'start_time' => '10:00',
            'end_time' => '12:00',
            'room' => 'Room A',
        ]);

        $response->assertStatus(201);
        $scheduleId = $response->json('data.id');

        // Verify schedule is visible to student 1
        $response1 = $this->actingAs($this->student1)->getJson('/api/mahasiswa/ta-defense-schedules/my-schedule');
        $response1->assertStatus(200);
        $schedules1 = $response1->json('data');
        $this->assertCount(1, $schedules1);
        $this->assertEquals($scheduleId, $schedules1[0]['id']);

        // Verify schedule is visible to student 2
        $response2 = $this->actingAs($this->student2)->getJson('/api/mahasiswa/ta-defense-schedules/my-schedule');
        $response2->assertStatus(200);
        $schedules2 = $response2->json('data');
        $this->assertCount(1, $schedules2);
        $this->assertEquals($scheduleId, $schedules2[0]['id']);

        // Verify evaluations were created for both students
        $evaluations = TaDefenseEvaluation::where('schedule_id', $scheduleId)->get();
        $this->assertCount(4, $evaluations); // 2 students x 2 examiners = 4 evaluations

        $studentIds = $evaluations->pluck('student_id')->unique()->toArray();
        $this->assertContains($this->student1->id, $studentIds);
        $this->assertContains($this->student2->id, $studentIds);
    }

    public function test_single_student_schedule_is_visible_to_that_student()
    {
        // Create schedule with single student via API
        $response = $this->actingAs($this->admin)->postJson('/api/admin/ta-defense-schedules', [
            'group_id' => $this->group->id,
            'student_ids' => [$this->student1->id],
            'period_id' => $this->period->id,
            'examiner_1_id' => $this->dosen1->id,
            'examiner_2_id' => $this->dosen2->id,
            'date' => now()->addDays(7)->format('Y-m-d'),
            'start_time' => '10:00',
            'end_time' => '12:00',
            'room' => 'Room A',
        ]);

        $response->assertStatus(201);
        $scheduleId = $response->json('data.id');

        // Verify schedule is visible to student 1
        $response1 = $this->actingAs($this->student1)->getJson('/api/mahasiswa/ta-defense-schedules/my-schedule');
        $response1->assertStatus(200);
        $schedules1 = $response1->json('data');
        $this->assertCount(1, $schedules1);
        $this->assertEquals($scheduleId, $schedules1[0]['id']);

        // Verify schedule is NOT visible to student 2 (who is not in the schedule)
        $response2 = $this->actingAs($this->student2)->getJson('/api/mahasiswa/ta-defense-schedules/my-schedule');
        $response2->assertStatus(200);
        $schedules2 = $response2->json('data');
        $this->assertCount(0, $schedules2);

        // Verify evaluations were created for only student 1
        $evaluations = TaDefenseEvaluation::where('schedule_id', $scheduleId)->get();
        $this->assertCount(2, $evaluations); // 1 student x 2 examiners = 2 evaluations

        $studentIds = $evaluations->pluck('student_id')->unique()->toArray();
        $this->assertContains($this->student1->id, $studentIds);
        $this->assertNotContains($this->student2->id, $studentIds);
    }

    public function test_ta_defense_is_visible_via_my_defense_endpoint()
    {
        // Create schedule with multiple students
        $response = $this->actingAs($this->admin)->postJson('/api/admin/ta-defense-schedules', [
            'group_id' => $this->group->id,
            'student_ids' => [$this->student1->id, $this->student2->id],
            'period_id' => $this->period->id,
            'examiner_1_id' => $this->dosen1->id,
            'examiner_2_id' => $this->dosen2->id,
            'date' => now()->addDays(7)->format('Y-m-d'),
            'start_time' => '10:00',
            'end_time' => '12:00',
            'room' => 'Room A',
        ]);

        $response->assertStatus(201);
        $scheduleId = $response->json('data.id');

        // Test TaDefenseController@myDefense for student 1
        $response1 = $this->actingAs($this->student1)->getJson('/api/mahasiswa/ta-defense');
        $response1->assertStatus(200);
        $data1 = $response1->json('data');
        $this->assertNotNull($data1);
        $this->assertEquals($scheduleId, $data1['id']);

        // Test TaDefenseController@myDefense for student 2
        $response2 = $this->actingAs($this->student2)->getJson('/api/mahasiswa/ta-defense');
        $response2->assertStatus(200);
        $data2 = $response2->json('data');
        $this->assertNotNull($data2);
        $this->assertEquals($scheduleId, $data2['id']);
    }

    public function test_ta_defense_is_visible_via_student_all_schedules_endpoint()
    {
        // Create schedule with multiple students
        $response = $this->actingAs($this->admin)->postJson('/api/admin/ta-defense-schedules', [
            'group_id' => $this->group->id,
            'student_ids' => [$this->student1->id, $this->student2->id],
            'period_id' => $this->period->id,
            'examiner_1_id' => $this->dosen1->id,
            'examiner_2_id' => $this->dosen2->id,
            'date' => now()->addDays(7)->format('Y-m-d'),
            'start_time' => '10:00',
            'end_time' => '12:00',
            'room' => 'Room A',
        ]);

        $response->assertStatus(201);
        $scheduleId = $response->json('data.id');

        // Test ScheduleController@studentAllSchedules for student 1
        $response1 = $this->actingAs($this->student1)->getJson('/api/mahasiswa/all-schedules');
        $response1->assertStatus(200);
        $schedules1 = $response1->json('data');
        $taSchedules1 = array_filter($schedules1, fn ($s) => $s['type'] === 'TA_DEFENSE');
        $this->assertCount(1, $taSchedules1);
        $this->assertEquals($scheduleId, array_values($taSchedules1)[0]['id']);

        // Test ScheduleController@studentAllSchedules for student 2
        $response2 = $this->actingAs($this->student2)->getJson('/api/mahasiswa/all-schedules');
        $response2->assertStatus(200);
        $schedules2 = $response2->json('data');
        $taSchedules2 = array_filter($schedules2, fn ($s) => $s['type'] === 'TA_DEFENSE');
        $this->assertCount(1, $taSchedules2);
        $this->assertEquals($scheduleId, array_values($taSchedules2)[0]['id']);
    }

    public function test_ta_defense_is_visible_via_seminar_dashboard_endpoint()
    {
        // Create schedule with multiple students
        $response = $this->actingAs($this->admin)->postJson('/api/admin/ta-defense-schedules', [
            'group_id' => $this->group->id,
            'student_ids' => [$this->student1->id, $this->student2->id],
            'period_id' => $this->period->id,
            'examiner_1_id' => $this->dosen1->id,
            'examiner_2_id' => $this->dosen2->id,
            'date' => now()->addDays(7)->format('Y-m-d'),
            'start_time' => '10:00',
            'end_time' => '12:00',
            'room' => 'Room A',
        ]);

        $response->assertStatus(201);
        $scheduleId = $response->json('data.id');

        // Test SeminarDashboardController@studentSchedules for student 1
        $response1 = $this->actingAs($this->student1)->getJson('/api/mahasiswa/seminar-schedules');
        $response1->assertStatus(200);
        $data1 = $response1->json('data');
        $this->assertNotNull($data1['ta_defense']);
        $this->assertEquals($scheduleId, $data1['ta_defense']['id']);

        // Test SeminarDashboardController@studentSchedules for student 2
        $response2 = $this->actingAs($this->student2)->getJson('/api/mahasiswa/seminar-schedules');
        $response2->assertStatus(200);
        $data2 = $response2->json('data');
        $this->assertNotNull($data2['ta_defense']);
        $this->assertEquals($scheduleId, $data2['ta_defense']['id']);
    }
}
