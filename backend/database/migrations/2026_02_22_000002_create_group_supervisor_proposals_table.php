<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('group_supervisor_proposals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained('groups')->onDelete('cascade');
            $table->foreignId('proposed_supervisor_1_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('proposed_supervisor_2_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('status')->default('PENDING'); // PENDING
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_supervisor_proposals');
    }
};
