<?php

namespace App\Concerns;

use App\Models\Group;
use App\Models\Period;
use Illuminate\Database\Eloquent\Model;

trait RequiresActivePeriod
{
    protected function ensurePeriodIsActive(Group $group): void
    {
        $period = $group->relationLoaded('period') ? $group->period : Period::find($group->period_id);

        if (!$period || !$period->is_active) {
            abort(403, 'Periode tidak aktif. Operasi tidak diizinkan.');
        }
    }

    protected function ensurePeriodActiveById(int $periodId): void
    {
        $period = Period::find($periodId);

        if (!$period || !$period->is_active) {
            abort(403, 'Periode tidak aktif. Operasi tidak diizinkan.');
        }
    }

    protected function ensureModelPeriodActive(Model $model): void
    {
        $periodRel = $model->relationLoaded('period') ? $model->period : null;

        if ($periodRel && !$periodRel->is_active) {
            abort(403, 'Periode tidak aktif. Operasi tidak diizinkan.');
        }

        if (!$periodRel && $model->period_id) {
            $period = Period::find($model->period_id);
            if (!$period || !$period->is_active) {
                abort(403, 'Periode tidak aktif. Operasi tidak diizinkan.');
            }
        }
    }
}
