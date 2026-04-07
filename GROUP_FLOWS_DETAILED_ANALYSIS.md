# DETAILED GROUP CREATION FLOWS ANALYSIS

## Overview
The CTMS system has TWO distinct group creation flows:
1. **Normal Group Creation** - For creating a standard group with multiple members
2. **Solo Seeker Group Creation** - For students who want to start alone and find members

---

## 1. NORMAL GROUP CREATION FLOW

### Endpoint & Button
- **API Endpoint**: `POST /mahasiswa/group`
- **Frontend Button**: "Create Group" (primary button)
- **Location in Frontend**: `/frontend/src/app/mahasiswa/group/page.tsx` line 455

### Handler Method
- **Controller**: `App\Http\Controllers\GroupController::store()`
- **Lines**: 97-155 in GroupController.php

### Creation Process

```
POST /mahasiswa/group
├── Validate user is authenticated (mahasiswa role)
├── Resolve period (from request or auto-detect active/non-finalized)
├── Check student NOT already in a group for this period
├── Create Group with:
│   ├── title_id: null
│   ├── period_id: {resolved_period_id}
│   ├── status: "FORMING"                    ← INITIAL STATUS
│   ├── group_mode: "GROUP" (or request value)
│   ├── has_existing_group: false (or request value)
│   └── is_solo: false (or unset - defaults to false)
├── Create GroupMember entry:
│   ├── group_id: {new_group_id}
│   ├── student_id: {current_user_id}
│   ├── is_leader: true
│   └── period_id: {resolved_period_id}
└── Call evaluateGroupReadiness($group) - attempt auto-transition
```

### Initial Status & Members
- **Database Status**: `FORMING`
- **Starting Members**: 1 (the creator, who is the leader)
- **Display Label**: "Incomplete Group" (from getStatusLabel() line 495 in page.tsx)

### Status Transitions as Members are Added

The status is determined by the `Group::determineStatus()` method (lines 129-171 in Group.php):

```
Member Count → Database Status → Display Label
──────────────────────────────────────────────
1 member     → FORMING        → "Incomplete Group"
2 members    → FORMING        → "Incomplete Group"
3+ members   → READY_FOR_BIDDING → "Ready for Bidding"
             (assuming min_group_size = 3)
```

The transitions happen **automatically** through `evaluateGroupReadiness()` in GroupService.php:
- When 2nd member joins: Status remains `FORMING`
- When 3rd member joins: Status transitions to `READY_FOR_BIDDING`

### Key Code Path for Status Determination
```php
// GroupService.php line 337-352
public function evaluateGroupReadiness(Group $group): void
{
    if ($this->canBecomeReady($group)) {
        $this->transitionToReady($group);  // → READY_FOR_BIDDING
    } else {
        // Revert if members drop below minimum
        $revertStatus = ($memberCount === 1 && $group->group_mode !== 'INDIVIDUAL') 
            ? self::STATUS_FORMING_SOLO 
            : self::STATUS_FORMING;
        $group->update(['status' => $revertStatus]);
    }
}
```

### Display Logic (Frontend)
```javascript
// page.tsx lines 492-499
const getStatusLabel = (status: string) => {
    switch (status) {
        case 'READY_FOR_BIDDING': 
            return hasTitle ? 'Ready for Finalization' : 'Ready for Bidding';
        case 'FORMING': 
            return 'Incomplete Group';  // ← Normal group with 1-2 members
        case 'FORMING_SOLO': 
            return 'Solo Seeker';       // ← Solo seeker group
        default: 
            return status;
    }
};
```

---

## 2. SOLO SEEKER GROUP CREATION FLOW

### Endpoint & Button
- **API Endpoint**: `POST /mahasiswa/group/store-solo`
- **Frontend Button**: "Solo Seeker (Idea Magnet)" (secondary button)
- **Location in Frontend**: `/frontend/src/app/mahasiswa/group/page.tsx` line 459

### Handler Method
- **Controller**: `App\Http\Controllers\GroupController::storeSolo()`
- **Lines**: 160-215 in GroupController.php

### Creation Process

