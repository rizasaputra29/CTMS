<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('peer_reviews', function (Blueprint $table) {
            $table->dropUnique('peer_reviews_group_id_reviewer_id_reviewee_id_indicator_id_unique');
            $table->unique(['group_id', 'reviewer_id', 'reviewee_id', 'period_indicator_id']);
        });
    }

    public function down(): void
    {
        Schema::table('peer_reviews', function (Blueprint $table) {
            $table->dropUnique('peer_reviews_group_id_reviewer_id_reviewee_id_period_indicator_id_unique');
            $table->unique(['group_id', 'reviewer_id', 'reviewee_id', 'indicator_id']);
        });
    }
};
