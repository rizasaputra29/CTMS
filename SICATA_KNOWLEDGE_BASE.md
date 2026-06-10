# SICATA — Sistem Informasi Capstone & Tugas Akhir

Knowledge base / blueprint sistem untuk mendukung penulisan dokumen perencanaan dan perancangan sistem.

---

## 1. Identitas Sistem

| Item | Detail |
|------|--------|
| **Nama** | SICATA (Sistem Informasi Capstone & Tugas Akhir) |
| **Tujuan** | Mengelola siklus akademik Capstone/Tugas Akhir secara terintegrasi: pembentukan grup, penentuan judul, bimbingan, evaluasi seminar & sidang, hingga penutupan periode |
| **Aktor** | Admin, Dosen (pembimbing/penguji), Mahasiswa |
| **Fase Akademik** | PDC1 → SEMPRO → PDC2 → EXPO → TA Draft → Sidang TA Defense |

---

## 2. Tech Stack

| Layer | Teknologi | Versi | Keterangan |
|-------|-----------|-------|------------|
| **Frontend** | Next.js | 16.1.6 | App Router, React 19, TypeScript strict |
| | Tailwind CSS | v4 | Utility-first styling |
| | Shadcn UI / Radix UI | latest | Komponen UI aksesibel |
| | Framer Motion | 12.34.1 | Animasi |
| | React Hook Form + Zod | 7.75 / 4.4 | Form & validasi |
| | TanStack React Table | 8.21.3 | Data tables interaktif |
| | Recharts | 3.7 | Grafik dan chart |
| | Axios | 1.13.5 | HTTP client |
| **Backend** | Laravel | 12.x | PHP framework |
| | PHP | ^8.2 | - |
| | Laravel Sanctum | ^4.3 | Token-based API auth |
| **Database** | PostgreSQL | - | Production (AWS Neon) |
| | SQLite | - | Development fallback |
| | Redis | - | Cache & queue (opsional) |
| **Infra** | Vite | ^7.0.7 | Build tool Laravel |
| | Queue | Database-driven | Laravel queue jobs |

---

## 3. Arsitektur

### 3.1 Pola Arsitektur

1. **API-first Architecture** — Frontend Next.js SPA terpisah total dari backend Laravel API. Komunikasi via REST JSON over HTTP.
2. **Service Layer Pattern** — Business logic dipisahkan dari Controller ke Service classes (`app/Services/`). Controller hanya bertugas sebagai orchestrator.
3. **State Machine Pattern** — `GroupStateMachine` mengatur transisi status grup secara ketat dengan daftar transisi valid (14 status grup).
4. **Observer Pattern** — `GroupObserver`, `GroupMemberObserver`, `BidObserver` untuk menjalankan side effects (auto-refresh readiness) saat data berubah.
5. **Period-based Multi-Tenancy** — Seluruh data di-scope berdasarkan `period_id`. Setiap periode akademik adalah silo data terpisah.

### 3.2 Diagram Alur Data

```
Browser (Next.js SPA)
    ↓ Axios HTTP (JSON + Bearer Token)
Laravel API (Sanctum)
    ↓
Middleware (auth:sanctum, role middleware)
    ↓
Controller
    ↓
Service (business logic)
    ↓
Repository / Eloquent Model
    ↓
PostgreSQL Database
```

### 3.3 Pembagian Frontend-Backend

| Aspek | Frontend (Next.js) | Backend (Laravel) |
|-------|-------------------|-------------------|
| Port | `:3000` | `:8000` |
| Auth | Token disimpan di localStorage, dikirim via Axios interceptor | Sanctum token-based auth |
| Routing | App Router (file-based) | REST API (`/api/...`) |
| State | React Context + hooks | Session (active_role) |
| Validation | Zod schemas (client-side) | Form Request (server-side) |

---

## 4. Entity & Database

### 4.1 Ringkasan

- **49 model** Eloquent
- **137 file migrasi** database
- **14 seeder** untuk data awal

### 4.2 Entitas Utama

