<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ta_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('group_id')->constrained('groups')->onDelete('cascade');
            $table->string('status')->default('TA_LOCKED'); // TA_LOCKED, TA_DRAFT, TA_REVISED, TA_READY, TA_REGISTERED, TA_DEFENDED
            $table->string('file_path')->nullable();
            $table->text('feedback')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();

            $table->index('student_id');
            $table->index(['group_id', 'status']);  // expo eligibility check
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ta_submissions');
    }
};
