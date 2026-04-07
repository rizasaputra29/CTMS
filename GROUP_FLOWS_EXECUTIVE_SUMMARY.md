# EXECUTIVE SUMMARY: GROUP CREATION FLOWS

## Quick Facts

| Feature | Normal Group | Solo Seeker |
|---------|-------------|-----------|
| **Endpoint** | `POST /mahasiswa/group` | `POST /mahasiswa/group/store-solo` |
| **Button Label** | "Create Group" | "Solo Seeker (Idea Magnet)" |
| **Initial Database Status** | `FORMING` | `FORMING_SOLO` |
| **Initial Display Label** | "Incomplete Group" | "Solo Seeker" |
| **Starting Members** | 1 (leader) | 1 (seeker/leader) |
| **Can Propose Title Immediately?** | NO (need 3 members) | YES (1 member OK) |
| **Status at 3+ Members** | `READY_FOR_BIDDING` | `FORMING_SOLO` (stays!) |
| **Key Database Flag** | `is_solo = false` | `is_solo = true` |

---

## The Correct Status → Display Mapping

### ALWAYS Use This Table

```
Database Status        Display Label              Applies When
─────────────────────────────────────────────────────────────────
FORMING               "Incomplete Group"         Normal group, < 3 members
FORMING_SOLO          "Solo Seeker"             Solo seeker group, any members
READY_FOR_BIDDING     "Ready for Bidding"       >= 3 members, NO title_id
READY_FOR_BIDDING     "Ready for Finalization"  >= 3 members, HAS title_id
```

---

## How Status Changes Work

### For Normal Groups: Automatic Based on Member Count

```
Post Group Creation:
  1 member  → FORMING ("Incomplete Group")
  2 members → FORMING ("Incomplete Group")  
  3 members → READY_FOR_BIDDING ("Ready for Bidding") ← AUTO-TRANSITION!
  
If member leaves:
  2 members → FORMING ("Incomplete Group") ← AUTO-REVERT!
```

### For Solo Seeker Groups: Sticky Status

```
Post Group Creation:
  1 member  → FORMING_SOLO ("Solo Seeker")
  2 members → FORMING_SOLO ("Solo Seeker") ← NO CHANGE!
  3+ members → FORMING_SOLO ("Solo Seeker") ← STAYS THE SAME!
  
Special Case: If period.allow_solo = true:
  With any members → Can transition to READY_FOR_BIDDING
```

---

## Key Files & Locations

### Backend Files
1. **GroupController.php** (line 97-215)
   - `store()` - Normal group creation
   - `storeSolo()` - Solo seeker group creation

2. **Group.php** (line 129-171)
   - `determineStatus()` - Calculates status based on member count

3. **GroupService.php** (line 337-352)
   - `evaluateGroupReadiness()` - Auto-transitions status on member join/leave

4. **GroupStateMachine.php** (line 8-203)
   - State transition rules and validation

### Frontend Files
1. **group/page.tsx** (line 455-862)
   - `handleCreateGroup()` - Create normal group button
   - `handleCreateSoloGroup()` - Create solo seeker button
   - `getStatusLabel()` - Display label logic (lines 492-499)
   - Group status/member display

### Routes
```
POST   /mahasiswa/group           → Create normal group
POST   /mahasiswa/group/store-solo → Create solo seeker group
```

---

## Implementation Checklist

### For Normal Group Creation:
- [ ] Endpoint: `/mahasiswa/group` ✓
- [ ] Initial status in DB: `FORMING` ✓
- [ ] is_solo flag: `false` ✓
- [ ] Starting members: 1 ✓
- [ ] Create GroupMember with is_leader=true ✓
- [ ] Call evaluateGroupReadiness() ✓
- [ ] Display label: "Incomplete Group" ✓

### For Solo Seeker Creation:
- [ ] Endpoint: `/mahasiswa/group/store-solo` ✓
- [ ] Initial status in DB: `FORMING_SOLO` ✓
- [ ] is_solo flag: `true` ✓
- [ ] Starting members: 1 ✓
- [ ] Create GroupMember with is_leader=true ✓
- [ ] DO NOT call evaluateGroupReadiness() ✓
- [ ] Display label: "Solo Seeker" ✓

### For Member Addition:
- [ ] Call `evaluateGroupReadiness()` after member joins ✓
- [ ] Check `determineStatus()` for correct status ✓
- [ ] Normal group: Auto-transition when reaching 3 members ✓
- [ ] Solo seeker: Stay FORMING_SOLO unless period.allow_solo=true ✓

