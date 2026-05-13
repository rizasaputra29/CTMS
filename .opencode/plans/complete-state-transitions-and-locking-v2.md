# Plan Update: TA_IN_PROGRESS State & Individual TA Scheduling

## Update Informasi dari User

User mengkonfirmasi:
1. **State tambahan**: `TA_IN_PROGRESS` setelah `PDC2_COMPLETED`
2. **Sub-state tracking**: Ada progress tracking per member
3. **Transisi ke CLOSED**: Hanya setelah semua member `TA_DEFENDED`
4. **Concern baru**: Scheduling Ujian TA per member (individual), bukan per grup

---

## Flow Lengkap yang Benar (Updated)

### Group Level States:
```
PDC2_COMPLETED (semua member selesai peer review)
    ↓
TA_IN_PROGRESS (sub-state tracking progress)
    ↓
CLOSED (ketika semua member TA_DEFENDED)
```

### Individual Level States (per member):
```
TA_BLOCKED → TA_ACTIVE → TA_DEFENDED
```

---

## Update Fix #3 (Revised)

### Fix #3: Peer Review → PDC2_COMPLETED → TA_IN_PROGRESS
**File**: `backend/app/Http/Controllers/PeerReviewController.php`  
**Method**: `checkAndUpdateCompletionStatus()`  
**Line**: ~255-259

**Revised Solution:**
```php
if ($hasCompleted) {
    $status->update([
        'has_completed_peer_review' => true,
        'peer_review_completed_at' => now(),
        'ta_status' => 'TA_ACTIVE', // Individual state
    ]);
    
    // Check group completion and transition to PDC2_COMPLETED
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
            // Step 1: Transition to PDC2_COMPLETED
            $stateMachine->transition($group, 'PDC2_COMPLETED');
            
            // Step 2: Auto-transition to TA_IN_PROGRESS
            $stateMachine->transition($group, 'TA_IN_PROGRESS');
        } catch (\Exception $e) {
            Log::info("Could not transition group {$groupId}: " . $e->getMessage());
        }
    }
}
```

---

## Fix Baru: TA_IN_PROGRESS → CLOSED (Auto Transition)

### Fix #5: Auto Transition to CLOSED
**File**: `backend/app/Http/Controllers/TaSubmissionController.php` (atau controller yang handle TA defense completion)
**Method**: (perlu dicek method yang handle TA defense completion)

**Expected Logic:**
```php
// Saat mahasiswa menyelesaikan TA defense (status jadi TA_DEFENDED)
// Check apakah semua member grup sudah TA_DEFENDED

private function checkAllMembersTaDefended(int $groupId): void
{
    $group = Group::with(['members' => function($query) {
        $query->with('studentPeerReviewStatus');
    }])->find($groupId);
    
    if (!$group) return;
    
    $totalMembers = $group->members()->count();
    $defendedCount = $group->members()
        ->whereHas('studentPeerReviewStatus', function($q) {
            $q->where('ta_status', 'TA_DEFENDED');
        })
        ->count();
    
    if ($defendedCount === $totalMembers && $group->status === 'TA_IN_PROGRESS') {
        $stateMachine = new \App\Services\GroupStateMachine();
        try {
            $stateMachine->transition($group, 'CLOSED');
        } catch (\Exception $e) {
            Log::info("Could not close group {$groupId}: " . $e->getMessage());
        }
    }
}
```

---

## Concern: Scheduling Ujian TA Individual

### Problem:
Saat ini scheduling (SEMPRO, EXPO) dilakukan **per group** melalui `SemproController` dan `ExpoController`.

Tapi Ujian TA adalah **per individual member**.

### Solusi yang Diusulkan:

#### Option A: Individual Scheduling Controller (Direkomendasikan)
Buat controller baru untuk scheduling TA individual:

**File**: `backend/app/Http/Controllers/TaDefenseController.php`

