# SICATA (Sistem Capstone dan Tugas Akhir)

**SICATA** adalah sistem manajemen proyek akademik mahasiswa (Capstone Project / Tugas Akhir) yang mendukung seluruh siklus akademik – mulai dari pembentukan grup, penentuan judul (bidding/proposal), bimbingan, evaluasi seminar & sidang, hingga penutupan periode secara terintegrasi.

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

- **Bun** (v1.0+ direkomendasikan) - [bun.sh](https://bun.sh)
- **PHP 8.4** atau lebih tinggi
- **Composer**
- **PostgreSQL** (Neon DB atau lokal)

---

## 4. Setup Development Lokal

### 4.1 Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Konfigurasi koneksi database di `.env` (Neon DB atau PostgreSQL lokal), lalu jalankan migrasi:

```bash
php artisan migrate --seed
```

Jalankan server:

```bash
php artisan serve                   # http://localhost:8000
```

### 4.2 Frontend (Next.js)

```bash
cd frontend
bun install
```

Buat file `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Jalankan server:

```bash
bun run dev                         # http://localhost:3000
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

## 6. Deployment (cPanel)

Arsitektur deployment menggunakan dua subdomain terpisah:

```
sicata.ce.undip.ac.id        → Frontend (Next.js via Node.js)
api.sicata.ce.undip.ac.id    → Backend (Laravel API)
```

### 6.1 Backend Deployment

1. Upload seluruh isi folder `backend/` ke subdomain `api.sicata.ce.undip.ac.id`
2. Pastikan document root mengarah ke folder `public/`
3. Jalankan perintah berikut di terminal server:

```bash
# Install dependencies (production)
composer install --no-dev --optimize-autoloader

# Konfigurasi environment
cp .env.example .env
php artisan key:generate

# Edit .env dengan nilai production:
# APP_ENV=production
# APP_DEBUG=false
# APP_URL=https://api.sicata.ce.undip.ac.id
# SANCTUM_STATEFUL_DOMAINS=sicata.ce.undip.ac.id
# SESSION_DOMAIN=.sicata.ce.undip.ac.id
# SESSION_SECURE_COOKIE=true

# Jalankan migrasi
php artisan migrate --force

# Optimasi performance
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
chmod -R 755 storage bootstrap/cache
```

### 6.2 Frontend Deployment

1. Upload seluruh isi folder `frontend/` ke subdomain `sicata.ce.undip.ac.id`
2. Jalankan perintah berikut di terminal server:

```bash
# Install dependencies
bun install

# Build untuk production
bun run build

# Jalankan aplikasi (port 3000)
bun run start
```

3. Konfigurasi Node.js App di cPanel (jika tersedia):
   - Application root: `/sicata.ce.undip.ac.id`
   - Startup file: `node_modules/.bin/next`
   - Application URL: `sicata.ce.undip.ac.id`

4. Buat file `.env.local` di root frontend:

```env
NEXT_PUBLIC_API_URL=https://api.sicata.ce.undip.ac.id/api
NEXT_PUBLIC_APP_URL=https://sicata.ce.undip.ac.id
```

### 6.3 HTTPS & SSL

- Aktifkan SSL melalui cPanel > SSL/TLS Status
- Pastikan semua URL menggunakan `https://`
- CORS dan Sanctum sudah dikonfigurasi untuk domain production

---

## 7. Aktor & Alur Singkat

| Aktor | Aktivitas Utama |
|-------|----------------|
| **Mahasiswa** | Bentuk grup, bidding/propose judul, upload dokumen per fase, ikut seminar/sidang, lihat hasil evaluasi. |
| **Dosen** | Kelola judul, review bid & proposal, review dokumen bimbingan, evaluasi seminar/sidang, review TA draft. |
| **Admin** | Setup periode & dokumen dinamis, monitor readiness, kontrol bidding, finalisasi batch, scheduling, monitoring evaluasi. |

> Untuk detail alur end-to-end per role, lihat dokumentasi: **[USER_FLOW_BUSINESS_FLOW.md](USER_FLOW_BUSINESS_FLOW.md)**

---

## 8. Dokumentasi & Referensi

| Dokumen | Deskripsi |
|---------|-----------|
| **[USER_FLOW_BUSINESS_FLOW.md](USER_FLOW_BUSINESS_FLOW.md)** | Alur pengguna (user flow) dan alur bisnis per role |
| **[BACKEND_CODEBASE_SUMMARY.md](BACKEND_CODEBASE_SUMMARY.md)** | Ringkasan arsitektur backend, pola, dan konvensi |
| **[CTMS_Assessment_Flow_Documentation.txt](CTMS_Assessment_Flow_Documentation.txt)** | Dokumentasi flow assessment, scheduling, dan evaluasi |
| **[CAPSTONE3_FINAL_IMPLEMENTATION_GUIDE.md](CAPSTONE3_FINAL_IMPLEMENTATION_GUIDE.md)** | Panduan implementasi final & kebijakan non-negotiable |
| **[STATUS_MAPPING_TABLE.md](STATUS_MAPPING_TABLE.md)** | Mapping status grup & dokumen |
| **[GROUP_FLOWS_EXECUTIVE_SUMMARY.md](GROUP_FLOWS_EXECUTIVE_SUMMARY.md)** | Executive summary alur grup |

---

## 9. Contributing / Berkontribusi

Gunakan *standard Git workflow*: buat branch fitur, commit dengan jelas, buka Pull Request. Pastikan kode frontend sesuai standar Prettier/ESLint dan backend sesuai konvensi Laravel.

---

## 10. License & Attribution

Proyek ini dikembangkan sebagai capstone project dan sistem manajemen akademik untuk institusi pendidikan.
