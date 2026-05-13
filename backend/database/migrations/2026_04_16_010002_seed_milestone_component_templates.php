<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Add default milestone component templates
        $milestoneComponents = [
            [
                'code' => 'MILESTONE-1',
                'name' => 'Kemampuan Perencanaan Proyek',
                'description' => 'Mahasiswa mampu menyusun perencanaan proyek yang jelas, terstruktur, dan sesuai dengan target capaian',
                'weight' => 33.33,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'MILESTONE-2',
                'name' => 'Pengelolaan Waktu dan Dana',
                'description' => 'Mahasiswa mampu mengelola proyek sesuai dengan timeline yang telah ditentukan dan menggunakan dana secara efisien',
                'weight' => 33.33,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'MILESTONE-3',
                'name' => 'Identifikasi Kebutuhan',
                'description' => 'Mahasiswa mampu mengidentifikasi kebutuhan proyek dengan tepat, termasuk resource, stakeholder, dan risiko',
                'weight' => 33.34,
                'is_active' => true,
                'created_by' => null,
                'sort_order' => 3,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($milestoneComponents as $component) {
            DB::table('assessment_component_templates')->insertOrIgnore($component);
        }
    }

    public function down(): void
    {
        DB::table('assessment_component_templates')
            ->whereIn('code', ['MILESTONE-1', 'MILESTONE-2', 'MILESTONE-3'])
            ->delete();
    }
};
