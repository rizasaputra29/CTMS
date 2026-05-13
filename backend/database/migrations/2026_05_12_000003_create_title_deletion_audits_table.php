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
        Schema::create('title_deletion_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('title_id')->constrained('titles')->onDelete('cascade');
            $table->string('title_name');
            $table->foreignId('lecturer_id')->constrained('users');
            $table->foreignId('period_id')->constrained('periods');
            $table->json('affected_groups'); // Array of {group_id, old_status, new_status}
            $table->foreignId('deleted_by')->constrained('users');
            $table->timestamp('deleted_at')->useCurrent();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('title_deletion_audits');
    }
};
