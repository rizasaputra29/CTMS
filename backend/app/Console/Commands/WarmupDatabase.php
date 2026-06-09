<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Warm up the database connection to prevent cold starts.
 *
 * This command pings the database to keep the connection warm,
 * preventing Neon Free Tier cold start delays.
 *
 * Usage: php artisan db:warmup
 */
class WarmupDatabase extends Command
{
    protected $signature = 'db:warmup';

    protected $description = 'Warm up database connection to prevent cold starts';

    public function handle(): int
    {
        try {
            $start = microtime(true);
            DB::connection()->getPdo();
            $elapsed = round((microtime(true) - $start) * 1000, 2);

            $this->info("✓ Database connection warmed up successfully ({$elapsed}ms)");

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error("✗ Failed to warm up database: {$e->getMessage()}");

            return self::FAILURE;
        }
    }
}