| Entity | Tabel | Fields Kunci | Relasi |
|--------|-------|-------------|--------|
| **User** | `users` | name, email, password, nip, nim, is_active | many-to-many → Role |
| **Role** | `roles` | name, slug | many-to-many ← User |
| **Period** | `periods` | name, start_date, end_date, phase_dates (JSON), bidding_window, grade_configuration (JSON), min_group_size, max_group_size, allow_solo, is_active, is_finalized | hasMany → Group, PeriodRegistration |
| **Group** | `groups` | code, period_id, status, title_id, supervisor_1_id, supervisor_2_id, group_mode, is_solo, has_active_proposal, readiness_status | belongsTo → Period, hasMany → GroupMember |
| **GroupMember** | `group_members` | group_id, student_id, is_leader, period_id | belongsTo → Group, User |
| **Title** | `titles` | title, description, quota, supervisor_id, title_source (DOSEN/STUDENT), supervisor_approval_status, proposed_by_group_id | belongsTo → User (supervisor) |
| **Bid** | `bids` | group_id, title_id, priority, status, lecturer_recommendation, proposed_supervisor_1_id, proposed_supervisor_2_id | belongsTo → Group, Title |
| **Supervision** | `supervisions` | group_id, supervisor_id, role (DOSBING_1/2), assigned_by | *Source of truth* pembimbingan |
| **Schedule** | `seminar_schedules`, `expo_events`, `ta_defense_schedules` | group_id, date, time, room, examiners (JSON), location_id | Per jenis jadwal |
| **Document** | `documents` | group_id, document_type, file_path, status (SUBMITTED/APPROVED/REJECTED), feedback | belongsTo → Group |
| **PeriodRegistration** | `period_registrations` | period_id, user_id | many-to-many User ↔ Period |
| **Notification** | `notifications` | user_id, type, message, is_read | belongsTo → User |
| **AssessmentComponent** | `assessment_components` | name, description, max_score | Digunakan di evaluasi |
| **AssessmentComponentTemplate** | `assessment_component_templates` | name, description | Bank soal komponen penilaian |
| **GradeConfiguration** | (via Period JSON) | Bobot komponen per fase (PDC1/PDC2/TA) | - |
| **PeerReview** | `peer_reviews` | reviewer_id, reviewee_id, group_id, scores | antar mahasiswa |
| **DigitalSignature** | `digital_signatures` | user_id, document_id, signature_data | Tanda tangan digital |

### 4.3 Relasi Kunci

- **User** (M:N) **Role** — Multi-role: satu user bisa jadi admin + dosen
- **Period** (1:N) **Group** — Satu periode punya banyak grup
- **Group** (1:N) **GroupMember** — Satu grup punya banyak anggota (leader + members)
- **Group** (1:1) **Title** — Satu grup memiliki satu judul (setelah finalisasi)
- **Title** (1:N) **Bid** — Satu judul bisa dibid oleh banyak grup
- **Group** (M:N) **User** via **Supervision** — Pembimbing ditetapkan di tabel supervisions

---

## 5. State Machine Grup

### 5.1 Status dan Transisi

```
FORMING ──────────────► READY_FOR_BIDDING ──────────────► READY_FOR_FINALIZATION ──► KELOMPOK_FINAL
    │                         │                                  │
    ├► WAITING_SUPERVISOR_    ├► WAITING_SUPERVISOR_              ├► TITLE_APPROVED_
    │   APPROVAL (proposal)   │   APPROVAL (proposal)             │   (solo revert)
    │                         ├► TITLE_APPROVED (bid accepted)    ├► READY_FOR_BIDDING (revert)
    ├► DISSOLVED              ├► READY_FOR_FINALIZATION           └► DISSOLVED
    │                         └► DISSOLVED
    │
FORMING_SOLO ──────────► TITLE_APPROVED ──────────────► READY_FOR_FINALIZATION ──► KELOMPOK_FINAL
    │                         │                                  │
    ├► WAITING_SUPERVISOR_    ├► READY_FOR_FINALIZATION           └► DISSOLVED
    │   APPROVAL              └► DISSOLVED
    └► DISSOLVED

KELOMPOK_FINAL ──► PDC1_ACTIVE ──► READY_FOR_SEMPRO ──► SEMPRO_DONE ──► PDC2_ACTIVE
                                                                              │
                                     ┌───────────────────────────────────────┘
                                     ▼
                              PDC2_READY_FOR_EXPO ──► EXPO_REGISTERED ──► EXPO_DONE
                                                                              │
                                                                              ▼
                                                                      READY_FOR_TA_INDIVIDUAL ──► CLOSED

Transisi khusus:
  - SEMPRO_DONE ◄── PDC1_ACTIVE (retry jika gagal SEMPRO)
  - PDC2_ACTIVE ◄── EXPO_REGISTERED (retry jika gagal EXPO)
  - DISSOLVED: dapat dicapai dari FORMING, READY_FOR_BIDDING, READY_FOR_FINALIZATION
  - CLOSED & DISSOLVED: terminal states (tidak ada transisi keluar)
```