```php
class TaDefenseController extends Controller
{
    // Schedule TA defense untuk 1 member
    public function schedule(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'student_id' => 'required|exists:users,id', // Member yang di-schedule
            'scheduled_at' => 'required|date',
            'examiner_ids' => 'required|array|min:2', // Minimal 2 examiner
            'examiner_ids.*' => 'exists:users,id',
        ]);
        
        // Cek group status harus TA_IN_PROGRESS
        $group = Group::find($request->group_id);
        if ($group->status !== 'TA_IN_PROGRESS') {
            return response()->json(['message' => 'Group not in TA_IN_PROGRESS state'], 400);
        }
        
        // Cek student adalah member grup
        $isMember = $group->members()->where('student_id', $request->student_id)->exists();
        if (!$isMember) {
            return response()->json(['message' => 'Student is not a member of this group'], 400);
        }
        
        // Cek student sudah TA_ACTIVE (selesai peer review)
        $peerReviewStatus = StudentPeerReviewStatus::where('group_id', $request->group_id)
            ->where('student_id', $request->student_id)
            ->first();
            
        if (!$peerReviewStatus || $peerReviewStatus->ta_status !== 'TA_ACTIVE') {
            return response()->json(['message' => 'Student not eligible for TA defense'], 400);
        }
        
        // Create TA defense schedule
        $taDefense = TaDefenseSchedule::create([
            'group_id' => $request->group_id,
            'student_id' => $request->student_id,
            'scheduled_at' => $request->scheduled_at,
            'status' => 'SCHEDULED',
        ]);
        
        // Attach examiners
        $taDefense->examiners()->attach($request->examiner_ids);
        
        return response()->json([
            'message' => 'TA defense scheduled successfully',
            'ta_defense' => $taDefense->load('examiners')
        ]);
    }
    
    // Evaluate TA defense
    public function evaluate(Request $request, $id)
    {
        $taDefense = TaDefenseSchedule::with('examiners')->findOrFail($id);
        
        $request->validate([
            'result' => 'required|in:PASS,FAIL',
            'scores' => 'required|array',
            'notes' => 'nullable|string',
        ]);
        
        // Update TA defense result
        $taDefense->update([
            'result' => $request->result,
            'notes' => $request->notes,
            'status' => 'COMPLETED',
            'completed_at' => now(),
        ]);
        
        // Update individual student status
        $peerReviewStatus = StudentPeerReviewStatus::where('group_id', $taDefense->group_id)
            ->where('student_id', $taDefense->student_id)
            ->first();
            
        if ($request->result === 'PASS') {
            $peerReviewStatus->update(['ta_status' => 'TA_DEFENDED']);
            
            // Check if all members defended
            $this->checkAllMembersTaDefended($taDefense->group_id);
        }
        
        return response()->json([
            'message' => 'TA defense evaluated',
            'ta_defense' => $taDefense->fresh()
        ]);
    }
}
```

**Routes** (di `api.php`):
```php
// TA Defense Scheduling (Admin)
Route::post('/ta-defense/schedule', [TaDefenseController::class, 'schedule']);
Route::get('/ta-defense', [TaDefenseController::class, 'index']);
Route::get('/ta-defense/group/{groupId}', [TaDefenseController::class, 'byGroup']);
Route::get('/ta-defense/student/{studentId}', [TaDefenseController::class, 'byStudent']);
Route::post('/ta-defense/{id}/evaluate', [TaDefenseController::class, 'evaluate']);
```

#### Option B: Extend Existing SchedulingService
Modifikasi `SchedulingService.php` untuk support scheduling individual:

**Pros**: Konsisten dengan SEMPRO/EXPO
**Cons**: Kompleksitas tinggi, perlu refactor besar

---

## State Diagram Final (Updated)

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
│       ↓ (auto-unlock peer review)                               │
│  PEER_REVIEW_ACTIVE (per individu)                              │
│       ↓ (semua member selesai - Fix #3 REVISED)                 │
│  PDC2_COMPLETED                                                 │
│       ↓ (AUTO - Fix #3 REVISED)                                 │
│  TA_IN_PROGRESS                                                 │
│       ↓ (semua member TA defended - Fix #5)                     │
│  CLOSED                                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              INDIVIDUAL MEMBER STATE FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TA_BLOCKED                                                     │
│       ↓ (group reach EXPO_DONE)                                 │
│  TA_ACTIVE                                                      │
│       ↓ (selesai peer review)                                   │
│  [TA defense scheduled - per individual]                        │
│       ↓ (TA defense completed)                                    │
│  TA_DEFENDED                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary: 5 Fix Total

| # | Fix | File | Deskripsi |
|---|-----|------|-----------|
| 1 | SEMPRO_DONE → PDC2_ACTIVE | SchedulingService.php | Auto-transition setelah SEMPRO PASS |
| 2 | PDC2 + TA Draft → PDC2_READY_FOR_EXPO | DocumentController.php | Cek TA draft sebelum transisi |
| 3 | Peer Review → TA_IN_PROGRESS | PeerReviewController.php | Auto-transition dengan sub-state |
| 4 | Document Requirement Locking | PhaseDocumentRequirementController.php | Lock admin CRUD saat finalized |
| 5 | TA_IN_PROGRESS → CLOSED | TaDefenseController.php (NEW) | Auto-transition setelah semua defended |

**Plus**: Controller baru untuk TA individual scheduling

---

## Pertanyaan Final untuk User:

### 1. **TA Defense Scheduling - Pilihan Implementasi:**
- **A.** Buat controller baru `TaDefenseController.php` (Recommended)
- **B.** Extend `SchedulingService.php` yang existing

### 2. **Apakah sudah ada tabel/model untuk TA defense schedule?**  
- Saya perlu cek apakah `TaDefenseSchedule` model sudah ada atau perlu dibuat

### 3. **Apakah 5 fix ini sudah lengkap?**  
- Atau ada concern lain yang perlu ditambahkan?

---

Status: **PLAN UPDATED - Waiting for final confirmation**
