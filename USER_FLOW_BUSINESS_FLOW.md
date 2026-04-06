# CTMS End-to-End User Flow dan Business Flow

## 1. Tujuan
Dokumen ini merangkum alur end-to-end CTMS dari sudut pandang:
- User Flow: pengalaman pengguna per role (Mahasiswa, Dosen, Admin).
- Business Flow: aturan bisnis, validasi, state transition, dan keputusan sistem.

## 2. Aktor Utama
- Mahasiswa: membentuk grup, bidding/propose judul, unggah dokumen, daftar seminar/sidang.
- Dosen: mengelola judul, memberi rekomendasi bid, review dokumen, evaluasi seminar/sidang.
- Admin: kelola periode, lock/unlock bidding, finalisasi, scheduling, monitoring akhir periode.

## 3. End-to-End User Flow (Ringkas)

### 3.1 Mahasiswa
1. Login ke sistem.
2. Cek periode aktif (dan belum finalized).
3. Pilih jalur grup:
   - Buat grup normal.
   - Buat grup solo seeker.
   - Terima undangan atau gabung via Bursa Ide.
4. Leader menyiapkan strategi judul:
   - Bid judul dosen, atau
   - Propose judul sendiri ke dosen pembimbing.
5. Menunggu keputusan dosen:
   - Bid diberi rekomendasi ACCEPT/REJECT.
   - Proposal judul APPROVED/PRE_APPROVED/REJECTED.
6. Menunggu finalisasi admin:
   - Alokasi judul + pembimbing.
   - Grup masuk fase proyek aktif.
7. Jalankan fase akademik:
   - Upload dokumen per fase (PDC1 -> SEMPRO -> PDC2 -> EXPO/TA -> SIDANG).
   - Revisi bila ditolak.
8. Ikut seminar/sidang sesuai jadwal admin.
9. Lihat hasil evaluasi dan progres status grup.
10. Penutupan:
   - Setelah seluruh anggota selesai sidang TA, status grup menjadi CLOSED.

### 3.2 Dosen
1. Login ke dashboard dosen.
2. Kelola judul topik yang dibuka.
3. Tinjau incoming bid pada judul miliknya.
4. Beri rekomendasi bid (ACCEPT/REJECT).
5. Tinjau proposal judul mahasiswa (jika dosen diajukan sebagai supervisor):
   - APPROVED jika layak.
   - PRE_APPROVED jika ide layak tetapi anggota belum memenuhi syarat.
   - REJECTED disertai alasan.
6. Review dokumen tiap fase grup bimbingan:
   - APPROVED/REJECTED + feedback.
7. Evaluasi SEMPRO/EXPO/TA defense sesuai penugasan examiner.
8. Review TA draft dan tandai TA_READY / butuh revisi.
9. Tandai TA_DEFENDED ketika sidang selesai.

### 3.3 Admin
1. Login ke dashboard admin.
2. Kelola master data:
   - Periode, user, aturan kuota/batas.
3. Pantau kesiapan grup (readiness).
4. Jalankan kontrol bidding:
   - lock/unlock jika diperlukan.
   - simulation/auto-fix bila ada blocker.
5. Lakukan finalisasi:
   - Alokasi grup ke judul berdasarkan aturan.
   - Tetapkan supervisor.
6. Jadwalkan kegiatan akademik:
   - SEMPRO.
   - EXPO.
   - TA Defense.
7. Pastikan tidak ada konflik jadwal (ruang/waktu/dosen).
8. Monitor hasil evaluasi dan status fase.
9. Final close period saat semua proses selesai.

### 3.4 Diagram Rinci per Role

#### A. Mahasiswa - Detailed User Flow

