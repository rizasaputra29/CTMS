# CTMS (Capstone / Tugas Akhir Management System)

**CTMS** adalah sistem manajemen proyek akademik mahasiswa (Capstone Project / Tugas Akhir) yang mendukung seluruh siklus akademik – mulai dari pembentukan grup, penentuan judul (bidding/proposal), bimbingan, evaluasi seminar & sidang, hingga penutupan periode secara terintegrasi.

Sistem ini dirancang untuk tiga aktor utama: **Admin**, **Dosen Pembimbing/Penguji**, dan **Mahasiswa**, dengan kontrol akses berbasis peran (*Role-Based Access Control*) dan alur kerja (*workflow*) yang tersistematis.

---

## 1. Fitur Utama

### 🎓 Manajemen Periode Akademik
- Manajemen periode Capstone/TA aktif, konfigurasi jadwal fase, batas anggota grup, dan kuota judul.
- Dokumen wajib dapat dikonfigurasi secara dinamis per periode dan per fase.
- Parameter fleksibel: pengaturan apakah semua mahasiswa wajib bergrup sebelum finalisasi.

### 👥 Pembentukan & Manajemen Grup
- Mahasiswa dapat membentuk grup normal, grup solo, menerima undangan, atau bergabung via Bursa Ide.
- Menejemen pembimbing (Dosbing 1 & Dosbing 2) melalui tabel *supervisions* sebagai sumber kebenaran tunggal.

### 📝 Bidding & Dua Jalur Penentuan Judul
- **Path A: Bidding Judul Dosen** – Mahasiswa memilih judul dari daftar topik dosen.
- **Path B: Propose Judul Sendiri** – Mahasiswa mengajukan judul karya ke dosen target.
- *Proposal aktif ditandai dengan flag `has_active_proposal` tanpa membekukan status grup*.

### 🏁 Finalisasi Batch (Admin)
- Finalisasi dilakukan per periode, bukan per grup.
- Validasi batch: anggota memenuhi syarat, judul valid, pembimbing lengkap, dan kuota terpenuhi.
- Jika satu grup gagal validasi, seluruh batch di-*rollback* secara atomik untuk menjaga integritas data.
- Tersedia mode simulasi (*dry-run*) dan auto-fix untuk kesiapan grup.

### 📄 Manajemen Dokumen & Progress Fase
- Dokumen wajib per fase dikelola secara dinamis sesuai konfigurasi admin.
- Alur progress fase: **PDC1 → SEMPRO → PDC2 → EXPO → TA Draft → Sidang TA Defense**.
- Status dokumen: `SUBMITTED`, `APPROVED`, `REJECTED` dengan feedback dari dosen.

### 📅 Penjadwalan & Evaluasi
- Admin menjadwalkan SEMPRO, EXPO, dan TA Defense.
- Validasi konflik: tumpang tindih jadwal dosen (examiner/supervisor) dan ruangan.
- *Auto-generate* baris evaluasi saat jadwal diterbitkan.
- Penilaian oleh examiner & supervisor dengan komponen penilaian yang dapat dikonfigurasi (bank soal).

### 🧮 Perhitungan Nilai
- Sistem otomatis menghitung nilai akhir berdasarkan bobot komponen per fase (PDC1, PDC2, TA).
- *Grade Consistency Check*: validasi rentang nilai otomatis.
- Peer review antar mahasiswa.

### 🔐 Keamanan & Tata Kelola
- Autentikasi *token-based* (Sanctum) dengan Role-Based Access Control (RBAC).
- State machine untuk mengatur transisi status grup secara ketat.
- Audit log untuk setiap operasi penting.
- Multi-role: pengguna dengan lebih dari satu peran dapat memilih dashboard aktif saat login.

---

## 2. Tech Stack

### Frontend
- **Next.js 16** (React 19)
- **Tailwind CSS v4**
- **Shadcn UI** & **Radix UI**
- **TypeScript**

### Backend
- **Laravel 12** (PHP 8.2+)
- **PostgreSQL**
- **Laravel Sanctum** (API Authentication)

