# CTMS — Test Case dari Seed Data

## Kredensial Default
| Role    | Email              | Password  |
|---------|--------------------|-----------|
| Admin   | admin@ctms.com     | password  |
| Dosen   | budi@ctms.com      | password  |
| Dosen   | siti@ctms.com      | password  |
| Leader  | andi@ctms.com      | password  (Grup A)  |
| Leader  | dodi@ctms.com      | password  (Grup B)  |
| Leader  | gita@ctms.com      | password  (Grup C)  |
| Leader  | kartika@ctms.com   | password  (Grup D)  |
| Leader  | zara@ctms.com      | password  (Solo A)  |
| Leader  | bella@ctms.com     | password  (Solo C - TITLE_APPROVED) |
| Ghost   | wawan@ctms.com     | password  |

---

## TC-01: Grup Normal — Bid Berhasil
**Data:** Grup A (ID:1), status READY_FOR_BIDDING, 0 bid aktif
**Actor:** andi@ctms.com (leader)
**Request:** POST /api/mahasiswa/bids
```json
{
  "title_id": 2,
  "priority": 1,
  "proposed_supervisor_1_id": "<id budi>",
  "proposed_supervisor_2_id": null
}
```
**Expected:** 201, bid terbuat status PENDING
**Verify:** group status TETAP READY_FOR_BIDDING

---

## TC-02: Grup Normal — Bid Gagal karena Kuota Penuh
**Data:** Grup C (ID:3), status READY_FOR_BIDDING, 3 bid PENDING (penuh)
**Actor:** gita@ctms.com (leader)
**Request:** POST /api/mahasiswa/bids (judul apapun)
**Expected:** 400, pesan kuota 3 terlampaui
**Verify:** tidak ada bid baru di DB

---

## TC-03: Grup Normal — Propose Berhasil
**Data:** Grup A (ID:1), status READY_FOR_BIDDING, 0 aktif
**Actor:** andi@ctms.com (leader)
**Request:** POST /api/mahasiswa/propose-title
```json
{
  "title": "Judul baru dari Grup A",
  "description": "Deskripsi ...",
  "problem_statement": "Masalah ...",
  "scope": "Scope ...",
  "proposed_supervisor_id": "<id siti>"
}
```
**Expected:** 201, proposal terbuat status PENDING
**Verify:** group status berubah ke WAITING_SUPERVISOR_APPROVAL

---

## TC-04: Grup Normal — Propose Gagal karena FORMING
**Data:** Grup F (ID:6), status FORMING, hanya 2 anggota
**Actor:** qori@ctms.com (leader)
**Request:** POST /api/mahasiswa/propose-title (payload lengkap)
**Expected:** 403, pesan anggota belum cukup
**Verify:** group status TETAP FORMING

---

## TC-05: Cancel Propose Tidak Mengubah Group Status
**Data:** Grup D (ID:4), status WAITING_SUPERVISOR_APPROVAL
**Actor:** kartika@ctms.com (leader)
**Request:** DELETE /api/mahasiswa/propose-title/<title_id_11>
**Expected:** 200, proposal dihapus/cancelled
**Verify:**
- group status dikembalikan via determineStatus() → READY_FOR_BIDDING (3 anggota)
- BUKAN hardcode ke FORMING

---

## TC-06: Quota Bebas setelah Proposal REJECTED
**Data:** Grup E (ID:5), proposal title ID:12 sudah REJECTED
**Actor:** nanda@ctms.com (leader)
**Expected:** GET /api/mahasiswa/bids atau dashboard → kuota aktif = 0
**Verify:** bisa submit propose/bid baru (kuota REJECTED tidak dihitung)

---

## TC-07: Non-Leader Tidak Bisa Bid
**Data:** Grup A (ID:1)
**Actor:** bela@ctms.com (member, bukan leader)
**Request:** POST /api/mahasiswa/bids (payload lengkap)
**Expected:** 403 Forbidden
**Verify:** tidak ada bid di DB

---

## TC-08: Ghost Tidak Bisa Bid/Propose
**Data:** wawan@ctms.com tidak punya grup
**Actor:** wawan@ctms.com
**Request:** POST /api/mahasiswa/bids atau propose-title
**Expected:** 403, pesan belum punya grup
**Verify:** tidak ada data baru di DB

---

## TC-09: Solo Seeker — Propose Berhasil (allow_solo=true)
**Data:** Solo A (ID:10), status READY_FOR_BIDDING, is_solo=true, period allow_solo=true
**Actor:** zara@ctms.com
**Request:** POST /api/mahasiswa/propose-title (payload lengkap)
**Expected:** 201, proposal terbuat
**Verify:** group status → WAITING_SUPERVISOR_APPROVAL

---

## TC-10: Solo Seeker — Bid Dilarang
**Data:** Solo A (ID:10)
**Actor:** zara@ctms.com
**Request:** POST /api/mahasiswa/bids (payload lengkap)
**Expected:** 403, pesan solo seeker tidak bisa bid judul dosen
**Verify:** tidak ada bid di DB

