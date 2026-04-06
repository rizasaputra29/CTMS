<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('titles', function (Blueprint $table) {
            $table->foreignId('period_id')->nullable()->after('lecturer_id')->constrained('periods')->onDelete('cascade');
        });

        // Link existing titles to the current active period
        $activePeriod = DB::table('periods')->where('is_active', true)->first();
        if ($activePeriod) {
            DB::table('titles')->update(['period_id' => $activePeriod->id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('titles', function (Blueprint $table) {
            $table->dropForeign(['period_id']);
            $table->dropColumn('period_id');
        });
    }
};
