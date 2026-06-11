<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assessment_scores', function (Blueprint $table) {
            // Add new column for period component reference
            $table->foreignId('period_component_id')->nullable()->after('component_id')
                ->constrained('period_assessment_components')->cascadeOnDelete();

            // Make component_id nullable as we'll migrate to new system
            $table->unsignedBigInteger('component_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('assessment_scores', function (Blueprint $table) {
            $table->dropForeign(['period_component_id']);
            $table->dropColumn('period_component_id');
            $table->unsignedBigInteger('component_id')->nullable(false)->change();
        });
    }
};
