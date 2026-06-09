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
        Schema::create('student_peer_review_status', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('group_id')->constrained()->onDelete('cascade');
            $table->foreignId('period_id')->constrained()->onDelete('cascade');
            $table->boolean('has_completed_peer_review')->default(false);
            $table->enum('ta_status', ['TA_BLOCKED', 'TA_ACTIVE', 'TA_DONE'])->default('TA_BLOCKED');
            $table->timestamps();

            // Unique constraint to ensure one record per student per period
            $table->unique(['student_id', 'period_id']);

            // Indexes for faster queries
            $table->index(['group_id', 'ta_status']);
            $table->index(['period_id', 'has_completed_peer_review']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_peer_review_status');
    }
};
