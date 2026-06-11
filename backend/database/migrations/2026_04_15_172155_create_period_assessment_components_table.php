<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('period_assessment_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('period_id')->constrained()->cascadeOnDelete();
            $table->foreignId('template_id')->constrained('assessment_component_templates')->cascadeOnDelete();
            $table->string('type');           // SEMPRO, SIDANG_TA, EXPO, BIMBINGAN
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['period_id', 'type', 'template_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('period_assessment_components');
    }
};
