# GROUP STATUS → DISPLAY LABEL MAPPING (COMPLETE TABLE)

## The Correct Mapping

### Normal Group with 1 Member

| Database Status | Display Label | Rationale | Transitions |
|-----------------|-------------|-----------|------------|
| `FORMING` | **"Incomplete Group"** | Group created but less than min members (3) | Can add members → READY_FOR_BIDDING |

### Normal Group with 2 Members

| Database Status | Display Label | Rationale | Transitions |
|-----------------|-------------|-----------|------------|
| `FORMING` | **"Incomplete Group"** | Still less than min members (3) | Can add members → READY_FOR_BIDDING |

### Normal Group with 3+ Members (Minimum Reached)

| Database Status | Display Label | Rationale | Conditions |
|-----------------|-------------|-----------|------------|
| `READY_FOR_BIDDING` | **"Ready for Bidding"** | Group ready to bid/propose, NO title assigned | `has_title = null` |
| `READY_FOR_BIDDING` | **"Ready for Finalization"** | Group ready, HAS title assigned | `has_title != null` |

### Solo Seeker Group with 1 Member

| Database Status | Display Label | Rationale | Conditions | Special Rules |
|-----------------|-------------|-----------|------------|-----------------|
| `FORMING_SOLO` | **"Solo Seeker"** | Solo seeker, can propose immediately | `is_solo = true` | Can propose without 3 members |

### Solo Seeker Group with 2+ Members

| Database Status | Display Label | Rationale | Conditions | Special Rules |
|-----------------|-------------|-----------|------------|-----------------|
| `FORMING_SOLO` | **"Solo Seeker"** | Solo seeker with joined members, status unchanged | `is_solo = true` + members > 1 | Does NOT auto-transition to READY (unless period.allow_solo = true) |
| `READY_FOR_BIDDING` | **"Ready for Bidding"** | Only if period.allow_solo = true AND manual transition | `is_solo = true` + `period.allow_solo = true` | Rare case: period config allows solo bidding |

---

## Key Database Fields That Determine Status

### 1. The `is_solo` Flag
- **In Normal Group**: `is_solo = false` (or NULL)
- **In Solo Seeker Group**: `is_solo = true`
- **Importance**: Critical for distinguishing group type

### 2. The `status` Column
- **Normal Group Initial**: `FORMING`
- **Solo Seeker Initial**: `FORMING_SOLO`
- **Importance**: Source of truth for display logic

### 3. Member Count (via GROUP_MEMBERS table)
- Determines if status CAN transition
- Counted dynamically from: `GroupMember::where('group_id', $group->id)->count()`
- Used in `determineStatus()` method

### 4. The `has_title` (via title_id)
- **If `title_id = null`**: Display "Ready for Bidding" (when READY_FOR_BIDDING)
- **If `title_id != null`**: Display "Ready for Finalization" (when READY_FOR_BIDDING)
- **Only matters**: When status is READY_FOR_BIDDING

---

## Frontend Display Logic (Source of Truth)

### Complete Implementation
**File**: `/frontend/src/app/mahasiswa/group/page.tsx` lines 492-499

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
            return status;  // For other statuses like WAITING_SUPERVISOR_APPROVAL, etc.
    }
};
```

### Frontend Member Color Logic
**File**: `/frontend/src/app/mahasiswa/group/page.tsx` lines 501-506

```javascript
const getMemberCountColor = (): string => {
    const current = myGroup?.members.length || 0;
    if (current >= maxMembers) return 'text-orange-600';  // At max capacity
    if (current < minMembers) return 'text-red-600';      // Below minimum
    return 'text-green-600';                               // Healthy
};
```

---

## State Machine Rules (Backend Validation)

### Valid Transitions
```
FORMING ──→ READY_FOR_BIDDING
         ──→ WAITING_SUPERVISOR_APPROVAL
         ──→ DISSOLVED

FORMING_SOLO ──→ READY_FOR_BIDDING (if period.allow_solo = true)
             ──→ TITLE_APPROVED (when solo proposal approved)
             ──→ DISSOLVED

READY_FOR_BIDDING ──→ FORMING (when members drop below min)
                   ──→ WAITING_SUPERVISOR_APPROVAL
                   ──→ READY_FOR_FINALIZATION (leader marks)
                   ──→ DISSOLVED
