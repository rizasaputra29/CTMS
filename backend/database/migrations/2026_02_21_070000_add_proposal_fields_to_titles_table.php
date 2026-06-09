<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('titles', function (Blueprint $table) {
            $table->string('title_source')->default('LECTURER')->after('approved_by_admin'); // LECTURER, STUDENT
            $table->foreignId('proposed_by_group_id')->nullable()->constrained('groups')->onDelete('set null')->after('title_source');
            $table->foreignId('proposed_supervisor_id')->nullable()->constrained('users')->onDelete('set null')->after('proposed_by_group_id');
            $table->string('supervisor_approval_status')->nullable()->after('proposed_supervisor_id'); // PENDING, APPROVED, REJECTED
            $table->text('rejection_reason')->nullable()->after('supervisor_approval_status');
            $table->text('problem_statement')->nullable()->after('description');
            $table->text('scope')->nullable()->after('problem_statement');
        });
    }

    public function down(): void
    {
        Schema::table('titles', function (Blueprint $table) {
            $table->dropForeign(['proposed_by_group_id']);
            $table->dropForeign(['proposed_supervisor_id']);
            $table->dropColumn([
                'title_source',
                'proposed_by_group_id',
                'proposed_supervisor_id',
                'supervisor_approval_status',
                'rejection_reason',
                'problem_statement',
                'scope',
            ]);
        });
    }
};
