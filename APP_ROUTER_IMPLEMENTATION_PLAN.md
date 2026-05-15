# CTMS Next.js + Laravel App Router Optimization

## Executive Summary

This implementation plan provides a step-by-step roadmap to migrate the CTMS (Capstone/TA Management System) from Client Components to the Next.js App Router with server-side rendering, HTTP-only cookie authentication, and production-ready deployment configuration.

**Current State:**
- 100% Client Components (67 pages all use 'use client')
- JWT stored in localStorage (XSS vulnerable)
- No middleware for auth protection
- Direct Axios calls in useEffect
- No error boundaries or loading states

**Target State:**
- Server Components for data fetching
- HTTP-only cookies with refresh tokens
- Next.js middleware for role-based protection
- Server Actions for form mutations
- React.cache for parallel data fetching
- Full E2E test coverage with Playwright
- Production deployment with PM2 + Nginx

---

## Project Overview

### Tech Stack
- **Frontend:** Next.js 16 (App Router) - `/Users/riza/CTMS/frontend/`
- **Backend:** Laravel 12 - `/Users/riza/CTMS/backend/`
- **Database:** Neon PostgreSQL
- **Deployment:** VPS with PM2 + Nginx
- **Testing:** Playwright E2E

### Key Requirements
1. HTTP-only cookie auth with refresh tokens (15min access, 7day refresh)
2. Role stored in session cookie (admin/dosen/mahasiswa)
3. Next.js middleware for server-side auth protection
4. Server Components for data fetching (eliminate unnecessary useEffect)
5. Server Actions for forms
6. Parallel data fetching with React.cache
7. Error boundaries and loading states
8. Playwright E2E tests for critical auth flows
9. VPS deployment configuration (PM2, Nginx)

---

## Implementation Phases

### Phase 1: Database & Backend (Days 1-5)
**Focus:** Secure authentication infrastructure

#### Day 1-2: Database Layer
- **Task 01:** Create refresh tokens table migration
  - `backend/database/migrations/2026_05_16_000001_create_refresh_tokens_table.php`
  - `backend/app/Models/RefreshToken.php`
  - Estimated: 2 hours

#### Day 2-3: Authentication Backend
- **Task 02:** Implement Laravel Sanctum with HTTP-only cookie auth
  - Refactor `AuthController` for cookie-based tokens
  - Create `RefreshTokenController` for token rotation
  - Update CORS configuration for credentials
  - Estimated: 4 hours

#### Day 3: Role-Based Access Control
- **Task 03:** Create role middleware for Laravel API
  - `backend/app/Http/Middleware/ApiRoleMiddleware.php`
  - Unit tests for middleware
  - Estimated: 2 hours

- **Task 04:** Update Laravel CORS config for cookie-based auth
  - Configure allowed origins and credentials
  - Security headers setup
  - Estimated: 1 hour

#### Day 4-5: API Standardization
- **Task 05:** Create API response contracts for Server Components
  - Standardized response format
  - Resources for User, Group, Period, Title
  - Estimated: 3 hours

**Phase 1 Total:** 5 days, 12 hours

---

### Phase 2: Frontend Infrastructure (Days 6-8)
**Focus:** Authentication and middleware setup

#### Day 6: Middleware Implementation
- **Task 06:** Set up Next.js middleware.ts for server-side auth
  - Role-based route protection
  - Cookie reading from request
  - Redirect handling
  - Estimated: 3 hours

#### Day 6-7: Server-Side Auth
- **Task 07:** Create server-side auth utilities and cookie handlers
  - `src/lib/auth/server-auth.ts`
  - `src/lib/auth/cookies.ts`
  - Type-safe auth interfaces
  - Estimated: 3 hours

#### Day 7-8: Server Actions
- **Task 08:** Implement Server Actions for authentication
  - Login/logout/refresh Server Actions
  - Error handling with typed responses
  - Cookie management
  - Estimated: 4 hours

**Phase 2 Total:** 3 days, 10 hours

---

### Phase 3: Server Component Migration (Days 9-14)
**Focus:** Migrate pages from Client to Server Components

#### Day 9: Data Fetching Infrastructure
- **Task 09:** Create data fetching utilities with React.cache
  - `src/lib/data/cache.ts` with React.cache
  - `src/lib/data/api-client.ts`
  - Parallel fetching helpers
  - Estimated: 4 hours

#### Day 10-11: Dashboard Migration
- **Task 10:** Migrate admin dashboard to Server Component
  - Remove 'use client' directive
  - Server-side data fetching
  - Loading/error states
  - Estimated: 3 hours

