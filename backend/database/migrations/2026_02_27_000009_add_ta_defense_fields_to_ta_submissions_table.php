<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('ta_submissions', function (Blueprint $table) {
            $table->string('draft_report_path')->nullable()->after('file_path');
            $table->string('paper_path')->nullable()->after('draft_report_path');
            $table->string('publication_link')->nullable()->after('paper_path');
        });
    }

    public function down(): void
    {
        Schema::table('ta_submissions', function (Blueprint $table) {
            $table->dropColumn(['draft_report_path', 'paper_path', 'publication_link']);
        });
    }
};
