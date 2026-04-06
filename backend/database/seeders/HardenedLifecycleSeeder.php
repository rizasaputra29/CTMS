<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Period;
use App\Models\PeriodRegistration;
use App\Models\Title;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Bid;
use App\Models\Supervision;
use App\Models\Role;
use App\Services\GroupStateMachine;
use App\Services\FinalizationService;
use Illuminate\Support\Facades\DB;

class HardenedLifecycleSeeder extends Seeder
{
    public function run()
    {
        DB::transaction(function () {
            echo "Starting Hardened Lifecycle Seeder...\n";

            // 1. Setup Roles & Users
            $mahasiswaRole = Role::firstOrCreate(['slug' => 'mahasiswa'], ['name' => 'Mahasiswa']);
            $dosenRole = Role::firstOrCreate(['slug' => 'dosen'], ['name' => 'Dosen']);
            $adminRole = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);

            $admin = User::firstOrCreate(['email' => 'admin_test@test.com'], [
                'name' => 'Admin Test',
                'password' => bcrypt('password'),
                'role' => 'admin'
            ]);
            $admin->roles()->sync([$adminRole->id]);

            $dosen1 = User::firstOrCreate(['email' => 'dosen1_test@test.com'], [
                'name' => 'Dr. Dosen Satu',
                'password' => bcrypt('password'),
                'role' => 'dosen'
            ]);
            $dosen1->roles()->sync([$dosenRole->id]);

            $dosen2 = User::firstOrCreate(['email' => 'dosen2_test@test.com'], [
                'name' => 'Dr. Dosen Dua',
                'password' => bcrypt('password'),
                'role' => 'dosen'
            ]);
            $dosen2->roles()->sync([$dosenRole->id]);

            $students = [];
            for ($i = 1; $i <= 3; $i++) {
                $s = User::firstOrCreate(['email' => "student{$i}_test@test.com"], [
                    'name' => "Student {$i} Test",
                    'password' => bcrypt('password'),
                    'role' => 'mahasiswa'
                ]);
                $s->roles()->sync([$mahasiswaRole->id]);
                $students[] = $s;
            }

            // 2. Cleanup ALL period data for isolation
            echo "Wiping all legacy period data for a clean test...\n";
            Supervision::query()->delete();
            Bid::query()->delete();
            GroupMember::query()->delete();
            DB::table('period_registrations')->delete();
            Title::where('title_source', 'STUDENT')->delete();
            Group::query()->delete();
            Period::query()->delete();
            
            echo "Cleanup complete.\n";

            // 3. Create Active Period
            $periodName = 'Hardened Test Period ' . now()->format('Y-m-d H:i:s');
            $period = Period::create([
                'name' => $periodName,
                'start_date' => now(),
                'end_date' => now()->addMonths(6),
                'is_active' => true,
                'min_group_size' => 3,
                'max_group_size' => 4,
                'bidding_start' => now()->subDay(),
                'bidding_end' => now()->addDays(7),
                'max_supervise_load' => 10,
            ]);
            echo "Created Period: {$period->name}\n";

            // 3. MANDATORY STEP: Period Registration
            foreach ($students as $student) {
                PeriodRegistration::create([
                    'user_id' => $student->id,
                    'period_id' => $period->id,
                ]);
            }
            echo "Registered 3 students for the period.\n";

            // 4. Group Formation
            $group = Group::create([
                'period_id' => $period->id,
                'status' => 'FORMING',
                'group_mode' => 'GROUP',
                'has_existing_group' => false,
            ]);

            foreach (array_slice($students, 0, 3) as $index => $student) {
                GroupMember::create([
                    'group_id' => $group->id,
                    'student_id' => $student->id,
                    'period_id' => $period->id,
                    'is_leader' => $index === 0,
                ]);
            }
            $group->update(['status' => 'READY_FOR_BIDDING']);
            echo "Formed Group #{$group->id} with 3 members (Status: READY_FOR_BIDDING).\n";

            // 5. Title & Bidding
            $title = Title::create([
                'title' => 'Advanced AI in Education',
                'description' => 'Test title for hardened lifecycle',
                'problem_statement' => 'Problem statement for AI test',
                'scope' => 'Scope for AI test',
                'lecturer_id' => $dosen1->id,
                'quota' => 1,
                'title_source' => 'LECTURER',
                'status' => 'open',
                'period_id' => $period->id,
            ]);

            $bid = Bid::create([
                'group_id' => $group->id,
                'title_id' => $title->id,
                'priority' => 1,
                'status' => 'PENDING',
                'proposed_supervisor_1_id' => $dosen1->id,
                'proposed_supervisor_2_id' => $dosen2->id,
                'lecturer_recommendation' => 'ACCEPT', // Recommended right away
            ]);
            echo "Title created and Bid recommended ACCEPT by lecturer.\n";

            // 6. Manual Check Simulation (Ready for Finalization?)
            $service = app(FinalizationService::class);
            $stats = $service->getReadinessStats($period->id);
            echo "Readiness Check:\n";
            echo "- Total Registered: {$stats['total_registered']}\n";
            echo "- Unassigned Students: {$stats['total_unassigned']} (Expect 0)\n";
            echo "- Invalid Groups: {$stats['total_invalid_groups']} (Expect 0)\n";

            // 7. Admin sets supervisors (Rule 4)
            echo "Admin assigning supervisors manually...\n";
            $group->refresh();
            $group->update([
                'supervisor_1_id' => $dosen1->id,
                'supervisor_2_id' => $dosen2->id,
            ]);
            Supervision::updateOrCreate(
                ['group_id' => $group->id, 'role' => 'SUPERVISOR_1'],
                ['supervisor_id' => $dosen1->id, 'assigned_by' => $admin->id]
            );
            Supervision::updateOrCreate(
                ['group_id' => $group->id, 'role' => 'SUPERVISOR_2'],
                ['supervisor_id' => $dosen2->id, 'assigned_by' => $admin->id]
            );

            // 8. Finalization
            echo "Executing Batch Finalization...\n";
            $result = $service->finalizePeriod($period->id, $admin->id);
            echo "Finalization Result: Assigned " . $result['total_allocated'] . " groups.\n";

            $group->refresh();
            echo "Final Group Status: {$group->status}\n";
            echo "Supervisor 1: " . ($group->supervisor_1_id ? User::find($group->supervisor_1_id)->name : 'NONE') . "\n";
            echo "Supervisor 2: " . ($group->supervisor_2_id ? User::find($group->supervisor_2_id)->name : 'NONE') . "\n";

            echo "Hardened Lifecycle Seeder completed successfully!\n";
        });
    }
}
