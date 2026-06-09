<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('join_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('PENDING'); // PENDING, ACCEPTED, REJECTED, INVALIDATED
            $table->text('message')->nullable();
            $table->timestamps();

            $table->unique(['group_id', 'requester_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('join_requests');
    }
};
