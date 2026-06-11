<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('peer_review_indicator_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');            // e.g. "Kontribusi Teknis"
            $table->text('description')->nullable();
            $table->decimal('weight', 5, 2);   // bobot 0-100
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('peer_review_indicator_templates');
    }
};