```mermaid
flowchart TD
   A1[Login] --> A2[Ambil profil dan role]
   A2 --> A3{Periode aktif dan belum finalized?}
   A3 -- Tidak --> A4[Read-only dashboard / tunggu periode dibuka]
   A3 -- Ya --> A5{Sudah punya grup di periode ini?}

   A5 -- Tidak --> A6{Pilih mode grup}
   A6 -->|Grup Normal| A7[Buat grup: status FORMING]
   A6 -->|Solo Seeker| A8[Buat grup solo: status FORMING_SOLO]
   A6 -->|Join undangan| A9[Terima undangan grup]
   A6 -->|Bursa Ide| A10[Request join ke grup PRE_APPROVED]

   A5 -- Ya --> A11[Masuk halaman grup aktif]
   A7 --> A11
   A8 --> A11
   A9 --> A11
   A10 --> A12{Request diterima leader target?}
   A12 -- Tidak --> A11
   A12 -- Ya --> A11

   A11 --> A13{Saya leader grup?}
   A13 -- Tidak --> A20[Ikut progress grup, unggah dokumen sesuai izin]
   A13 -- Ya --> A14{Strategi judul}

   A14 -->|Bid judul dosen| A15[Submit bid + prioritas + proposed supervisors]
   A14 -->|Propose judul sendiri| A16[Submit proposal ke dosen target]

   A15 --> A17{Validasi bidding lolos?}
   A17 -- Tidak --> A18[Perbaiki syarat: anggota/min size/window/lock]
   A18 --> A15
   A17 -- Ya --> A19[Tunggu rekomendasi dosen]

   A16 --> A21[Status grup WAITING_SUPERVISOR_APPROVAL]
   A21 --> A22{Keputusan dosen}
   A22 -->|REJECTED| A23[Revisi proposal dan resubmit]
   A23 --> A16
   A22 -->|PRE_APPROVED| A24[Recruit anggota via Bursa Ide]
   A24 --> A14
   A22 -->|APPROVED| A25[Tunggu finalisasi admin]

   A19 --> A25
   A25 --> A26{Finalisasi sukses?}
   A26 -- Tidak --> A27[Tunggu/ikuti instruksi admin]
   A27 --> A25
   A26 -- Ya --> A28[Status ke PDC1_ACTIVE]

   A28 --> A29[Upload dokumen fase aktif]
   A29 --> A30{Dokumen di-approve dosen?}
   A30 -- Tidak --> A31[Terima feedback dan revisi]
   A31 --> A29
   A30 -- Ya --> A32[Fase berikutnya unlock]

   A32 --> A33{Perlu jadwal seminar/sidang?}
   A33 -- Ya --> A34[Tunggu jadwal admin + notifikasi]
   A34 --> A35[Ikuti SEMPRO/EXPO/TA Defense]
   A35 --> A36[Lihat hasil evaluasi]
   A36 --> A37{TA selesai semua anggota?}
   A37 -- Tidak --> A29
   A37 -- Ya --> A38[Status grup CLOSED]

   A33 -- Tidak --> A29
   A20 --> A29
```

#### B. Dosen - Detailed User Flow

```mermaid
flowchart TD
   B1[Login Dosen] --> B2[Dashboard dosen]
   B2 --> B3[Kelola judul: create/update/quota]
   B2 --> B4[Lihat incoming bids pada judul milik saya]
   B2 --> B5[Lihat proposal judul mahasiswa ke saya]
   B2 --> B6[Lihat dokumen grup bimbingan]
   B2 --> B7[Lihat jadwal evaluator: SEMPRO/EXPO/TA Defense]

   B4 --> B8{Review bid}
   B8 -->|ACCEPT| B9[Simpan lecturer recommendation ACCEPT]
   B8 -->|REJECT| B10[Simpan lecturer recommendation REJECT]

   B5 --> B11{Review proposal mahasiswa}
   B11 -->|APPROVED| B12[Proposal approved, grup siap finalisasi]
   B11 -->|PRE_APPROVED| B13[Proposal layak, butuh tambah anggota]
   B11 -->|REJECTED| B14[Proposal ditolak + alasan revisi]

   B6 --> B15{Review dokumen fase}
   B15 -->|APPROVED| B16[Set approved + trigger cek completion fase]
   B15 -->|REJECTED| B17[Set rejected + feedback]
   B17 --> B18[Mahasiswa revisi lalu upload ulang]
   B18 --> B15

   B7 --> B19{Saya examiner/supervisor ter-assign?}
   B19 -- Tidak --> B2
   B19 -- Ya --> B20[Submit evaluasi per jadwal]
   B20 --> B21{Semua evaluator submit?}
   B21 -- Tidak --> B22[Menunggu evaluator lain]
   B21 -- Ya --> B23[Result final dihitung sistem]

   B2 --> B24[Review TA draft mahasiswa]
   B24 --> B25{Hasil review TA}
   B25 -->|APPROVE| B26[Set TA_READY]
   B25 -->|REVISE| B27[Kirim feedback revisi]
   B27 --> B24

   B2 --> B28[Pasca sidang: mark TA_DEFENDED]
   B28 --> B29{Semua anggota grup defended?}
   B29 -- Ya --> B30[Group ditutup sistem -> CLOSED]
   B29 -- Tidak --> B2
```

#### C. Admin - Detailed User Flow

