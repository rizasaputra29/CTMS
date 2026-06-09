<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

class AddTokenCookie
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Skip cookie setting for file downloads (BinaryFileResponse doesn't support cookies)
        if ($response instanceof BinaryFileResponse) {
            return $response;
        }

        // If user is authenticated and has an authorization header, set a cookie
        if ($request->user() && $request->bearerToken()) {
            $token = $request->bearerToken();

            // Set httpOnly cookie for SSR authentication (2 hours expiration)
            $response->cookie(
                'auth_token',
                $token,
                120, // 2 hours
                '/',
                null,
                true, // secure
                true, // httpOnly
                false,
                'Strict' // SameSite
            );
        }

        return $response;
    }
}