### 5.2 Catatan Transisi

- Status grup ditentukan oleh `determineStatus()` berdasarkan jumlah anggota (FORMING vs READY_FOR_BIDDING)
- `GroupStateMachine::TRANSITIONS` mendefinisikan transisi valid untuk *intentional actions*, bukan rekalkulasi otomatis
- Leader manual menandai `READY_FOR_FINALIZATION`
- Admin menjalankan finalisasi batch untuk transisi ke `KELOMPOK_FINAL`
- Setelah `KELOMPOK_FINAL`, grup tidak bisa kembali ke status sebelumnya (irreversible)

---

## 6. Fitur per Modul

### 6.1 Manajemen Periode Akademik
- CRUD periode (nama, tanggal, konfigurasi fase)
- Config dokumen wajib per fase per periode
- Parameter grup: min/max size, allow_solo, require_all_students_grouped
- Soft delete

### 6.2 Pembentukan & Manajemen Grup
- Tiga jalur: Grup Normal, Solo Seeker, Join via Undangan/Bursa Ide
- Invite/accept/reject/remove/leave anggota
- Leader-only actions: add/remove member, submit bid, submit proposal
- Group code generation
- Bursa Ide: open recruitment + request join

### 6.3 Penentuan Judul (Dual Path)
- **Path A (Bidding):** Mahasiswa bid judul dosen dengan prioritas dan calon pembimbing
- **Path B (Propose):** Mahasiswa ajukan judul sendiri ke dosen target
- Dosen review: ACCEPT/REJECT (bid), APPROVED/UNDER_REVIEW/REJECTED (proposal)
- Flag `has_active_proposal` tanpa mengubah status grup
- Solo Title Bidding: grup solo bisa terima bid dari grup lain

### 6.4 Finalisasi Batch
- Level periode, bukan per grup (all-or-nothing)
- Validasi batch: anggota cukup, judul valid, pembimbing lengkap, kuota terpenuhi
- **Atomic commit/rollback:** 1 grup gagal → seluruh batch gagal
- Dry-run simulation + auto-fix readiness
- Lock/unlock periode, force-ready
- Auto-matchmaker service

### 6.5 Manajemen Dokumen & Fase
- 6 fase: PDC1 → SEMPRO → PDC2 → EXPO → TA Draft → Sidang TA
- Dokumen requirement dinamis per periode + fase + tipe dokumen
- Status: SUBMITTED → APPROVED / REJECTED (dengan feedback)
- Unlock fase beranting (prerequisite)

### 6.6 Penjadwalan & Evaluasi
- Admin jadwalkan SEMPRO, EXPO, TA Defense
- **Conflict detection:** jadwal dosen (examiner/supervisor) dan ruangan tumpang tindih
- **Auto-generate** baris evaluasi saat jadwal diterbitkan
- Evaluasi oleh examiner & supervisor dengan Assessment Component dari bank soal
- Jenis evaluasi: BIMBINGAN_SEMPRO, BIMBINGAN_EXPO, MILESTONE, BIMBINGAN_TA

