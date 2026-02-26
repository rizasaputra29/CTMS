<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('grade_consistency_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('pdc1_score', 5, 2)->nullable();
            $table->decimal('pdc2_score', 5, 2)->nullable();
            $table->decimal('deviation', 5, 2)->nullable();
            $table->string('status')->default('UNCHECKED'); // UNCHECKED, CONSISTENT, INCONSISTENT
            $table->text('notes')->nullable();
            $table->foreignId('checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grade_consistency_checks');
    }
};
