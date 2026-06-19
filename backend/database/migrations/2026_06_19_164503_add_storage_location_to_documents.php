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
        Schema::table('documents', function (Blueprint $table) {
            $table->string('storage_location')->default('local')->after('file_path')
                ->comment('local or s3');
        });

        Schema::table('expo_student_documents', function (Blueprint $table) {
            $table->string('storage_location')->default('local')->after('file_path')
                ->comment('local or s3');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('storage_location');
        });

        Schema::table('expo_student_documents', function (Blueprint $table) {
            $table->dropColumn('storage_location');
        });
    }
};