### 6.7 Perhitungan Nilai
- Grade Configuration per periode (bobot komponen PDC1/PDC2/TA)
- Grade Consistency Check: validasi rentang nilai otomatis
- Peer Review antar mahasiswa (indikator dari bank soal)
- Final grade recalculation

### 6.8 TA Submission & Sidang
- Upload TA draft → review dosen (APPROVE/REVISE)
- Registrasi sidang TA → penjadwalan TA Defense (individual per mahasiswa)
- Mark TA_DEFENDED → CLOSED (setelah semua anggota defended)

### 6.9 Notifikasi & Audit
- Notification system (unread count, mark as read)
- Audit Log: setiap operasi penting tercatat
- Title Approval Audit + Title Deletion Audit
- Finalization Audit

### 6.10 Digital Signature
- Sign & verify dokumen dengan tanda tangan digital

### 6.11 Laporan & Ekspor
- Report: summary, detail assessments, peer reviews, final grades, grade consistency
- Export laporan (format tabel/detail)

---

## 7. API Endpoints

### 7.1 Ringkasan

**Total: ~150+ endpoint REST**, dibagi:

| Prefix | Jumlah | Rate Limit |
|--------|--------|-----------|
| Public (`/api/login`) | 1 | 5/min |
| Shared (`/api/user/*`, `/api/profile`) | ~5 | 60/min |
| Admin (`/api/admin/*`) | ~60 | 60/min |
| Dosen (`/api/dosen/*`) | ~40 | 60/min |
| Mahasiswa (`/api/mahasiswa/*`) | ~50 | 60/min |

### 7.2 Autentikasi (Public)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/login` | Login (rate limited: 5/min) |
| POST | `/api/logout` | Logout (auth:sanctum) |

### 7.3 Shared (Semua Role)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/user` | Profil user + roles |
| GET | `/api/user/roles` | Daftar roles user |
| POST | `/api/user/active-role` | Set role aktif (session) |
| GET | `/api/user/current-role` | Role aktif saat ini |
| PUT | `/api/profile` | Update profil |

### 7.4 Admin (`/api/admin/*`)

| Area | Method | Endpoint | Deskripsi |
|------|--------|----------|-----------|
| Dashboard | GET | `/dashboard` | Ringkasan sistem |
| Periods | GET/POST | `/periods` | CRUD periode |
| | GET/PUT/DELETE | `/periods/{id}` | Detail/update/hapus periode |
| Users | GET/POST | `/users` | CRUD user |
| | GET/PUT/DELETE | `/users/{id}` | Detail/update/hapus user |
| Groups | GET | `/groups` | Daftar grup |
| | GET | `/groups/{id}` | Detail grup |
| Finalisasi | POST | `/finalization/finalize-period/{id}` | Finalisasi batch atomic |
| | GET | `/finalization/simulate/{id}` | Dry-run finalisasi |
| | POST | `/finalization/auto-fix/{id}` | Auto-fix readiness |
| | POST | `/finalization/lock/{id}` | Lock periode |
| | POST | `/finalization/unlock/{id}` | Unlock periode |
| | POST | `/finalization/set-supervisor` | Set pembimbing |
| | POST | `/finalization/batch-set-supervisor` | Batch set pembimbing |
| Penjadwalan | POST | `/sempro/schedule` | Jadwalkan SEMPRO |
| | GET/POST | `/expo-events` | CRUD event EXPO |
| | GET/POST | `/ta-defense-schedules` | CRUD jadwal sidang TA |
| Penilaian | GET/POST | `/assessment-templates` | CRUD bank soal komponen |
| | GET/POST | `/assessment-components` | CRUD komponen penilaian |
| | GET | `/periods/{id}/assessment-config` | Konfigurasi per periode |
| Dokumen | GET/POST | `/document-types` | CRUD tipe dokumen |
| | GET/POST | `/document-requirements` | CRUD requirement dokumen |
| Grade | GET/POST | `/grade-configuration/{id}` | Konfigurasi bobot nilai |
| | GET | `/grade-consistency` | Cek konsistensi nilai |
| | POST | `/grade-consistency/recheck` | Recheck grade consistency |
| Laporan | GET | `/reports/summary` | Laporan ringkasan |
| | GET | `/reports/assessments` | Detail penilaian |
| | GET | `/reports/peer-reviews` | Peer review report |
| | GET | `/reports/final-grades` | Nilai akhir |
| | GET | `/reports/{type}/export` | Export laporan |
| Peer Review | GET/POST | `/peer-review-indicator-templates` | CRUD bank peer review |

