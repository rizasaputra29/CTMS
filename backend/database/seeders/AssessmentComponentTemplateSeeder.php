<?php

namespace Database\Seeders;

use App\Models\AssessmentComponentTemplate;
use App\Models\User;
use Illuminate\Database\Seeder;

class AssessmentComponentTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $createdBy = User::where('email', 'admin@ctms.com')->value('id');

        $templates = [
            // C100 Level (Total: 100%)
            [
                'code' => 'C100-CPMK1',
                'name' => 'Penerapan Pengetahuan Matematis/Ilmu Alam',
                'description' => 'Kemampuan mahasiswa dalam menerapkan pengetahuan matematis atau ilmu alam dalam perancangan dan pengembangan solusi proyek ketika menganalisis dan menyelesaikan masalah kompleks di dunia nyata (C100).',
                'weight' => 15.00,
                'sort_order' => 1,
            ],
            [
                'code' => 'C100-CPMK2',
                'name' => 'Perancangan Komponen/Sistem/Proses',
                'description' => 'Kemampuan mahasiswa dalam melakukan perancangan dan pengembangan komponen, sistem, atau proses berdasarkan aspek ekonomi, manufakturabilitas, sustainabilitas, atau aspek lainnya seperti aspek lingkungan dan legal (C100, C200, C300).',
                'weight' => 25.00,
                'sort_order' => 2,
            ],
            [
                'code' => 'C100-CPMK3',
                'name' => 'Riset dalam Perancangan Desain',
                'description' => 'Kemampuan mahasiswa dalam melakukan riset dalam proses perancangan desain (C100, C200, C300).',
                'weight' => 25.00,
                'sort_order' => 3,
            ],
            [
                'code' => 'C100-CPMK4',
                'name' => 'Identifikasi & Analisis Masalah Kompleks',
                'description' => 'Kemampuan mahasiswa dalam melakukan identifikasi, perumusan, dan analisis permasalahan kompleks (C100).',
                'weight' => 15.00,
                'sort_order' => 4,
            ],
            [
                'code' => 'C100-CPMK5',
                'name' => 'Memahami Perkembangan Teknologi',
                'description' => 'Kemampuan mahasiswa dalam memahami dan mengikuti perkembangan teknologi (C100, C200, C300).',
                'weight' => 20.00,
                'sort_order' => 5,
            ],

            // C400/C500 Level (Total: 100%)
            [
                'code' => 'C400-CPMK1',
                'name' => 'Riset, Analisis & Interpretasi Data',
                'description' => 'Kemampuan mahasiswa dalam melakukan riset untuk mengumpulkan, menganalisis, dan menginterpretasi data guna mendukung penilaian teknis dan ilmiah dalam proses perancangan desain (C400, C500).',
                'weight' => 40.00,
                'sort_order' => 6,
            ],
            [
                'code' => 'C400-CPMK2',
                'name' => 'Analisis Permasalahan Kompleks (C400/C500)',
                'description' => 'Kemampuan mahasiswa dalam melakukan identifikasi, perumusan, dan analisis permasalahan kompleks (C400, C500).',
                'weight' => 40.00,
                'sort_order' => 7,
            ],
            [
                'code' => 'C400-CPMK3',
                'name' => 'Metode & Desain Perancangan Sistem',
                'description' => 'Kemampuan mahasiswa dalam menerapkan metode dan desain perancangan sistem (C400).',
                'weight' => 20.00,
                'sort_order' => 8,
            ],

            // CPMK5 - Manajemen Proyek Tambahan (Total: 100%)
            [
                'code' => 'CPMK5-WAKTU',
                'name' => 'Perencanaan & Pengelolaan Waktu',
                'description' => 'Kemampuan mahasiswa dalam melakukan perencanaan dan pengelolaan proyek desain capstone sesuai dengan waktu yang sudah ditentukan.',
                'weight' => 30.00,
                'sort_order' => 9,
            ],
            [
                'code' => 'CPMK5-DANA',
                'name' => 'Perencanaan & Pengelolaan Dana',
                'description' => 'Kemampuan mahasiswa dalam melakukan perencanaan dan pengelolaan proyek desain capstone sesuai dengan dana yang diusulkan.',
                'weight' => 30.00,
                'sort_order' => 10,
            ],
            [
                'code' => 'CPMK5-KEBUTUHAN',
                'name' => 'Perencanaan sesuai Kebutuhan Desain',
                'description' => 'Kemampuan mahasiswa dalam melakukan perencanaan dan pengelolaan proyek desain capstone sesuai dengan kebutuhan identifikasi desain.',
                'weight' => 40.00,
                'sort_order' => 11,
            ],

            // Peer Review (10 kriteria, @10% = 100%)
            [
                'code' => 'PEER-1',
                'name' => 'Keterlibatan Perancangan Komponen',
                'description' => 'Keterlibatan dalam perancangan komponen.',
                'weight' => 10.00,
                'sort_order' => 12,
            ],
            [
                'code' => 'PEER-2',
                'name' => 'Keterlibatan Implementasi Komponen',
                'description' => 'Keterlibatan dalam implementasi komponen.',
                'weight' => 10.00,
                'sort_order' => 13,
            ],
            [
                'code' => 'PEER-3',
                'name' => 'Keterlibatan Penyusunan Laporan',
                'description' => 'Keterlibatan dalam penyusunan laporan.',
                'weight' => 10.00,
                'sort_order' => 14,
            ],
            [
                'code' => 'PEER-4',
                'name' => 'Keterlibatan Pembuatan Slide',
                'description' => 'Keterlibatan dalam pembuatan slide.',
                'weight' => 10.00,
                'sort_order' => 15,
            ],
            [
                'code' => 'PEER-5',
                'name' => 'Komunikasi',
                'description' => 'Kemampuan komunikasi tim.',
                'weight' => 10.00,
                'sort_order' => 16,
            ],
            [
                'code' => 'PEER-6',
                'name' => 'Kerjasama',
                'description' => 'Kemampuan kerjasama tim.',
                'weight' => 10.00,
                'sort_order' => 17,
            ],
            [
                'code' => 'PEER-7',
                'name' => 'Penyelesaian Masalah',
                'description' => 'Efektivitas penyelesaian masalah.',
                'weight' => 10.00,
                'sort_order' => 18,
            ],
            [
                'code' => 'PEER-8',
                'name' => 'Penyelesaian Tugas',
                'description' => 'Ketepatan waktu penyelesaian tugas.',
                'weight' => 10.00,
                'sort_order' => 19,
            ],
            [
                'code' => 'PEER-9',
                'name' => 'Tanggung Jawab',
                'description' => 'Tingkat tanggung jawab anggota tim.',
                'weight' => 10.00,
                'sort_order' => 20,
            ],
            [
                'code' => 'PEER-10',
                'name' => 'Kontribusi Keseluruhan',
                'description' => 'Kontribusi keseluruhan anggota tim.',
                'weight' => 10.00,
                'sort_order' => 21,
            ],
        ];

        foreach ($templates as $template) {
            AssessmentComponentTemplate::query()->updateOrCreate(
                ['code' => $template['code']],
                [
                    'name' => $template['name'],
                    'description' => $template['description'],
                    'weight' => $template['weight'],
                    'is_active' => true,
                    'created_by' => $createdBy,
                    'sort_order' => $template['sort_order'],
                ]
            );
        }

        $this->command->info('Seeded assessment component templates ('.count($templates).' items).');
    }
}
