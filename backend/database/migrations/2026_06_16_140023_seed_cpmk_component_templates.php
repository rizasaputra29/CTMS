<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $cpmkComponents = [
            [
                'code' => 'CPMK-1',
                'name' => 'CPMK 1',
                'description' => 'Kemampuan mahasiswa dalam menerapkan pengetahuan matematis atau ilmu alam dalamperancangan dan pengembangan solusi proyek ketika menganalisis dan menyelesaikan masalah kompleks di dunia nyata (C100).',
                'weight' => 15.00,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'CPMK-2',
                'name' => 'CPMK 2',
                'description' => 'Kemampuan mahasiswa dalam melakukan perancangan dan pengembangan komponen, sistem, atau proses berdasarkan aspek ekonomi, manufakturabilitas, sustainabilitas, atau aspek lainnyaseperti aspek lingkungan dan legal (C100, C200, C300).',
                'weight' => 25.00,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'CPMK-3',
                'name' => 'CPMK 3',
                'description' => 'Kemampuan mahasiswa dalam melakukan riset dalam proses perancangan desain (C100, C200, C300).',
                'weight' => 25.00,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 3,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'CPMK-4',
                'name' => 'CPMK 4',
                'description' => 'Kemampuan mahasiswa dalam melakukan identifikasi, perumusan, dan analisis permasalahan kompleks. (C100).',
                'weight' => 15.00,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 4,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'CPMK-5',
                'name' => 'CPMK 5',
                'description' => 'Kemampuan mahasiswa dalam memahami dan mengikuti perkembangan teknologi (C100, C200, С300).',
                'weight' => 20.00,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 5,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($cpmkComponents as $component) {
            DB::table('assessment_component_templates')->updateOrInsert(
                ['code' => $component['code']],
                $component
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('assessment_component_templates')
            ->whereIn('code', ['CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5'])
            ->delete();
    }
};
