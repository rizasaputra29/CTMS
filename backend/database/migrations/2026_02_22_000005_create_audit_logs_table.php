<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('action');           // e.g. FINALIZATION_ALLOCATE, BIDDING_LOCK, MEMBER_LEAVE_APPROVED
            $table->string('target_type');      // e.g. Group, Title, TaSubmission
            $table->unsignedBigInteger('target_id');
            $table->json('payload')->nullable(); // extra context
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