- **Task 11:** Migrate dosen dashboard to Server Component
  - Similar refactoring
  - Estimated: 2 hours

- **Task 12:** Migrate mahasiswa dashboard to Server Component
  - Student-specific data handling
  - Estimated: 2 hours

#### Day 12-13: CRUD Pages
- **Task 13:** Migrate admin CRUD pages (titles, users, periods)
  - Server-side tables with pagination
  - Search/filter in URL
  - Estimated: 6 hours

#### Day 13-14: Scheduling
- **Task 14:** Migrate scheduling and evaluation pages
  - Calendar data server-side
  - Evaluation data fetching
  - Estimated: 5 hours

**Phase 3 Total:** 6 days, 24 hours

---

### Phase 4: Client Optimization (Days 15-17)
**Focus:** Forms, mutations, and UX

#### Day 15-16: Server Actions for Mutations
- **Task 15:** Create Server Actions for all mutations
  - CRUD actions for all entities
  - Zod validation schemas
  - Revalidation strategies
  - Estimated: 6 hours

- **Task 16:** Update Client Components for Server Actions
  - Form submission via actions
  - useFormState for error handling
  - Optimistic updates
  - Estimated: 5 hours

#### Day 16-17: Error Handling
- **Task 17:** Create error boundaries and global error handling
  - Root error.tsx
  - Segment-level error boundaries
  - Custom error UI
  - Estimated: 3 hours

- **Task 18:** Implement loading states and Suspense boundaries
  - Skeleton components
  - Progressive loading
  - No layout shift
  - Estimated: 3 hours

**Phase 4 Total:** 3 days, 17 hours

---

### Phase 5: Testing & Polish (Days 18-20)
**Focus:** E2E testing and quality assurance

#### Day 18: Playwright Setup
- **Task 19:** Set up Playwright E2E testing framework
  - Multi-browser configuration
  - Test fixtures and helpers
  - Auth setup for tests
  - Estimated: 3 hours

#### Day 18-19: Auth Testing
- **Task 20:** Write Playwright E2E tests for auth flows
  - Login/logout flows
  - Protected route tests
  - Session refresh tests
  - Cross-browser verification
  - Estimated: 4 hours

- **Task 21:** Write Playwright E2E tests for critical user flows
  - Title CRUD tests
  - Group management tests
  - Schedule tests
  - Evaluation tests
  - Estimated: 5 hours

#### Day 20: Quality Audit
- **Task 22:** Performance and accessibility audit
  - Lighthouse performance (≥90)
  - Lighthouse accessibility (≥95)
  - Core Web Vitals
  - Keyboard accessibility
  - Estimated: 3 hours

**Phase 5 Total:** 3 days, 15 hours

---

### Phase 6: Deployment (Days 21-22)
**Focus:** Production deployment configuration

#### Day 21: Process Management
- **Task 23:** Create PM2 ecosystem config for production
  - Frontend and backend process definitions
  - Log rotation
  - Auto-restart configuration
  - Estimated: 2 hours

- **Task 24:** Configure Nginx reverse proxy with SSL
  - SSL termination
  - Reverse proxy rules
  - Security headers
  - Rate limiting
  - Estimated: 3 hours

#### Day 21-22: Deployment Automation
- **Task 25:** Create deployment automation scripts
  - Zero-downtime deployment
  - Database migration scripts
  - Health checks
  - Rollback capability
  - Estimated: 4 hours

- **Task 26:** Set up environment configuration for production
  - .env.production files
  - Secrets management
  - Neon PostgreSQL configuration
  - Estimated: 2 hours

#### Day 22: Monitoring
- **Task 27:** Create monitoring and logging setup
  - Health check endpoint
  - Log rotation
  - PM2 monitoring
  - Error alerting
  - Estimated: 2 hours

- **Task 28:** Create deployment documentation and runbook
  - Deployment guide
  - Troubleshooting docs
  - Security checklist
  - Ops runbook
  - Estimated: 3 hours

**Phase 6 Total:** 2 days, 16 hours

---

## Total Effort Summary

| Phase | Days | Hours | Tasks |
|-------|------|-------|-------|
| Phase 1: Database & Backend | 5 | 12 | 5 tasks |
| Phase 2: Frontend Infrastructure | 3 | 10 | 3 tasks |
| Phase 3: Server Component Migration | 6 | 24 | 6 tasks |
| Phase 4: Client Optimization | 3 | 17 | 4 tasks |
| Phase 5: Testing & Polish | 3 | 15 | 4 tasks |
| Phase 6: Deployment | 2 | 16 | 6 tasks |
| **TOTAL** | **22 days** | **94 hours** | **28 tasks** |

