<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('peer_reviews', function (Blueprint $table) {
            // Add new column for period indicator reference
            $table->foreignId('period_indicator_id')->nullable()->after('indicator_id')
                ->constrained('period_peer_review_indicators')->cascadeOnDelete();
            
            // Make indicator_id nullable as we'll migrate to new system
            $table->unsignedBigInteger('indicator_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('peer_reviews', function (Blueprint $table) {
            $table->dropForeign(['period_indicator_id']);
            $table->dropColumn('period_indicator_id');
            $table->unsignedBigInteger('indicator_id')->nullable(false)->change();
        });
    }
};
