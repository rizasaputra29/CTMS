<?php

namespace Database\Seeders;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class GroupSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        // Helper untuk ambil user
        $u = fn (string $email) => User::where('email', $email)->value('id');

        $dosen = [
            'budi' => User::where('email', 'budi@ctms.com')->value('id'),
            'siti' => User::where('email', 'siti@ctms.com')->value('id'),
            'ahmad' => User::where('email', 'ahmad@ctms.com')->value('id'),
            'dewi' => User::where('email', 'dewi@ctms.com')->value('id'),
            'rudi' => User::where('email', 'rudi@ctms.com')->value('id'),
            'maya' => User::where('email', 'maya@ctms.com')->value('id'),
            'hendra' => User::where('email', 'hendra@ctms.com')->value('id'),
            'rina' => User::where('email', 'rina@ctms.com')->value('id'),
        ];

        // ════════════════════════════════════════════════════════════════════
        // PERIOD 1 — GRUP NORMAL
        // ════════════════════════════════════════════════════════════════════

        // ── GRUP A: READY_FOR_BIDDING, tidak ada bid/propose ────────────────
        // Skenario: Grup lengkap (3 org), idle, bisa bid atau propose
        DB::table('groups')->insert([
            'id' => 1,
            'name' => 'Grup Alpha',
            'period_id' => 1,
            'status' => 'READY_FOR_BIDDING',
            'is_solo' => false,
            'leader_id' => $u('andi@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 1, 'user_id' => $u('andi@ctms.com'),  'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 1, 'user_id' => $u('bela@ctms.com'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 1, 'user_id' => $u('citra@ctms.com'), 'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ── GRUP B: READY_FOR_BIDDING, punya 1 bid PENDING ──────────────────
        // Skenario: Sudah bid 1 judul, masih bisa bid 2 lagi (kuota tersisa)
        DB::table('groups')->insert([
            'id' => 2,
            'name' => 'Grup Beta',
            'period_id' => 1,
            'status' => 'READY_FOR_BIDDING',
            'is_solo' => false,
            'leader_id' => $u('dodi@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 2, 'user_id' => $u('dodi@ctms.com'),  'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 2, 'user_id' => $u('eva@ctms.com'),   'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 2, 'user_id' => $u('fahmi@ctms.com'), 'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);
        DB::table('bids')->insert([
            'group_id' => 2,
            'title_id' => 1,         // judul Dr. Budi
            'priority' => 1,
            'status' => 'PENDING',
            'lecturer_recommendation' => null,       // belum direkomendasikan
            'proposed_supervisor_1_id' => $dosen['budi'],
            'proposed_supervisor_2_id' => null,
            'period_id' => 1,
            'created_at' => $now, 'updated_at' => $now,
        ]);

        // ── GRUP C: READY_FOR_BIDDING, kuota penuh (3 bid PENDING) ──────────
        // Skenario: Tidak bisa bid/propose lagi, harus tunggu reject atau cancel
        DB::table('groups')->insert([
            'id' => 3,
            'name' => 'Grup Gamma',
            'period_id' => 1,
            'status' => 'READY_FOR_BIDDING',
            'is_solo' => false,
            'leader_id' => $u('gita@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 3, 'user_id' => $u('gita@ctms.com'),   'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 3, 'user_id' => $u('hendra@ctms.com'), 'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 3, 'user_id' => $u('indra@ctms.com'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 3, 'user_id' => $u('joko@ctms.com'),   'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);
        DB::table('bids')->insert([
            // Bid 1 - priority 1
            [
                'group_id' => 3, 'title_id' => 2, 'priority' => 1,
                'status' => 'PENDING', 'lecturer_recommendation' => null,
                'proposed_supervisor_1_id' => $dosen['siti'],
                'proposed_supervisor_2_id' => $dosen['budi'],
                'period_id' => 1, 'created_at' => $now, 'updated_at' => $now,
            ],
            // Bid 2 - priority 2
            [
                'group_id' => 3, 'title_id' => 3, 'priority' => 2,
                'status' => 'PENDING', 'lecturer_recommendation' => null,
                'proposed_supervisor_1_id' => $dosen['ahmad'],
                'proposed_supervisor_2_id' => null,
                'period_id' => 1, 'created_at' => $now, 'updated_at' => $now,
            ],
            // Bid 3 - priority 3
            [
                'group_id' => 3, 'title_id' => 4, 'priority' => 3,
                'status' => 'PENDING', 'lecturer_recommendation' => null,
                'proposed_supervisor_1_id' => $dosen['dewi'],
                'proposed_supervisor_2_id' => null,
                'period_id' => 1, 'created_at' => $now, 'updated_at' => $now,
            ],
        ]);

        // ── GRUP D: WAITING_SUPERVISOR_APPROVAL (propose ke dosen) ──────────
        // Skenario: Proposal sedang di-review, tidak bisa submit propose baru
        DB::table('groups')->insert([
            'id' => 4,
            'name' => 'Grup Delta',
            'period_id' => 1,
            'status' => 'WAITING_SUPERVISOR_APPROVAL',
            'is_solo' => false,
            'leader_id' => $u('kartika@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 4, 'user_id' => $u('kartika@ctms.com'), 'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 4, 'user_id' => $u('lukman@ctms.com'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 4, 'user_id' => $u('mira@ctms.com'),    'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);
        // Proposal PENDING milik Grup D — judul mahasiswa
        DB::table('titles')->insert([
            'id' => 11,
            'title' => 'Sistem Manajemen Tugas Berbasis Kanban dengan Fitur AI',
            'description' => 'Aplikasi manajemen tugas yang memanfaatkan AI untuk saran prioritas otomatis.',
            'problem_statement' => 'Tim pengembang kesulitan mengelola prioritas tugas yang dinamis.',
            'scope' => 'Web application, AI task prioritization, integrasi Slack.',
            'title_source' => 'STUDENT',
            'supervisor_approval_status' => 'PENDING',
            'owner_id' => null,
            'proposed_by_group_id' => 4,
            'proposed_supervisor_id' => $dosen['maya'],
            'period_id' => 1,
            'quota' => 1,
            'is_available' => false,
            'created_at' => $now, 'updated_at' => $now,
        ]);

        // ── GRUP E: READY_FOR_BIDDING, proposal pernah REJECTED ─────────────
        // Skenario: Proposal ditolak dosen, quota BEBAS, bisa propose/bid lagi
        // Test: memverifikasi proposal REJECTED tidak dihitung ke quota
        DB::table('groups')->insert([
            'id' => 5,
            'name' => 'Grup Epsilon',
            'period_id' => 1,
            'status' => 'READY_FOR_BIDDING',
            'is_solo' => false,
            'leader_id' => $u('nanda@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 5, 'user_id' => $u('nanda@ctms.com'),  'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 5, 'user_id' => $u('oky@ctms.com'),    'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 5, 'user_id' => $u('putri@ctms.com'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);
        // Proposal REJECTED — tidak dihitung di kuota
        DB::table('titles')->insert([
            'id' => 12,
            'title' => 'Platform Crowdfunding untuk UMKM Lokal',
            'description' => 'Sistem crowdfunding khusus UMKM dengan verifikasi ketat.',
            'problem_statement' => 'UMKM sulit mendapatkan pendanaan dari jalur konvensional.',
            'scope' => 'Platform web, payment gateway, verifikasi KYC.',
            'title_source' => 'STUDENT',
            'supervisor_approval_status' => 'REJECTED',   // ← REJECTED, quota bebas
            'owner_id' => null,
            'proposed_by_group_id' => 5,
            'proposed_supervisor_id' => $dosen['rudi'],
            'period_id' => 1,
            'quota' => 1,
            'is_available' => false,
            'created_at' => $now->copy()->subDays(3),
            'updated_at' => $now,
        ]);

        // ── GRUP F: FORMING (hanya 2 anggota, min=3) ────────────────────────
        // Skenario: Belum bisa bid atau propose, harus cari anggota dulu
        DB::table('groups')->insert([
            'id' => 6,
            'name' => 'Grup Zeta',
            'period_id' => 1,
            'status' => 'FORMING',
            'is_solo' => false,
            'leader_id' => $u('qori@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 6, 'user_id' => $u('qori@ctms.com'), 'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 6, 'user_id' => $u('reza@ctms.com'), 'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ── GRUP G: KELOMPOK_FINAL (bid ACCEPTED, siap finalisasi admin) ─────
        // Skenario: Dosen sudah ACCEPT bid, menunggu batch finalisasi admin
        DB::table('groups')->insert([
            'id' => 7,
            'name' => 'Grup Eta',
            'period_id' => 1,
            'status' => 'KELOMPOK_FINAL',
            'is_solo' => false,
            'leader_id' => $u('sari@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 7, 'user_id' => $u('sari@ctms.com'),  'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 7, 'user_id' => $u('tono@ctms.com'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 7, 'user_id' => $u('udin@ctms.com'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 7, 'user_id' => $u('vina@ctms.com'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);
        DB::table('bids')->insert([
            'group_id' => 7,
            'title_id' => 5,         // judul Dr. Rudi
            'priority' => 1,
            'status' => 'ACCEPTED', // dosen sudah ACCEPT
            'lecturer_recommendation' => 'ACCEPT',
            'proposed_supervisor_1_id' => $dosen['rudi'],
            'proposed_supervisor_2_id' => $dosen['maya'],
            'period_id' => 1,
            'created_at' => $now, 'updated_at' => $now,
        ]);

        // ── GRUP H: READY_FOR_BIDDING, ingin bid ke judul solo seeker C ─────
        // Skenario: Test mekanisme bid ke judul solo seeker (TITLE_APPROVED)
        DB::table('groups')->insert([
            'id' => 8,
            'name' => 'Grup Theta',
            'period_id' => 1,
            'status' => 'READY_FOR_BIDDING',
            'is_solo' => false,
            'leader_id' => $u('dani@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 8, 'user_id' => $u('dani@ctms.com'),  'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 8, 'user_id' => $u('eka@ctms.com'),   'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 8, 'user_id' => $u('fani@ctms.com'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ── GRUP I: bid ACCEPTED by dosen, siap finalisasi ──────────────────
        // Skenario: Dosen ACCEPT bid priority 1, bid lain tidak relevan
        DB::table('groups')->insert([
            'id' => 9,
            'name' => 'Grup Iota',
            'period_id' => 1,
            'status' => 'KELOMPOK_FINAL',
            'is_solo' => false,
            'leader_id' => $u('gilang@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 9, 'user_id' => $u('gilang@ctms.com'), 'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 9, 'user_id' => $u('hani@ctms.com'),   'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 9, 'user_id' => $u('ivan@ctms.com'),   'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);
        DB::table('bids')->insert([
            [
                'group_id' => 9, 'title_id' => 6, 'priority' => 1,
                'status' => 'ACCEPTED', 'lecturer_recommendation' => 'ACCEPT',
                'proposed_supervisor_1_id' => $dosen['maya'],
                'proposed_supervisor_2_id' => $dosen['budi'],
                'period_id' => 1, 'created_at' => $now, 'updated_at' => $now,
            ],
            // Bid lain yang kalah (status REJECTED by dosen)
            [
                'group_id' => 9, 'title_id' => 7, 'priority' => 2,
                'status' => 'REJECTED', 'lecturer_recommendation' => 'REJECT',
                'proposed_supervisor_1_id' => $dosen['hendra'],
                'proposed_supervisor_2_id' => null,
                'period_id' => 1, 'created_at' => $now, 'updated_at' => $now,
            ],
        ]);

        // ════════════════════════════════════════════════════════════════════
        // PERIOD 1 — SOLO SEEKER
        // ════════════════════════════════════════════════════════════════════

        // ── SOLO A: READY_FOR_BIDDING (is_solo=true, allow_solo=true, belum propose)
        // Skenario: Solo siap propose, belum melakukan apapun
        DB::table('groups')->insert([
            'id' => 10,
            'name' => 'Solo — Zara',
            'period_id' => 1,
            'status' => 'READY_FOR_BIDDING',
            'is_solo' => true,
            'leader_id' => $u('zara@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 10, 'user_id' => $u('zara@ctms.com'), 'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ── SOLO B: WAITING_SUPERVISOR_APPROVAL (propose sedang di-review) ──
        // Skenario: Solo sudah propose, menunggu dosen approve/reject
        DB::table('groups')->insert([
            'id' => 11,
            'name' => 'Solo — Aldo',
            'period_id' => 1,
            'status' => 'WAITING_SUPERVISOR_APPROVAL',
            'is_solo' => true,
            'leader_id' => $u('aldo@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 11, 'user_id' => $u('aldo@ctms.com'), 'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
        ]);
        DB::table('titles')->insert([
            'id' => 13,
            'title' => 'Sistem Deteksi Plagiarisme Kode Program Berbasis AST',
            'description' => 'Deteksi plagiarisme kode dengan membandingkan Abstract Syntax Tree antar submission.',
            'problem_statement' => 'Plagiarisme kode sulit dideteksi hanya dari perbandingan teks.',
            'scope' => 'Parser multi-bahasa, algoritma tree similarity, laporan deteksi.',
            'title_source' => 'STUDENT',
            'supervisor_approval_status' => 'PENDING',
            'owner_id' => null,
            'proposed_by_group_id' => 11,
            'proposed_supervisor_id' => $dosen['budi'],
            'period_id' => 1,
            'quota' => 1,
            'is_available' => false,
            'created_at' => $now, 'updated_at' => $now,
        ]);

        // ── SOLO C: TITLE_APPROVED — judul di marketplace, bisa di-bid ───────
        // Skenario: Judul solo seeker sudah approved, terbuka untuk Grup H bid
        DB::table('groups')->insert([
            'id' => 12,
            'name' => 'Solo — Bella',
            'period_id' => 1,
            'status' => 'TITLE_APPROVED',
            'is_solo' => true,
            'leader_id' => $u('bella@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 12, 'user_id' => $u('bella@ctms.com'), 'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
        ]);
        DB::table('titles')->insert([
            'id' => 14,
            'title' => 'Aplikasi Diagnosa Awal Penyakit Tanaman Padi dengan CNN',
            'description' => 'Sistem diagnosa penyakit tanaman padi menggunakan foto daun dan model CNN.',
            'problem_statement' => 'Petani tidak memiliki akses mudah ke pakar untuk diagnosa penyakit tanaman.',
            'scope' => 'Model CNN, mobile app, database penyakit tanaman.',
            'title_source' => 'STUDENT',
            'supervisor_approval_status' => 'APPROVED',   // ← sudah disetujui dosen
            'owner_id' => null,
            'proposed_by_group_id' => 12,
            'proposed_supervisor_id' => $dosen['siti'],
            'period_id' => 1,
            'quota' => 1,
            'is_available' => true,            // ← terbuka di marketplace
            'created_at' => $now, 'updated_at' => $now,
        ]);

        // ── SOLO D: READY_FOR_BIDDING — proposal pernah REJECTED, quota bebas
        // Skenario: Test quota bebas setelah rejected (sama seperti grup normal)
        DB::table('groups')->insert([
            'id' => 13,
            'name' => 'Solo — Candra',
            'period_id' => 1,
            'status' => 'READY_FOR_BIDDING',
            'is_solo' => true,
            'leader_id' => $u('candra@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 13, 'user_id' => $u('candra@ctms.com'), 'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
        ]);
        DB::table('titles')->insert([
            'id' => 15,
            'title' => 'Sistem Rekomendasi Wisata Berbasis Collaborative Filtering',
            'description' => 'Aplikasi rekomendasi destinasi wisata personal menggunakan data preferensi pengguna.',
            'problem_statement' => 'Wisatawan kesulitan menemukan destinasi yang sesuai selera dan budget.',
            'scope' => 'Algoritma CF, integrasi Google Maps, mobile app.',
            'title_source' => 'STUDENT',
            'supervisor_approval_status' => 'REJECTED',   // ← REJECTED, quota bebas
            'owner_id' => null,
            'proposed_by_group_id' => 13,
            'proposed_supervisor_id' => $dosen['ahmad'],
            'period_id' => 1,
            'quota' => 1,
            'is_available' => false,
            'created_at' => $now->copy()->subDays(2),
            'updated_at' => $now,
        ]);

        // ════════════════════════════════════════════════════════════════════
        // PERIOD 2 — allow_solo = false
        // ════════════════════════════════════════════════════════════════════

        // ── GRUP J: READY_FOR_BIDDING, period 2 ─────────────────────────────
        DB::table('groups')->insert([
            'id' => 14,
            'name' => 'Grup Kappa',
            'period_id' => 2,
            'status' => 'READY_FOR_BIDDING',
            'is_solo' => false,
            'leader_id' => $u('jaka@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 14, 'user_id' => $u('jaka@ctms.com'),  'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 14, 'user_id' => $u('kiki@ctms.com'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 14, 'user_id' => $u('lina@ctms.com'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ── SOLO periode 2 (allow_solo=false) — harus diperlakukan seperti ghost
        // Skenario: is_solo=true tapi allow_solo=false → FORMING, tidak bisa propose
        DB::table('groups')->insert([
            'id' => 15,
            'name' => 'Solo — Miko (blocked)',
            'period_id' => 2,
            'status' => 'FORMING',   // ← FORMING karena allow_solo=false
            'is_solo' => true,
            'leader_id' => $u('miko@ctms.com'),
            'created_at' => $now, 'updated_at' => $now,
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 15, 'user_id' => $u('miko@ctms.com'), 'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ════════════════════════════════════════════════════════════════════
        // PERIOD 3 — Finalized (historical, PDC1_ACTIVE)
        // ════════════════════════════════════════════════════════════════════
        DB::table('groups')->insert([
            'id' => 16,
            'name' => 'Grup Lambda (Historical)',
            'period_id' => 3,
            'status' => 'PDC1_ACTIVE',
            'is_solo' => false,
            'leader_id' => User::where('email', 'omar@ctms.com')->value('id'),
            'created_at' => Carbon::now()->subMonths(5),
            'updated_at' => Carbon::now()->subMonths(5),
        ]);
        DB::table('group_members')->insert([
            ['group_id' => 16, 'user_id' => User::where('email', 'omar@ctms.com')->value('id'), 'role' => 'leader', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 16, 'user_id' => User::where('email', 'pita@ctms.com')->value('id'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
            ['group_id' => 16, 'user_id' => User::where('email', 'quin@ctms.com')->value('id'),  'role' => 'member', 'created_at' => $now, 'updated_at' => $now],
        ]);

        $this->command->info('✅ GroupSeeder done');
        $this->printSummary();
    }

    private function printSummary(): void
    {
        $this->command->info('');
        $this->command->info('════════════════════════════════════════════════════');
        $this->command->info('  RINGKASAN SKENARIO TEST');
        $this->command->info('════════════════════════════════════════════════════');
        $this->command->info('');
        $this->command->info('  PERIOD 1 — allow_solo=TRUE');
        $this->command->info('  ──────────────────────────────────────────────────');
        $this->command->info('  Grup A  (ID:1)  READY_FOR_BIDDING  — idle, belum bid/propose');
        $this->command->info('  Grup B  (ID:2)  READY_FOR_BIDDING  — 1 bid PENDING (sisa kuota 2)');
        $this->command->info('  Grup C  (ID:3)  READY_FOR_BIDDING  — 3 bid PENDING (kuota PENUH)');
        $this->command->info('  Grup D  (ID:4)  WAITING_SUPERVISOR — propose PENDING ke dosen');
        $this->command->info('  Grup E  (ID:5)  READY_FOR_BIDDING  — propose REJECTED, quota bebas');
        $this->command->info('  Grup F  (ID:6)  FORMING            — hanya 2 anggota (butuh 1 lagi)');
        $this->command->info('  Grup G  (ID:7)  KELOMPOK_FINAL     — bid ACCEPTED, tunggu admin');
        $this->command->info('  Grup H  (ID:8)  READY_FOR_BIDDING  — siap bid ke judul solo seeker C');
        $this->command->info('  Grup I  (ID:9)  KELOMPOK_FINAL     — bid P1 ACCEPT, P2 REJECT');
        $this->command->info('');
        $this->command->info('  Solo A  (ID:10) READY_FOR_BIDDING  — belum propose, siap');
        $this->command->info('  Solo B  (ID:11) WAITING_SUPERVISOR — propose PENDING');
        $this->command->info('  Solo C  (ID:12) TITLE_APPROVED     — judul di marketplace');
        $this->command->info('  Solo D  (ID:13) READY_FOR_BIDDING  — propose REJECTED, quota bebas');
        $this->command->info('');
        $this->command->info('  PERIOD 2 — allow_solo=FALSE');
        $this->command->info('  ──────────────────────────────────────────────────');
        $this->command->info('  Grup J  (ID:14) READY_FOR_BIDDING  — normal, bisa bid/propose');
        $this->command->info('  Solo Miko(ID:15) FORMING           — solo tapi allow_solo=false → ghost');
        $this->command->info('');
        $this->command->info('  PERIOD 3 — FINALIZED');
        $this->command->info('  ──────────────────────────────────────────────────');
        $this->command->info('  Grup L  (ID:16) PDC1_ACTIVE        — historical, sudah difinalisasi');
        $this->command->info('');
        $this->command->info('  GHOST (tidak punya grup):');
        $this->command->info('  Wawan, Xena, Yoga (period 1) | Nina (period 2)');
        $this->command->info('');
        $this->command->info('  CREDENTIALS: [email] / password');
        $this->command->info('  Admin   : admin@ctms.com / password');
        $this->command->info('  Dosen   : budi@ctms.com  / password  (dan 7 lainnya)');
        $this->command->info('  Leader  : andi@ctms.com  / password  (Grup A, period 1)');
        $this->command->info('════════════════════════════════════════════════════');
    }
}
