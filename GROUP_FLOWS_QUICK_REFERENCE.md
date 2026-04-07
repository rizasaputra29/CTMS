# QUICK REFERENCE: GROUP CREATION FLOWS

## At-a-Glance Comparison

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NORMAL GROUP CREATION                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Endpoint:      POST /mahasiswa/group                                    │
│ Button:        "Create Group"                                           │
│ Initial Status: FORMING                                                 │
│ is_solo:       false                                                    │
│ Min Members:   3 (before READY_FOR_BIDDING)                            │
│                                                                         │
│ Status Flow:                                                            │
│   1 member → FORMING ("Incomplete Group")                              │
│   2 members → FORMING ("Incomplete Group")                             │
│   3+ members → READY_FOR_BIDDING ("Ready for Bidding")                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      SOLO SEEKER GROUP CREATION                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Endpoint:      POST /mahasiswa/group/store-solo                        │
│ Button:        "Solo Seeker (Idea Magnet)"                            │
│ Initial Status: FORMING_SOLO                                           │
│ is_solo:       true                                                    │
│ Min Members:   1 (can propose immediately!)                            │
│                                                                         │
│ Status Flow:                                                            │
│   1 member → FORMING_SOLO ("Solo Seeker")                             │
│   2+ members → FORMING_SOLO ("Solo Seeker")     ← STAYS SAME!         │
│                                                                         │
│ Special Ability: Can propose title WITHOUT 3 members                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Decision Tree: Which Status?

```
START: New group created

    ↓
    
Is is_solo = true?
    │
    ├─ YES → Status = FORMING_SOLO 
    │        Display = "Solo Seeker"
    │
    └─ NO → Status = FORMING
             Display = "Incomplete Group"
             
    (For FORMING groups)
    Members >= 3?
        │
        ├─ YES → Transition to READY_FOR_BIDDING
        │        Display = "Ready for Bidding" (or "Ready for Finalization" if has title)
        │
        └─ NO → Stay FORMING
                Display = "Incomplete Group"
```

---

## Member Addition Scenarios

### Normal Group Example (min_group_size = 3)

```
Step 1: Create Group
POST /mahasiswa/group
├─ Group ID: 1
├─ Status: FORMING ✓
├─ Members: 1 (Alice - leader)
└─ Display: "Incomplete Group"

    ↓ Leader invites Bob

Step 2: Bob Accepts Invite
POST /mahasiswa/group-invitations/{id}/accept
├─ evaluateGroupReadiness() called
├─ member_count = 2 < min_group_size (3)
├─ Status: FORMING (no change)
├─ Members: 2 (Alice, Bob)
└─ Display: "Incomplete Group"

    ↓ Leader invites Carol

Step 3: Carol Accepts Invite
POST /mahasiswa/group-invitations/{id}/accept
├─ evaluateGroupReadiness() called
├─ member_count = 3 >= min_group_size (3) ✓
├─ canBecomeReady() = true → TRANSITION
├─ Status: FORMING → READY_FOR_BIDDING
├─ Members: 3 (Alice, Bob, Carol)
└─ Display: "Ready for Bidding"

    ↓ Leader invites David

Step 4: David Accepts Invite (Group Full)
POST /mahasiswa/group-invitations/{id}/accept
├─ evaluateGroupReadiness() called
├─ member_count = 4 (already ready)
├─ Status: READY_FOR_BIDDING (no change)
├─ Members: 4 (Alice, Bob, Carol, David)
└─ Display: "Ready for Bidding"
```

### Solo Seeker Example

```
Step 1: Create Solo Group
POST /mahasiswa/group/store-solo
├─ Group ID: 2
├─ Status: FORMING_SOLO ✓
├─ Members: 1 (Eve - seeker)
├─ is_solo: true
└─ Display: "Solo Seeker"

    ↓ Solo seeker proposes title

Step 2: Propose Title
POST /mahasiswa/propose-title
├─ Title created
├─ supervisor_approval_status: PENDING
├─ Group status: FORMING_SOLO (stays)
└─ Display: "Solo Seeker"

    ↓ Supervisor approves proposal

Step 3: Title Approved
(Backend: Supervisor clicks approve)
├─ Title status: APPROVED
├─ Group: FORMING_SOLO or TITLE_APPROVED
└─ Display: "Solo Seeker" (still alone)

    ↓ Frank finds the title and requests to join

Step 4: Frank Requests to Join
POST /mahasiswa/bursa-ide/{groupId}/request-join
├─ JoinRequest created
├─ Status: PENDING
├─ Solo leader sees notification
└─ Waiting for solo leader to accept

    ↓ Solo leader accepts Frank's request

Step 5: Frank Joins (2 members now)
POST /mahasiswa/join-requests/{id}/accept
├─ evaluateGroupReadiness() called
├─ member_count = 2
├─ Behavior:
│   ├─ If period.allow_solo = true:
│   │  └─ Status: FORMING_SOLO → READY_FOR_BIDDING
│   │     Display: "Ready for Bidding"
│   └─ If period.allow_solo = false:
│      └─ Status: FORMING_SOLO (stays)
│         Display: "Solo Seeker"
├─ Members: 2 (Eve, Frank)
└─ (Depends on period configuration)
```

