<?php

namespace App\Console\Commands;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Role;
use App\Models\Title;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class ImportCapstoneStudents extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'import:capstone-students {csvPath} {--period-name=\"Capstone TA Semester 1 Tahun 2026\"} {--start-date=2026-01-20}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Import capstone students from CSV into a new period with groups and titles';

    private array $stats = [
        'periods_created' => 0,
        'users_created' => 0,
        'users_existing' => 0,
        'registrations_created' => 0,
        'titles_created' => 0,
        'groups_created' => 0,
        'members_assigned' => 0,
        'errors' => [],
    ];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $csvPath = $this->argument('csvPath');
        $periodName = $this->option('period-name');
        $startDate = $this->option('start-date');

        if (! file_exists($csvPath)) {
            $this->error("CSV file not found: {$csvPath}");

            return Command::FAILURE;
        }

        $this->info("Starting import from: {$csvPath}");
        $this->info("Period name: {$periodName}");
        $this->info("Start date: {$startDate}");

        // Parse CSV
        $groups = $this->parseCsv($csvPath);
        $this->info('Parsed '.count($groups).' groups with '.array_sum(array_map(fn ($g) => count($g['students']), $groups)).' students');

        if (count($groups) === 0) {
            $this->error('No valid groups found in CSV.');

            return Command::FAILURE;
        }

        // Get mahasiswa role
        $mahasiswaRole = Role::where('slug', 'mahasiswa')->first();
        if (! $mahasiswaRole) {
            $this->error("Role 'mahasiswa' not found in database.");

            return Command::FAILURE;
        }

        // Get admin user for placeholder lecturer
        $adminUser = User::where('role', 'admin')->orWhereHas('roles', fn ($q) => $q->where('slug', 'admin'))->first();
        if (! $adminUser) {
            $this->warn('No admin user found. Title lecturer_id will be null (may cause issues).');
        }

        DB::beginTransaction();

        try {
            // Step 1: Create Period
            $period = $this->createPeriod($periodName, $startDate);
            $this->info("Created period ID: {$period->id}");

            // Step 2-8: Process each group
            foreach ($groups as $groupData) {
                $this->processGroup($groupData, $period, $mahasiswaRole, $adminUser);
            }

            DB::commit();

            // Print stats
            $this->newLine();
            $this->info('=== IMPORT SUMMARY ===');
            $this->info("Periods created: {$this->stats['periods_created']}");
            $this->info("Users created: {$this->stats['users_created']}");
            $this->info("Users already existed: {$this->stats['users_existing']}");
            $this->info("Registrations created: {$this->stats['registrations_created']}");
            $this->info("Titles created: {$this->stats['titles_created']}");
            $this->info("Groups created: {$this->stats['groups_created']}");
            $this->info("Members assigned: {$this->stats['members_assigned']}");

            if (! empty($this->stats['errors'])) {
                $this->warn('Errors encountered:');
                foreach ($this->stats['errors'] as $error) {
                    $this->warn("  - {$error}");
                }
            }

            $this->info('Import completed successfully!');

            return Command::SUCCESS;

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error('Import failed: '.$e->getMessage());
            $this->error($e->getTraceAsString());

            return Command::FAILURE;
        }
    }

    /**
     * Parse CSV file into structured group data.
     */
    private function parseCsv(string $csvPath): array
    {
        $handle = fopen($csvPath, 'r');
        if (! $handle) {
            throw new \Exception("Cannot open CSV file: {$csvPath}");
        }

        // Skip first two header rows
        fgetcsv($handle); // Row 1: empty/dash
        fgetcsv($handle); // Row 2: column headers

        $groups = [];
        $currentGroup = null;

        while (($row = fgetcsv($handle)) !== false) {
            // Clean up the row
            $row = array_map(fn ($cell) => trim($cell ?? ''), $row);

            // Skip empty rows
            if (empty(array_filter($row, fn ($v) => $v !== ''))) {
                continue;
            }

            // Check if this row has group info (column 0 has a number)
            if (! empty($row[0]) && is_numeric($row[0])) {
                // Save previous group if exists
                if ($currentGroup !== null) {
                    $groups[] = $currentGroup;
                }

                // Start new group
                $groupNumber = (int) $row[0];
                $title = $row[1] ?? '';
                $supervisor1 = $row[2] ?? '';
                $supervisor2 = $row[3] ?? '';
                $expoPeriod = $row[4] ?? '';
                $no = $row[5] ?? '';
                $nim = $row[6] ?? '';
                $name = $row[7] ?? '';

                $currentGroup = [
                    'number' => $groupNumber,
                    'title' => $title,
                    'supervisor_1' => $supervisor1,
                    'supervisor_2' => $supervisor2,
                    'expo_period' => $expoPeriod,
                    'students' => [],
                ];

                // Add first student if present
                if (! empty($nim) && ! empty($name)) {
                    $currentGroup['students'][] = [
                        'nim' => $nim,
                        'name' => $name,
                    ];
                }
            } else {
                // This is a continuation row with just student info
                $no = $row[5] ?? '';
                $nim = $row[6] ?? '';
                $name = $row[7] ?? '';

                if (! empty($nim) && ! empty($name) && $currentGroup !== null) {
                    $currentGroup['students'][] = [
                        'nim' => $nim,
                        'name' => $name,
                    ];
                }
            }
        }

        // Save last group
        if ($currentGroup !== null) {
            $groups[] = $currentGroup;
        }

        fclose($handle);

        return $groups;
    }

    /**
     * Create the new period.
     */
    private function createPeriod(string $name, string $startDate): Period
    {
        $start = Carbon::parse($startDate);
        $end = $start->copy()->addMonths(6);

        $period = Period::create([
            'name' => $name,
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'is_active' => true,
            'is_finalized' => false,
            'min_group_size' => 3,
            'max_group_size' => 4,
            'allow_solo' => false,
            'require_all_students_grouped' => true,
            'max_supervisor_load' => 8,
            'max_supervise_load' => 8,
            'bidding_start' => $start->copy(),
            'bidding_end' => $start->copy()->addDays(30),
            'pdc1_start' => $start->copy()->addDays(45)->toDateString(),
            'pdc1_end' => $start->copy()->addDays(60)->toDateString(),
            'pdc2_start' => $start->copy()->addDays(75)->toDateString(),
            'pdc2_end' => $start->copy()->addDays(90)->toDateString(),
            'expo_date' => $start->copy()->addDays(105)->toDateString(),
            'ta_start' => $start->copy()->addDays(110)->toDateString(),
            'ta_end' => $end->toDateString(),
            'phase_dates' => [
                'bidding' => ['start' => $start->toDateString(), 'end' => $start->copy()->addDays(30)->toDateString()],
                'pdc1' => ['start' => $start->copy()->addDays(45)->toDateString(), 'end' => $start->copy()->addDays(60)->toDateString()],
                'pdc2' => ['start' => $start->copy()->addDays(75)->toDateString(), 'end' => $start->copy()->addDays(90)->toDateString()],
                'expo' => ['start' => $start->copy()->addDays(105)->toDateString(), 'end' => $start->copy()->addDays(105)->toDateString()],
                'ta' => ['start' => $start->copy()->addDays(110)->toDateString(), 'end' => $end->toDateString()],
            ],
        ]);

        $this->stats['periods_created']++;

        return $period;
    }

    /**
     * Process a single group: create users, title, group, and assign members.
     */
    private function processGroup(array $groupData, Period $period, Role $mahasiswaRole, ?User $adminUser): void
    {
        $groupNumber = $groupData['number'];
        $titleText = trim($groupData['title']);
        $hasTitle = ! empty($titleText) && strtolower($titleText) !== 'belum ada judul';

        $this->info("Processing Group {$groupNumber} (".count($groupData['students']).' students)');

        // Step 1: Create or find students
        $studentIds = [];
        foreach ($groupData['students'] as $index => $studentData) {
            $user = $this->createOrFindStudent($studentData, $mahasiswaRole);
            if ($user) {
                $studentIds[] = ['id' => $user->id, 'is_first' => $index === 0];

                // Register to period
                $this->registerStudentToPeriod($user->id, $period->id);
            }
        }

        if (empty($studentIds)) {
            $this->stats['errors'][] = "Group {$groupNumber}: No valid students found";

            return;
        }

        // Step 2: Create Title (if has title)
        $titleId = null;
        if ($hasTitle) {
            $title = Title::create([
                'lecturer_id' => $adminUser?->id,
                'title' => $titleText,
                'description' => $titleText,
                'quota' => count($studentIds),
                'status' => 'CLOSED',
                'approved_by_admin' => true,
                'title_source' => 'ADMIN',
                'period_id' => $period->id,
                'supervisor_approval_status' => 'APPROVED',
            ]);
            $titleId = $title->id;
            $this->stats['titles_created']++;
        }

        // Step 3: Create Group
        $status = $hasTitle ? 'READY_FOR_FINALIZATION' : 'READY_FOR_BIDDING';
        $groupCode = 'S1T26K'.str_pad((string) $groupNumber, 2, '0', STR_PAD_LEFT);

        $group = Group::create([
            'code' => $groupCode,
            'period_id' => $period->id,
            'title_id' => $titleId,
            'status' => $status,
            'group_mode' => 'NORMAL',
            'is_solo' => false,
        ]);
        $this->stats['groups_created']++;

        // Step 4: Assign members
        foreach ($studentIds as $studentInfo) {
            GroupMember::create([
                'group_id' => $group->id,
                'student_id' => $studentInfo['id'],
                'period_id' => $period->id,
                'is_leader' => $studentInfo['is_first'],
            ]);
            $this->stats['members_assigned']++;
        }

        $this->info("  -> Created group ID {$group->id} with status {$status}");
    }

    /**
     * Create or find a student user.
     */
    private function createOrFindStudent(array $studentData, Role $mahasiswaRole): ?User
    {
        $nim = $studentData['nim'];
        $name = $studentData['name'];
        $email = $nim.'@student.undip.ac.id';

        // Check if user already exists by NIM or email
        $user = User::where('nim', $nim)->orWhere('email', $email)->first();

        if ($user) {
            $this->stats['users_existing']++;
            // Ensure role is set
            if (! $user->roles()->where('role_id', $mahasiswaRole->id)->exists()) {
                $user->roles()->attach($mahasiswaRole->id);
            }

            return $user;
        }

        // Create new user
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'mahasiswa',
            'nim' => $nim,
            'is_active' => true,
        ]);

        $user->roles()->attach($mahasiswaRole->id);

        $this->stats['users_created']++;

        return $user;
    }

    /**
     * Register a student to the period.
     */
    private function registerStudentToPeriod(int $userId, int $periodId): void
    {
        DB::table('period_registrations')->updateOrInsert(
            ['user_id' => $userId, 'period_id' => $periodId],
            ['updated_at' => now(), 'created_at' => now()]
        );
        $this->stats['registrations_created']++;
    }
}
