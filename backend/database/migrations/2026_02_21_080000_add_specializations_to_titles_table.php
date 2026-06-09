<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('titles', function (Blueprint $table) {
            $table->json('specializations')->nullable()->after('scope');
        });
    }

    public function down(): void
    {
        Schema::table('titles', function (Blueprint $table) {
            $table->dropColumn('specializations');
        });
    }
};
