<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Load split API route files
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api/auth.php'));

            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api/shared.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->prepend(\App\Http\Middleware\AssignRequestId::class);
        $middleware->prepend(\Illuminate\Http\Middleware\HandleCors::class);
        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
            'add.token.cookie' => \App\Http\Middleware\AddTokenCookie::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\App\Exceptions\ConflictRuleException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'CONFLICT',
            ], 409);
        });

        $exceptions->render(function (\App\Exceptions\DomainRuleException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'DOMAIN_ERROR',
            ], 422);
        });

        // Handle authentication errors for API routes
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Unauthenticated.',
                ], 401);
            }
        });
    })->create();
