<?php

namespace App\Concerns;

use App\Models\Period;
use Illuminate\Support\Facades\Cache;

trait ResolvesActivePeriods
{
    private function getActiveAndFinalizedPeriodIds(): array
    {
        return Cache::remember('periods:active_and_finalized_ids', now()->addMinutes(5), function () {
            return Period::where('is_active', true)
                ->orWhere('is_finalized', true)
                ->pluck('id')
                ->toArray();
        });
    }
}
