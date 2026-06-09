<?php

namespace App\Jobs;

use App\Models\Group;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Batch refresh readiness snapshots for multiple groups.
 * Dispatched to queue for better performance during finalization.
 */
class RefreshGroupReadinessBatch implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The group IDs to refresh.
     *
     * @var array<int>
     */
    public array $groupIds;

    /**
     * Create a new job instance.
     *
     * @param  array<int>  $groupIds
     */
    public function __construct(array $groupIds)
    {
        $this->groupIds = $groupIds;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Group::whereIn('id', $this->groupIds)
            ->chunkById(100, function ($groups) {
                foreach ($groups as $group) {
                    $group->refreshReadinessSnapshot();
                }
            });
    }
}
