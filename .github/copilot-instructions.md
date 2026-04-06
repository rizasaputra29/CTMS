# CTMS Workspace Instructions

## Project Overview

**CTMS** (Capstone/Tugas Akhir Management System) is a full-stack academic project management application with:
- **Frontend**: Next.js 16 (React 19) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend**: Laravel 12 (PHP 8.2+) + PostgreSQL
- **Architecture**: Role-based access (Admin, Lecturer/Dosen, Student/Mahasiswa) with complex workflows for project bidding, supervision, and defense scheduling

See [README.md](../../README.md) for detailed setup and tech stack.

## Quick Start Commands

### Backend (Laravel)

```bash
cd backend

# Install dependencies
composer install

# Setup environment & database
cp .env.example .env
php artisan key:generate
php artisan migrate --seed

# Development server
php artisan serve  # Runs on http://localhost:8000

# Testing
php artisan test

# Build for production
php artisan optimize
```

### Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Setup environment (create .env.local)
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local

# Development server
npm run dev  # Runs on http://localhost:3000

# Build & production
npm run build
npm start

# Linting
npm run lint
```

## Architecture & Patterns

### Backend (Laravel)

**Directory Structure:**
- `app/Models/` — Eloquent models (33 domain entities: Group, User, TaDefenseEvaluation, etc.)
- `app/Http/Controllers/` — REST API endpoints organized by feature domain
- `app/Services/` — Business logic layer (GroupService, FinalizationService, GroupStateMachine)
- `app/Observers/` — Model lifecycle hooks for side effects (e.g., readiness tracking)
- `database/migrations/` — Schema definitions
- `tests/` — Feature (workflow) and Unit (business logic) tests

**Key Patterns:**
- **State Machine**: `GroupStateMachine` enforces valid status transitions (FORMING → READY_FOR_BIDDING → ACTIVE_BIDDING, etc.)
- **Concurrency Safety**: Pessimistic locking + DB transactions + idempotency checks
- **Multi-Tenant**: Period-scoped data via `period_id` (only 1 active period at a time)
- **Pivot Auditing**: Supervision assignments tracked via `Supervision` pivot with audit trail
- **Protected Fields**: Sensitive fields (e.g., `title_id`) excluded from mass assignment; special methods required for assignment

**Naming Conventions:**
| Type | Format | Example |
|------|--------|---------|
| Models | PascalCase | `Group`, `GroupMember`, `TaDefenseEvaluation` |
| Controllers | PascalCase + "Controller" | `GroupController`, `BidController` |
| Services | PascalCase + "Service" | `GroupService`, `FinalizationService` |
| Tables | snake_case, plural | `groups`, `group_members`, `ta_defense_evaluations` |
| Statuses | SHOUTY_SNAKE_CASE | `FORMING`, `READY_FOR_BIDDING`, `ACTIVE_BIDDING` |

**Critical Knowledge for AI:**
- Always validate `period_id` context before operations
- Use `GroupStateMachine::can()` before state transitions
- Don't force-assign protected fields; use designated methods
- Wrap multi-step updates in `DB::transaction()`
- Lock resources in consistent order (User → Group → Pivot) to prevent deadlocks

### Frontend (Next.js + React)

**Directory Structure:**
- `src/app/` — Next.js App Router pages and root layout
  - `login/` — Authentication
  - `mahasiswa/`, `dosen/`, `admin/` — Role-based dashboards
- `src/components/` — Reusable components
  - `ui/` — shadcn/ui base components (Button, Dialog, etc.)
  - `layout/` — Shared layouts (Sidebar, Nav, DashboardLayout)
  - Domain-specific folders (schedule, home, etc.)
- `src/context/` — React Context (AuthContext for user state)
- `src/hooks/` — Custom hooks (useIsMobile, etc.)
- `src/lib/` — Utilities
  - `api.ts` — Axios instance with Bearer token injection
  - `utils.ts` — cn() helper for Tailwind class merging

**Key Patterns:**
- **State Management**: React Context API (no Redux/Zustand)
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix UI under the hood)
- **Icons**: Lucide React
- **Animations**: Framer Motion transitions
- **API Integration**: Axios with auto Bearer token injection and CORS
- **Role-Based Routes**: Top-level `/mahasiswa`, `/dosen`, `/admin` routes with dedicated layouts
- **Responsive**: `useIsMobile()` hook for mobile detection

**Naming Conventions:**
- Components: PascalCase (`DashboardLayout.tsx`, `ScheduleCalendar.tsx`)
- Hooks: camelCase with `use-` prefix (`use-mobile.ts`)
- Utilities: lowercase (`api.ts`, `utils.ts`)
- Pages: Next.js convention (`page.tsx`)

**API Integration Pattern:**
```typescript
// Use the pre-configured axios instance from @/lib/api
import { api } from '@/lib/api';

// Auto-injects Bearer token from localStorage
const response = await api.get('/mahasiswa/dashboard');
const res = await api.post('/logout');
```

## Development Workflows

### Adding a New Feature (Full-Stack)

1. **Backend**: Create migration → Model → Controller → Service (if complex logic) → Add routes in `routes/api.php`
2. **Frontend**: Create page/component → Wire up with API via `@/lib/api` → Test role-based access

### Testing

**Backend:**
```bash
cd backend
php artisan test  # Runs all tests with RefreshDatabase

# Single file
php artisan test tests/Feature/GroupWorkflowTest.php

# With coverage
php artisan test --coverage
```

**Frontend:**
```bash
cd frontend
npm run lint  # ESLint validation (no test runner visible yet)
```

### Database Migrations

```bash
cd backend

# Create new migration
php artisan make:migration create_table_name

# Run pending migrations
php artisan migrate

# Rollback last batch
php artisan migrate:rollback

# Fresh seed
php artisan migrate:refresh --seed
```

## Common Patterns & Anti-Patterns

### ✅ Do This

- Use `GroupStateMachine` before state transitions
- Wrap multi-step updates in transactions
- Validate `period_id` on read/write operations
- Use shadcn/ui components for consistency (don't create custom UI)
- Leverage existing `api.ts` Axios instance (don't create new HTTP clients)
- Use role-based route guards (`/mahasiswa/*`, `/dosen/*`, `/admin/*`)

### ❌ Don't Do This

- Force-assign protected model fields (use special methods)
- Update group status without state machine validation
- Skip `period_id` validation in queries
- Create custom API clients outside `lib/api.ts`
- Mix role-based logic in components (handle in backend)
- Lock resources in inconsistent order (causes deadlocks)

## Useful References

- [Backend README](../../backend/README.md) — Laravel setup details
- [Frontend README](../../frontend/README.md) — Next.js setup details
- [Laravel Docs](https://laravel.com/docs) — Framework reference
- [Next.js Docs](https://nextjs.org/docs) — App Router & API integration
- [Tailwind CSS Docs](https://tailwindcss.com/docs) — Styling reference
- [shadcn/ui Docs](https://ui.shadcn.com) — Component library
