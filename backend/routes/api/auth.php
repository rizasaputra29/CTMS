<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\ProfileController;

/*
|--------------------------------------------------------------------------
| Rate Limiting Configuration
|--------------------------------------------------------------------------
|
| Configure rate limiting for different endpoint categories
|
*/

// Configure rate limiters
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});

RateLimiter::for('auth', function (Request $request) {
    return Limit::perMinute(5)->by($request->ip());
});

RateLimiter::for('upload', function (Request $request) {
    return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
});

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
|
| Public authentication endpoints and user management
|
*/

// Public routes with strict rate limiting
Route::middleware(['throttle:auth'])->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
});

// Authenticated routes with standard API rate limiting
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    
    // User info and roles
    Route::get('/user', [AuthController::class, 'me']);
    Route::get('/user/roles', [RoleController::class, 'index']);
    Route::post('/user/active-role', [RoleController::class, 'setActiveRole']);
    Route::get('/user/current-role', [RoleController::class, 'currentRole']);
    
    // Profile
    Route::put('/profile', [ProfileController::class, 'update']);
});
