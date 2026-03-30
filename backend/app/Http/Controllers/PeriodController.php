<?php

namespace App\Http\Controllers;

use App\Models\Period;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PeriodController extends Controller
{
    public function index()
    {
        return Period::orderBy('created_at', 'desc')->get();
    }

    public function show(Period $period)
    {
        return response()->json($period);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'is_active' => 'boolean',
            // Bidding config
            'bidding_start' => 'nullable|date',
            'bidding_end' => 'nullable|date|after_or_equal:bidding_start',
            // Phase dates
            'pdc1_start' => 'nullable|date',
            'pdc1_end' => 'nullable|date|after_or_equal:pdc1_start',
            'pdc2_start' => 'nullable|date',
            'pdc2_end' => 'nullable|date|after_or_equal:pdc2_start',
            'expo_date' => 'nullable|date',
            'ta_start' => 'nullable|date',
            'ta_end' => 'nullable|date|after_or_equal:ta_start',
            // Group config
            'min_group_size' => 'nullable|integer|min:1|max:10',
            'max_group_size' => 'nullable|integer|min:1|max:10',
            'max_supervise_load' => 'nullable|integer|min:1|max:50',
        ]);

        // V4: Allow multiple active periods — no auto-deactivation

        $period = Period::create($validated);

        return response()->json($period->fresh(), 201);
    }

    public function update(Request $request, Period $period)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after:start_date',
            'is_active' => 'boolean',
            // Bidding config
            'bidding_start' => 'nullable|date',
            'bidding_end' => 'nullable|date|after_or_equal:bidding_start',
            // Phase dates
            'pdc1_start' => 'nullable|date',
            'pdc1_end' => 'nullable|date|after_or_equal:pdc1_start',
            'pdc2_start' => 'nullable|date',
            'pdc2_end' => 'nullable|date|after_or_equal:pdc2_start',
            'expo_date' => 'nullable|date',
            'ta_start' => 'nullable|date',
            'ta_end' => 'nullable|date|after_or_equal:ta_start',
            // Group config
            'min_group_size' => 'nullable|integer|min:1|max:10',
            'max_group_size' => 'nullable|integer|min:1|max:10',
            'max_supervise_load' => 'nullable|integer|min:1|max:50',
        ]);

        // V4: Allow multiple active periods — no auto-deactivation

        $period->update($validated);

        return response()->json($period->fresh());
    }

    public function destroy(Period $period)
    {
        // Prevent deleting active period
        if ($period->is_active) {
            return response()->json(['message' => 'Cannot delete the active period. Deactivate it first.'], 400);
        }

        // Soft delete
        $period->delete();
        return response()->json(['message' => 'Period archived successfully.']);
    }
}