---

## Testing Strategy

### Unit Testing
- Laravel: PHPUnit for controllers, services, middleware
- Next.js: Jest for utilities, hooks, components

### Integration Testing
- API endpoint testing with Laravel HTTP tests
- Server Action testing with mocked fetch

### E2E Testing (Playwright)
1. **Authentication Flows:** Login, logout, token refresh, session expiry
2. **Role-Based Access:** Admin/dosen/mahasiswa route access
3. **CRUD Operations:** Titles, groups, schedules, evaluations
4. **Error Scenarios:** Network errors, validation errors
5. **Cross-Browser:** Chrome, Firefox, WebKit

### Performance Testing
- Lighthouse CI for each PR
- Core Web Vitals monitoring
- Bundle size analysis

---

## Security Checklist

### Authentication
- [x] HTTP-only cookies (not localStorage)
- [x] SameSite=Strict cookie flag
- [x] Secure flag on cookies (HTTPS only)
- [x] 15-minute access token expiry
- [x] 7-day refresh token expiry with rotation
- [x] Server-side session validation

### Authorization
- [x] Middleware role checking on every request
- [x] Server Component session verification
- [x] API endpoint authorization
- [x] CSRF protection on mutations

### Transport
- [x] HTTPS only in production
- [x] HSTS headers
- [x] CORS properly configured
- [x] Rate limiting on API

---

## Deployment Architecture

```
User → Nginx (SSL) → Next.js (PM2) → Laravel (PM2)
                          ↓                ↓
                    Static Assets      Neon PostgreSQL
```

### Environment Variables
See `frontend/.env.production.example` and `backend/.env.production.example` in Task 26.

### Health Checks
- `/api/health` - Application health
- `/api/health/db` - Database connectivity
- `/api/health/cache` - Cache connectivity

---

## Task Files Location

All 28 task files are located at:
```
.tmp/tasks/ctms-app-router-optimization/
├── task.json
├── subtask_01.json through subtask_28.json
```

---

## Key Code Patterns

### Server Component with Data Fetching
```typescript
// app/admin/dashboard/page.tsx
import { getServerSession } from '@/lib/auth/server-auth';
import { getCachedDashboard } from '@/lib/data/cache';

export default async function AdminDashboardPage() {
  const session = await getServerSession();
  if (!session || session.role !== 'admin') {
    redirect('/unauthorized');
  }
  
  const dashboardData = await getCachedDashboard('admin', session.userId);
  
  return (
    <div>
      <DashboardStats data={dashboardData.stats} />
    </div>
  );
}
```

### Server Action for Mutations
```typescript
// app/actions/titles.ts
'use server';

export async function createTitle(formData: FormData) {
  const validated = createTitleSchema.safeParse({...});
  if (!validated.success) {
    return { error: 'Invalid input', details: validated.error.flatten() };
  }
  
  const response = await fetch(`${process.env.API_URL}/api/titles`, {...});
  
  revalidatePath('/admin/titles');
  return { success: true };
}
```

### Next.js Middleware
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('access_token');
  const userRole = request.cookies.get('user_role');
  
  if (!accessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Check role-based access
  const requiredRole = PROTECTED_ROUTES
    .find(([route]) => pathname.startsWith(route))?.[1];
  
  if (requiredRole && !requiredRole.includes(userRole?.value || '')) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }
  
  return NextResponse.next();
}
```

---

## Next Steps

1. **Start with Phase 1** - Database migrations and backend auth
2. **Review task files** - Each subtask has detailed acceptance criteria
3. **Run tests after each phase** - Ensure no regressions
4. **Deploy incrementally** - Consider staging environment
5. **Monitor metrics** - Performance, errors, user behavior

---

## Support Resources

- **Next.js App Router Docs:** https://nextjs.org/docs/app
- **Laravel Sanctum Docs:** https://laravel.com/docs/12.x/sanctum
- **Playwright Docs:** https://playwright.dev
- **PM2 Docs:** https://pm2.keymetrics.io

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Auth migration breaks existing users | Gradual rollout with dual-token support |
| Performance regression | Lighthouse CI gates, incremental deployment |
| Data inconsistency | Comprehensive E2E tests, database backups |
| Deployment failure | Rollback scripts, health checks |

---

**Document Version:** 1.0  
**Created:** 2026-05-15  
**Total Tasks:** 28  
**Estimated Duration:** 22 days (94 hours)
