<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class MigrateToPostgresCommand extends Command
{
    protected $signature = 'db:migrate-to-postgres
                            {--backup : Create SQLite backup before migration}
                            {--delete-group-50 : Delete Group #50 after migration}
                            {--source=sqlite : Source database connection}
                            {--target=pgsql : Target database connection}
                            {--force : Skip confirmation prompts}';

    protected $description = 'Migrate data from SQLite to PostgreSQL (Neon)';

    private array $stats = [];

    private array $errors = [];

    public function handle()
    {
        $this->info('╔════════════════════════════════════════════════════════╗');
        $this->info('║     SQLite to PostgreSQL (Neon) Migration Tool         ║');
        $this->info('╚════════════════════════════════════════════════════════╝');
        $this->newLine();

        // Configure database connections dynamically
        $this->configureConnections();

        try {
            // Step 1: Create backup
            if ($this->option('backup')) {
                $this->createBackup();
            }

            // Step 2: Test connections
            $this->testConnections();

            // Step 3: Check target is empty
            $this->verifyTargetEmpty();

            // Step 4: Run migrations on target
            $this->runMigrations();

            // Step 5: Migrate data
            $this->migrateData();

            // Step 6: Verify migration
            $this->verifyMigration();

            // Step 7: Delete Group #50 if requested
            if ($this->option('delete-group-50')) {
                $this->deleteGroup50();
            }

            // Success!
            $this->displaySuccess();

            return 0;

        } catch (\Exception $e) {
            $this->displayError($e);

            return 1;
        }
    }

    private function configureConnections(): void
    {
        // Configure SQLite connection for source
        config([
            'database.connections.sqlite' => [
                'driver' => 'sqlite',
                'url' => env('DB_SQLITE_URL'),
                'database' => env('DB_SQLITE_DATABASE', database_path('database.sqlite')),
                'prefix' => '',
                'foreign_key_constraints' => env('DB_SQLITE_FOREIGN_KEYS', true),
            ],
            'database.connections.pgsql' => [
                'driver' => 'pgsql',
                'url' => env('DB_URL'),
                'host' => env('DB_HOST', '127.0.0.1'),
                'port' => env('DB_PORT', '5432'),
                'database' => env('DB_DATABASE', 'forge'),
                'username' => env('DB_USERNAME', 'forge'),
                'password' => env('DB_PASSWORD', ''),
                'charset' => env('DB_CHARSET', 'utf8'),
                'prefix' => '',
                'prefix_indexes' => true,
                'search_path' => 'public',
                'sslmode' => env('DB_SSLMODE', 'prefer'),
            ],
        ]);

        // Purge and reconnect to ensure fresh connections
        DB::purge('sqlite');
        DB::purge('pgsql');

        // Set default to pgsql
        config(['database.default' => 'pgsql']);
    }

    private function createBackup(): void
    {
        $this->info('📦 Step 1: Creating SQLite backup...');

        $sourcePath = database_path('database.sqlite');
        $backupPath = database_path('database.sqlite.backup.'.now()->format('Y-m-d-His'));

        if (! File::exists($sourcePath)) {
            throw new \Exception("SQLite database not found at: {$sourcePath}");
        }

        File::copy($sourcePath, $backupPath);
        $this->info("   ✓ Backup created: {$backupPath}");
        $this->newLine();
    }

    private function testConnections(): void
    {
        $this->info('🔌 Step 2: Testing database connections...');

        // Test SQLite
        try {
            $sqliteCount = DB::connection($this->option('source'))->table('users')->count();
            $this->info("   ✓ SQLite connection OK ({$sqliteCount} users found)");
        } catch (\Exception $e) {
            throw new \Exception('SQLite connection failed: '.$e->getMessage());
        }

        // Test PostgreSQL
        try {
            DB::connection($this->option('target'))->getPdo();
            $this->info('   ✓ PostgreSQL connection OK');
        } catch (\Exception $e) {
            throw new \Exception('PostgreSQL connection failed: '.$e->getMessage());
        }

        $this->newLine();
    }

    private function verifyTargetEmpty(): void
    {
        $this->info('🔍 Step 3: Verifying target database is empty...');

        $hasData = false;
        $tables = ['users', 'periods', 'titles', 'groups'];

        foreach ($tables as $table) {
            try {
                $count = DB::connection($this->option('target'))->table($table)->count();
                if ($count > 0) {
                    $hasData = true;
                    $this->warn("   ⚠ Table '{$table}' has {$count} records");
                }
            } catch (\Exception $e) {
                // Table doesn't exist yet, which is fine
            }
        }

        if ($hasData) {
            if (! $this->option('force') && ! $this->confirm('Target database has existing data. Continue and overwrite?', false)) {
                throw new \Exception('Migration cancelled by user');
            }
            $this->warn('   ⚠ Target database will be overwritten (--force)');
        } else {
            $this->info('   ✓ Target database is empty');
        }

        $this->newLine();
    }

    private function runMigrations(): void
    {
        $this->info('🏗️  Step 4: Running migrations on PostgreSQL...');

        // Temporarily switch to PostgreSQL
        config(['database.default' => $this->option('target')]);

        try {
            // Fresh migrate
            $this->call('migrate:fresh', [
                '--force' => true,
            ]);

            $this->info('   ✓ Migrations completed');
        } catch (\Exception $e) {
            throw new \Exception('Migration failed: '.$e->getMessage());
        } finally {
            // Switch back to SQLite
            config(['database.default' => $this->option('source')]);
        }

        $this->newLine();
    }

    private function migrateData(): void
    {
        $this->info('📤 Step 5: Migrating data...');
        $this->newLine();

        // Step 1: Core tables without dependencies
        $this->migrateTable('users');
        $this->migrateTable('periods');
        $this->migrateTable('password_reset_tokens');
        $this->migrateTable('personal_access_tokens');

        // Step 2: Titles with NULL proposed_by_group_id (temporarily)
        $this->migrateTitlesStep1();

        // Step 3: Groups (can reference titles)
        $this->migrateTable('groups');

        // Step 4: Update titles with proposed_by_group_id
        $this->migrateTitlesStep2();

        // Step 5: Remaining tables
        $this->migrateTable('group_members');
        $this->migrateTable('bids');
        $this->migrateTable('notifications');
    }

    private function migrateTitlesStep1(): void
    {
        try {
            $data = DB::connection($this->option('source'))
                ->table('titles')
                ->get()
                ->map(fn ($row) => (array) $row)
                ->toArray();

            if (empty($data)) {
                $this->line('   ⏭️  titles: empty');
                $this->stats['titles'] = 0;

                return;
            }

            // Temporarily set proposed_by_group_id to NULL to avoid FK error
            $dataWithNullGroup = array_map(function ($row) {
                $row['proposed_by_group_id'] = null;

                return $row;
            }, $data);

            DB::connection($this->option('target'))->transaction(function () use ($dataWithNullGroup) {
                foreach (array_chunk($dataWithNullGroup, 100) as $chunk) {
                    DB::connection($this->option('target'))->table('titles')->insert($chunk);
                }
            });

            $this->info('   ✓ titles: '.count($data).' records (step 1/2)');

        } catch (\Exception $e) {
            $this->error('   ✗ titles (step 1): '.$e->getMessage());
            $this->errors['titles'] = $e->getMessage();
            $this->stats['titles'] = 'ERROR';
        }
    }

    private function migrateTitlesStep2(): void
    {
        try {
            // Get original data with proposed_by_group_id
            $data = DB::connection($this->option('source'))
                ->table('titles')
                ->whereNotNull('proposed_by_group_id')
                ->get(['id', 'proposed_by_group_id']);

            if ($data->isEmpty()) {
                $this->line('   ⏭️  titles: no proposed_by_group_id to update');

                return;
            }

            // Update titles with their proposed_by_group_id
            DB::connection($this->option('target'))->transaction(function () use ($data) {
                foreach ($data as $row) {
                    DB::connection($this->option('target'))
                        ->table('titles')
                        ->where('id', $row->id)
                        ->update(['proposed_by_group_id' => $row->proposed_by_group_id]);
                }
            });

            $this->info('   ✓ titles: updated '.$data->count().' records with proposed_by_group_id (step 2/2)');

        } catch (\Exception $e) {
            $this->error('   ✗ titles (step 2): '.$e->getMessage());
            $this->errors['titles_step2'] = $e->getMessage();
        }
    }

    private function migrateTable(string $table): void
    {
        try {
            // Get data from SQLite
            $data = DB::connection($this->option('source'))
                ->table($table)
                ->get()
                ->map(fn ($row) => (array) $row)
                ->toArray();

            // Skip empty tables
            if (empty($data)) {
                $this->line("   ⏭️  {$table}: empty");
                $this->stats[$table] = 0;

                return;
            }

            $count = count($data);

            // Insert into PostgreSQL
            DB::connection($this->option('target'))->transaction(function () use ($table, $data) {
                foreach (array_chunk($data, 100) as $chunk) {
                    DB::connection($this->option('target'))->table($table)->insert($chunk);
                }
            });

            $this->info("   ✓ {$table}: {$count} records");
            $this->stats[$table] = $count;

        } catch (\Exception $e) {
            $this->error("   ✗ {$table}: ".$e->getMessage());
            $this->errors[$table] = $e->getMessage();
            $this->stats[$table] = 'ERROR';
        }
    }

    private function verifyMigration(): void
    {
        $this->newLine();
        $this->info('✅ Step 6: Verifying migration...');
        $this->newLine();

        $verified = true;

        foreach ($this->stats as $table => $count) {
            if ($count === 'ERROR') {
                continue;
            }

            $sourceCount = DB::connection($this->option('source'))->table($table)->count();
            $targetCount = DB::connection($this->option('target'))->table($table)->count();

            if ($sourceCount === $targetCount) {
                $this->info("   ✓ {$table}: {$targetCount}/{$sourceCount} ✓");
            } else {
                $this->error("   ✗ {$table}: {$targetCount}/{$sourceCount} ✗ MISMATCH!");
                $verified = false;
            }
        }

        if (! $verified) {
            throw new \Exception('Migration verification failed - record counts do not match');
        }

        $this->newLine();
    }

    private function deleteGroup50(): void
    {
        $this->info('🗑️  Step 7: Deleting Group #50 (test data)...');

        try {
            // Switch to PostgreSQL
            config(['database.default' => $this->option('target')]);

            // Delete related records first
            DB::table('group_members')->where('group_id', 50)->delete();
            DB::table('bids')->where('group_id', 50)->delete();
            DB::table('groups')->where('id', 50)->delete();

            $this->info('   ✓ Group #50 and related records deleted');

        } catch (\Exception $e) {
            $this->warn('   ⚠ Failed to delete Group #50: '.$e->getMessage());
        } finally {
            // Switch back
            config(['database.default' => $this->option('source')]);
        }

        $this->newLine();
    }

    private function displaySuccess(): void
    {
        $this->newLine();
        $this->info('╔════════════════════════════════════════════════════════╗');
        $this->info('║           ✅ MIGRATION COMPLETED SUCCESSFULLY           ║');
        $this->info('╚════════════════════════════════════════════════════════╝');
        $this->newLine();

        $this->info('Migration Summary:');
        $this->newLine();

        $totalRecords = 0;
        foreach ($this->stats as $table => $count) {
            if (is_int($count)) {
                $this->line(sprintf('  %-30s %5d records', $table, $count));
                $totalRecords += $count;
            }
        }

        $this->newLine();
        $this->info("Total records migrated: {$totalRecords}");
        $this->newLine();

        $this->info('Next steps:');
        $this->line('  1. Update .env: Set DB_CONNECTION=pgsql');
        $this->line('  2. Test the application');
        $this->line('  3. Keep SQLite backup as fallback');
        $this->newLine();
    }

    private function displayError(\Exception $e): void
    {
        $this->newLine();
        $this->error('╔════════════════════════════════════════════════════════╗');
        $this->error('║           ❌ MIGRATION FAILED                          ║');
        $this->error('╚════════════════════════════════════════════════════════╝');
        $this->newLine();

        $this->error("Error: {$e->getMessage()}");

        if (! empty($this->errors)) {
            $this->newLine();
            $this->error('Failed tables:');
            foreach ($this->errors as $table => $error) {
                $this->error("  - {$table}: {$error}");
            }
        }

        $this->newLine();
        $this->warn('SQLite database remains unchanged.');
        $this->warn('Fix the error and run the command again.');
    }
}
