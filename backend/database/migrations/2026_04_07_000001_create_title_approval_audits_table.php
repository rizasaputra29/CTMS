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
        Schema::create('title_approval_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('title_id')->constrained('titles')->cascadeOnDelete();
            $table->foreignId('lecturer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('affected_group_id')->nullable()->constrained('groups')->nullOnDelete();
            $table->enum('action', ['APPROVE', 'WITHDRAW', 'RE_APPROVE'])->default('APPROVE');
            $table->text('reason')->nullable();
            $table->timestamps();

            // Indexes for faster queries
            $table->index(['title_id', 'created_at']);
            $table->index(['lecturer_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('title_approval_audits');
    }
};
