<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->foreignId('supervisor_1_id')->nullable()->constrained('users')->onDelete('set null')->after('status');
            $table->foreignId('supervisor_2_id')->nullable()->constrained('users')->onDelete('set null')->after('supervisor_1_id');
        });

        // Update default status from PENDING to FORMING for new records
        // Existing records keep their current status
    }

    public function down(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->dropForeign(['supervisor_1_id']);
            $table->dropForeign(['supervisor_2_id']);
            $table->dropColumn(['supervisor_1_id', 'supervisor_2_id']);
        });
    }
};
