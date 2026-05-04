<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->prepend(\App\Http\Middleware\AssignRequestId::class);
        $middleware->prepend(\Illuminate\Http\Middleware\HandleCors::class);
        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\App\Exceptions\ConflictRuleException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'request_id' => \Illuminate\Support\Facades\Log::getContext()['request_id'] ?? null,
                'code' => 'CONFLICT'
            ], 409);
        });

        $exceptions->render(function (\App\Exceptions\DomainRuleException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'request_id' => \Illuminate\Support\Facades\Log::getContext()['request_id'] ?? null,
                'code' => 'DOMAIN_ERROR'
            ], 422);
        });
    })->create();
