# Plan: Fix Bug Finalisasi - Status Pengecekan & Reopen Logic

## Ringkasan Bug

### Bug #1: Pengecekan Status Terlalu Strict
**File:** `/backend/app/Http/Controllers/FinalizationController.php`
**Method:** `executeFinalization()`
**Line:** ~787-789

**Current Logic:**
```php
$notReadyGroups = Group::where('period_id', $period->id)
    ->whereNotIn('status', ['KELOMPOK_FINAL', 'PDC1_ACTIVE', 'PDC2_ACTIVE', 'CLOSED', 'DISSOLVED'])
    ->count();
```

**Problem:** Missing statuses after PDC1_ACTIVE:
- READY_FOR_SEMPRO
- SEMPRO_DONE
- PDC2_READY_FOR_EXPO
- EXPO_REGISTERED
- EXPO_DONE
- PDC2_COMPLETED

**Fix:** Tambahkan semua status >= KELOMPOK_FINAL

### Bug #2: Reopen Period Hanya Merevert PDC1_ACTIVE
**File:** `/backend/app/Http/Controllers/FinalizationController.php`
**Method:** `reopenPeriod()`
**Line:** ~332-353

**Current Logic:**
```php
$hasPdc1ActiveGroups = Group::where('period_id', $period->id)
    ->where('status', 'PDC1_ACTIVE')  // Only PDC1_ACTIVE
    ->exists();

$revertedCount = Group::where('period_id', $period->id)
    ->where('status', 'PDC1_ACTIVE')  // Only revert PDC1_ACTIVE
    ->update([...])
```

**Problem:** Grup dengan status lebih tinggi (SEMPRO_DONE, dll) tidak direvert

**Fix:** Revert semua grup yang sudah difinalisasi (>= PDC1_ACTIVE)

---

## Implementasi

### Perubahan File:

#### 1. FinalizationController.php - executeFinalization()
**Line ~787-789:**
```php
// BEFORE:
$notReadyGroups = Group::where('period_id', $period->id)
    ->whereNotIn('status', ['KELOMPOK_FINAL', 'PDC1_ACTIVE', 'PDC2_ACTIVE', 'CLOSED', 'DISSOLVED'])
    ->count();

// AFTER:
$allowedStatuses = [
    'KELOMPOK_FINAL',
    'PDC1_ACTIVE',
    'READY_FOR_SEMPRO',
    'SEMPRO_DONE',
    'PDC2_ACTIVE',
    'PDC2_READY_FOR_EXPO',
    'EXPO_REGISTERED',
    'EXPO_DONE',
    'PDC2_COMPLETED',
    'CLOSED',
    'DISSOLVED',
];

$notReadyGroups = Group::where('period_id', $period->id)
    ->whereNotIn('status', $allowedStatuses)
    ->count();
```

#### 2. FinalizationController.php - reopenPeriod()
**Line ~332-353:**
```php
// BEFORE:
$hasPdc1ActiveGroups = Group::where('period_id', $period->id)
    ->where('status', 'PDC1_ACTIVE')
    ->exists();

$revertedCount = Group::where('period_id', $period->id)
    ->where('status', 'PDC1_ACTIVE')
    ->update([...])

// AFTER:
$finalizedStatuses = [
    'PDC1_ACTIVE',
    'READY_FOR_SEMPRO',
    'SEMPRO_DONE',
    'PDC2_ACTIVE',
    'PDC2_READY_FOR_EXPO',
    'EXPO_REGISTERED',
    'EXPO_DONE',
    'PDC2_COMPLETED',
];

$hasFinalizedGroups = Group::where('period_id', $period->id)
    ->whereIn('status', $finalizedStatuses)
    ->exists();

$revertedCount = Group::where('period_id', $period->id)
    ->whereIn('status', $finalizedStatuses)
    ->update([...])
```

---

## Acceptance Criteria

- [ ] Grup dengan status SEMPRO_DONE bisa difinalisasi
- [ ] Grup dengan status EXPO_DONE bisa difinalisasi  
- [ ] Grup dengan status PDC2_COMPLETED bisa difinalisasi
- [ ] Reopen period merevert SEMUA grup yang sudah difinalisasi
- [ ] Error message "belum siap finalisasi" tidak muncul untuk grup valid

## Testing Scenario

1. Finalisasi period → grup ke PDC1_ACTIVE
2. Progress grup ke SEMPRO_DONE
3. Reopen period → grup kembali ke KELOMPOK_FINAL
4. Finalisasi ulang → berhasil tanpa error

---

Status: **READY TO IMPLEMENT**
