<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('peer_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('indicator_id')->constrained('peer_review_indicators')->cascadeOnDelete();
            $table->decimal('score', 5, 2);    // 0-100
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->unique(['group_id', 'reviewer_id', 'reviewee_id', 'indicator_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('peer_reviews');
    }
};
