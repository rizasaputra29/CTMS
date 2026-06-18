<?php

namespace App\Http\Controllers;

use App\Models\GroupMember;
use App\Models\Period;
use App\Models\PeriodRegistration;
use App\Services\StudentFlagService;
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
            ->where('status', 'active')
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
        if (! $user->hasRole('mahasiswa')) {
            return response()->json(['message' => 'Only students can register for an academic period.'], 403);
        }

        // Guard: Period must be open
        if (! $period->isRegistrationOpen()) {
            return response()->json(['message' => 'Registration for this period is closed.'], 400);
        }

        // Guard: User can only be actively registered in ONE period at a time.
        // Flagged registrations are kept for audit, but they do NOT block the
        // student from registering for a new period.
        $activeRegistration = PeriodRegistration::where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if ($activeRegistration) {
            $existingPeriod = Period::find($activeRegistration->period_id);

            return response()->json([
                'message' => "You are already registered in period '{$existingPeriod->name}'. You must leave your current group before registering for a new period.",
            ], 400);
        }

        // If a flagged registration exists for this specific period, the student
        // cannot re-register until they are unflagged by admin.
        $flaggedRegistration = PeriodRegistration::where('user_id', $user->id)
            ->where('period_id', $period->id)
            ->where('status', 'flagged')
            ->first();

        if ($flaggedRegistration) {
            return response()->json(['message' => 'You are flagged from this period and cannot register. Contact admin for assistance.'], 403);
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

            return response()->json(['message' => 'Registration failed: '.$e->getMessage()], 500);
        }
    }

    /**
     * Get the authenticated user's currently registered period.
     * Auto-registers user if they have a group but no registration.
     */
    public function myPeriod(Request $request)
    {
        $user = $request->user();

        // Prioritize active registration on active period (same logic as PeriodFinalizationMiddleware)
        $registration = PeriodRegistration::where('user_id', $user->id)
            ->where('status', 'active')
            ->whereHas('period', function ($query) {
                $query->where('is_active', true);
            })
            ->with('period')
            ->first();

        // Fallback: any registration if no active one found
        if (! $registration) {
            $registration = PeriodRegistration::where('user_id', $user->id)
                ->latest()
                ->with('period')
                ->first();
        }

        // If no registration found, check if user has a group membership
        if (! $registration) {
            $groupMembership = GroupMember::where('student_id', $user->id)
                ->whereHas('group', function ($q) {
                    $q->whereNotIn('status', ['CLOSED', 'DISSOLVED']);
                })
                ->with('group')
                ->first();

            if ($groupMembership) {
                // Auto-create registration for the group's period
                $registration = PeriodRegistration::create([
                    'user_id' => $user->id,
                    'period_id' => $groupMembership->group->period_id,
                ]);

                $registration->load('period');

                return response()->json([
                    'period' => $registration->period,
                    'registration' => $registration,
                    'auto_registered' => true,
                    'message' => "You have been automatically registered for {$registration->period->name} based on your group membership.",
                ]);
            }

            return response()->json([
                'period' => null,
                'message' => 'Not registered for any period',
            ]);
        }

        return response()->json([
            'period' => $registration->period,
            'registration' => $registration,
            'auto_registered' => false,
        ]);
    }

    /**
     * Student confirms a pending flag request from an admin/dosen.
     */
    public function confirmFlag(Request $request, $periodId)
    {
        $user = $request->user();

        if (! $user->hasRole('mahasiswa')) {
            return response()->json(['message' => 'Only students can confirm flag requests.'], 403);
        }

        $period = Period::findOrFail($periodId);

        $registration = PeriodRegistration::where('user_id', $user->id)
            ->where('period_id', $period->id)
            ->where('status', 'pending_flag')
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'No pending flag request found for this period.'], 404);
        }

        $flagService = app(StudentFlagService::class);
        $flagService->confirmFlag($period, $user);

        return response()->json([
            'message' => 'Anda telah mengkonfirmasi pengeluaran dari periode. Akun Anda tidak lagi aktif di periode ini.',
            'period_id' => $period->id,
        ]);
    }
}
