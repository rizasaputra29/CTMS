<?php

namespace App\Console\Commands;

use App\Models\Period;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupImportResidue extends Command
{
    protected $signature = 'import:cleanup-residue';

    protected $description = 'Clean up residue data from previous import';

    public function handle(): int
    {
        $this->info('Starting cleanup of import residue...');

        // Find the period created by import
        $period = Period::where('name', 'Capstone TA Semester 1 Tahun 2026')->first();

        if ($period) {
            $periodId = $period->id;
            $this->info("Found period ID: {$periodId}");

            // 1. Delete group_members
            $deletedMembers = DB::table('group_members')->where('period_id', $periodId)->delete();
            $this->info("Deleted {$deletedMembers} group_members");

            // 2. Delete groups
            $deletedGroups = DB::table('groups')->where('period_id', $periodId)->delete();
            $this->info("Deleted {$deletedGroups} groups");

            // 3. Delete titles
            $deletedTitles = DB::table('titles')->where('period_id', $periodId)->delete();
            $this->info("Deleted {$deletedTitles} titles");

            // 4. Delete period_registrations
            $deletedRegs = DB::table('period_registrations')->where('period_id', $periodId)->delete();
            $this->info("Deleted {$deletedRegs} period_registrations");

            // 5. Delete period
            $period->delete();
            $this->info("Deleted period ID: {$periodId}");
        } else {
            $this->warn("No period 'Capstone TA Semester 1 Tahun 2026' found.");
        }

        // 6. Delete users with student.undip.ac.id emails that have no remaining registrations
        $emails = DB::table('users')
            ->where('email', 'like', '%@student.undip.ac.id')
            ->pluck('email');

        $deletedUsers = 0;
        foreach ($emails as $email) {
            $user = User::where('email', $email)->first();
            if ($user) {
                // Only delete if user has no period registrations
                $hasRegistrations = DB::table('period_registrations')
                    ->where('user_id', $user->id)
                    ->exists();

                if (! $hasRegistrations) {
                    // Also check if user is not in any remaining groups
                    $hasGroups = DB::table('group_members')
                        ->where('student_id', $user->id)
                        ->exists();

                    if (! $hasGroups) {
                        $user->delete();
                        $deletedUsers++;
                    }
                }
            }
        }

        $this->info("Deleted {$deletedUsers} orphaned student users");
        $this->info('Cleanup completed!');

        return Command::SUCCESS;
    }
}
