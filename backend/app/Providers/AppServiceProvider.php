<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Support\Facades\Route::aliasMiddleware('role', \App\Http\Middleware\RoleMiddleware::class);
        
        // Register Observers for Real-time Readiness Tracking
        \App\Models\Group::observe(\App\Observers\GroupObserver::class);
        \App\Models\GroupMember::observe(\App\Observers\GroupMemberObserver::class);
        \App\Models\Bid::observe(\App\Observers\BidObserver::class);
    }
}
