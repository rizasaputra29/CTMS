<?php

namespace App\Http\Controllers;

use App\Models\Period;
use App\Models\PeriodRegistration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RegistrationController extends Controller
{
    /**
     * Check if the authenticated user is registered for a specific period.
     */
    public function check(Request $request, $periodId)
    {
        $user = $request->user();
        $isRegistered = PeriodRegistration::where('user_id', $user->id)
            ->where('period_id', $periodId)
            ->exists();

        return response()->json([
            'is_registered' => $isRegistered,
        ]);
    }

    /**
     * Register the authenticated user for a specific period.
     */
    public function register(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $user = $request->user();
        $period = Period::findOrFail($request->period_id);

        // Guard: Only students can register
        if (!$user->hasRole('mahasiswa')) {
            return response()->json(['message' => 'Only students can register for an academic period.'], 403);
        }

        // Guard: Period must be open
        if (!$period->isRegistrationOpen()) {
            return response()->json(['message' => 'Registration for this period is closed.'], 400);
        }

        // Guard: User can only be registered in ONE period at a time
        $existingRegistration = PeriodRegistration::where('user_id', $user->id)
            ->first();

        if ($existingRegistration) {
            $existingPeriod = Period::find($existingRegistration->period_id);
            return response()->json([
                'message' => "You are already registered in period '{$existingPeriod->name}'. You must leave your current group before registering for a new period."
            ], 400);
        }

        // Check if already registered for this specific period (redundant but safe)
        $existing = PeriodRegistration::where('user_id', $user->id)
            ->where('period_id', $period->id)
            ->first();

        if ($existing) {
            return response()->json(['message' => 'You are already registered for this period.'], 400);
        }

        DB::beginTransaction();
        try {
            $registration = PeriodRegistration::create([
                'user_id' => $user->id,
                'period_id' => $period->id,
            ]);

            DB::commit();

            return response()->json([
                'message' => "Successfully registered for {$period->name}.",
                'registration' => $registration,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Registration failed: ' . $e->getMessage()], 500);
        }
    }
}