```
POST /mahasiswa/group/store-solo
├── Validate user is authenticated (mahasiswa role)
├── Resolve period (from request or auto-detect active/non-finalized)
├── Check student NOT already in a group for this period
├── Create Group with:
│   ├── title_id: null
│   ├── period_id: {resolved_period_id}
│   ├── status: "FORMING_SOLO"              ← INITIAL STATUS (KEY DIFFERENCE!)
│   ├── group_mode: "GROUP"                 ← Always "GROUP"
│   ├── has_existing_group: false           ← Always false
│   └── is_solo: true                       ← KEY FLAG (distinguishes from normal)
├── Create GroupMember entry:
│   ├── group_id: {new_group_id}
│   ├── student_id: {current_user_id}
│   ├── is_leader: true
│   └── period_id: {resolved_period_id}
└── Do NOT call evaluateGroupReadiness() - stays as FORMING_SOLO
```

### Initial Status & Members
- **Database Status**: `FORMING_SOLO` (NOT FORMING!)
- **Starting Members**: 1 (the creator/seeker, who is the leader)
- **is_solo Flag**: `true`
- **Display Label**: "Solo Seeker" (from getStatusLabel() line 496 in page.tsx)

### Member Addition & Status Transitions

**IMPORTANT**: Solo seeker groups have a SPECIAL transition mechanism:

```
Member Count in Solo Seeker → Database Status → Display Label
──────────────────────────────────────────────────────────────
1 member                    → FORMING_SOLO   → "Solo Seeker"
2+ members                  → FORMING_SOLO   → "Solo Seeker" (stays!)
```

**Why?** The `determineStatus()` method has special handling (lines 159-166):

```php
// Group.php lines 159-166
// Special case: solo seeker with allow_solo enabled
if ($memberCount === 1 && $allowSolo && $this->is_solo) {
    return 'READY_FOR_BIDDING';  // Can skip to bidding if period allows
}

// If group has exactly 1 member (solo seeker), return FORMING_SOLO
if ($memberCount === 1) {
    return 'FORMING_SOLO';  // ← Default: stays FORMING_SOLO
}
```

### Key Differences: Normal vs Solo Seeker

| Feature | Normal Group | Solo Seeker |
|---------|--------------|-------------|
| **Initial Status** | `FORMING` | `FORMING_SOLO` |
| **is_solo Flag** | false | true |
| **Can propose title immediately?** | No, needs min members | YES (immediately!) |
| **Display Label** | "Incomplete Group" | "Solo Seeker" |
| **Status when 3+ members?** | `READY_FOR_BIDDING` | `FORMING_SOLO` (stays) |
| **Member addition** | Auto-transitions to READY | No auto-transition |

### Solo Seeker Special Rules (from page.tsx)

```javascript
// Lines 671-686 - Bidding card HIDDEN for solo seekers
if (myGroup.status !== 'FORMING_SOLO') {
    <Card>Bid for a Title</Card>  // Hidden for FORMING_SOLO
}

// Lines 693-704 - Proposal allowed for solo seekers immediately
{myGroup.status === 'FORMING_SOLO' 
    ? "Ajukan judul tugas akhir Anda sendiri..." 
    : "Submit your own title idea..."}

// Can propose WITHOUT needing min members!
disabled={!hasEnoughMembers && myGroup.status !== 'FORMING_SOLO'}
```

---

## 3. MEMBER ADDITION LOGIC & STATUS TRANSITIONS

### How Members Join

**For Normal Groups:**
```
1. Leader invites via addMember() → GroupInvitation created
2. Student accepts via acceptInvite() → handleJoinGroup() called
3. handleJoinGroup() adds member + calls evaluateGroupReadiness()
4. determineStatus() recalculates status based on NEW member count
```

**For Solo Seeker Groups:**
```
1. Student sees the solo seeker's title in marketplace
2. Student clicks "Join Request"
3. Solo leader accepts request → handleJoinGroup() called
4. evaluateGroupReadiness() called BUT:
   - If period.allow_solo = true: → READY_FOR_BIDDING
   - Otherwise: → Stays FORMING_SOLO
```

### Detailed Status Timeline: Normal Group

