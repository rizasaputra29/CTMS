<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('digital_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('document_reference');   // reference to signed document
            $table->string('document_type');         // SURAT_TUGAS, BERITA_ACARA, etc.
            $table->text('signature_data');          // base64 signature image or hash
            $table->string('hash')->unique();       // SHA-256 hash for verification
            $table->timestamp('signed_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('digital_signatures');
    }
};
