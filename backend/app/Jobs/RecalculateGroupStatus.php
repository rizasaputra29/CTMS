<?php

namespace App\Jobs;

use App\Models\Group;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Recalculate group status based on member count.
 * Dispatched to queue to avoid blocking observer execution.
 */
class RecalculateGroupStatus implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The group ID to recalculate.
     */
    public int $groupId;

    /**
     * Create a new job instance.
     */
    public function __construct(int $groupId)
    {
        $this->groupId = $groupId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $group = Group::find($this->groupId);
        
        if (!$group) {
            return;
        }

        // IMPORTANT: Refresh to get latest status from DB (avoid stale data from eager loading)
        $group->refresh();
        
        // Skip if group is in a finalized or beyond state - these should NOT change
        $finalizedStates = [
            'TITLE_APPROVED',    // Solo title approved - waiting for members to join via marketplace
            'READY_FOR_FINALIZATION', // Locked in after leader clicks button - don't revert
            'KELOMPOK_FINAL',   // Waiting for admin finalization
            'PDC1_ACTIVE',
            'READY_FOR_SEMPRO',
            'SEMPRO_DONE',
            'PDC2_ACTIVE',
            'PDC2_READY_FOR_EXPO',
            'EXPO_REGISTERED',
            'EXPO_DONE',
            'PDC2_COMPLETED',
            'CLOSED',
            'DISSOLVED',
        ];

        if (in_array($group->status, $finalizedStates)) {
            return;
        }

        // CRITICAL: For FORMING_SOLO groups with STUDENT PROPOSED titles,
        // DO NOT auto-transition to READY_FOR_BIDDING.
        // Leader must manually click "Siap Finalisasi" button.
        if ($group->status === 'FORMING_SOLO') {
            $title = $group->title;
            if ($title && $title->title_source === 'STUDENT') {
                // Don't auto-transition - stay in FORMING_SOLO
                return;
            }
        }

        // Special handling: If group is READY_FOR_BIDDING and falls below minimum,
        // revert to appropriate status based on group type
        if ($group->status === 'READY_FOR_BIDDING') {
            $period = $group->period;
            $minSize = $period->min_group_size ?? 3;
            $memberCount = $group->members()->count();

            if ($memberCount < $minSize) {
                // If it's a solo seeker (has title_id), revert to FORMING_SOLO
                if ($group->title_id) {
                    $group->status = 'FORMING_SOLO';
                } else {
                    // Normal group, revert to FORMING
                    $group->status = 'FORMING';
                }
                $group->save();
                return;
            }
        }

        // Use determineStatus() to calculate the correct status based on member count
        $newStatus = $group->determineStatus();

        // Only update if status actually changed
        if ($group->status !== $newStatus) {
            $group->status = $newStatus;
            $group->save();
        }
    }
}