```
Step 1: Create Group
├── POST /mahasiswa/group
├── Status: FORMING, Members: 1
└── Display: "Incomplete Group"

Step 2: Add 2nd Member
├── Leader sends invite via addMember()
├── Student accepts invite
├── evaluateGroupReadiness() called
├── canBecomeReady() checks: member_count (2) < min_group_size (3)
├── Status stays: FORMING
└── Display: "Incomplete Group"

Step 3: Add 3rd Member (minimum reached!)
├── Leader sends invite via addMember()
├── Student accepts invite
├── evaluateGroupReadiness() called
├── canBecomeReady() checks: member_count (3) >= min_group_size (3) ✓
├── transitionToReady() called
├── stateMachine->transition($group, 'READY_FOR_BIDDING')
├── Status changes: FORMING → READY_FOR_BIDDING
└── Display: "Ready for Bidding" (or "Ready for Finalization" if has_title)

Step 4: Add 4th Member (if max_group_size = 4)
├── Third invite sent
├── canBecomeReady() already true (no change needed)
├── Status stays: READY_FOR_BIDDING
└── Display: "Ready for Bidding"
```

### Detailed Status Timeline: Solo Seeker Group

```
Step 1: Create Solo Group
├── POST /mahasiswa/group/store-solo
├── Status: FORMING_SOLO, Members: 1
├── is_solo: true
└── Display: "Solo Seeker"

Step 2: Propose Title (immediately!)
├── Solo leader can propose WITHOUT needing 3 members
├── Title created with supervisor_approval_status: PENDING
├── Group status stays: FORMING_SOLO
└── Display: "Solo Seeker"

Step 3: Title Approved by Supervisor
├── Supervisor approves the proposal
├── Title status: APPROVED
├── Group status: TITLE_APPROVED (or stays FORMING_SOLO - depends on logic)
└── Display: "Solo Seeker" or updated label

Step 4: Other Students Join (Request Join)
├── Student finds solo seeker's title in marketplace
├── Student clicks "Join Request"
├── Solo leader accepts
├── evaluateGroupReadiness() called
├── Behavior depends on period.allow_solo flag:
│   ├── If allow_solo = true AND is_solo = true:
│   │   └── Status → READY_FOR_BIDDING (auto-transition!)
│   └── Otherwise:
│       └── Status → Stays FORMING_SOLO
└── Display: "Ready for Bidding" or "Solo Seeker"
```

---

## 4. COMPLETE STATUS → DISPLAY LABEL MAPPING TABLE

### Database Status Mappings

| Database Status | Display Label | Applies To | Member Count | Conditions |
|-----------------|--------------|-----------|--------------|------------|
| `FORMING` | "Incomplete Group" | Normal Groups | 1-2 members | members < min_group_size |
| `FORMING_SOLO` | "Solo Seeker" | Solo Seeker Groups | 1+ members | is_solo = true OR membership = 1 |
| `READY_FOR_BIDDING` | "Ready for Bidding" | Both | 3+ members (normal) | members >= min_group_size AND !has_title |
| `READY_FOR_BIDDING` | "Ready for Finalization" | Both | 3+ members | members >= min_group_size AND has_title |
| `TITLE_APPROVED` | (auto-determined) | Solo Seekers | 1+ members | Proposal approved by supervisor |
| `READY_FOR_FINALIZATION` | (status dependent) | Both | >= min | Leader clicked "Siap Finalisasi" |
| `KELOMPOK_FINAL` | (post-finalization) | Both | >= min | Admin finalized |

### Frontend Logic (page.tsx lines 492-499)

```javascript
const getStatusLabel = (status: string) => {
    switch (status) {
        case 'READY_FOR_BIDDING': 
            return hasTitle ? 'Ready for Finalization' : 'Ready for Bidding';
        case 'FORMING': 
            return 'Incomplete Group';
        case 'FORMING_SOLO': 
            return 'Solo Seeker';
        default: 
            return status;  // For other statuses, return as-is
    }
};
```

---

## 5. CRITICAL IMPLEMENTATION DETAILS

### evaluateGroupReadiness() Logic
**File**: GroupService.php, lines 337-352

