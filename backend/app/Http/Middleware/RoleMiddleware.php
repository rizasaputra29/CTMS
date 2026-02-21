<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        Log::info('RoleMiddleware: Handling request', [
            'path' => $request->path(),
            'user_id' => $request->user()?->id,
            'user_role' => $request->user()?->role,
            'required_roles' => $roles,
        ]);

        if (!$request->user()) {
            Log::warning('RoleMiddleware: User is null! Returning 401.');
            abort(401, 'Unauthenticated.');
        }

        if (!in_array($request->user()->role, $roles)) {
            Log::error('RoleMiddleware: Role mismatch!', [
                'user_role' => $request->user()->role,
                'required_roles' => $roles,
            ]);
            abort(403, 'Unauthorized action.');
        }

        return $next($request);
    }
}
