<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->boolean('has_active_proposal')->default(false)->after('has_existing_group');
        });

        Schema::table('periods', function (Blueprint $table) {
            $table->boolean('require_all_students_grouped')->default(true)->after('max_supervise_load');
        });

        // Governance normalization: PRE_APPROVED is replaced by UNDER_REVIEW.
        DB::table('titles')
            ->where('supervisor_approval_status', 'PRE_APPROVED')
            ->update(['supervisor_approval_status' => 'UNDER_REVIEW']);

        // Mark groups as having active proposal when they still have open proposal lifecycle.
        $activeProposalGroupIds = DB::table('titles')
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW'])
            ->whereNotNull('proposed_by_group_id')
            ->pluck('proposed_by_group_id')
            ->unique();

        if ($activeProposalGroupIds->isNotEmpty()) {
            DB::table('groups')
                ->whereIn('id', $activeProposalGroupIds)
                ->update(['has_active_proposal' => true]);
        }
    }

    public function down(): void
    {
        // Rollback enum normalization to previous value for backward compatibility.
        DB::table('titles')
            ->where('supervisor_approval_status', 'UNDER_REVIEW')
            ->update(['supervisor_approval_status' => 'PRE_APPROVED']);

        Schema::table('groups', function (Blueprint $table) {
            $table->dropColumn('has_active_proposal');
        });

        Schema::table('periods', function (Blueprint $table) {
            $table->dropColumn('require_all_students_grouped');
        });
    }
};
