# Lint Error Fix Plan

## Overview
Fix 45 lint errors (26 errors, 19 warnings) across the CTMS frontend codebase.

## Error Categories

### 1. TypeScript `any` Type Errors (15 errors)

#### File: `ta-defense/page.tsx` (2 errors)
- **Line 97**: `eligibleData.forEach((item: any)` → Use `EligibleStudentData` interface
- **Line 103**: `item.supervisors?.map((s: any)` → Use proper type from interface

**Fix Strategy:**
1. Add `EligibleStudentData` interface after line 48:
```typescript
interface EligibleStudentData {
    group: { id: number; name: string; code: string };
    student: Student;
    supervisors: { id: number; pivot?: { role: string } }[];
    submission?: { id: number };
}
```
2. Update line 97: `(item: any)` → `(item: EligibleStudentData)`
3. Update line 103: `(s: any)` → `(s: { id: number; pivot?: { role: string } })`

#### File: `schedule/page.tsx` (3 errors)
- **Line 141**: `u: { role: string }` in filter callback → Use `User` type
- **Line 187**: `payload: any` → Create specific payload interfaces
- **Line 242**: `payload: any` → Use same interface

**Fix Strategy:**
1. Add payload interfaces:
```typescript
interface SchedulePayload {
    group_id: number;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    mode: 'ONLINE' | 'OFFLINE';
    notes?: string;
    examiners?: number[];
}
```
2. Update line 141: Use existing `User` type from imports
3. Update lines 187, 242: Use `SchedulePayload` type

#### File: `reports/assessments/page.tsx` (2 errors)
- **Line 101**: `const params: any` → Use `Record<string, string | number>`
- **Line 134**: `const params: any` → Use `Record<string, string | number>`

**Fix Strategy:**
Replace both with: `const params: Record<string, string | number> = {`

#### File: `reports/final-grades/page.tsx` (2 errors)
- **Line 102**: `const params: any` → Use `Record<string, string | number>`
- **Line 147**: `const params: any` → Use `Record<string, string | number>`

**Fix Strategy:**
Same as assessments page

#### File: `reports/grade-consistency/page.tsx` (3 errors)
- **Line 69**: `err: any` → Use `unknown` with proper type guard
- **Line 102**: `const params: any` → Use `Record<string, string | number>`
- **Line 135**: `const params: any` → Use `Record<string, string | number>`

**Fix Strategy:**
1. Line 69: Change to `err: unknown` and use type guard
2. Lines 102, 135: Same as other reports pages

#### File: `reports/groups/page.tsx` (2 errors)
- **Line 98**: `const params: any` → Use `Record<string, string | number>`
- **Line 131**: `const params: any` → Use `Record<string, string | number>`

**Fix Strategy:**
Same pattern as other reports

#### File: `reports/peer-reviews/page.tsx` (2 errors)
- **Line 110**: `const params: any` → Use `Record<string, string | number>`
- **Line 147**: `const params: any` → Use `Record<string, string | number>`

**Fix Strategy:**
Same pattern as other reports

#### File: `mahasiswa/ta-submission/page.tsx` (3 errors)
- **Line 181**: `e: any` → Use `React.ChangeEvent<HTMLInputElement>`
- **Line 286**: `err: any` → Use `unknown` with type guard
- **Line 465**: `isPending` unused variable → Remove or comment out

**Fix Strategy:**
1. Line 181: Use proper React event type
2. Line 286: Change to `unknown` and use type guard
3. Line 465: Comment out unused variable

#### File: `components/dashboard/CombinedDashboard.tsx` (4 errors)
- **Line 59**: `data: any` → Use specific type
- **Line 72**: `result: any` → Use `PromiseSettledResult<T>`
- **Line 86**: `item: any` → Use specific item type
- **Line 99**: `error: any` → Use `unknown` with type guard

**Fix Strategy:**
1. Add proper interfaces based on actual usage
2. Use `PromiseSettledResult<ApiResponse>` for line 72
3. Use proper data types for lines 59, 86
4. Change line 99 to `unknown` with type guard

### 2. React Unescaped Entities (4 errors)

#### File: `admin/reports/page.tsx` (Lines 738, 739)
- Replace `"` with `&quot;` or `&ldquo;/&rdquo;`

**Fix Strategy:**
Replace straight quotes with proper HTML entities or curly quotes

### 3. Unused Imports and Variables (19 warnings)

#### Files to fix:
- `dosen/bimbingan/page.tsx`: Remove unused `Download` import
- `dosen/supervisor-evaluation/page.tsx`: Remove unused `CardDescription` import
- `mahasiswa/grades/page.tsx`: Remove unused `Loader2` import and unused `error` variable
- `mahasiswa/peer-review/page.tsx`: Remove unused `User` import and unused `existingReviews` variable
- `mahasiswa/ta-submission/page.tsx`: Comment out unused `isPending` variable
- `components/dashboard/CombinedDashboard.tsx`: Remove unused `LayoutDashboard`, `Settings` imports
- `components/layout/AppSidebar.tsx`: Comment out unused `renderSubItems` function and `parentLabel` parameter
- `admin/analytics/evaluation-summary/page.tsx`: Comment out unused `getGradeStatusBadge` function

### 4. React Hook Dependency Warning (1 warning)

#### File: `admin/grade-configuration/page.tsx` (Line 72)
- Add missing `fetchConfig` dependency or use callback properly

## Implementation Order

1. **High Priority**: Fix all `any` type errors (15 errors)
2. **Medium Priority**: Fix unescaped entities (4 errors)
3. **Low Priority**: Fix unused imports/variables (19 warnings)
4. **Low Priority**: Fix hook dependency (1 warning)

## Verification

After all fixes, run: `npm run lint` in /Users/riza/CTMS/frontend
Expected result: 0 errors, 0 warnings
