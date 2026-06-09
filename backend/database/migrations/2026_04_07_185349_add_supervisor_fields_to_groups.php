<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            // Only add fields that don't exist yet
            if (! Schema::hasColumn('groups', 'finalization_notes')) {
                $table->text('finalization_notes')->nullable()->after('status');
            }
            if (! Schema::hasColumn('groups', 'finalized_at')) {
                $table->timestamp('finalized_at')->nullable()->after('finalization_notes');
            }
            if (! Schema::hasColumn('groups', 'finalized_by')) {
                $table->foreignId('finalized_by')->nullable()->after('finalized_at')->constrained('users')->onDelete('set null');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            if (Schema::hasColumn('groups', 'finalized_by')) {
                $table->dropForeign(['finalized_by']);
                $table->dropColumn('finalized_by');
            }
            if (Schema::hasColumn('groups', 'finalization_notes')) {
                $table->dropColumn('finalization_notes');
            }
            if (Schema::hasColumn('groups', 'finalized_at')) {
                $table->dropColumn('finalized_at');
            }
        });
    }
};