---

## Code Snippets: Key Logic

### Frontend Display Logic
```javascript
// Location: /frontend/src/app/mahasiswa/group/page.tsx (lines 492-499)

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'READY_FOR_BIDDING': 
            return hasTitle ? 'Ready for Finalization' : 'Ready for Bidding';
        case 'FORMING': 
            return 'Incomplete Group';
        case 'FORMING_SOLO': 
            return 'Solo Seeker';
        default: 
            return status;
    }
};
```

### Backend Readiness Check
```php
// Location: /backend/app/Services/GroupService.php (lines 337-352)

public function evaluateGroupReadiness(Group $group): void
{
    if ($this->canBecomeReady($group)) {
        $this->transitionToReady($group);  // → READY_FOR_BIDDING
    } else {
        // Revert if members drop below minimum
        $memberCount = GroupMember::where('group_id', $group->id)->count();
        $revertStatus = ($memberCount === 1 && $group->group_mode !== 'INDIVIDUAL') 
            ? 'FORMING_SOLO' 
            : 'FORMING';
        $group->update(['status' => $revertStatus]);
    }
}
```

### Status Determination
```php
// Location: /backend/app/Models/Group.php (lines 129-171)

public function determineStatus(): string
{
    $memberCount = $this->members()->count();
    
    if ($memberCount >= $minSize) {
        return 'READY_FOR_BIDDING';
    }
    
    if ($memberCount === 1 && $allowSolo && $this->is_solo) {
        return 'READY_FOR_BIDDING';  // Solo with permission
    }
    
    if ($memberCount === 1) {
        return 'FORMING_SOLO';  // Default single member
    }
    
    return 'FORMING';  // 2 members, not enough
}
```

---

## Transition Rules (State Machine)

```
FORMING
├─ Can transition to: READY_FOR_BIDDING (when members reach min)
│                     WAITING_SUPERVISOR_APPROVAL (when proposing)
│                     DISSOLVED (when deleted)
└─ Automatic reversal from: READY_FOR_BIDDING (if members drop)

FORMING_SOLO
├─ Can transition to: (depends on period.allow_solo)
│                     READY_FOR_BIDDING (if allow_solo = true)
│                     TITLE_APPROVED (when proposal approved)
│                     DISSOLVED (when deleted)
└─ Auto-transition: NO (stays FORMING_SOLO unless explicit action)

READY_FOR_BIDDING
├─ Can transition to: FORMING (if members drop below min)
│                     WAITING_SUPERVISOR_APPROVAL (when proposing)
│                     READY_FOR_FINALIZATION (leader marks ready)
│                     DISSOLVED (when deleted)
└─ Triggered by: Reaching minimum members OR period.allow_solo = true

READY_FOR_FINALIZATION
├─ Can transition to: KELOMPOK_FINAL (when admin finalizes)
│                     READY_FOR_BIDDING (when leader cancels)
│                     DISSOLVED (when deleted)
└─ Triggered by: Leader clicks "Siap Finalisasi" button
```

---

## Common Issues & Solutions

### Issue 1: Group Created but Status Shows "FORMING" instead of "READY_FOR_BIDDING"
**Reason:** Likely normal group with < 3 members, or FORMING_SOLO status
**Solution:** 
- Check if `is_solo = true` → It's a solo seeker group
- Check member count → Add more members to reach min_group_size

### Issue 2: Solo Seeker Can't Propose Without Members
**Reason:** Not in FORMING_SOLO status
**Solution:**
- Verify creation endpoint was `/mahasiswa/group/store-solo`
- Check database that `is_solo = true` and `status = FORMING_SOLO`

### Issue 3: Display Shows "Incomplete Group" for Solo Seeker
**Reason:** Status is FORMING instead of FORMING_SOLO
**Cause:** Used `/mahasiswa/group` instead of `/mahasiswa/group/store-solo`
**Solution:** Check the creation endpoint and is_solo flag

### Issue 4: Members Added but Status Won't Change to READY_FOR_BIDDING
**Reason:** 
- evaluateGroupReadiness() was never called, OR
- period.min_group_size is higher than expected, OR
- A blocking condition in canBecomeReady() is preventing transition
**Solution:**
- Verify evaluateGroupReadiness() is called after member join
- Check period.min_group_size setting
- Check Group::getReadinessIssues() for blocking issues

---

## Testing Checklist

### For Normal Group Creation
- [ ] Create group → Status is FORMING ✓
- [ ] Add 2nd member → Status stays FORMING ✓
- [ ] Add 3rd member → Status becomes READY_FOR_BIDDING ✓
- [ ] Remove member → Status reverts to FORMING ✓
- [ ] Display label updates correctly ✓

### For Solo Seeker Group Creation
- [ ] Create solo group → Status is FORMING_SOLO ✓
- [ ] is_solo flag is true ✓
- [ ] Can propose title immediately (1 member) ✓
- [ ] Add 2nd member → Status stays FORMING_SOLO (unless allow_solo=true) ✓
- [ ] "Bid for Title" card is hidden ✓
- [ ] "Propose Your Own Title" is always available ✓