```

### Automatic Transitions (via evaluateGroupReadiness)
- **FORMING** → **READY_FOR_BIDDING**: When members >= min_group_size (3)
- **READY_FOR_BIDDING** → **FORMING**: When members drop below min_group_size
- **FORMING_SOLO** → **READY_FOR_BIDDING**: When period.allow_solo = true AND is_solo = true

### Manual/Explicit Transitions
- **READY_FOR_BIDDING** → **READY_FOR_FINALIZATION**: Leader clicks "Siap Finalisasi"
- **READY_FOR_FINALIZATION** → **KELOMPOK_FINAL**: Admin completes finalization
- **READY_FOR_FINALIZATION** → **READY_FOR_BIDDING**: Leader cancels finalization

---

## Database Query to Find Group Status

### Find Current Status of a Group
```sql
SELECT 
    g.id,
    g.status,
    g.is_solo,
    g.title_id,
    COUNT(gm.id) as member_count,
    p.min_group_size,
    p.max_group_size,
    p.allow_solo
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id
LEFT JOIN periods p ON p.id = g.period_id
WHERE g.id = ?
GROUP BY g.id;
```

### Determine Display Label (SQL)
```sql
-- Simplified logic in SQL
SELECT 
    CASE 
        WHEN g.status = 'FORMING_SOLO' THEN 'Solo Seeker'
        WHEN g.status = 'FORMING' THEN 'Incomplete Group'
        WHEN g.status = 'READY_FOR_BIDDING' AND g.title_id IS NOT NULL 
            THEN 'Ready for Finalization'
        WHEN g.status = 'READY_FOR_BIDDING' AND g.title_id IS NULL 
            THEN 'Ready for Bidding'
        ELSE g.status  -- For other statuses
    END as display_label
FROM groups g
WHERE g.id = ?;
```

---

## Typical Progression Examples

### Example 1: Normal Group Reaches Ready Status
```
Timeline: Day 1 - Day 7

DAY 1, 10:00 AM
├─ Alice creates group
├─ Status: FORMING
├─ Members: 1 (Alice)
└─ Display: "Incomplete Group"

DAY 3, 2:30 PM
├─ Alice invites Bob
├─ Bob accepts invite
├─ Status: FORMING (no change, only 2 members)
├─ Members: 2 (Alice, Bob)
└─ Display: "Incomplete Group"

DAY 5, 11:15 AM
├─ Alice invites Carol
├─ Carol accepts invite
├─ Status: FORMING → READY_FOR_BIDDING (automatic!)
├─ Members: 3 (Alice, Bob, Carol)
└─ Display: "Ready for Bidding"

DAY 7, 3:45 PM
├─ Alice proposes a title
├─ Title is approved
├─ Status: READY_FOR_BIDDING (no change)
├─ Members: 3 (Alice, Bob, Carol)
└─ Display: "Ready for Finalization" (now has title!)
```

### Example 2: Solo Seeker Proposes and Recruits
```
Timeline: Day 1 - Day 30

DAY 1, 9:00 AM
├─ Eve creates solo seeker group
├─ Status: FORMING_SOLO
├─ Members: 1 (Eve)
└─ Display: "Solo Seeker"

DAY 3, 1:00 PM
├─ Eve proposes her title (no min members required!)
├─ Title status: PENDING (waiting for supervisor)
├─ Group status: FORMING_SOLO (stays)
└─ Display: "Solo Seeker"

DAY 10, 4:30 PM
├─ Supervisor approves Eve's title
├─ Title status: APPROVED
├─ Group status: FORMING_SOLO (stays) or TITLE_APPROVED
└─ Display: "Solo Seeker" or updates based on status

DAY 15, 10:00 AM
├─ Frank sees Eve's approved title in marketplace
├─ Frank requests to join
├─ Status: pending acceptance by Eve
└─ Eve sees join request notification

DAY 15, 11:30 AM
├─ Eve accepts Frank's join request
├─ Frank joins group
├─ Status: FORMING_SOLO → READY_FOR_BIDDING (if period.allow_solo = true)
│  OR stays FORMING_SOLO (if period.allow_solo = false)
├─ Members: 2 (Eve, Frank)
└─ Display: "Ready for Bidding" OR "Solo Seeker"

DAY 20, 2:00 PM
├─ Grace also requests to join
├─ Eve accepts Grace
├─ Status: (no further change)
├─ Members: 3 (Eve, Frank, Grace)
└─ Display: same as before
```

---

## Summary: The Golden Rules

### Rule 1: Initial Status Determines Everything
- If created via `/mahasiswa/group` → **Status = FORMING, is_solo = false**
- If created via `/mahasiswa/group/store-solo` → **Status = FORMING_SOLO, is_solo = true**

### Rule 2: Display Label Depends on Status
- **FORMING** → "Incomplete Group"
- **FORMING_SOLO** → "Solo Seeker"
- **READY_FOR_BIDDING** without title → "Ready for Bidding"
- **READY_FOR_BIDDING** with title → "Ready for Finalization"

### Rule 3: Status Transitions on Member Count (for Normal Groups)
- 1-2 members: FORMING
- 3+ members: READY_FOR_BIDDING (automatic)
- Drop below 3: Back to FORMING (automatic revert)

### Rule 4: Solo Seeker Status is Sticky
- Stays FORMING_SOLO unless explicitly transitioned
- Can add members without status change
- Only transitions to READY_FOR_BIDDING if period.allow_solo = true

### Rule 5: hasTitle Doesn't Change Status
- hasTitle affects only the DISPLAY LABEL
- Does NOT trigger status transition
- Only matters when status is READY_FOR_BIDDING