### Pola Arsitektur
- API-first architecture
- Service Layer Pattern (business logic terpisah dari controller)
- State Machine Pattern (`GroupStateMachine`)
- Observer Pattern (auto-refresh readiness)
- Period-based Multi-Tenancy

---

## 3. Persiapan Awal

Sebelum menginstal, pastikan Anda memiliki:

- **Node.js** (v18+ direkomendasikan)
- **npm** atau **pnpm**
- **PHP 8.2** atau lebih tinggi
- **Composer**
- **PostgreSQL** atau **SQLite** (untuk dev cepat)

---

## 4. Setup Development Lokal

### 4.1 Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Konfigurasi koneksi database di `.env`, lalu jalankan migrasi:

```bash
touch database/database.sqlite      # jika pakai SQLite
php artisan migrate --seed
```

Jalankan server:

```bash
php artisan serve                   # http://localhost:8000
```

### 4.2 Frontend (Next.js)

```bash
cd frontend
npm install                         # atau pnpm install
```

Buat file `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Jalankan server:

```bash
npm run dev                         # http://localhost:3000
```

---

## 5. Artisan Commands

Beberapa *custom artisan commands* yang tersedia di backend:

```bash
# Refresh readiness snapshot grup
php artisan group:refresh-readiness
php artisan group:refresh-readiness --period=2024-SP-01
php artisan group:refresh-readiness --only-invalid
php artisan group:refresh-readiness --verify          # dry-run

# Import data mahasiswa capstone
php artisan import:capstone-students <file>

# Pembersihan data residu
php artisan cleanup:import-residue
```

---

## 6. Aktor & Alur Singkat

| Aktor | Aktivitas Utama |
|-------|----------------|
| **Mahasiswa** | Bentuk grup, bidding/propose judul, upload dokumen per fase, ikut seminar/sidang, lihat hasil evaluasi. |
| **Dosen** | Kelola judul, review bid & proposal, review dokumen bimbingan, evaluasi seminar/sidang, review TA draft. |
| **Admin** | Setup periode & dokumen dinamis, monitor readiness, kontrol bidding, finalisasi batch, scheduling, monitoring evaluasi. |

> Untuk detail alur end-to-end per role, lihat dokumentasi: **[USER_FLOW_BUSINESS_FLOW.md](USER_FLOW_BUSINESS_FLOW.md)**

---

## 7. Dokumentasi & Referensi

| Dokumen | Deskripsi |
|---------|-----------|
| **[USER_FLOW_BUSINESS_FLOW.md](USER_FLOW_BUSINESS_FLOW.md)** | Alur pengguna (user flow) dan alur bisnis per role |
| **[BACKEND_CODEBASE_SUMMARY.md](BACKEND_CODEBASE_SUMMARY.md)** | Ringkasan arsitektur backend, pola, dan konvensi |
| **[CTMS_Assessment_Flow_Documentation.txt](CTMS_Assessment_Flow_Documentation.txt)** | Dokumentasi flow assessment, scheduling, dan evaluasi |
| **[CAPSTONE3_FINAL_IMPLEMENTATION_GUIDE.md](CAPSTONE3_FINAL_IMPLEMENTATION_GUIDE.md)** | Panduan implementasi final & kebijakan non-negotiable |
| **[STATUS_MAPPING_TABLE.md](STATUS_MAPPING_TABLE.md)** | Mapping status grup & dokumen |
| **[GROUP_FLOWS_EXECUTIVE_SUMMARY.md](GROUP_FLOWS_EXECUTIVE_SUMMARY.md)** | Executive summary alur grup |

---

## 8. Contributing / Berkontribusi

Gunakan *standard Git workflow*: buat branch fitur, commit dengan jelas, buka Pull Request. Pastikan kode frontend sesuai standar Prettier/ESLint dan backend sesuai konvensi Laravel.

---

## 9. License & Attribution

Proyek ini dikembangkan sebagai capstone project dan sistem manajemen akademik untuk institusi pendidikan.
