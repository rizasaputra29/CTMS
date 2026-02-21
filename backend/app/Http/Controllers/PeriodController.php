<?php

namespace App\Http\Controllers;

use App\Models\Period;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PeriodController extends Controller
{
    public function index()
    {
        return Period::orderBy('start_date', 'desc')->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'is_active' => 'boolean',
        ]);

        if ($validated['is_active'] ?? false) {
            // Deactivate other periods if this one is active
            Period::whereRaw('is_active = true')->update(['is_active' => DB::raw('false')]);
        }

        $data = $validated;
        if (isset($data['is_active'])) {
            $data['is_active'] = $data['is_active'] ? DB::raw('true') : DB::raw('false');
        }

        $period = Period::create($data);
        $period->refresh();

        return response()->json($period, 201);
    }

    public function update(Request $request, Period $period)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after:start_date',
            'is_active' => 'boolean',
        ]);

        if ($validated['is_active'] ?? false) {
            // Deactivate other periods if this one is set to active
            Period::where('id', '!=', $period->id)->whereRaw('is_active = true')->update(['is_active' => DB::raw('false')]);
        }

        $data = $validated;
        if (isset($data['is_active'])) {
            $data['is_active'] = $data['is_active'] ? DB::raw('true') : DB::raw('false');
        }

        $period->update($data);
        $period->refresh();

        return response()->json($period);
    }

    public function destroy(Period $period)
    {
        $period->delete();
        return response()->json(['message' => 'Period deleted']);
    }
}