---

## TC-11: Solo Seeker — Ditolak jika allow_solo=false
**Data:** Solo Miko (ID:15), period 2 allow_solo=false
**Actor:** miko@ctms.com
**Request:** POST /api/mahasiswa/propose-title (payload lengkap)
**Expected:** 403, pesan period tidak mengizinkan solo seeker
**Verify:** status group TETAP FORMING

---

## TC-12: Dosen Approve Proposal Solo → TITLE_APPROVED
**Data:** Solo B (ID:11), proposal title ID:13 status PENDING
**Actor:** budi@ctms.com (dosen supervisor)
**Request:** PUT /api/dosen/title-approvals/<id> { "status": "APPROVED" }
**Expected:** 200
**Verify:**
- title status → APPROVED
- group status → TITLE_APPROVED (bukan READY_FOR_BIDDING)
- is_available title → true (masuk marketplace)

---

## TC-13: Dosen Approve Proposal Grup Normal → READY_FOR_BIDDING
**Data:** Grup D (ID:4), proposal title ID:11 status PENDING
**Actor:** maya@ctms.com (dosen supervisor)
**Request:** PUT /api/dosen/title-approvals/<id> { "status": "APPROVED" }
**Expected:** 200
**Verify:**
- group status → READY_FOR_BIDDING (via determineStatus(), 3 anggota ≥ min)
- BUKAN TITLE_APPROVED (karena is_solo=false)

---

## TC-14: Dosen Reject Proposal → Quota Bebas
**Data:** Solo B (ID:11), proposal title ID:13 PENDING
**Actor:** budi@ctms.com
**Request:** PUT /api/dosen/title-approvals/<id> { "status": "REJECTED" }
**Expected:** 200
**Verify:**
- group status → READY_FOR_BIDDING (via determineStatus())
- kuota aktif = 0 (REJECTED tidak dihitung)
- bisa propose lagi

---

## TC-15: Bid ke Judul Solo Seeker — Berhasil
**Data:** Grup H (ID:8, 3 anggota), Solo C (ID:12, TITLE_APPROVED), title ID:14
**Actor:** dani@ctms.com (leader Grup H)
**Request:** POST /api/mahasiswa/solo-titles/14/bid
**Expected:** 201, bid request terbuat
**Verify:** Solo C mendapat notifikasi ada bidder

---

## TC-16: Bid ke Judul Solo — Gagal karena Merge Melebihi Max
**Data:** Buat skenario Solo C (1 org) + grup 4 org = 5 > max_group_size(4)
**Expected:** 400, pesan total anggota setelah merge melebihi batas
**Verify:** tidak ada bid di DB

---

## TC-17: Solo Seeker Accept Bidder → Merge Terjadi
**Data:** Grup H (ID:8) sudah bid ke Solo C (ID:12), bid PENDING
**Actor:** bella@ctms.com (leader Solo C)
**Request:** PUT /api/mahasiswa/solo-titles/14/accept { "bid_id": <id> }
**Expected:** 200
**Verify:**
- Anggota Grup H (dani, eka, fani) pindah ke group ID:12
- Grup H (ID:8) dissolved/deleted
- is_solo pada ID:12 → false
- determineStatus() → READY_FOR_BIDDING (1+3=4 ≥ min 3)

---

## TC-18: Solo Seeker Reject Bidder → Quota Bidder Bebas
**Data:** Ada grup yang bid ke Solo C, status PENDING
**Actor:** bella@ctms.com (leader Solo C)
**Request:** PUT /api/mahasiswa/solo-titles/14/reject { "bid_id": <id> }
**Expected:** 200
**Verify:**
- bid dihapus
- kuota bidder berkurang 1 (sehingga bisa bid/propose lain)
- Solo C TETAP di TITLE_APPROVED

---

## TC-19: Non-Owner Tidak Bisa Accept/Reject Bidder
**Data:** Solo C (ID:12), ada bid masuk
**Actor:** dani@ctms.com (bukan owner solo seeker)
**Request:** PUT /api/mahasiswa/solo-titles/14/accept { "bid_id": <id> }
**Expected:** 403 Forbidden
**Verify:** status bid tidak berubah

---

## TC-20: Observer — Status Auto-Update saat Member Keluar
**Data:** Grup A (ID:1), 3 anggota, READY_FOR_BIDDING
**Actor:** admin atau via internal action
**Action:** Hapus salah satu anggota (bukan leader) dari group_members
**Expected:** GroupMemberObserver terpicu
**Verify:** group status otomatis berubah ke FORMING (2 < min 3)

---

## TC-21: Observer — Status Auto-Update saat Member Masuk
**Data:** Grup F (ID:6), 2 anggota, FORMING
**Action:** Tambahkan anggota baru (misal: yoga@ctms.com)
**Expected:** Observer terpicu
**Verify:** group status otomatis berubah ke READY_FOR_BIDDING (3 ≥ min)

---

