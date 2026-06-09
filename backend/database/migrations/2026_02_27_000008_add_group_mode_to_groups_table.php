<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->string('group_mode')->default('GROUP')->after('assignment_type');
            // GROUP = kelompok, INDIVIDUAL = capstone individu
            $table->boolean('has_existing_group')->default(false)->after('group_mode');
            // Konfirmasi apakah sudah punya kelompok sebelum membuat
        });
    }

    public function down(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->dropColumn(['group_mode', 'has_existing_group']);
        });
    }
};
