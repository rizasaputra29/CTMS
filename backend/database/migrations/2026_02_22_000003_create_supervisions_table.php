<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supervisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained('groups')->onDelete('cascade');
            $table->foreignId('supervisor_id')->constrained('users')->onDelete('cascade');
            $table->string('role'); // SUPERVISOR_1, SUPERVISOR_2
            $table->foreignId('assigned_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['group_id', 'role']);    // no two SUPERVISOR_1 per group
            $table->index('supervisor_id');          // load calculation queries
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supervisions');
    }
};
