# Comprehensive Implementation Plan: Fix Frontend Runtime Errors

## Overview
Fix hydration mismatches and API response unwrapping issues while preserving:
- **React Hook Form** for form handling
- **TanStack Query** for data fetching
- Existing component architecture

---

## Root Causes
1. **Hydration Mismatch (React #418)**: `localStorage`/`window` access during SSR
2. **API Response Unwrapping**: Backend returns `{success, message, data: {...}}`, frontend reads `res.data.property`
3. **Defensive Operations**: `.forEach()` on potentially undefined arrays

---

## Reference Patterns (Already Working)

### Pattern 1: Response Unwrapping
```typescript
// From: frontend/src/app/dosen/supervisor-evaluation/[groupId]/page.tsx:93
const data = response.data?.data ?? response.data;
```

### Pattern 2: Defensive forEach
```typescript
// From: EvaluationSummaryFeature.tsx:55
(data.items ?? []).forEach(item => { ... });
```

### Pattern 3: Client-Side State Sync
```typescript
const [state, setState] = useState(defaultValue);
useEffect(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('key');
    if (saved) setState(saved);
  }
}, []);
```

---

## Files to Fix (15 total)

### Phase 1: Hydration Mismatch (Critical)

**1. frontend/src/hooks/use-mobile.ts**
- **Issue**: `window.innerWidth` in useState initializer
- **Fix**: Initialize with `false`, update in useEffect
- **Preserves**: React hook pattern, no TanStack Query changes

**2. frontend/src/components/layout/AppSidebar.tsx (Lines 301-304)**
- **Issue**: `localStorage` access in SidebarSection
- **Fix**: Initialize with `defaultOpen`, sync in useEffect
- **Preserves**: Component structure, callback patterns

**3. frontend/src/components/layout/AppSidebar.tsx (Lines 360-363)**
- **Issue**: `localStorage` access in SidebarCategoryCollapsible
- **Fix**: Initialize with `false`, sync in useEffect

**4. frontend/src/components/layout/AppSidebar.tsx (Lines 415-418)**
- **Issue**: `localStorage` access in SidebarSubSection
- **Fix**: Initialize with `false`, sync in useEffect

**5. frontend/src/components/layout/AppSidebar.tsx (Lines 496-516)**
- **Issue**: `pathname` in useState initializer
- **Fix**: Initialize with `null`, calculate in useEffect

**6. frontend/src/components/layout/Footer.tsx (Line 56)**
- **Issue**: `new Date().getFullYear()` causes hydration mismatch
- **Fix**: Add `suppressHydrationWarning` prop
- **Preserves**: Static component, no logic changes

### Phase 2: Mahasiswa Dashboard (Critical)

**7. frontend/src/features/mahasiswa/dashboard/hooks/use-mahasiswa-dashboard.ts**
- **Issues**:
  - Line 21: `periodRes.data?.period` should unwrap
  - Line 51: `statsRes.value.data` should unwrap
  - Line 58: `groupRes.value.data` inconsistent unwrapping
  - Line 64: `scheduleRes.value.data` inconsistent unwrapping
- **Fix**: Standardize all to `res.data?.data ?? res.data`
- **Preserves**: TanStack Query useQuery pattern

**8. frontend/src/features/mahasiswa/group/components/GroupFeature.tsx**
- **Issues**:
  - Line 58: `response.data.group` should unwrap
  - Line 94: Already correct pattern
  - Line 178-179: `periodRes.data?.period` should unwrap
  - Line 190: `response.data?.group` should unwrap
  - Line 230: `response.data?.group` should unwrap
- **Fix**: Standardize to `const data = response.data?.data ?? response.data`
- **Preserves**: React Hook Form usage, useCallback patterns

### Phase 3: Other API Unwrapping (High Priority)

**9. frontend/src/app/admin/reports/grade-consistency/page.tsx (Line 117)**
- **Issue**: `res.data.data`
- **Fix**: `setChecks((res.data?.data ?? []) as GradeConsistencyCheck[])`

**10. frontend/src/app/admin/reports/assessments/student/[studentId]/page.tsx (Line 121)**
- **Issue**: `res.data.data.find()`
- **Fix**: `const students = (res.data?.data ?? []) as StudentData[]; students.find(...)`

**11. frontend/src/app/login/components/LoginForm.tsx (Line 48)**
- **Issue**: `res.data.data.user` and `res.data.data.roles`
- **Fix**: `const responseData = res.data?.data ?? res.data; login(responseData?.user, responseData?.roles ?? [])`
- **Preserves**: React Hook Form handleSubmit pattern

**12. frontend/src/features/dosen/evaluation/hooks/use-evaluation.ts**
- **Issues**:
  - Lines 23-24: `res.data.data?.seminars` and `res.data.data?.ta_defenses`
  - Line 27: `seminars.forEach` - no null check
  - Line 50: `taDefenses.forEach` - no null check
  - Line 52: `t.evaluations.forEach` - nested, no check
  - Line 77: `students.forEach` - no null check
- **Fix**: 
  - Unwrap: `const responseData = res.data?.data ?? res.data;`
  - `(responseData?.seminars ?? []).forEach(...)`
  - `(responseData?.taDefenses ?? []).forEach(...)`
  - `(t.evaluations ?? []).forEach(...)`
  - `(students ?? []).forEach(...)`
- **Preserves**: TanStack Query useQuery pattern

**13. frontend/src/features/dosen/schedule/components/DosenScheduleFeature.tsx (Line 163)**
- **Issue**: `schedules.forEach`
- **Fix**: `(schedules ?? []).forEach(...)`

**14. frontend/src/features/dosen/bimbingan/components/BimbinganFeature.tsx**
- **Issues**:
  - Line 75: `filteredDocuments.forEach` - no null check
  - Lines 98-114: Document viewing may have blob wrapping
- **Fix**: 
  - `(filteredDocuments ?? []).forEach(...)`
  - Check if blob response is wrapped: `const blob = response.data?.data ?? response.data`
- **Preserves**: React Hook Form, TanStack Query patterns

**15. frontend/src/features/dosen/ta-evaluation/hooks/use-ta-evaluation.ts (Line 33)**
- **Issue**: `Object.entries(data.existing_scores)` - no null check
- **Fix**: `if (data.existing_scores) { Object.entries(data.existing_scores).forEach(...) }`
- **Preserves**: TanStack Query useMutation pattern

### Phase 4: Calendar Date Formatting (Medium)

**16. frontend/src/components/ui/calendar.tsx (Lines 44, 200)**
- **Issue**: `toLocaleString` and `toLocaleDateString` cause hydration mismatches
- **Fix**: Use `format` from date-fns or deterministic formatter from lib/utils
- **Note**: May require adding import for `format`

---

## TanStack Query Best Practices (Per Context7)

1. **Error Handling**: Query functions should throw errors on failure
2. **Data Access**: `data` defaults to `undefined` - always use optional chaining
3. **Loading States**: Use `isLoading`, `isError`, `isSuccess` for UI states
4. **Caching**: Current cache invalidation patterns remain unchanged

## React Hook Form Best Practices (Per Context7)

1. **Form Submission**: Keep `handleSubmit` wrapper
2. **Server Errors**: Use `setError` to set API errors on fields or root
3. **Validation**: Continue using `zodResolver` with Zod schemas
4. **Controller**: Keep for complex inputs (selects, date pickers)

---

## Implementation Order

1. **Phase 1**: Hydration fixes (6 files) - fixes React #418 errors
2. **Phase 2**: Dashboard unwrapping (2 files) - fixes mahasiswa data issues
3. **Phase 3**: Other API fixes (6 files) - fixes remaining data issues
4. **Phase 4**: Calendar fix (1 file) - fixes date hydration

---

## Verification Steps

After all fixes:
```bash
# TypeScript check
npx tsc --noEmit

# Build check
npm run build
```

## Success Criteria
- [ ] No React #418 errors in console
- [ ] Mahasiswa sees period/group data (not redirected)
- [ ] Sidebar works on desktop and mobile
- [ ] Tables show data (no NaN)
- [ ] Document viewing works in bimbingan
- [ ] TypeScript shows zero errors
- [ ] Build succeeds

---

## Notes

- **All RHF forms remain unchanged** - only API response handling fixed
- **All TanStack Query hooks remain** - only data unwrapping logic fixed
- **No architectural changes** - only defensive coding added
- **Backward compatible** - changes handle both wrapped and unwrapped responses