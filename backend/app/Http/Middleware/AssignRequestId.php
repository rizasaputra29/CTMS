<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AssignRequestId
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // 1. Get or Generate Request ID
        $requestId = $request->header('X-Request-ID') ?: (string) Str::uuid();

        // 2. Share context with Log system (Laravel 11 standard)
        Log::shareContext([
            'request_id' => $requestId,
        ]);

        // 3. Process the request
        $response = $next($request);

        // 4. Add Request ID to the response header
        $response->headers->set('X-Request-ID', $requestId);

        return $response;
    }
}
