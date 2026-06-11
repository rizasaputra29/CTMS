<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Sync group title assignments based on title's pre_assigned_group_id.
     * This fixes the mismatch where titles have pre_assigned_group_id set
     * but groups don't have title_id set.
     */
    public function up(): void
    {
        // Find titles with pre_assigned_group_id that don't have matching group title_id
        $titles = DB::table('titles')
            ->whereNotNull('pre_assigned_group_id')
            ->get();

        foreach ($titles as $title) {
            // Check if group exists and is in correct status
            $group = DB::table('groups')->find($title->pre_assigned_group_id);

            if ($group && $group->title_id !== $title->id) {
                // Only update if group is READY_FOR_BIDDING and in same period
                if ($group->status === 'READY_FOR_BIDDING' && $group->period_id === $title->period_id) {
                    DB::table('groups')
                        ->where('id', $group->id)
                        ->update([
                            'title_id' => $title->id,
                            'status' => 'TITLE_APPROVED',
                            'updated_at' => now(),
                        ]);

                    // Create audit log
                    DB::table('finalization_audits')->insert([
                        'period_id' => $group->period_id,
                        'group_id' => $group->id,
                        'user_id' => $title->lecturer_id,
                        'action' => 'TITLE_ASSIGNED_BY_LECTURER',
                        'old_values' => json_encode(['title_id' => null, 'status' => 'READY_FOR_BIDDING']),
                        'new_values' => json_encode(['title_id' => $title->id, 'status' => 'TITLE_APPROVED']),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    /**
     * Reverse the migration.
     */
    public function down(): void
    {
        // This migration syncs data, rollback would be complex
        // and could cause data loss. We'll leave it as-is.
    }
};
