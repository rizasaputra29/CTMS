<?php

namespace Database\Seeders;

use App\Models\Title;
use App\Models\User;
use Illuminate\Database\Seeder;

class TitleSeeder extends Seeder
{
    public function run(): void
    {
        $lecturerByEmail = User::query()->pluck('id', 'email');

        $titles = [
            [
                'id' => 1,
                'title' => 'Sistem Rekomendasi Produk Berbasis Collaborative Filtering',
                'description' => 'Membangun sistem rekomendasi menggunakan algoritma collaborative filtering untuk e-commerce.',
                'problem_statement' => 'Pengguna kesulitan menemukan produk yang relevan di antara ribuan pilihan.',
                'scope' => 'Backend sistem rekomendasi, integrasi dengan platform e-commerce.',
                'title_source' => 'LECTURER',
                'lecturer_email' => 'budi@ctms.com',
                'period_id' => 1,
                'quota' => 2,
            ],
            [
                'id' => 2,
                'title' => 'Deteksi Hoaks pada Media Sosial Menggunakan NLP',
                'description' => 'Sistem deteksi otomatis konten hoaks menggunakan teknik Natural Language Processing.',
                'problem_statement' => 'Penyebaran hoaks di media sosial yang sulit dideteksi secara manual.',
                'scope' => 'Model NLP, dataset berita Indonesia, API deteksi.',
                'title_source' => 'LECTURER',
                'lecturer_email' => 'siti@ctms.com',
                'period_id' => 1,
                'quota' => 3,
            ],
            [
                'id' => 3,
                'title' => 'Aplikasi Monitoring Kesehatan berbasis IoT',
                'description' => 'Platform monitoring kondisi kesehatan real-time menggunakan sensor IoT.',
                'problem_statement' => 'Kurangnya sistem monitoring kesehatan yang terjangkau dan real-time.',
                'scope' => 'Sensor IoT, backend, dashboard monitoring.',
                'title_source' => 'LECTURER',
                'lecturer_email' => 'ahmad@ctms.com',
                'period_id' => 1,
                'quota' => 2,
            ],
            [
                'id' => 4,
                'title' => 'Optimasi Rute Pengiriman Menggunakan Algoritma Genetika',
                'description' => 'Sistem optimasi rute pengiriman barang menggunakan pendekatan evolutionary algorithm.',
                'problem_statement' => 'Biaya operasional pengiriman tinggi akibat rute yang tidak optimal.',
                'scope' => 'Algoritma genetika, visualisasi rute, integrasi maps API.',
                'title_source' => 'LECTURER',
                'lecturer_email' => 'dewi@ctms.com',
                'period_id' => 1,
                'quota' => 2,
            ],
            [
                'id' => 5,
                'title' => 'Sistem Manajemen Inventori dengan Computer Vision',
                'description' => 'Otomasi manajemen stok gudang menggunakan deteksi objek berbasis computer vision.',
                'problem_statement' => 'Proses inventori manual memakan waktu dan rentan kesalahan.',
                'scope' => 'Model YOLO, sistem manajemen inventori, dashboard.',
                'title_source' => 'LECTURER',
                'lecturer_email' => 'rudi@ctms.com',
                'period_id' => 1,
                'quota' => 3,
            ],
            [
                'id' => 6,
                'title' => 'Platform E-Learning Adaptif Berbasis AI',
                'description' => 'Sistem pembelajaran online yang menyesuaikan materi berdasarkan performa dan gaya belajar.',
                'problem_statement' => 'Konten e-learning yang seragam tidak efektif untuk semua jenis pelajar.',
                'scope' => 'Algoritma adaptive learning, LMS, analitik pembelajaran.',
                'title_source' => 'LECTURER',
                'lecturer_email' => 'maya@ctms.com',
                'period_id' => 1,
                'quota' => 2,
            ],
            [
                'id' => 7,
                'title' => 'Blockchain untuk Keamanan Data Rekam Medis',
                'description' => 'Implementasi blockchain untuk menjamin integritas dan keamanan data rekam medis pasien.',
                'problem_statement' => 'Data rekam medis rentan terhadap pemalsuan dan akses tidak sah.',
                'scope' => 'Smart contract, sistem rekam medis, enkripsi data.',
                'title_source' => 'LECTURER',
                'lecturer_email' => 'hendra@ctms.com',
                'period_id' => 1,
                'quota' => 2,
            ],
            [
                'id' => 8,
                'title' => 'Chatbot Customer Service Berbasis Large Language Model',
                'description' => 'Pengembangan chatbot cerdas untuk layanan pelanggan menggunakan LLM.',
                'problem_statement' => 'Respons layanan pelanggan lambat dan tidak konsisten.',
                'scope' => 'Fine-tuning LLM, integrasi channel komunikasi, evaluasi respons.',
                'title_source' => 'LECTURER',
                'lecturer_email' => 'rina@ctms.com',
                'period_id' => 1,
                'quota' => 3,
            ],
            [
                'id' => 9,
                'title' => 'Analisis Sentimen Ulasan Produk Marketplace',
                'description' => 'Sistem analisis sentimen otomatis untuk ulasan produk di marketplace.',
                'problem_statement' => 'Merchant kesulitan memahami feedback pelanggan secara massal.',
                'scope' => 'Model sentimen, API marketplace, dashboard analitik.',
                'title_source' => 'LECTURER',
                'lecturer_email' => 'budi@ctms.com',
                'period_id' => 2,
                'quota' => 2,
            ],
            [
                'id' => 10,
                'title' => 'Sistem Prediksi Kebutuhan Energi Smart Building',
                'description' => 'Prediksi konsumsi energi gedung pintar menggunakan machine learning.',
                'problem_statement' => 'Pemborosan energi di gedung komersial akibat manajemen yang reaktif.',
                'scope' => 'Sensor energi, model prediksi, sistem kontrol otomatis.',
                'title_source' => 'LECTURER',
                'lecturer_email' => 'siti@ctms.com',
                'period_id' => 2,
                'quota' => 2,
            ],
        ];

        foreach ($titles as $row) {
            $lecturerId = $lecturerByEmail->get($row['lecturer_email']);
            if (! $lecturerId) {
                continue;
            }

            Title::query()->updateOrCreate(
                ['id' => $row['id']],
                [
                    'lecturer_id' => $lecturerId,
                    'title' => $row['title'],
                    'description' => $row['description'],
                    'problem_statement' => $row['problem_statement'],
                    'scope' => $row['scope'],
                    'quota' => $row['quota'],
                    'status' => 'OPEN',
                    'approved_by_admin' => true,
                    'title_source' => $row['title_source'],
                    'proposed_by_group_id' => null,
                    'proposed_supervisor_id' => null,
                    'supervisor_approval_status' => null,
                    'rejection_reason' => null,
                    'period_id' => $row['period_id'],
                ]
            );
        }

        $this->command->info('Seeded lecturer titles for QA scenarios.');
    }
}
