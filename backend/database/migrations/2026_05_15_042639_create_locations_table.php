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
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Location name (e.g., "Room A101", "Zoom Meeting")
            $table->integer('capacity')->nullable(); // Room capacity, null for online/virtual
            $table->boolean('is_active')->default(true); // Whether location is available
            $table->string('type')->default('physical'); // physical or online
            $table->text('description')->nullable(); // Optional description
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('locations');
    }
};
