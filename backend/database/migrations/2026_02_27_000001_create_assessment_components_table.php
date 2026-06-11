<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assessment_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('period_id')->constrained()->cascadeOnDelete();
            $table->string('type');           // SEMPRO, SIDANG_TA, EXPO, BIMBINGAN
            $table->string('code');           // e.g. CPMK-1, CPL-3
            $table->string('name');           // e.g. "Kemampuan Presentasi"
            $table->text('description')->nullable();
            $table->decimal('weight', 5, 2); // bobot 0-100
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['period_id', 'type', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assessment_components');
    }
};
