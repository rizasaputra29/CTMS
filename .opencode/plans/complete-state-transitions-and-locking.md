# Plan: Complete State Transition & Document Requirement Fixes

## Ringkasan Request User

User mengkonfirmasi 3 hal untuk document requirement locking:
1. **Lock hanya untuk Tipe Dokumen (admin CRUD)** - mahasiswa tetap bisa upload
2. **Otomatis unlock** saat period direopen
3. **Plan sudah lengkap** - siap implementasi

---

## Daftar Lengkap Fix (Total 4 Fix)

### Fix #1: SEMPRO_DONE → PDC2_ACTIVE Auto-Transition
**File:** `backend/app/Services/SchedulingService.php`  
**Method:** `submitSeminarEvaluation()`  
**Line:** ~289-292

**Problem:** Setelah SEMPRO PASS, group stuck di SEMPRO_DONE, tidak otomatis ke PDC2_ACTIVE

**Solution:**
```php
if ($schedule->type === 'SEMPRO') {
    if ($result === 'PASS') {
        $this->stateMachine->transition($group, 'SEMPRO_DONE');
        // ADD: Auto-transition to PDC2_ACTIVE
        $this->stateMachine->transition($group, 'PDC2_ACTIVE');
    } else {
        $this->stateMachine->transition($group, 'PDC1_ACTIVE');
    }
}
```

---

### Fix #2: PDC2_ACTIVE → PDC2_READY_FOR_EXPO (with TA Draft Check)
**File:** `backend/app/Http/Controllers/DocumentController.php`  
**Method:** `checkPhaseCompletion()`  
**Line:** ~399-400

**Problem:** Transisi hanya cek dokumen approved, kurang cek TA draft upload

**Solution:**
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
**File:** `backend/app/Http/Controllers/PeerReviewController.php`  
**Method:** `checkAndUpdateCompletionStatus()`  
**Line:** ~255-259

**Problem:** Tidak ada transisi group ke PDC2_COMPLETED setelah semua member selesai peer review

**Solution:**
```php
if ($hasCompleted) {
    $status->update([
        'has_completed_peer_review' => true,
        'peer_review_completed_at' => now(),
        'ta_status' => 'TA_ACTIVE',
    ]);
    
    // ADD: Check group completion and transition
    $this->checkGroupPeerReviewCompletion($groupId);
}

// ADD NEW METHOD:
private function checkGroupPeerReviewCompletion(int $groupId): void
{
    $group = Group::with('members')->find($groupId);
    if (!$group) return;
    
    $totalMembers = $group->members()->count();
    $completedCount = StudentPeerReviewStatus::where('group_id', $groupId)
        ->where('has_completed_peer_review', true)
        ->count();
    
    if ($completedCount === $totalMembers) {
        $stateMachine = new \App\Services\GroupStateMachine();
        try {
            $stateMachine->transition($group, 'PDC2_COMPLETED');
        } catch (\Exception $e) {
            Log::info("Could not transition group {$groupId}: " . $e->getMessage());
        }
    }
}
```

---

### Fix #4: Document Requirement Locking (Admin CRUD Only)
**File:** `backend/app/Http/Controllers/Admin/PhaseDocumentRequirementController.php`

**Problem:** Admin bisa ubah/hapus/tambah tipe dokumen setelah period difinalisasi

**Solution - Add to ALL methods (store, update, destroy, bulkUpdate):**

