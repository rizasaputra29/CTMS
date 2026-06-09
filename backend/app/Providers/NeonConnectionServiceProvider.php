<?php

namespace App\Providers;

use App\Database\NeonPostgresConnection;
use Illuminate\Database\Connection;
use Illuminate\Support\ServiceProvider;

/**
 * Service Provider to register the custom Neon PostgreSQL connection.
 *
 * This provider registers the NeonPostgresConnection class to handle
 * the 'pgsql' driver, fixing boolean casting issues when using
 * Neon PostgreSQL with PgBouncer (ATTR_EMULATE_PREPARES => true).
 */
class NeonConnectionServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Register the custom PostgreSQL connection resolver
        Connection::resolverFor('pgsql', function ($connection, $database, $prefix, $config) {
            return new NeonPostgresConnection($connection, $database, $prefix, $config);
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}
