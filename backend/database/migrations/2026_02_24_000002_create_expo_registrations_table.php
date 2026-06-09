<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expo_registrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expo_event_id')->constrained('expo_events')->cascadeOnDelete();
            $table->foreignId('group_id')->constrained()->cascadeOnDelete();
            $table->timestamp('registered_at')->useCurrent();
            $table->enum('status', ['REGISTERED', 'SCHEDULED', 'DONE'])->default('REGISTERED');
            $table->timestamps();

            // ⚠ Unique: prevent double registration
            $table->unique(['expo_event_id', 'group_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expo_registrations');
    }
};