```php
// Method store() - Line ~44
public function store(Request $request)
{
    $validator = Validator::make($request->all(), [...]);
    
    // ADD: Check period not finalized
    $period = Period::findOrFail($request->period_id);
    if ($period->is_finalized) {
        return response()->json([
            'message' => 'Cannot modify document requirements for a finalized period.'
        ], 403);
    }
    
    // ... rest of method
}

// Method update() - Line ~63
public function update(Request $request, string $id)
{
    $requirement = PhaseDocumentRequirement::with('period')->findOrFail($id);
    
    // ADD: Check period not finalized
    if ($requirement->period && $requirement->period->is_finalized) {
        return response()->json([
            'message' => 'Cannot modify document requirements for a finalized period.'
        ], 403);
    }
    
    // ... rest of method
}

// Method destroy() - Line ~83
public function destroy(string $id)
{
    $requirement = PhaseDocumentRequirement::with('period')->findOrFail($id);
    
    // ADD: Check period not finalized
    if ($requirement->period && $requirement->period->is_finalized) {
        return response()->json([
            'message' => 'Cannot delete document requirements for a finalized period.'
        ], 403);
    }
    
    // ... rest of method
}

// Method bulkUpdate() - Line ~91
public function bulkUpdate(Request $request)
{
    // ... validation
    
    // ADD: Check period not finalized BEFORE bulk delete
    $period = Period::findOrFail($periodId);
    if ($period->is_finalized) {
        return response()->json([
            'message' => 'Cannot modify document requirements for a finalized period.'
        ], 403);
    }
    
    PhaseDocumentRequirement::where('period_id', $periodId)->delete();
    // ... rest of method
}
```

**Otomatis Unlock:** Saat period direopen (is_finalized = false), locking otomatis hilang. Tidak perlu mekanisme tambahan.

---

## Flow Lengkap Setelah Semua Fix

```
┌─────────────────────────────────────────────────────────────────┐
│                    GROUP STATE FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  KELOMPOK_FINAL                                                 │
│       ↓                                                         │
│  PDC1_ACTIVE                                                    │
│       ↓ (dokumen PDC1 approved)                                 │
│  READY_FOR_SEMPRO                                               │
│       ↓ (nilai SEMPRO PASS - examiner)                          │
│  SEMPRO_DONE                                                    │
│       ↓ (AUTO - Fix #1)                                         │
│  PDC2_ACTIVE                                                    │
│       ↓ (dokumen PDC2 approved + TA draft uploaded - Fix #2)    │
│  PDC2_READY_FOR_EXPO                                            │
│       ↓ (admin schedule expo)                                   │
│  EXPO_REGISTERED                                                │
│       ↓ (nilai EXPO PASS - examiner)                            │
│  EXPO_DONE                                                      │
│       ↓ (auto-unlock peer review - sudah ada)                   │
│  PEER_REVIEW_ACTIVE (per individu)                                │
│       ↓ (semua member selesai - Fix #3)                         │
│  PDC2_COMPLETED (group level)                                     │
│       ↓ (semua member TA defended)                            │
│  CLOSED                                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              DOCUMENT REQUIREMENT LOCKING                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Period Active (is_finalized = false)                           │
│       ↓                                                         │
│  [Admin BISA CRUD tipe dokumen]                                 │
│       ↓                                                         │
│  Period Finalized (is_finalized = true)                         │
│       ↓                                                         │
│  [Admin TIDAK BISA CRUD - Fix #4]                               │
│       ↓                                                         │
│  Period Reopened (is_finalized = false)                         │
│       ↓                                                         │
│  [Admin BISA CRUD lagi - auto unlock]                           │
│                                                                 │
│  Note: Mahasiswa tetap bisa upload dokumen kapan saja            │
│        (sesuai workflow unlock rules)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File yang Diubah (Total 4 File)

1. `backend/app/Services/SchedulingService.php` - Fix #1
2. `backend/app/Http/Controllers/DocumentController.php` - Fix #2  
3. `backend/app/Http/Controllers/PeerReviewController.php` - Fix #3
4. `backend/app/Http/Controllers/Admin/PhaseDocumentRequirementController.php` - Fix #4

---

## Acceptance Criteria

### State Transitions:
- [ ] Setelah SEMPRO PASS, group otomatis ke PDC2_ACTIVE
- [ ] PDC2 dokumen approve + TA draft → PDC2_READY_FOR_EXPO
- [ ] Setelah peer review semua member selesai → PDC2_COMPLETED
- [ ] Tidak ada error state transition

### Document Requirement Locking:
- [ ] Admin tidak bisa tambah requirement jika period finalized
- [ ] Admin tidak bisa edit requirement jika period finalized
- [ ] Admin tidak bisa hapus requirement jika period finalized
- [ ] Admin tidak bisa bulk update jika period finalized
- [ ] Locking otomatis hilang saat period reopened
- [ ] Mahasiswa tetap bisa upload dokumen (tidak ter-lock)

---

Status: **READY TO IMPLEMENT**