```mermaid
flowchart TD
   C1[Login Admin] --> C2[Dashboard admin]
   C2 --> C3[Kelola master data: periode, users, rules]
   C2 --> C4[Monitor readiness groups per period]
   C2 --> C5[Kontrol bidding: lock/unlock]
   C2 --> C6[Simulation dan auto-fix readiness]
   C2 --> C7[Finalization panel]
   C2 --> C8[Scheduling panel: SEMPRO/EXPO/TA Defense]
   C2 --> C9[Monitoring evaluasi dan progress fase]

   C7 --> C10{Sumber alokasi}
   C10 -->|Bid ACCEPT dari dosen| C11[Allocate via bid winner]
   C10 -->|Student proposal APPROVED| C12[Allocate student-proposed title]

   C11 --> C13[Assign supervisor 1/2]
   C12 --> C13
   C13 --> C14{Quota title tersedia?}
   C14 -- Tidak --> C15[Skip/fix/ubah alokasi]
   C15 --> C7
   C14 -- Ya --> C16[Commit transaction finalisasi]
   C16 --> C17[State: READY_FOR_BIDDING -> KELOMPOK_FINAL -> PDC1_ACTIVE]

   C8 --> C18[Pilih entitas jadwal]
   C18 -->|SEMPRO| C19[Set tanggal, ruang, examiner]
   C18 -->|EXPO| C20[Set tanggal, ruang, examiner]
   C18 -->|TA Defense| C21[Set tanggal, ruang, examiner + supervisor]

   C19 --> C22{Ada konflik jadwal?}
   C20 --> C22
   C21 --> C22
   C22 -- Ya --> C23[Ubah slot/ruang/examiner]
   C23 --> C18
   C22 -- Tidak --> C24[Publish schedule + auto-create evaluations]

   C24 --> C25[Distribusi notifikasi ke mahasiswa dan dosen]
   C25 --> C9
   C9 --> C26{Periode selesai?}
   C26 -- Tidak --> C4
   C26 -- Ya --> C27[Finalize/close period]
```

## 4. Business Flow Inti

### 4.1 Onboarding dan Group Formation
1. Sistem hanya mengizinkan aksi pada period aktif dan belum finalized.
2. Mahasiswa tidak boleh punya lebih dari satu membership pada period yang sama.
3. Leader-only actions:
   - add/remove member,
   - submit bid,
   - submit proposal.
4. Status awal grup:
   - FORMING untuk grup normal.
   - FORMING_SOLO untuk solo seeker.

### 4.2 Dual Path Judul (Bidding vs Propose)
1. Path A - Bidding judul dosen:
   - Prasyarat: status grup READY_FOR_BIDDING.
   - Cek min anggota, window bidding, lock status, dan batas total 3 (bid + proposal).
   - Dosen memberi rekomendasi ACCEPT/REJECT.
2. Path B - Propose judul mahasiswa:
   - Leader submit proposal ke dosen target.
   - Status grup pindah ke WAITING_SUPERVISOR_APPROVAL.
   - Dosen memutuskan APPROVED / PRE_APPROVED / REJECTED.
   - PRE_APPROVED dapat dilanjutkan setelah komposisi anggota terpenuhi (dapat via Bursa Ide).

### 4.3 Readiness dan Gating
1. Readiness menjadi syarat sebelum grup masuk bidding/finalisasi.
2. Snapshot readiness dipakai sebagai cache/status view, bukan sumber logika utama.
3. Business rules penting:
   - validasi period_id,
   - state transition harus valid,
   - operasi multi-step dibungkus transaction.

### 4.4 Finalization (Admin Authority)
1. Admin mengeksekusi finalisasi dari data bid/proposal yang valid.
2. Ketika alokasi sukses:
   - title_id ditetapkan,
   - supervisor 1/2 ditetapkan,
   - bid pemenang ACCEPTED, bid lain REJECTED.
3. State progression pasca finalisasi:
   - READY_FOR_BIDDING -> KELOMPOK_FINAL -> PDC1_ACTIVE.
4. Tersedia simulation mode, auto-fix, dan force-ready untuk edge case operasional.

### 4.5 Fase Dokumen dan Progress Akademik
1. Unlock fase mengikuti prereq:
   - PDC1 -> SEMPRO -> PDC2 -> EXPO/TA -> SIDANG.
2. Upload dokumen hanya di fase yang unlocked.
3. Dosen review dokumen:
   - APPROVED membuka fase berikutnya (sesuai requirement),
   - REJECTED memicu revisi.
4. Transisi otomatis contoh:
   - PDC1 complete: PDC1_ACTIVE -> READY_FOR_SEMPRO.
   - PDC2 complete: PDC2_ACTIVE -> PDC2_READY_FOR_EXPO.

### 4.6 Scheduling dan Evaluasi
1. Admin membuat jadwal SEMPRO/EXPO/TA defense.
2. Sistem validasi konflik:
   - bentrok dosen (examiner/supervisor),
   - bentrok ruangan/waktu.
3. Saat jadwal dibuat, sistem auto-generate evaluation rows.
4. Examiner submit evaluasi masing-masing sampai seluruh evaluator complete.

