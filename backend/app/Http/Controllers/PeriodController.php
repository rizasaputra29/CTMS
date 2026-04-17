<?php

namespace App\Http\Controllers;

use App\Models\Period;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PeriodController extends Controller
{
    use ApiResponseTrait;
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

        // V4: Allow multiple active periods — no auto-deactivation

        $period->update($validated);
        Cache::forget('active_period');

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
}