### 7.5 Dosen (`/api/dosen/*`)

| Area | Method | Endpoint | Deskripsi |
|------|--------|----------|-----------|
| Dashboard | GET | `/dashboard` | Dashboard dosen |
| Judul | GET/POST | `/titles` | CRUD judul |
| | PUT/DELETE | `/titles/{id}` | Update/hapus judul |
| | POST | `/titles/{id}/withdraw-approval` | Tarik approval judul |
| Bidding | GET | `/bids` | Daftar bid masuk |
| | PUT | `/bids/{id}/recommend` | Review bid (ACCEPT/REJECT) |
| Proposal | GET/PUT | `/title-approvals/{id}/approve` | Review proposal mahasiswa |
| Dokumen | GET | `/documents` | Dokumen grup bimbingan |
| | PUT | `/documents/{id}` | Review dokumen (APPROVE/REJECT) |
| Evaluasi | POST | `/sempro/{id}/evaluate` | Nilai SEMPRO |
| | POST | `/expo/{id}/evaluate` | Nilai EXPO |
| | POST | `/ta-defense/{id}/evaluate` | Nilai sidang TA |
| Supervisor Eval | GET | `/supervisor-evaluation/groups` | Grup bimbingan |
| | POST | `/supervisor-evaluation` | Evaluasi bimbingan |
| TA Review | PUT | `/ta/{id}/review` | Review TA draft (APPROVE/REVISE) |
| | PUT | `/ta/{id}/defended` | Mark TA defended |

### 7.6 Mahasiswa (`/api/mahasiswa/*`)

| Area | Method | Endpoint | Deskripsi |
|------|--------|----------|-----------|
| Dashboard | GET | `/dashboard` | Dashboard mahasiswa |
| | GET | `/dashboard/workflow` | Workflow status |
| Grup | GET/POST | `/group` | Buat/lihat grup |
| | POST | `/group/store-solo` | Buat grup solo |
| | DELETE | `/group` | Hapus grup |
| | POST | `/group/add-member` | Tambah anggota |
| | POST | `/group-invitations/{id}/accept` | Terima undangan |
| | POST | `/group-invitations/{id}/reject` | Tolak undangan |
| Bidding | GET/POST | `/bids` | Daftar/buat bid |
| | PUT | `/bids/reorder` | Urutkan prioritas bid |
| | DELETE | `/bids/{id}` | Hapus bid |
| Proposal | POST | `/propose-title` | Ajukan judul |
| | GET | `/my-proposal` | Lihat proposal |
| | PUT | `/my-proposal` | Update proposal |
| Dokumen | GET/POST | `/documents` | Upload/lihat dokumen |
| Bursa Ide | GET | `/bursa-ide` | Daftar bursa ide |
| | POST | `/bursa-ide/{id}/request-join` | Request join |
| Solo | GET | `/solo-titles` | Judul solo tersedia |
| | POST | `/solo-titles/{id}/bid` | Bid judul solo |
| Peer Review | GET/POST | `/peer-review` | Peer review |
| | GET | `/peer-review/status` | Status peer review |
| TA | GET | `/ta-status` | Status TA |
| | POST | `/ta-submission` | Submit TA |
| | POST | `/ta-submission/upload` | Upload file TA |
| Jadwal | GET | `/seminar-schedules` | Jadwal SEMPRO |
| | GET | `/ta-defense-schedules/my-schedule` | Jadwal sidang |
| EXPO | GET | `/expo-events` | Event EXPO |
| | POST | `/expo-events/{id}/register` | Daftar EXPO |
| Nilai | GET | `/my-grades` | Nilai sendiri |

---

## 8. Alur Bisnis End-to-End