## TC-22: Admin Batch Finalisasi — Hanya Period Tertentu
**Data:** Period 1, Grup G (ID:7) dan Grup I (ID:9) status KELOMPOK_FINAL
**Actor:** admin@ctms.com
**Request:** POST /api/admin/finalization/finalize-period { "period_id": 1 }
**Expected:** 200, batch finalization sukses
**Verify:**
- Grup G dan I status → PDC1_ACTIVE
- Period 2 grup TIDAK terpengaruh
- Period 1 is_finalized → true

---

## TC-23: Simulate Finalisasi — Preview sebelum Eksekusi
**Actor:** admin@ctms.com
**Request:** GET /api/admin/finalization/simulate?period_id=1
**Expected:** 200, response dengan can_finalize, blocker list
**Verify:**
- Grup F (FORMING, 2 anggota) muncul sebagai blocker
- Ghost users (wawan, xena, yoga) muncul sebagai blocker
- Grup G dan I muncul sebagai ready

---

## TC-24: PDC1_ACTIVE Tidak Bisa Dicapai Tanpa Admin Batch
**Verify:** Tidak ada endpoint mahasiswa atau dosen yang bisa langsung
mengubah status grup ke PDC1_ACTIVE. Semua jalur ke PDC1_ACTIVE
harus melalui POST /api/admin/finalization/finalize-period.

---

## TC-25: Race Condition — Dua Bid Bersamaan ke Slot Terakhir Solo
**Setup:** Solo seeker dengan max 4 anggota, sudah ada 3 anggota
(1 solo + 2 dari merge). Sisa slot = 1.
**Action:** Kirim 2 request POST /solo-titles/{id}/bid secara bersamaan
dari dua grup berbeda, masing-masing 1 anggota.
**Expected:** Satu request sukses 201, satu request gagal 400
**Verify:** lockForUpdate() mencegah double booking

---

## Ringkasan Matriks Test per Skenario

| ID   | Skenario                              | Group  | Status Awal              | Expected Result          |
|------|---------------------------------------|--------|--------------------------|--------------------------|
| TC01 | Bid berhasil                          | A(1)   | READY_FOR_BIDDING        | 201, status tidak berubah|
| TC02 | Bid gagal kuota penuh                 | C(3)   | READY_FOR_BIDDING        | 400                      |
| TC03 | Propose berhasil                      | A(1)   | READY_FOR_BIDDING        | 201 → WAITING_SUPERVISOR |
| TC04 | Propose gagal FORMING                 | F(6)   | FORMING                  | 403                      |
| TC05 | Cancel propose                        | D(4)   | WAITING_SUPERVISOR       | 200 → determineStatus()  |
| TC06 | Quota bebas setelah REJECTED          | E(5)   | READY_FOR_BIDDING        | kuota = 0                |
| TC07 | Non-leader bid                        | A(1)   | READY_FOR_BIDDING        | 403                      |
| TC08 | Ghost bid/propose                     | -      | tidak punya grup         | 403                      |
| TC09 | Solo propose (allow_solo=true)        | SA(10) | READY_FOR_BIDDING        | 201 → WAITING_SUPERVISOR |
| TC10 | Solo bid judul dosen                  | SA(10) | READY_FOR_BIDDING        | 403                      |
| TC11 | Solo propose (allow_solo=false)       | SM(15) | FORMING                  | 403                      |
| TC12 | Dosen approve solo → TITLE_APPROVED   | SB(11) | WAITING_SUPERVISOR       | TITLE_APPROVED           |
| TC13 | Dosen approve grup → READY_FOR_BIDDING| D(4)  | WAITING_SUPERVISOR       | READY_FOR_BIDDING        |
| TC14 | Dosen reject → quota bebas            | SB(11) | WAITING_SUPERVISOR       | READY_FOR_BIDDING        |
| TC15 | Bid ke judul solo berhasil            | H(8)   | READY_FOR_BIDDING        | 201                      |
| TC16 | Bid ke judul solo melebihi max        | -      | -                        | 400                      |
| TC17 | Solo accept bidder → merge            | SC(12) | TITLE_APPROVED           | merge, is_solo=false     |
| TC18 | Solo reject bidder                    | SC(12) | TITLE_APPROVED           | bid hapus, kuota bebas   |
| TC19 | Non-owner accept/reject               | SC(12) | TITLE_APPROVED           | 403                      |
| TC20 | Observer member keluar                | A(1)   | READY_FOR_BIDDING        | auto → FORMING           |
| TC21 | Observer member masuk                 | F(6)   | FORMING                  | auto → READY_FOR_BIDDING |
| TC22 | Admin batch finalisasi                | G,I    | KELOMPOK_FINAL           | PDC1_ACTIVE              |
| TC23 | Simulate finalisasi                   | -      | -                        | preview + blockers       |
| TC24 | PDC1 hanya via admin batch            | -      | -                        | tidak ada jalur lain     |
| TC25 | Race condition bid solo               | -      | -                        | 1 sukses, 1 gagal        |