```php
public function evaluateGroupReadiness(Group $group): void
{
    // Guard: Skip if already finalized or dissolved
    if ($this->stateMachine->isAtLeast($group, self::STATUS_KELOMPOK_FINAL) 
        || $group->status === self::STATUS_DISSOLVED) {
        return;
    }

    if ($this->canBecomeReady($group)) {
        $this->transitionToReady($group);  // → READY_FOR_BIDDING
    } else {
        // Revert to appropriate status if members drop below minimum
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        $revertStatus = ($memberCount === 1 && $group->group_mode !== 'INDIVIDUAL') 
            ? self::STATUS_FORMING_SOLO 
            : self::STATUS_FORMING;
        $group->update(['status' => $revertStatus]);
    }
}
```

### determineStatus() Logic
**File**: Group.php, lines 129-171

```php
public function determineStatus(): string
{
    // Skip if already finalized
    if (in_array($this->status, [
        'TITLE_APPROVED', 'KELOMPOK_FINAL', 'PDC1_ACTIVE', ...
    ])) {
        return $this->status;
    }

    $memberCount = $this->members()->count();
    $minSize = $this->period->min_group_size ?? 3;
    $allowSolo = $this->period->allow_solo ?? false;

    // Case 1: Enough members → READY_FOR_BIDDING
    if ($memberCount >= $minSize) {
        return 'READY_FOR_BIDDING';
    }

    // Case 2: Solo seeker with permission to proceed alone
    if ($memberCount === 1 && $allowSolo && $this->is_solo) {
        return 'READY_FOR_BIDDING';
    }

    // Case 3: Exactly 1 member (default solo seeker status)
    if ($memberCount === 1) {
        return 'FORMING_SOLO';
    }

    // Case 4: 2 members but less than min (still forming)
    return 'FORMING';
}
```

### State Machine Transitions
**File**: GroupStateMachine.php, lines 18-67

```php
const TRANSITIONS = [
    'FORMING' => [
        'READY_FOR_BIDDING',           // via members reaching min
        'WAITING_SUPERVISOR_APPROVAL', // student proposal
        'DISSOLVED',
    ],
    'READY_FOR_BIDDING' => [
        'FORMING',                      // via member count drop
        'WAITING_SUPERVISOR_APPROVAL',  // submit proposal
        'READY_FOR_FINALIZATION',       // leader marks ready
        'DISSOLVED',
    ],
    // ... more transitions
];
```

---

## 6. ROUTES & ENDPOINTS SUMMARY

### Student Group Management Endpoints
```
POST   /mahasiswa/group                          → Create normal group (store)
POST   /mahasiswa/group/store-solo              → Create solo seeker group (storeSolo)
GET    /mahasiswa/group                          → Get current group (index)
DELETE /mahasiswa/group                          → Delete/disband group (deleteGroup)
POST   /mahasiswa/group/leave                    → Leave group as non-leader (leaveGroup)
POST   /mahasiswa/group/add-member               → Invite member (addMember)
DELETE /mahasiswa/group/members/{memberId}      → Remove member (removeMember)
POST   /mahasiswa/group/mark-ready-for-finalization    → Mark ready (markReadyForFinalization)
POST   /mahasiswa/group/cancel-ready-for-finalization  → Cancel ready (cancelReadyForFinalization)
```

---

## 7. SUMMARY TABLE: THE KEY DIFFERENCES

| Aspect | Normal Group | Solo Seeker Group |
|--------|-------------|-----------------|
| **Endpoint** | `POST /mahasiswa/group` | `POST /mahasiswa/group/store-solo` |
| **Initial Status** | `FORMING` | `FORMING_SOLO` |
| **Initial Members** | 1 (leader) | 1 (leader/seeker) |
| **is_solo Flag** | false | true |
| **Can Propose Immediately?** | NO (need 3 members) | YES (1 member OK) |
| **Display Label (1 member)** | "Incomplete Group" | "Solo Seeker" |
| **Transition on 3rd Member** | FORMING → READY_FOR_BIDDING | FORMING_SOLO → stays FORMING_SOLO |
| **Bidding Visible?** | YES (when 3+ members) | NO (unless status changes) |
| **Join Mechanism** | Invite by leader | Join request for title |
| **Member Cap** | max_group_size (4) | max_group_size (4) |

