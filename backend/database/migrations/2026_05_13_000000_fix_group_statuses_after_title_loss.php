<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migration.
     *
     * IMPORTANT: This migration only UPDATES existing records.
     * It does NOT drop any tables, columns, or data.
     * It is safe to run and rollback.
     */
    public function up(): void
    {
        // Get period info to determine min_size
        $groups = DB::table('groups')
            ->whereIn('id', [79, 80])
            ->get();

        foreach ($groups as $group) {
            // Get period min_size
            $period = DB::table('periods')->find($group->period_id);
            $minSize = $period?->min_group_size ?? 3;

            // Get member count
            $memberCount = DB::table('group_members')
                ->where('group_id', $group->id)
                ->count();

            // Get is_solo flag
            $isSolo = $group->is_solo ?? false;
            $allowSolo = $period?->allow_solo ?? false;

            // Determine correct base status
            if ($memberCount >= $minSize) {
                $newStatus = 'READY_FOR_BIDDING';
            } elseif ($memberCount === 2) {
                $newStatus = 'FORMING';
            } elseif ($memberCount === 1 && $isSolo && $allowSolo) {
                $newStatus = 'FORMING_SOLO';
            } else {
                $newStatus = 'FORMING';
            }

            // Clear title_id since they lost their title
            DB::table('groups')
                ->where('id', $group->id)
                ->update([
                    'status' => $newStatus,
                    'title_id' => null,
                    'updated_at' => now(),
                ]);

            // Update the group status (no audit log to avoid FK issues)
            // The status change is tracked in the group's updated_at timestamp
        }
    }

    /**
     * Reverse the migration.
     *
     * IMPORTANT: This rollback ONLY restores the status for groups 79 and 80
     * to a safe default state. It does NOT restore any data.
     */
    public function down(): void
    {
        // Revert to safe defaults - groups with 3 members should be READY_FOR_BIDDING
        foreach ([79, 80] as $groupId) {
            $group = DB::table('groups')->find($groupId);

            if ($group) {
                // Get member count
                $memberCount = DB::table('group_members')
                    ->where('group_id', $groupId)
                    ->count();

                // Default rollback logic
                if ($memberCount >= 3) {
                    $rollbackStatus = 'READY_FOR_BIDDING';
                } elseif ($memberCount === 2) {
                    $rollbackStatus = 'FORMING';
                } elseif ($memberCount === 1 && ($group->is_solo ?? false)) {
                    $rollbackStatus = 'FORMING_SOLO';
                } else {
                    $rollbackStatus = 'FORMING';
                }

                DB::table('groups')
                    ->where('id', $groupId)
                    ->update([
                        'status' => $rollbackStatus,
                        'updated_at' => now(),
                    ]);
            }
        }
    }
};
