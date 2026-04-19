# Plan: Fix Missing State Transitions

## Masalah yang Dilaporkan User
User melaporkan error di state transition dan bertanya apakah flow berikut sudah sesuai:
1. ✅ PDC1 approve → READY_FOR_SEMPRO (sudah benar)
2. Setelah nilai SEMPRO masuk semua → SEMPRO_DONE / PDC2_ACTIVE 
3. Setelah dokumen PDC2 approve + TA draft upload → PDC2_READY_FOR_EXPO
4. Setelah nilai expo + milestone + peer review masuk semua → fase TA individu

## Hasil Verifikasi

### ✅ SUDAH BENAR
1. **PDC1 → READY_FOR_SEMPRO**: DocumentController.php line 397-398 ✅
2. **EXPO_DONE → Peer Review**: SchedulingService.php line 297-307 ✅

### ❌ MISSING / SALAH
1. **SEMPRO_DONE → PDC2_ACTIVE**: Tidak ada transisi otomatis setelah SEMRO pass
2. **PDC2_ACTIVE → PDC2_READY_FOR_EXPO**: Hanya cek dokumen, kurang cek TA draft
3. **Peer Review lengkap → PDC2_COMPLETED**: Tidak ada transisi group level

---

## Fix yang Diperlukan

### Fix #1: SEMPRO_DONE → PDC2_ACTIVE Auto-Transition
**File**: `/backend/app/Services/SchedulingService.php`
**Method**: `submitSeminarEvaluation()`
**Line**: ~289-292

**Current Code:**
```php
if ($schedule->type === 'SEMPRO') {
    if ($result === 'PASS') {
        $this->stateMachine->transition($group, 'SEMPRO_DONE');
        // MISSING: Auto-transition ke PDC2_ACTIVE
    } else {
        $this->stateMachine->transition($group, 'PDC1_ACTIVE');
    }
}
```

**Expected:**
```php
if ($schedule->type === 'SEMPRO') {
    if ($result === 'PASS') {
        $this->stateMachine->transition($group, 'SEMPRO_DONE');
        // Auto-transition to PDC2_ACTIVE after SEMPRO_DONE
        $this->stateMachine->transition($group, 'PDC2_ACTIVE');
    } else {
        $this->stateMachine->transition($group, 'PDC1_ACTIVE');
    }
}
```

---

### Fix #2: PDC2_ACTIVE → PDC2_READY_FOR_EXPO (with TA Draft Check)
**File**: `/backend/app/Http/Controllers/DocumentController.php`
**Method**: `checkPhaseCompletion()`
**Line**: ~373-405

**Current Code:**
```php
elseif ($phase === 'PDC2' && $group->status === 'PDC2_ACTIVE') {
    $this->stateMachine->transition($group, 'PDC2_READY_FOR_EXPO');
}
```

**Expected:**
```php
elseif ($phase === 'PDC2' && $group->status === 'PDC2_ACTIVE') {
    // Check if at least 1 member has uploaded TA draft
    $hasTaDraft = TaSubmission::where('group_id', $group->id)
        ->whereIn('status', ['TA_DRAFT', 'SUPERVISOR_APPROVED', 'ADMIN_APPROVED'])
        ->exists();
    
    if ($hasTaDraft) {
        $this->stateMachine->transition($group, 'PDC2_READY_FOR_EXPO');
    }
}
```

---

### Fix #3: Peer Review Lengkap → PDC2_COMPLETED (Group Level)
**File**: `/backend/app/Http/Controllers/PeerReviewController.php`
**Method**: `checkAndUpdateCompletionStatus()`
**Line**: ~255-259

**Current Code:**
```php
if ($hasCompleted) {
    $status->update([
        'has_completed_peer_review' => true,
        'peer_review_completed_at' => now(),
        'ta_status' => 'TA_ACTIVE',
    ]);
    // MISSING: Check if all group members completed
}
```

**Expected:**
```php
if ($hasCompleted) {
    $status->update([
        'has_completed_peer_review' => true,
        'peer_review_completed_at' => now(),
        'ta_status' => 'TA_ACTIVE',
    ]);
    
    // Check if all group members completed peer review
    $this->checkGroupPeerReviewCompletion($groupId);
}
```

**Tambahan Method:**
```php
private function checkGroupPeerReviewCompletion(int $groupId): void
{
    $group = Group::with('members')->find($groupId);
    if (!$group) return;
    
    $totalMembers = $group->members()->count();
    $completedCount = StudentPeerReviewStatus::where('group_id', $groupId)
        ->where('has_completed_peer_review', true)
        ->count();
    
    if ($completedCount === $totalMembers) {
        // All members completed, transition group to PDC2_COMPLETED
        $stateMachine = new \App\Services\GroupStateMachine();
        try {
            $stateMachine->transition($group, 'PDC2_COMPLETED');
        } catch (\Exception $e) {
            Log::info("Could not transition group {$groupId} to PDC2_COMPLETED: " . $e->getMessage());
        }
    }
}
```

---

## Flow Lengkap Setelah Fix

```
PDC1_ACTIVE
    ↓ (dokumen approved)
READY_FOR_SEMPRO
    ↓ (nilai SEMPRO PASS - examiner)
SEMPRO_DONE
    ↓ (auto-transition)
PDC2_ACTIVE
    ↓ (dokumen approved + TA draft uploaded)
PDC2_READY_FOR_EXPO
    ↓ (admin schedule expo)
EXPO_REGISTERED
    ↓ (nilai EXPO PASS - examiner)
EXPO_DONE
    ↓ (auto-unlock peer review)
PEER_REVIEW_ACTIVE (per individu)
    ↓ (semua member selesai)
PDC2_COMPLETED (group level)
    ↓ (semua member TA defended)
CLOSED
```

## Acceptance Criteria

- [ ] Setelah SEMPRO PASS, group otomatis ke PDC2_ACTIVE
- [ ] PDC2 dokumen approve + TA draft → PDC2_READY_FOR_EXPO  
- [ ] Setelah peer review semua member selesai → PDC2_COMPLETED
- [ ] Tidak ada error state transition

## File yang Diubah

1. `backend/app/Services/SchedulingService.php` - Fix #1
2. `backend/app/Http/Controllers/DocumentController.php` - Fix #2
3. `backend/app/Http/Controllers/PeerReviewController.php` - Fix #3

Status: **READY TO IMPLEMENT**
