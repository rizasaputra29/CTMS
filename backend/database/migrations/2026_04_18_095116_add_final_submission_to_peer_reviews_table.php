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
        Schema::table('peer_reviews', function (Blueprint $table) {
            $table->boolean('is_final_submission')->default(false)->after('comment');
            $table->timestamp('submitted_at')->nullable()->after('is_final_submission');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('peer_reviews', function (Blueprint $table) {
            $table->dropColumn(['is_final_submission', 'submitted_at']);
        });
    }
};
