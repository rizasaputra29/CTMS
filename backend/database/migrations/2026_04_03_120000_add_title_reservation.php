<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('titles', function (Blueprint $table) {
            $table->foreignId('pre_assigned_group_id')->nullable()->constrained('groups')->nullOnDelete();
            $table->boolean('is_reserved')->default(false)->after('quota');
        });
    }

    public function down(): void
    {
        Schema::table('titles', function (Blueprint $table) {
            $table->dropForeign(['pre_assigned_group_id']);
            $table->dropColumn(['pre_assigned_group_id', 'is_reserved']);
        });
    }
};
