<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

class SyncRoleUserCommand extends Command
{
    protected $signature = 'db:sync-role-user
                            {--source=sqlite : Source database (sqlite)}
                            {--target=pgsql : Target database (pgsql)}';

    protected $description = 'Sync role_user data from SQLite to PostgreSQL';

    public function handle()
    {
        $this->info('🔄 Syncing role_user data from SQLite to PostgreSQL...');
        $this->newLine();

        // Configure connections
        Config::set('database.connections.sqlite', [
            'driver' => 'sqlite',
            'database' => database_path('database.sqlite'),
            'prefix' => '',
        ]);

        DB::purge('sqlite');
        DB::purge('pgsql');

        try {
            // Get role_user from SQLite
            $sqliteData = DB::connection('sqlite')
                ->table('role_user')
                ->get();

            $this->info('Found '.$sqliteData->count().' role_user records in SQLite');

            // Clear existing role_user in PostgreSQL
            $deleted = DB::connection('pgsql')->table('role_user')->delete();
            $this->info("Cleared {$deleted} existing records in PostgreSQL");

            // Insert into PostgreSQL
            if ($sqliteData->isNotEmpty()) {
                $data = $sqliteData->map(fn ($row) => [
                    'role_id' => $row->role_id,
                    'user_id' => $row->user_id,
                    'created_at' => $row->created_at,
                    'updated_at' => $row->updated_at,
                ])->toArray();

                DB::connection('pgsql')->table('role_user')->insert($data);

                $this->info('✅ Synced '.count($data).' role_user records');
            }

            // Verify
            $pgsqlCount = DB::connection('pgsql')->table('role_user')->count();
            $this->newLine();
            $this->info('Verification:');
            $this->info('  SQLite: '.$sqliteData->count().' records');
            $this->info('  PostgreSQL: '.$pgsqlCount.' records');

            if ($sqliteData->count() === $pgsqlCount) {
                $this->info('  ✅ Sync successful!');

                return 0;
            } else {
                $this->error('  ❌ Mismatch detected!');

                return 1;
            }

        } catch (\Exception $e) {
            $this->error('Error: '.$e->getMessage());

            return 1;
        }
    }
}