### 8.1 Fase 0: Setup Awal (Admin)
1. Buat periode akademik → set tanggal & konfigurasi fase
2. Konfigurasi dokumen wajib per fase (`PhaseDocumentRequirement`)
3. Aktifkan komponen penilaian (`AssessmentComponent`) untuk periode
4. Set bobot grade (`GradeConfiguration`)

### 8.2 Fase 1: Pembentukan Grup (Mahasiswa)
1. Login → pilih periode → pilih role Mahasiswa
2. Pilih jalur:
   - **Grup Normal:** Buat grup → undang anggota → anggota mencapai min → status → `READY_FOR_BIDDING`
   - **Solo Seeker:** Buat grup solo → status `FORMING_SOLO`
   - **Bursa Ide:** Cari grup → request join → leader accept → status grup berubah
3. Setiap perubahan anggota memicu `GroupMemberObserver` → `RefreshGroupReadiness`

### 8.3 Fase 2: Penentuan Judul (Mahasiswa + Dosen)
- **Path A (Bidding):**
  1. Mahasiswa daftar judul dosen via bidding (prioritas 1, 2, 3)
  2. Dosen review bid: ACCEPT / REJECT
  3. Bid accepted → status → `READY_FOR_FINALIZATION`
- **Path B (Propose):**
  1. Mahasiswa ajukan judul ke dosen target
  2. Dosen review: APPROVED / UNDER_REVIEW / REJECTED
  3. Approved & has_active_proposal flag aktif

### 8.4 Fase 3: Finalisasi Batch (Admin)
1. Admin jalankan **simulasi finalisasi** (dry-run) untuk validasi semua grup
2. Auto-fix grup yang belum siap (opsional)
3. **Eksekusi finalisasi batch:**
   - Validasi: anggota cukup, judul approved, pembimbing ditetapkan, kuota tidak over
   - **Atomic:** semua grup berhasil → commit. 1 gagal → rollback semua
   - Allocation + Assignment: judul final, dosbing 1 & 2 via `Supervision`
4. Status grup → `KELOMPOK_FINAL` → `PDC1_ACTIVE`

### 8.5 Fase 4: PDC1 + SEMPRO
1. Upload dokumen PDC1 → dosen review → APPROVED
2. Semua dokumen PDC1 approved → status `READY_FOR_SEMPRO`
3. Admin jadwalkan SEMPRO (validasi konflik dosen + ruang)
4. Auto-generate baris evaluasi SEMPRO
5. Mahasiswa ikut SEMPRO → examiner beri nilai
6. PASS → `SEMPRO_DONE` → `PDC2_ACTIVE`
7. FAIL → `PDC1_ACTIVE` (retry)

### 8.6 Fase 5: PDC2 + EXPO
1. Upload dokumen PDC2 → dosen review
2. Admin jadwalkan EXPO event
3. Grup daftar EXPO → `EXPO_REGISTERED`
4. Ikut EXPO → examiner nilai → PASS → `EXPO_DONE`
5. Supervisor evaluasi BIMBINGAN_EXPO + MILESTONE

### 8.7 Fase 6: TA Defense
1. Upload TA Draft → dosen review (APPROVE / REVISE)
2. APPROVED → status TA_READY → mahasiswa daftar sidang
3. Admin jadwalkan TA Defense (individu per mahasiswa)
4. Ikut sidang → examiner evaluasi
5. PASS → `TA_DEFENDED`, FAIL → `TA_REVISED` (retry)

### 8.8 Fase 7: Penutupan
1. Semua anggota grup sudah TA_DEFENDED → grup `CLOSED`
2. Final grade recalculation
3. Admin dapat close periode

---

## 9. Struktur Frontend

### 9.1 Routing (Next.js App Router)

