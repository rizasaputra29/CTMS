<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->foreignId('proposed_supervisor_1_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('proposed_supervisor_2_id')->nullable()->constrained('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->dropForeign(['proposed_supervisor_1_id']);
            $table->dropForeign(['proposed_supervisor_2_id']);
            $table->dropColumn(['proposed_supervisor_1_id', 'proposed_supervisor_2_id']);
        });
    }
};
