<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

class ResetPostgresSequencesCommand extends Command
{
    protected $signature = 'db:reset-sequences';

    protected $description = 'Reset PostgreSQL sequences to match current max IDs';

    public function handle()
    {
        $this->info('🔄 Resetting PostgreSQL sequences...');
        $this->newLine();

        Config::set('database.default', 'pgsql');
        DB::purge('pgsql');

        $tables = [
            'users',
            'periods',
            'titles',
            'groups',
            'group_members',
            'bids',
            'notifications',
            'group_invitations',
            'group_supervisor_proposals',
            'supervisions',
            'ta_submissions',
            'audit_logs',
            'expo_events',
            'expo_registrations',
            'period_registrations',
            'group_invitations',
            'join_requests',
            'documents',
            'assessment_components',
            'assessment_scores',
            'peer_review_indicators',
            'peer_reviews',
            'grade_consistency_checks',
            'document_types',
            'digital_signatures',
            'title_approval_audits',
            'seminar_schedules',
            'seminar_evaluations',
            'ta_defense_schedules',
            'ta_defense_examiners',
            'ta_defense_evaluations',
            'sempro_scores',
            'sidang_ta_scores',
            'bimbingan_sempro_scores',
            'bimbingan_ta_scores',
            'expo_scores',
            'milestone_scores',
            'nilai_dosen_scores',
            'stakeholders',
            'title_stakeholder',
            'phase_document_requirements',
            'roles',
            'permissions',
            'role_user',
            'model_has_permissions',
            'model_has_roles',
            'role_has_permissions',
        ];

        $resetCount = 0;

        foreach ($tables as $table) {
            try {
                // Check if table exists
                $exists = DB::select("SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = ?
                )", [$table]);

                if (! $exists[0]->exists) {
                    continue;
                }

                // Check if table has an 'id' column
                $hasId = DB::select("SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = ?
                    AND column_name = 'id'
                )", [$table]);

                if (! $hasId[0]->exists) {
                    continue;
                }

                // Get current max ID
                $maxId = DB::table($table)->max('id') ?? 0;

                // Reset sequence to max ID + 1
                $sequenceName = "{$table}_id_seq";

                DB::statement('SELECT setval(?, ?, false)', [$sequenceName, $maxId + 1]);

                $this->info("   ✓ {$table}: sequence reset to ".($maxId + 1));
                $resetCount++;

            } catch (\Exception $e) {
                // Silently skip tables without sequences or errors
                continue;
            }
        }

        $this->newLine();
        $this->info("✅ Reset {$resetCount} sequences successfully!");

        return 0;
    }
}