---

## Critical Code Paths (What Calls What)

### Normal Group Member Addition Flow:
```
addMember() 
  → acceptInvite() 
    → handleJoinGroup() 
      → attachToGroup() 
      → evaluateGroupReadiness()
        → canBecomeReady()
          → checks member_count >= min_group_size
          → checks title quota (if exists)
        → transitionToReady()
          → GroupStateMachine::transition($group, 'READY_FOR_BIDDING')
```

### Display Label Determination:
```
Frontend: getStatusLabel(status)
  ├─ IF status = 'READY_FOR_BIDDING':
  │   ├─ IF hasTitle: return "Ready for Finalization"
  │   └─ IF !hasTitle: return "Ready for Bidding"
  ├─ IF status = 'FORMING': return "Incomplete Group"
  ├─ IF status = 'FORMING_SOLO': return "Solo Seeker"
  └─ ELSE: return status
```

---

## Common Mistakes to Avoid

### Mistake 1: Wrong Creation Endpoint
- Using `/mahasiswa/group` for solo seekers
- **Fix**: Use `/mahasiswa/group/store-solo`

### Mistake 2: Not Calling evaluateGroupReadiness()
- Member joins but status doesn't update to READY_FOR_BIDDING
- **Fix**: Ensure `evaluateGroupReadiness()` is called in handleJoinGroup()

### Mistake 3: Assuming Solo Seeker Transitions Automatically
- Expecting FORMING_SOLO → READY_FOR_BIDDING on 3rd member
- **Fix**: Solo seeker status is sticky; only transitions if period.allow_solo=true

### Mistake 4: Confusing hasTitle with Status
- Thinking hasTitle changes the database status
- **Fix**: hasTitle only affects the DISPLAY LABEL, not the status

### Mistake 5: Wrong Display Label Logic
- Showing "Ready for Bidding" when group has a title
- **Fix**: Check the getStatusLabel() function at page.tsx line 492

---

## Testing These Flows

### Manual Test: Normal Group
1. Create group with `POST /mahasiswa/group`
2. Check DB: status = 'FORMING', is_solo = false ✓
3. Add 2nd member via invite
4. Check DB: status still = 'FORMING' ✓
5. Add 3rd member via invite
6. Check DB: status = 'READY_FOR_BIDDING' ✓
7. Frontend shows: "Ready for Bidding" ✓

### Manual Test: Solo Seeker
1. Create group with `POST /mahasiswa/group/store-solo`
2. Check DB: status = 'FORMING_SOLO', is_solo = true ✓
3. Propose title immediately
4. Check DB: status still = 'FORMING_SOLO' ✓
5. Frontend shows: "Solo Seeker" ✓
6. Add 2nd member
7. Check DB: status still = 'FORMING_SOLO' (unless period.allow_solo=true) ✓

---

## Database Queries for Verification

### Verify Normal Group Status
```sql
SELECT g.id, g.status, g.is_solo, COUNT(gm.id) as member_count 
FROM groups g 
LEFT JOIN group_members gm ON gm.group_id = g.id 
WHERE g.id = ? 
GROUP BY g.id;

Expected: status='FORMING' when member_count < 3
Expected: status='READY_FOR_BIDDING' when member_count >= 3
```

### Verify Solo Seeker Status
```sql
SELECT g.id, g.status, g.is_solo, COUNT(gm.id) as member_count 
FROM groups g 
LEFT JOIN group_members gm ON gm.group_id = g.id 
WHERE g.is_solo = true 
GROUP BY g.id;

Expected: status='FORMING_SOLO' regardless of member_count
```

---

## Related Documentation

This summary is part of a three-document set:

1. **GROUP_FLOWS_EXECUTIVE_SUMMARY.md** (this file) - High-level overview
2. **GROUP_FLOWS_QUICK_REFERENCE.md** - Quick lookup guide
3. **GROUP_FLOWS_DETAILED_ANALYSIS.md** - Deep technical analysis
4. **STATUS_MAPPING_TABLE.md** - Complete status mapping reference

---

## Key Takeaway

**The fundamental difference:**
- **Normal Group**: Status automatically changes based on member count (FORMING → READY_FOR_BIDDING)
- **Solo Seeker**: Status is set to FORMING_SOLO and stays there (sticky) unless explicitly transitioned by period.allow_solo

Display label depends on both the database status AND whether the group has a title assigned.

