# GROUP CREATION FLOWS - DOCUMENTATION INDEX

## Overview

This directory contains comprehensive documentation of the CTMS group creation system, including two distinct flows:
1. **Normal Group Creation** - Standard multi-member groups
2. **Solo Seeker Group Creation** - Solo student groups that recruit members

---

## Documents in This Set

### 1. **GROUP_FLOWS_EXECUTIVE_SUMMARY.md** (START HERE)
**Purpose**: Quick overview for developers and stakeholders
**Contains**:
- Quick facts table comparing normal vs solo seeker
- Status → Display label mapping
- How status changes work
- Key files and locations
- Implementation checklist
- Common mistakes to avoid

**Best for**: Understanding the big picture in 5 minutes

---

### 2. **GROUP_FLOWS_QUICK_REFERENCE.md**
**Purpose**: Fast lookup guide during development
**Contains**:
- At-a-glance comparison
- Decision tree
- Member addition scenarios with examples
- Code snippets (frontend & backend)
- State machine transition rules
- Common issues & solutions
- Testing checklist

**Best for**: Quick answers while coding

---

### 3. **GROUP_FLOWS_DETAILED_ANALYSIS.md**
**Purpose**: Complete technical reference
**Contains**:
- Detailed creation process for both flows
- Initial status and member details
- Status transitions with logic
- Member addition logic and timelines
- Complete status → display label mapping
- Critical implementation details
- Routes and endpoints summary
- Summary comparison table

**Best for**: Deep understanding, code review, troubleshooting

---

### 4. **STATUS_MAPPING_TABLE.md**
**Purpose**: Comprehensive status mapping reference
**Contains**:
- Complete mapping tables for all member counts
- Key database fields explanation
- Frontend display logic implementation
- State machine rules
- Database queries
- Typical progression examples
- The 5 golden rules

**Best for**: Verifying status calculations, debugging

---

## Quick Navigation by Task

### I want to...

#### Understand the system (5 min)
→ Read: **GROUP_FLOWS_EXECUTIVE_SUMMARY.md**

#### Implement a feature (30 min)
→ Read: **GROUP_FLOWS_QUICK_REFERENCE.md** + **GROUP_FLOWS_DETAILED_ANALYSIS.md**

#### Debug a status issue (15 min)
→ Read: **STATUS_MAPPING_TABLE.md** + check code at line references

#### Review the code (1-2 hours)
→ Read all documents in order, then review source code

#### Fix a specific problem
→ See "Common Issues & Solutions" in **GROUP_FLOWS_QUICK_REFERENCE.md**

#### Verify database state (10 min)
→ Use SQL queries in **STATUS_MAPPING_TABLE.md**

---

## Key Concepts at a Glance

### The Two Creation Flows

| Aspect | Normal Group | Solo Seeker |
|--------|-------------|-----------|
| **Endpoint** | `POST /mahasiswa/group` | `POST /mahasiswa/group/store-solo` |
| **Initial Status** | `FORMING` | `FORMING_SOLO` |
| **Display Label** | "Incomplete Group" | "Solo Seeker" |
| **Minimum Members** | 3 | 1 |
| **Status at 3+ Members** | `READY_FOR_BIDDING` | `FORMING_SOLO` (stays) |
| **Key Flag** | `is_solo = false` | `is_solo = true` |

### Status → Display Label Mapping

```
FORMING         → "Incomplete Group"     (normal group, < 3 members)
FORMING_SOLO    → "Solo Seeker"         (solo group, any members)
READY_FOR_BIDDING (no title)  → "Ready for Bidding"
READY_FOR_BIDDING (with title) → "Ready for Finalization"
```

---

## Source Code References

### Backend Files
- **GroupController.php** (lines 97-215)
  - `store()` - Normal group creation
  - `storeSolo()` - Solo seeker group creation

- **Group.php** (lines 129-171)
  - `determineStatus()` - Status calculation logic

- **GroupService.php** (lines 337-352)
  - `evaluateGroupReadiness()` - Auto-transition logic

- **GroupStateMachine.php** (lines 8-203)
  - State transition rules

### Frontend Files
- **group/page.tsx** (lines 455-862)
  - `handleCreateGroup()` - Normal group creation
  - `handleCreateSoloGroup()` - Solo seeker creation
  - `getStatusLabel()` - Display label logic (lines 492-499)

### Routes
- **routes/api.php** (lines 240-259)
  - Student group endpoints

---

## Testing Scenarios