```
src/app/
├── page.tsx                    # Landing / redirect
├── layout.tsx                  # Root layout
├── login/                      # Halaman login
│   ├── page.tsx
│   └── loading.tsx
├── profile/                    # Profil user
│   └── page.tsx
├── notifications/              # Notifikasi
│   └── page.tsx
├── admin/                      # Dashboard Admin (24 sub-routes)
│   ├── page.tsx                # Dashboard
│   ├── periods/                # CRUD periode
│   ├── users/                  # CRUD user
│   ├── groups/                 # Monitoring grup
│   ├── finalization/           # Finalisasi batch
│   ├── titles/                 # Kelola judul
│   ├── bidding/                # Monitoring bidding
│   ├── documents/              # Dokumen requirement
│   ├── schedules/              # Penjadwalan
│   ├── sempro/                 # SEMPRO
│   ├── expo/                   # EXPO
│   ├── ta-defense/             # TA Defense
│   ├── assessment/             # Bank soal komponen
│   ├── peer-review/            # Peer review config
│   ├── grades/                 # Nilai & grade
│   ├── reports/                # Laporan
│   └── settings/               # Pengaturan
├── dosen/                      # Dashboard Dosen (13 sub-routes)
│   ├── page.tsx                # Dashboard
│   ├── titles/                 # Kelola judul
│   ├── bids/                   # Review bidding
│   ├── proposals/              # Review proposal
│   ├── documents/              # Review dokumen
│   ├── evaluations/            # Evaluasi
│   ├── ta-review/              # Review TA
│   └── groups/                 # Grup bimbingan
└── mahasiswa/                  # Dashboard Mahasiswa (15 sub-routes)
    ├── page.tsx                # Dashboard
    ├── group/                  # Manajemen grup
    ├── bidding/                # Bidding judul
    ├── proposals/              # Proposal judul
    ├── documents/              # Upload dokumen
    ├── bursa-ide/              # Bursa ide
    ├── peer-review/            # Peer review
    ├── ta-submission/          # TA submission
    ├── schedules/              # Jadwal
    ├── grades/                 # Nilai
    └── expo/                   # EXPO
```

### 9.2 Komponen UI Utama

- **Layout:** DashboardLayout, Sidebar, Navbar (3 varian per role)
- **Data Display:** DataTable (TanStack), Cards, StatCards
- **Forms:** Form + React Hook Form + Zod validation controller
- **Modals:** Dialog (Shadcn/Radix), AlertDialog
- **Feedback:** Toast (Sonner), Loading spinner, Empty state
- **Charts:** Recharts (bar, line, pie)
- **Auth:** LoginForm, ProtectedRoute, RoleGuard

### 9.3 State Management

| State | Mekanisme | Lokasi |
|-------|-----------|--------|
| Auth (token, user) | React Context | `src/context/AuthContext.tsx` |
| Active period | React Context | `src/context/PeriodSelectionContext.tsx` |
| Form state | React Hook Form | Per komponen |
| Server cache | TanStack Query (implisit via hooks) | Per halaman |
| UI state | Local useState | Per komponen |

### 9.4 Library & Dependensi Frontend Penting

| Library | Fungsi |
|---------|--------|
| `axios` | HTTP client dengan interceptor token |
| `react-hook-form` | Form management |
| `zod` | Validasi skema (client & server) |
| `@hookform/resolvers` | Bridge RHF ↔ Zod |
| `@tanstack/react-table` | Data table sorting/filtering/pagination |
| `framer-motion` | Animasi transisi |
| `recharts` | Chart & grafik |
| `lucide-react` | Icon set |
| `date-fns` | Manipulasi tanggal |
| `sonner` | Toast notification |
| `react-day-picker` | Date picker |

---

## 10. Keamanan & Audit

### 10.1 Autentikasi
- **Laravel Sanctum** — token-based API authentication
- Token dikirim via Bearer header, di-side oleh Axios interceptor di frontend
- Rate limiting: 5 req/min untuk login, 60 req/min untuk API umum, 10 req/min untuk upload

### 10.2 Otorisasi (RBAC)
- Role: `admin`, `dosen`, `mahasiswa` (disimpan di tabel `roles`, relasi M:N dengan `users`)
- User bisa memiliki multiple roles; saat login pilih active_role yang disimpan di session
- Middleware per role memfilter akses ke route group:
  ```php
  Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin')->group(...)
  Route::middleware(['auth:sanctum', 'role:dosen'])->prefix('dosen')->group(...)
  Route::middleware(['auth:sanctum', 'role:mahasiswa'])->prefix('mahasiswa')->group(...)
  ```

