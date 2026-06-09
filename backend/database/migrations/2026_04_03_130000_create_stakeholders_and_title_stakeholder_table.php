<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stakeholders', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('organization')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('type')->default('INDUSTRY');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('stakeholder_title', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stakeholder_id')->constrained('stakeholders')->cascadeOnDelete();
            $table->foreignId('title_id')->constrained('titles')->cascadeOnDelete();
            $table->string('role')->default('ADVISOR');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['stakeholder_id', 'title_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stakeholder_title');
        Schema::dropIfExists('stakeholders');
    }
};
