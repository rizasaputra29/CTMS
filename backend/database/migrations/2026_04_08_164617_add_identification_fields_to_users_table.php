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
        Schema::table('users', function (Blueprint $table) {
            // NIP for lecturers (dosen)
            $table->string('nip')->nullable()->after('email');

            // NIM for students (mahasiswa)
            $table->string('nim')->nullable()->after('nip');

            // Active status
            $table->boolean('is_active')->default(true)->after('nim');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['nip', 'nim', 'is_active']);
        });
    }
};