### 10.3 Audit Trail
| Mekanisme | Deskripsi |
|-----------|-----------|
| `AuditLog` | Catat operasi penting (siapa, apa, kapan, data sebelum/sesudah) |
| `TitleApprovalAudit` | Riwayat approval judul |
| `TitleDeletionAudit` | Riwayat penghapusan judul |
| `FinalizationAudit` | Riwayat finalisasi batch |
| Observers | Log otomatis saat grup/anggota/bid berubah |

### 10.4 Validasi & Integritas Data

| Mekanisme | Detail |
|-----------|--------|
| **State Machine** | Grup hanya bisa transisi ke status yang valid (defined in `GroupStateMachine::TRANSITIONS`) |
| **Atomic Batch** | Finalisasi commit/rollback — partial failure tidak diperbolehkan |
| **Grade Consistency Check** | Validasi otomatis rentang nilai tidak keluar batas |
| **Conflict Detection** | Validasi tumpang tindih jadwal dosen & ruangan |
| **Soft Delete** | Periode bisa dihapus (soft) tanpa kehilangan data referensial |

### 10.5 Digital Signature
- Tanda tangan digital untuk dokumen (sign & verify)
- Terpisah dari auth — berfungsi sebagai verifikasi integritas dokumen

---

## 11. Catatan Implementasi

### 11.1 Migration & Seeding
- 137 file migrasi (incremental, versioned)
- 14 seeder: roles, users (default admin), periods, document types, assessment component templates, peer review indicator templates
- Factory: GroupFactory, UserFactory untuk testing

### 11.2 Queue Jobs
| Job | Trigger | Fungsi |
|-----|---------|--------|
| `RecalculateGroupStatus` | Perubahan status grup | Update status dan readiness |
| `RefreshGroupReadiness` | Perubahan anggota/bid | Refresh readiness snapshot |
| `RefreshGroupReadinessBatch` | Operasi batch | Refresh massal |

### 11.3 Custom Artisan Commands
| Command | Fungsi |
|---------|--------|
| `group:refresh-readiness` | Refresh readiness manual (per periode / only-invalid / verify) |
| `import:capstone-students <file>` | Import data mahasiswa dari CSV |
| `cleanup:import-residue` | Bersihkan data residu hasil import |

### 11.4 Testing
| Jenis | Alat | Cakupan |
|-------|------|---------|
| Backend unit test | PHPUnit | Service, Controller, Model |
| E2E frontend | Playwright | Alur pengguna end-to-end |
| UAT | 54 test cases | Terdokumentasi di `QA_UAT_TEST_MATRIX.csv` |

---

## 12. Glossary

| Istilah | Definisi |
|---------|----------|
| **PDC** | Progress Document Check (pemeriksaan dokumen progres) |
| **SEMPRO** | Seminar Proposal |
| **EXPO** | Pameran/Presentasi hasil TA |
| **TA** | Tugas Akhir |
| **Dosbing** | Dosen Pembimbing (1 & 2) |
| **Bidding** | Proses pemilihan judul oleh mahasiswa |
| **Finalisasi Batch** | Proses atomic finalisasi semua grup dalam satu periode |
| **State Machine** | Mesin status yang mengatur transisi grup secara ketat |
| **Bursa Ide** | Forum pertukaran ide/recruitment anggota grup |
| **Grade Configuration** | Konfigurasi bobot penilaian per fase |
| **Assessment Component** | Komponen/indikator penilaian (CPMK/CPL) |
| **Peer Review** | Penilaian antar mahasiswa dalam satu grup |
| **Sanctum** | Laravel package untuk token-based API auth |

---

*Dokumen ini adalah knowledge base / blueprint sistem SICATA (berdasarkan implementasi CTMS). Data diambil dari kodebase dan dapat digunakan sebagai Source of Truth (SOT) untuk penulisan dokumen perencanaan dan perancangan sistem.*
