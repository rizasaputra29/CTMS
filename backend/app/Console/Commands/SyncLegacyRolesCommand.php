<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;

class SyncLegacyRolesCommand extends Command
{
    protected $signature = 'roles:sync-legacy {--dry-run : Show changes without writing to database}';

    protected $description = 'Sync legacy users.role values into role_user pivot without removing existing roles';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $rolesBySlug = Role::query()->pluck('id', 'slug');
        if ($rolesBySlug->isEmpty()) {
            $this->error('No roles found in roles table. Seed roles first.');

            return self::FAILURE;
        }

        $this->info('Syncing legacy users.role to pivot roles...');
        if ($dryRun) {
            $this->warn('DRY RUN mode enabled. No data will be written.');
        }

        $total = 0;
        $synced = 0;
        $alreadyHad = 0;
        $emptyLegacy = 0;
        $unknownLegacy = 0;

        User::query()->with('roles:id,slug')->orderBy('id')->chunkById(200, function ($users) use (
            $rolesBySlug,
            $dryRun,
            &$total,
            &$synced,
            &$alreadyHad,
            &$emptyLegacy,
            &$unknownLegacy
        ) {
            foreach ($users as $user) {
                $total++;

                $legacy = strtolower(trim((string) ($user->role ?? '')));
                if ($legacy === '') {
                    $emptyLegacy++;

                    continue;
                }

                $roleId = $rolesBySlug->get($legacy);
                if (! $roleId) {
                    $unknownLegacy++;
                    $this->warn("User #{$user->id} has unknown legacy role '{$legacy}'");

                    continue;
                }

                $hasRole = $user->roles->contains(fn ($r) => (int) $r->id === (int) $roleId);
                if ($hasRole) {
                    $alreadyHad++;

                    continue;
                }

                if (! $dryRun) {
                    $user->roles()->syncWithoutDetaching([$roleId]);
                }

                $synced++;
                $this->line("Synced user #{$user->id} ({$user->email}) => {$legacy}");
            }
        });

        $this->newLine();
        $this->info('Done.');
        $this->line("Total users      : {$total}");
        $this->line("Synced           : {$synced}");
        $this->line("Already had role : {$alreadyHad}");
        $this->line("Empty legacy     : {$emptyLegacy}");
        $this->line("Unknown legacy   : {$unknownLegacy}");

        return self::SUCCESS;
    }
}
