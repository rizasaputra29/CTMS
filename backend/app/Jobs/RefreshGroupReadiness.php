<?php

namespace App\Jobs;

use App\Models\Group;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Refresh readiness snapshot for a single group.
 * Dispatched to queue to avoid blocking observer execution.
 */
class RefreshGroupReadiness implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The group ID to refresh.
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
        
        if ($group) {
            $group->refreshReadinessSnapshot();
        }
    }
}
