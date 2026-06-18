<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        \Illuminate\Support\Facades\Route::aliasMiddleware('role', \App\Http\Middleware\RoleMiddleware::class);

        // Prevent N+1 lazy loading in non-production environments
        Model::preventLazyLoading(! $this->app->isProduction());

        // Register Observers for Real-time Readiness Tracking
        \App\Models\Group::observe(\App\Observers\GroupObserver::class);
        \App\Models\GroupMember::observe(\App\Observers\GroupMemberObserver::class);
        \App\Models\Bid::observe(\App\Observers\BidObserver::class);
    }
}
