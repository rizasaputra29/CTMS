<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE expo_registrations DROP CONSTRAINT IF EXISTS expo_registrations_status_check');
        DB::statement("ALTER TABLE expo_registrations ADD CONSTRAINT expo_registrations_status_check CHECK (status in ('REGISTERED', 'SCHEDULED', 'DONE', 'CANCELLED'))");
        DB::statement("ALTER TABLE expo_registrations ALTER COLUMN status SET DEFAULT 'REGISTERED'");
        DB::statement('ALTER TABLE expo_registrations ALTER COLUMN status SET NOT NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE expo_registrations DROP CONSTRAINT IF EXISTS expo_registrations_status_check');
        DB::statement("ALTER TABLE expo_registrations ADD CONSTRAINT expo_registrations_status_check CHECK (status in ('REGISTERED', 'SCHEDULED', 'DONE'))");
        DB::statement("ALTER TABLE expo_registrations ALTER COLUMN status SET DEFAULT 'REGISTERED'");
        DB::statement('ALTER TABLE expo_registrations ALTER COLUMN status SET NOT NULL');
    }
};
