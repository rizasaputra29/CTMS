<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Period;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PeriodController extends Controller
{
    use ApiResponseTrait;

    private ?array $periodColumns = null;

    public function index()
    {
        $periods = Period::orderBy('created_at', 'desc')->get();
        return $this->successResponse($periods, 'Periods retrieved successfully');
    }

    public function show(Period $period)
    {
        return $this->successResponse($period, 'Period retrieved successfully');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'is_active' => 'boolean',
            'is_finalized' => 'boolean',
            // Bidding config
            'bidding_start' => 'nullable|date',
            'bidding_end' => 'nullable|date|after_or_equal:bidding_start',
            'bidding_reminder_at' => 'nullable|date',
            // Phase dates
            'pdc1_start' => 'nullable|date',
            'pdc1_end' => 'nullable|date|after_or_equal:pdc1_start',
            'pdc1_reminder_at' => 'nullable|date',
            'pdc2_start' => 'nullable|date',
            'pdc2_end' => 'nullable|date|after_or_equal:pdc2_start',
            'pdc2_reminder_at' => 'nullable|date',
            'expo_date' => 'nullable|date',
            'expo_reminder_at' => 'nullable|date',
            'ta_start' => 'nullable|date',
            'ta_end' => 'nullable|date|after_or_equal:ta_start',
            'ta_reminder_at' => 'nullable|date',
            // Group config
            'min_group_size' => 'nullable|integer|min:1|max:10',
            'max_group_size' => 'nullable|integer|min:1|max:10',
            'max_supervisor_load' => 'nullable|integer|min:1|max:50',
            'require_all_students_grouped' => 'boolean',
        ]);

        $validated = $this->normalizePeriodPayload($validated);

        // V4: Allow multiple active periods — no auto-deactivation

        $period = Period::create($validated);
        Cache::forget('active_period');

        return $this->createdResponse($period->fresh(), 'Period created successfully');
    }

    public function update(Request $request, Period $period)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after:start_date',
            'is_active' => 'boolean',
            'is_finalized' => 'boolean',
            // Bidding config
            'bidding_start' => 'nullable|date',
            'bidding_end' => 'nullable|date|after_or_equal:bidding_start',
            'bidding_reminder_at' => 'nullable|date',
            // Phase dates
            'pdc1_start' => 'nullable|date',
            'pdc1_end' => 'nullable|date|after_or_equal:pdc1_start',
            'pdc1_reminder_at' => 'nullable|date',
            'pdc2_start' => 'nullable|date',
            'pdc2_end' => 'nullable|date|after_or_equal:pdc2_start',
            'pdc2_reminder_at' => 'nullable|date',
            'expo_date' => 'nullable|date',
            'expo_reminder_at' => 'nullable|date',
            'ta_start' => 'nullable|date',
            'ta_end' => 'nullable|date|after_or_equal:ta_start',
            'ta_reminder_at' => 'nullable|date',
            // Group config
            'min_group_size' => 'nullable|integer|min:1|max:10',
            'max_group_size' => 'nullable|integer|min:1|max:10',
            'max_supervisor_load' => 'nullable|integer|min:1|max:50',
            'require_all_students_grouped' => 'boolean',
        ]);

        $validated = $this->normalizePeriodPayload($validated);

        // Phase 1: Safe deactivation guard
        if (isset($validated['is_active']) && $validated['is_active'] === false && $period->is_active === true) {
            $activeGroups = Group::where('period_id', $period->id)
                ->whereIn('status', [
                    'PDC1_ACTIVE', 'READY_FOR_SEMPRO', 'SEMPRO_DONE',
                    'PDC2_ACTIVE', 'PDC2_READY_FOR_EXPO', 'EXPO_REGISTERED',
                    'EXPO_DONE', 'READY_FOR_TA_INDIVIDUAL',
                ])
                ->count();

            if ($activeGroups > 0) {
                AuditLog::create([
                    'user_id' => $request->user()->id,
                    'action' => 'PERIOD_DEACTIVATED',
                    'target_type' => 'Period',
                    'target_id' => $period->id,
                    'payload' => ['active_groups_at_deactivation' => $activeGroups],
                ]);
            }
        }

        // Phase 3: Reactivation audit log
        if (isset($validated['is_active']) && $validated['is_active'] === true && $period->is_active === false) {
            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'PERIOD_REACTIVATED',
                'target_type' => 'Period',
                'target_id' => $period->id,
            ]);
        }

        $period->update($validated);
        Cache::forget('active_period');
        Cache::forget('periods:active:all');

        return $this->successResponse($period->fresh(), 'Period updated successfully');
    }

    public function destroy(Period $period)
    {
        // Prevent deleting active period
        if ($period->is_active) {
            return $this->errorResponse('Cannot delete the active period. Deactivate it first.', 400);
        }

        // Soft delete
        $period->delete();
        Cache::forget('active_period');

        return $this->successResponse(null, 'Period archived successfully');
    }

    /**
     * V5: Get the current registration period for students.
     * Returns the latest active, non-finalized period.
     */
    public function registrationPeriod()
    {
        $period = Period::where('is_active', true)
            ->where('is_finalized', false)
            ->orderBy('created_at', 'desc')
            ->first();

        return $this->successResponse(['period' => $period], 'Registration period retrieved successfully');
    }

    private function normalizePeriodPayload(array $payload): array
    {
        $optionalColumns = [
            'bidding_reminder_at',
            'pdc1_reminder_at',
            'pdc2_reminder_at',
            'expo_reminder_at',
            'ta_reminder_at',
        ];

        foreach ($optionalColumns as $column) {
            if (array_key_exists($column, $payload) && !$this->hasPeriodColumn($column)) {
                unset($payload[$column]);
            }
        }

        if (array_key_exists('max_supervisor_load', $payload)) {
            $maxLoad = $payload['max_supervisor_load'];

            if ($this->hasPeriodColumn('max_supervisor_load')) {
                $payload['max_supervisor_load'] = $maxLoad;
            } else {
                unset($payload['max_supervisor_load']);
            }

            // Keep legacy column in sync when it still exists.
            if ($this->hasPeriodColumn('max_supervise_load')) {
                $payload['max_supervise_load'] = $maxLoad;
            }
        }

        if (array_key_exists('max_supervise_load', $payload) && !array_key_exists('max_supervisor_load', $payload)) {
            $maxLoad = $payload['max_supervise_load'];

            if ($this->hasPeriodColumn('max_supervisor_load')) {
                $payload['max_supervisor_load'] = $maxLoad;
            }

            if (!$this->hasPeriodColumn('max_supervise_load')) {
                unset($payload['max_supervise_load']);
            }
        }

        return $payload;
    }

    private function hasPeriodColumn(string $column): bool
    {
        if ($this->periodColumns === null) {
            $this->periodColumns = Schema::getColumnListing('periods');
        }

        return in_array($column, $this->periodColumns, true);
    }
}
