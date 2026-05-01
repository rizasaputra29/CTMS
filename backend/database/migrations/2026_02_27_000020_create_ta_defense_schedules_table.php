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
        if (!Schema::hasTable('ta_defense_schedules')) {
            Schema::create('ta_defense_schedules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('group_id')->constrained('groups')->onDelete('cascade');
                $table->foreignId('period_id')->constrained('periods')->onDelete('cascade');
                $table->foreignId('examiner_1_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('examiner_2_id')->constrained('users')->onDelete('cascade');
                $table->date('date');
                $table->time('start_time');
                $table->time('end_time');
                $table->string('room');
                $table->enum('status', ['SCHEDULED', 'DONE', 'CANCELLED'])->default('SCHEDULED');
                $table->timestamp('evaluation_deadline')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                // Indexes
                $table->index(['student_id', 'period_id']);
                $table->index(['group_id', 'period_id']);
                $table->index('status');
            });
        } else {
            // Add columns that may be missing from the older migration
            Schema::table('ta_defense_schedules', function (Blueprint $table) {
                if (!Schema::hasColumn('ta_defense_schedules', 'evaluation_deadline')) {
                    $table->timestamp('evaluation_deadline')->nullable();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ta_defense_schedules');
    }
};
