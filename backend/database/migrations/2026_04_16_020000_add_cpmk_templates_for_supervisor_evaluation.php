<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // CPMK Templates untuk BIMBINGAN_SEMPRO, BIMBINGAN_EXPO, BIMBINGAN_TA
        // Gunakan insertOrIgnore untuk idempotent (bisa di-run berkali-kali)
        $cpmkTemplates = [
            [
                'code' => 'CPMK-1',
                'name' => 'Kemampuan Presentasi',
                'description' => 'Kemampuan menyampaikan ide secara jelas dan terstruktur',
                'weight' => 25.00,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'CPMK-2',
                'name' => 'Penguasaan Materi',
                'description' => 'Pemahaman mendalam terhadap topik yang dibahas',
                'weight' => 30.00,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'CPMK-3',
                'name' => 'Metodologi Penelitian',
                'description' => 'Ketepatan metode yang digunakan dalam penelitian',
                'weight' => 25.00,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 3,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'CPMK-4',
                'name' => 'Kualitas Dokumen',
                'description' => 'Tata tulis, referensi, dan kelengkapan dokumen',
                'weight' => 20.00,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 4,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($cpmkTemplates as $template) {
            // insertOrIgnore akan skip jika code sudah ada (idempotent)
            DB::table('assessment_component_templates')->insertOrIgnore($template);
        }
    }

    public function down(): void
    {
        // Hapus CPMK templates saja (MILESTONE sudah di-handle migration terpisah)
        DB::table('assessment_component_templates')
            ->whereIn('code', ['CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4'])
            ->delete();
    }
};