### Test Normal Group Creation
1. Create group → Status = FORMING
2. Add 2nd member → Status stays FORMING
3. Add 3rd member → Status = READY_FOR_BIDDING (automatic!)
4. Remove member → Status reverts to FORMING (automatic!)

### Test Solo Seeker Creation
1. Create solo group → Status = FORMING_SOLO
2. Propose title immediately → Status stays FORMING_SOLO
3. Add 2nd member → Status stays FORMING_SOLO (sticky!)
4. Can't bid for title → Only proposal allowed

---

## Common Questions

**Q: Why is my solo seeker group showing "Incomplete Group" instead of "Solo Seeker"?**
A: Check if it was created with the correct endpoint `/mahasiswa/group/store-solo` and that `is_solo = true` in database.

**Q: Why doesn't the group transition to READY_FOR_BIDDING when I add the 3rd member?**
A: Check if `evaluateGroupReadiness()` is being called after member join. See GroupService line 98.

**Q: Can a solo seeker group ever become READY_FOR_BIDDING?**
A: Yes, but only if `period.allow_solo = true`. It's controlled by the period configuration, not automatic.

**Q: What changes the display label from "Ready for Bidding" to "Ready for Finalization"?**
A: The presence of `title_id`. It's not a status change, just a display logic change. See page.tsx line 494.

---

## Integration Points

### When Creating a Group
1. Frontend calls `POST /mahasiswa/group` or `POST /mahasiswa/group/store-solo`
2. Backend validates and creates Group + GroupMember
3. For normal groups: `evaluateGroupReadiness()` is called
4. Status is stored in `groups.status` column
5. Frontend fetches and displays using `getStatusLabel()`

### When Adding a Member
1. Leader invites via `addMember()`
2. Student accepts via `acceptInvite()`
3. Backend calls `handleJoinGroup()` → `evaluateGroupReadiness()`
4. Status may auto-transition (for normal groups)
5. Frontend refreshes and displays new status

### When Proposing a Title
1. Student must be in correct status (READY_FOR_BIDDING or FORMING_SOLO)
2. Title is created with supervisor_approval_status = PENDING
3. Group status may change based on supervisor approval
4. Display label updates to show "Ready for Finalization" (if READY_FOR_BIDDING)

---

## Troubleshooting Guide

### Issue: Status not updating after member added
**Check**:
1. Is `evaluateGroupReadiness()` being called?
2. Is `determineStatus()` returning the correct status?
3. Check period.min_group_size setting

### Issue: Solo seeker group transitioned to READY_FOR_BIDDING unexpectedly
**Check**:
1. Is `period.allow_solo = true`?
2. Is there a background job calling `determineStatus()`?
3. Check GroupObserver for auto-transitions

### Issue: Display label wrong
**Check**:
1. Is `getStatusLabel()` receiving the correct status from backend?
2. Is `hasTitle` computed correctly?
3. Check frontend vs backend status sync

### Issue: Member can't join solo seeker group
**Check**:
1. Is group status FORMING_SOLO?
2. Is student trying to propose instead of joining?
3. Is there a marketplace entry for the title?

---

## Performance Notes

- Status is determined dynamically via `determineStatus()` on-read
- Member count is counted fresh from GROUP_MEMBERS table
- No caching of status (always current)
- `evaluateGroupReadiness()` is atomic within a transaction

---

## Related Systems

- **Title Proposal System**: Connects to solo seeker proposal flow
- **Bidding System**: Requires READY_FOR_BIDDING status
- **Finalization System**: Transitions from READY_FOR_BIDDING or FORMING_SOLO
- **Period Management**: Controls min_group_size, max_group_size, allow_solo
- **Notification System**: Alerts for group state changes

---

## Document Statistics

| Document | Size | Sections | Tables |
|----------|------|----------|--------|
| Executive Summary | ~5 KB | 12 | 3 |
| Quick Reference | ~11 KB | 11 | 2 |
| Detailed Analysis | ~15 KB | 7 | 10+ |
| Status Mapping | ~9 KB | 9 | 15+ |

**Total**: ~40 KB of comprehensive documentation

---

## Last Updated

- Analysis Date: April 7, 2026
- CTMS Version: Current (with GROUP_FLOWS_SOLO status)
- Covers: All group creation and status management flows

---

## How to Use This Documentation

1. **First Time Setup**: Read Executive Summary → Quick Reference
2. **Feature Development**: Reference Quick Reference + Detailed Analysis
3. **Bug Fixing**: Check Status Mapping + relevant code sections
4. **Code Review**: Read all documents + review source code
5. **Onboarding**: Start with Executive Summary, then Detailed Analysis

---