### 4.7 TA Submission sampai Closing
1. Mahasiswa upload TA draft saat grup minimal PDC2_ACTIVE.
2. Dosen review:
   - APPROVE -> TA_READY,
   - REVISE -> mahasiswa revisi ulang.
3. Mahasiswa daftar sidang TA saat window TA buka dan syarat terpenuhi.
4. Admin jadwalkan TA defense.
5. Setelah sidang, dosen menandai TA_DEFENDED.
6. Jika semua anggota grup TA_DEFENDED, grup transition ke CLOSED.

## 5. State Flow Utama Grup

```mermaid
stateDiagram-v2
    [*] --> FORMING
    [*] --> FORMING_SOLO

    FORMING --> WAITING_SUPERVISOR_APPROVAL
    FORMING --> READY_FOR_BIDDING
    FORMING_SOLO --> WAITING_SUPERVISOR_APPROVAL
    FORMING_SOLO --> READY_FOR_BIDDING
    WAITING_SUPERVISOR_APPROVAL --> READY_FOR_BIDDING
    WAITING_SUPERVISOR_APPROVAL --> FORMING
    WAITING_SUPERVISOR_APPROVAL --> FORMING_SOLO

    READY_FOR_BIDDING --> KELOMPOK_FINAL
    KELOMPOK_FINAL --> PDC1_ACTIVE
    PDC1_ACTIVE --> READY_FOR_SEMPRO
    READY_FOR_SEMPRO --> SEMPRO_DONE
    SEMPRO_DONE --> PDC2_ACTIVE
    PDC2_ACTIVE --> PDC2_READY_FOR_EXPO
    PDC2_READY_FOR_EXPO --> EXPO_REGISTERED
    EXPO_REGISTERED --> EXPO_DONE
    EXPO_DONE --> PDC2_COMPLETED
    PDC2_COMPLETED --> CLOSED

    FORMING --> DISSOLVED
    FORMING_SOLO --> DISSOLVED
    WAITING_SUPERVISOR_APPROVAL --> DISSOLVED
    READY_FOR_BIDDING --> DISSOLVED
```

## 6. Swimlane Business Flow (End-to-End)

```mermaid
flowchart LR
    A[Mahasiswa: Login + pilih periode] --> B[Mahasiswa: Bentuk grup]
    B --> C{Jalur Judul}

    C -->|Bid Judul Dosen| D[Mahasiswa Leader submit bid]
    C -->|Propose Judul Sendiri| E[Mahasiswa Leader submit proposal]

    D --> F[Dosen: rekomendasi ACCEPT/REJECT]
    E --> G[Dosen: approve/pre-approve/reject]

    F --> H[Admin: cek readiness + lock/window]
    G --> H

    H --> I[Admin: finalisasi alokasi + assign supervisor]
    I --> J[Group status ke PDC1_ACTIVE]

    J --> K[Mahasiswa: upload dokumen per fase]
    K --> L[Dosen: review APPROVED/REJECTED]
    L --> M[System: unlock fase berikutnya]
    M --> N[Admin: jadwalkan SEMPRO/EXPO/TA defense]
    N --> O[Dosen Examiner: submit evaluasi]
    O --> P[Mahasiswa: upload/review TA dan daftar sidang]
    P --> Q[Dosen: mark TA_DEFENDED]
    Q --> R[System: jika semua anggota defended -> CLOSED]
```

## 7. KPI Operasional yang Disarankan
- Conversion rate FORMING -> READY_FOR_BIDDING.
- Lead time READY_FOR_BIDDING -> PDC1_ACTIVE (efektivitas finalisasi).
- Rata-rata siklus review dokumen (submit -> approve).
- Konflik jadwal per periode (indikator kualitas perencanaan).
- Rasio proposal mahasiswa APPROVED vs REJECTED.
- Rasio grup CLOSED terhadap total grup aktif periode.

## 8. Titik Risiko dan Kontrol
- Risiko: deadlock saat operasi multi-entitas.
  - Kontrol: transaction + lock order konsisten.
- Risiko: status lompat tanpa validasi.
  - Kontrol: state machine sebagai guard transisi.
- Risiko: alokasi judul melebihi kuota.
  - Kontrol: row lock + quota validation saat finalisasi.
- Risiko: data lintas periode tercampur.
  - Kontrol: period scoping wajib pada query kritikal.

## 9. Checklist Implementasi Produk/Operasional
- Semua halaman menampilkan period aktif yang sedang dipakai.
- Semua aksi leader-only ditandai jelas pada UI.
- Semua pesan gagal menampilkan alasan bisnis yang actionable.
- Dashboard admin menampilkan readiness blocker sebelum finalisasi.
- Notifikasi aktif untuk momen penting: invitation, approval, schedule, review.
- Monitoring KPI dibuat per periode untuk evaluasi kurikulum.
