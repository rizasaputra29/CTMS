<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class PeriodFinalizationMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'Unauthenticated.');
        }

        // Only apply to mahasiswa role
        if (! $user->hasRole('mahasiswa')) {
            return $next($request);
        }

        // Find student's active period registration
        $registration = \App\Models\PeriodRegistration::where('user_id', $user->id)
            ->where('status', 'active')
            ->whereHas('period', function ($query) {
                $query->where('is_active', true);
            })
            ->with('period')
            ->first();

        if (! $registration || ! $registration->period) {
            Log::warning('PeriodFinalizationMiddleware: Student has no active period registration.', [
                'user_id' => $user->id,
            ]);
            abort(403, 'Anda belum terdaftar pada periode aktif.');
        }

        $period = $registration->period;

        // Allow access only if period is finalized
        if (! $period->is_finalized) {
            Log::warning('PeriodFinalizationMiddleware: Period not finalized, access denied.', [
                'user_id' => $user->id,
                'period_id' => $period->id,
                'period_name' => $period->name,
                'path' => $request->path(),
            ]);
            abort(403, 'Akses ditolak. Menu ini tersedia setelah periode di-finalisasi.');
        }

        return $next($request);
    }
}
