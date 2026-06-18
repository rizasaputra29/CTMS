<?php

namespace App\Http\Controllers;

use App\Models\GroupMember;
use App\Models\Period;
use App\Models\PeriodRegistration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RegistrationController extends Controller
{
    use ApiResponseTrait;

    /**
     * Check if the authenticated user is registered for a specific period.
     */
    public function check(Request $request, $periodId)
    {
        $user = $request->user();
        $isRegistered = PeriodRegistration::where('user_id', $user->id)
            ->where('period_id', $periodId)
            ->exists();

        return $this->successResponse([
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
            return $this->unauthorizedResponse('Only students can register for an academic period.');
        }

        // Guard: Period must be open
        if (! $period->isRegistrationOpen()) {
            return $this->errorResponse('Registration for this period is closed.', 400);
        }

        // Guard: User can only be registered in ONE period at a time
        $existingRegistration = PeriodRegistration::where('user_id', $user->id)
            ->first();

        if ($existingRegistration) {
            $existingPeriod = Period::find($existingRegistration->period_id);

            return $this->errorResponse("You are already registered in period '{$existingPeriod->name}'. You must leave your current group before registering for a new period.", 400);
        }

        // Check if already registered for this specific period (redundant but safe)
        $existing = PeriodRegistration::where('user_id', $user->id)
            ->where('period_id', $period->id)
            ->first();

        if ($existing) {
            return $this->errorResponse('You are already registered for this period.', 400);
        }

        DB::beginTransaction();
        try {
            $registration = PeriodRegistration::create([
                'user_id' => $user->id,
                'period_id' => $period->id,
            ]);

            DB::commit();

            return $this->createdResponse([
                'registration' => $registration,
            ], "Successfully registered for {$period->name}.");
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->errorResponse('Registration failed: '.$e->getMessage(), 500);
        }
    }

    /**
     * Get the authenticated user's currently registered period.
     * Auto-registers user if they have a group but no registration.
     */
    public function myPeriod(Request $request)
    {
        $user = $request->user();

        $registration = PeriodRegistration::where('user_id', $user->id)
            ->with('period')
            ->first();

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

                return $this->successResponse([
                    'period' => $registration->period,
                    'registration' => $registration,
                    'auto_registered' => true,
                    'message' => "You have been automatically registered for {$registration->period->name} based on your group membership.",
                ]);
            }

            return $this->successResponse([
                'period' => null,
                'message' => 'Not registered for any period',
            ]);
        }

        return $this->successResponse([
            'period' => $registration->period,
            'registration' => $registration,
            'auto_registered' => false,
        ]);
    }
}
