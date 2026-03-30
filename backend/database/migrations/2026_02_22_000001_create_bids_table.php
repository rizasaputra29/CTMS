<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('bids', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained('groups')->onDelete('cascade');
            $table->foreignId('title_id')->constrained('titles')->onDelete('cascade');
            $table->integer('priority');
            $table->string('status')->default('PENDING'); // PENDING, ACCEPTED, REJECTED
            $table->string('lecturer_recommendation')->nullable(); // ACCEPT, REJECT
            $table->timestamps();

            $table->unique(['group_id', 'priority']);   // no duplicate priority per group
            $table->unique(['group_id', 'title_id']);   // no duplicate bid to same title
            $table->index('title_id');                  // title-centric queries
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bids');
    }
};
