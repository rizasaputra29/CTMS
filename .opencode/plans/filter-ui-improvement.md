# Plan: Perbaikan UI Filter Lanjutan di Page Finalization

## Tujuan
Memperbaiki UI filter lanjutan di page finalization agar lebih sederhana dan clean dengan gaya shadcn.

## Analisis Saat Ini
- Filter panel menggunakan layout grid 3 kolom yang memakan space
- Filter chips (pill buttons) untuk setiap opsi
- Selalu terlihat/terbuka, tidak ada cara untuk menyembunyikan

## Solusi
Mengubah filter menjadi **Popover Dropdown** yang:
1. Tersembunyi secara default (clean UI)
2. Muncul saat tombol "Filter" diklik
3. Menggunakan Select component ala shadcn
4. Menampilkan badge filter aktif di luar popover
5. Bisa remove filter individual via badge

## Perubahan File

### 1. `/frontend/src/components/finalization/filter-panel.tsx`
**Before:**
- Grid layout 3 kolom dengan FilterChip buttons
- Selalu terlihat
- Tombol Reset di dalam panel

**After:**
- Popover wrapper
- Active filter badges di luar popover (removable)
- Tombol "Filter" dengan badge counter
- Select dropdowns untuk setiap filter category
- Layout vertikal dalam popover

### 2. `/frontend/src/app/admin/finalization/page.tsx`
**Changes:**
- Integrasi FilterPanel baru (API tetap sama)
- Layout search bar + filter lebih compact

## Preview UI

```
[Search Input                ] [Filter ▼ 2]
                                ↑
                          Popover trigger
                          (badge = 2 filter aktif)

Active filters:
[Tanpa SV1 ✕] [< 3 ✕] [Reset]
```

Popover terbuka:
```
┌─────────────────────────┐
│ Filter Lanjutan  [Reset]│
├─────────────────────────┤
│ Status Supervisor       │
│ [Semua Status     ▼]    │
│                         │
│ Jumlah Anggota          │
│ [Semua Jumlah     ▼]    │
│                         │
│ Status Judul            │
│ [Semua Judul      ▼]    │
└─────────────────────────┘
```

## Acceptance Criteria
- [ ] Filter panel tersembunyi secara default
- [ ] Tombol Filter dengan icon SlidersHorizontal
- [ ] Badge counter jumlah filter aktif
- [ ] Popover muncul saat tombol diklik
- [ ] Select dropdown untuk setiap filter
- [ ] Active filter badges removable
- [ ] Tombol Reset untuk clear semua filter

## Implementation Ready
Status: **READY TO IMPLEMENT**
