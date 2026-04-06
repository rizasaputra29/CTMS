# CTMS Backend (Laravel) - Codebase Summary

## 1. Directory Structure & Purpose

```
backend/
├── app/
│   ├── Models/            # Eloquent models (33 models total)
│   ├── Http/
│   │   ├── Controllers/   # 32+ controllers (RESTful endpoints)
│   │   └── Middleware/    # RoleMiddleware for auth
│   ├── Services/          # Business logic layer (9 services)
│   ├── Observers/         # Model observers (3: Group, GroupMember, Bid)
│   ├── Exceptions/        # Custom exceptions (DomainRuleException, ConflictRuleException)
│   └── Providers/         # Service registration (AppServiceProvider)
├── routes/
│   ├── api.php           # All API endpoints
│   ├── web.php
│   └── console.php
├── database/
│   ├── migrations/       # 50+ migrations (timestamp-based naming)
│   ├── factories/        # Model factories for testing
│   └── seeders/          # Database seeders
├── tests/
│   ├── Feature/          # 9 feature tests (end-to-end)
│   ├── Unit/             # 3 unit tests
│   └── TestCase.php      # Base test class
├── config/               # Configuration files
└── resources/            # Views (minimal; API-first)
```

**Key Observations:**
- **API-first architecture** — routes/api.php is the main entry point
- **Heavy service layer** — Business logic moved out of controllers
- **Observers pattern** — Real-time readiness tracking via model observers
- **Test-driven** — Feature tests cover end-to-end workflows

---

## 2. Naming Conventions

### Models
- **Format:** PascalCase, singular or plural based on semantics
- **Examples:** `User`, `Group`, `Bid`, `GroupMember`, `Title`, `Period`, `Supervision`
- **Nested concepts:** Compound models follow logical groupings (e.g., `GroupMember`, `GroupInvitation`, `GroupSupervisorProposal`)
- **Status models:** Domain-specific terms used (e.g., `TaDefenseEvaluation`, `GradeConsistencyCheck`)

### Controllers
- **Format:** PascalCase, resource name + "Controller" suffix
- **Examples:** `GroupController`, `BidController`, `FinalizationController`
- **Logical grouping:** Controllers grouped by feature domain (e.g., Ta-related: `TaSubmissionController`, `TaDefenseController`)

### Database Tables
- **Format:** snake_case, plural form
- **Examples:** `groups`, `group_members`, `group_supervisor_proposals`, `ta_defense_evaluations`
- **Pivot tables:** Explicit naming with both entities (e.g., `group_members`, not just `groups_users`)
- **Foreign keys:** `{model}_id` pattern (e.g., `group_id`, `student_id`, `supervisor_id`)

### Services
- **Format:** PascalCase + "Service" suffix
- **Examples:** `GroupService`, `BiddingService`, `FinalizationService`, `NotificationService`
- **Specialized services:** Domain-specific state machines (e.g., `GroupStateMachine`)

### Constants
- **Status values:** SHOUTY_SNAKE_CASE (e.g., `FORMING`, `READY_FOR_BIDDING`, `KELOMPOK_FINAL`, `DISSOLVED`)
- **Role values:** lowercase (e.g., `mahasiswa`, `dosen`, `admin`)

---

## 3. Observable Patterns & Architecture

### Pattern 1: State Machine Pattern
**Service:** `GroupStateMachine`
- **Purpose:** Enforce valid group status transitions
- **Design:** Centralized transition matrix (`TRANSITIONS` constant)
- **States:** Domain-specific (FORMING → READY_FOR_BIDDING → KELOMPOK_FINAL → CLOSED)
- **Used by:** Controllers & service classes validate via `canTransition()`

```php
// States: FORMING, FORMING_SOLO, SOFT_FORMING, WAITING_SUPERVISOR_APPROVAL, 
//         READY_FOR_BIDDING, KELOMPOK_FINAL, PDC1_ACTIVE, ... → CLOSED
public function transition(Group $group, string $newStatus): void
```

### Pattern 2: Service Layer with Dependency Injection
**Key Services:**
- `GroupService` — Handles group creation, joining, member management
- `BiddingService` — Bidding window logic
- `FinalizationService` — Title allocation & quota management
- `NotificationService` — Event-driven notifications
- `GroupStateMachine` — State transitions

**Design Principles:**
- Controllers inject services via constructor
- Services are stateless; business logic is isolated
- Exceptions (`DomainRuleException`, `ConflictRuleException`) used for domain violations

### Pattern 3: Observer Pattern for Side Effects
**Observers:** `GroupObserver`, `GroupMemberObserver`, `BidObserver`
- **Trigger:** Model events (created, updated)
- **Purpose:** Automatically refresh group `readiness_status` when members/bids change
- **Prevents loops:** Observers check `isDirty()` to avoid infinite triggering

### Pattern 4: Concurrency & Data Integrity
**Patterns Used:**
- **Pessimistic locking:** `lockForUpdate()` on critical resources (Users, Groups, Titles)
- **Transactions:** All state changes wrapped in `DB::transaction()`
- **Idempotency checks:** Pre-validate inside + outside transaction to prevent race conditions
- **Retry logic:** `retry(3, ...)` with exponential backoff for deadlocks

**Example from `GroupService::handleJoinGroup()`:**
```php
retry(3, function () use ($student, $targetGroup) {
    DB::transaction(function () use ($student, $targetGroup) {
        $lockedStudent = User::where('id', $student->id)->lockForUpdate()->first();
        $lockedGroup = Group::where('id', $targetGroup->id)->lockForUpdate()->first();
        // Re-check idempotency inside transaction (Hard Guarantee)
    });
});
```

### Pattern 5: Model Relationships & Fillable Protection
**Key Pattern:** Sensitive fields excluded from `$fillable` to prevent direct mutation
- **Example:** `Group::$fillable` excludes `title_id` & `assignment_type`
- **Enforcement:** Only `assignTitleFromFinalization()` and `assignTypeFromFinalization()` can set these (called only by `FinalizationService`)
- **Purpose:** Prevents accidental or unauthorized changes through mass assignment

**Relationships with Pivot Data:**
```php
// Source of truth: supervisions table
public function supervisedGroups()
{
    return $this->belongsToMany(Group::class, 'supervisions', 'supervisor_id', 'group_id')
        ->withPivot('role', 'assigned_by')
        ->withTimestamps();
}
```

### Pattern 6: Route Organization
- **Auth routes:** `/api/login`, `/api/logout`
- **Role-based grouping:** Separate route groups for `mahasiswa`, `dosen`, `admin`
- **Nested resources:** `/api/mahasiswa/group/{id}/bids`, etc.
- **Middleware:** All authenticated routes use `auth:sanctum`

### Pattern 7: Logging & Context Sharing
**Pattern Used:**
```php
Log::shareContext([
    'request_id' => Str::uuid(),
    'student_id' => $student->id,
    'group_id' => $targetGroup->id,
]);
```
- **Purpose:** Tracing across distributed operations

---

## 4. Test Structure & Conventions

### Test Organization
```
tests/
├── Feature/
│   ├── GroupManagementTest.php      # Group lifecycle
│   ├── GroupMarketplaceTest.php     # Bidding & marketplace
│   ├── BidControllerTest.php        # Bid-specific operations
│   ├── ProposalApprovalTest.php     # Approval workflows
│   ├── FinalizationQuotaTest.php    # Allocation logic
│   └── EndToEndTaLifecycleTest.php  # Full workflow (multi-period, users, phases)
└── Unit/
    ├── GroupStateMachineTest.php    # State transitions
    ├── FinalizationServiceTest.php  # Business logic
    └── ExampleTest.php
```

### Test Conventions
- **Use `RefreshDatabase`:** Reset DB before each test for isolation
- **Use `WithFaker`:** Generate realistic test data
- **Setup method:** Create roles, periods, users in `setUp()`
- **Naming:** `test_<action>_<scenario>()` (e.g., `test_student_can_create_group()`)
- **Assertions:**
  - `$response->assertStatus(201)` — HTTP status codes
  - `$this->assertDatabaseHas('groups', [...])` — DB assertions
  - Exception assertions for domain violations

### Test Data Setup Pattern
```php
protected function setUp(): void
{
    parent::setUp();
    
    // Create roles
    $this->studentRole = Role::firstOrCreate(['name' => 'Mahasiswa', 'slug' => 'mahasiswa']);
    
    // Create active period
    $this->period = Period::create([
        'name' => 'Ganjil 2023/2024',
        'is_active' => true,
        'min_group_size' => 2,
        'max_group_size' => 3,
    ]);
}
```

---

## 5. Configuration & Architectural Decisions

### Key Decisions

#### 1. **Period-Based Multi-Tenant Design**
- **Mutually exclusive periods:** Only 1 active period, only that period can be "finalized"
- **Models scoped by period:** `Period` is root entity; `Title`, `Group`, `PeriodRegistration` all have `period_id`
- **Implication:** AI agent should always validate `period_id` when querying models

#### 2. **Soft Deletes on Critical Entities**
- **Models:** `Period` uses `SoftDeletes`
- **Pattern:** Never physically delete; mark as deleted via timestamp
- **Query impact:** Must use `->withTrashed()` when needed

#### 3. **Role-Based Access Control (RBAC)**
- **Roles table:** `roles` with `slug` (mahasiswa, dosen, admin)
- **Pivot table:** `role_user` (many-to-many)
- **Middleware:** `RoleMiddleware` validates user has required role
- **Example:** `auth:sanctum` + `role:mahasiswa`

#### 4. **Bidding & Finalization Workflow**
- **Bids:** Groups submit ranked title preferences with proposed supervisors
- **Lecturer Recommendation:** Lecturers recommend ACCEPT/REJECT before finalization
- **Admin Allocation:** Admins allocate groups to titles (enforces quotas)
- **State Transitions:** READY_FOR_BIDDING → KELOMPOK_FINAL (after successful allocation)

#### 5. **Supervision Model (Source of Truth)**
- **Supervisions Table:** Explicit M2M between User & Group
- **Not in Group attributes:** `supervisor_1_id` & `supervisor_2_id` are denormalized cache
- **Purpose:** Allows audit trail (withPivot 'assigned_by', timestamps) + flexible supervisor changes

#### 6. **Document Management**
- **DocumentType:** Predefined types per phase (e.g., PDC1, PDC2, EXPO, SEMINAR, TA_DEFENSE)
- **PhaseDocumentRequirement:** Declares which documents are required per phase
- **DigitalSignature:** Tracks signatures on documents for audit

#### 7. **Audit Logging**
- **AuditLog Model:** Tracks all significant operations
- **Columns:** `action`, `model`, `model_id`, `user_id`, `changes`, `created_at`
- **Purpose:** Compliance & dispute resolution

#### 8. **Notifications**
- **Notification Model:** Broadcast events (group created, bid accepted, etc.)
- **NotificationService:** Centralizes all notification logic
- **No email integration visible:** Likely WebSocket/polling-based

---

## 6. Key Model Relationships

### Core Domain Models

#### User
- `supervisedGroups()` → Groups via `supervisions` table (M2M with pivot)
- `roles()` → Roles (M2M)
- `createdTitles()` → Titles as lecturer (1:M)
- Connects to: Group, Title, Supervision, Role

#### Period (Root Entity)
- `titles()` → All titles in this period
- `groups()` → All groups in this period
- `registrations()` → Student registrations for this period
- Fields: `is_active`, `is_finalized`, phase dates (bidding, PDC1, PDC2, EXPO, TA)

#### Group
- `period()` → Period (M:1)
- `title()` → Assigned title (optional, M:1)
- `members()` → GroupMembers (1:M)
- `students()` → Users via `group_members` (M2M)
- `bids()` → Bids submitted (1:M)
- `supervisorProposals()` → GroupSupervisorProposals (1:M)
- `supervisions()` → Assigned supervisors via `supervisions` (1:M)
- Fields: `status`, `supervisor_1_id` (cache), `supervisor_2_id` (cache), `readiness_status` (array)

#### Title
- `lecturer()` → Lecturer who owns it (M:1, User)
- `period()` → Period (M:1)
- `groups()` → Groups allocated to this title (1:M)
- `bids()` → Bids on this title (1:M)
- `proposedByGroup()` → If proposal, the proposing group (M:1)
- `proposedSupervisor()` → If proposal, the supervisor for approval (M:1)
- Fields: `quota`, `title_source` (LECTURER | STUDENT), `supervisor_approval_status`

#### Bid
- `group()` → Bidding group (M:1)
- `title()` → Bid target (M:1)
- `proposedSupervisor1()` → User (M:1)
- `proposedSupervisor2()` → User (M:1)
- Fields: `status` (PENDING, ACCEPTED, REJECTED), `lecturer_recommendation`, `priority`

#### Supervision
- Links User & Group with metadata
- Fields: `role` (supervisor role), `assigned_by` (admin ID)

#### GroupMember
- `group()` → Group (M:1)
- `student()` → User (M:1)
- `period()` → Period (M:1)
- Fields: `is_leader` (boolean)

#### Assessment & Evaluation Models
- `AssessmentComponent` → Category (seminar, TA defense)
- `AssessmentScore` → Score for a component
- `PeerReview` → Student peer reviews
- `GradeConsistencyCheck` → Auto-validation of grade ranges

#### TA Lifecycle
- `TaSubmission` → Group's TA submission
- `TaDefenseSchedule` → Schedule for defense
- `TaDefenseExaminer` → Examiners assigned
- `TaDefenseEvaluation` → Grades

---

## 7. Services Deep Dive

### GroupService
**Responsibility:** Group lifecycle management, member operations
**Key Methods:**
- `handleJoinGroup()` — Atomic join with concurrency locking
- `validateJoinRequest()` — Pre-checks (period active, group not full, student not already member)
- `createGroup()` — Student creates group (becomes leader)
- Handles: Invitations, join requests, member removal

**Pattern:** Validates all pre-conditions, uses DB transactions, logs context

### BiddingService
**Responsibility:** Bidding window management
**Key Methods:**
- `isWindowOpen()` — Check if bidding is currently open
- `isBiddingLocked()` — Check if admin locked bidding
- `lockBidding()`, `unlockBidding()` — Admin controls

**Pattern:** Simple state checking; delegates to Period model

### FinalizationService
**Responsibility:** Title allocation after bidding closes
**Key Methods:**
- `allocateGroup()` — Allocate group to title (accepts bid, rejects others, creates supervisions, transitions state)
- `validateQuota()` — Check if title quota is available (with row locking)

**Pattern:** Heavy use of transactions + locking; enforces governance rules (lecturer recommendation, supervisor approval)

### GroupStateMachine
**Responsibility:** Validate & enforce state transitions
**Key Methods:**
- `canTransition()` — Check if transition is allowed
- `transition()` — Apply transition (throws if invalid)

**Pattern:** Declarative transition matrix; pure logic, no side effects

### NotificationService
**Responsibility:** Event-driven notifications
**Key Methods:**
- (Details not fully explored, but likely fires on group/bid/allocation events)

**Pattern:** Likely uses Laravel events or explicit job dispatch

---

## 8. Common AI Agent Patterns to Know

### 1. Always Validate Period Context
```php
// Group creation or listing should always check:
$group->period()->where('is_finalized', false)->first();
```

### 2. Use State Machine Before Transitions
```php
if ($this->stateMachine->canTransition($group->status, 'READY_FOR_BIDDING')) {
    $this->stateMachine->transition($group, 'READY_FOR_BIDDING');
}
```

### 3. Check $fillable Before Mass Assignment
```php
// DON'T: $group->update(['title_id' => 5]); // Will silently fail
// DO: $group->assignTitleFromFinalization(5); $group->save();
```

### 4. Use Transactions for Multi-Step Operations
```php
DB::transaction(function () {
    $group->update(['status' => 'KELOMPOK_FINAL']);
    Supervision::create([...]);
});
```

### 5. Lock Resources in Consistent Order
```php
$user = User::lockForUpdate()->find($userId);
$group = Group::lockForUpdate()->find($groupId);
// Prevents deadlocks
```

### 6. Test with RefreshDatabase & Real Roles
```php
use RefreshDatabase;
protected function setUp() {
    parent::setUp();
    Role::firstOrCreate(['slug' => 'mahasiswa']);
}
```

---

## Summary Table

| Aspect | Pattern | Key Tools |
|--------|---------|-----------|
| **Models** | Declarative with protected `$fillable`, relationships explicit | Eloquent, Observers |
| **Business Logic** | Service layer with dependency injection | Controllers → Services → Models |
| **State** | State machine for workflows | `GroupStateMachine` constant matrix |
| **Concurrency** | Pessimistic locking + transactions + idempotency | `lockForUpdate()`, `DB::transaction()` |
| **Validation** | Pre-flight checks + guard clauses + domain exceptions | `DomainRuleException`, `ConflictRuleException` |
| **Side Effects** | Model observers for readiness tracking | `GroupObserver`, `GroupMemberObserver`, `BidObserver` |
| **Auth** | Role-based RBAC with Sanctum tokens | `auth:sanctum`, `RoleMiddleware`, `roles` pivot table |
| **Testing** | Feature tests with test data setup, DB assertions | Feature & Unit tests, `RefreshDatabase` |
| **Multi-Tenancy** | Period-scoped; all models reference `period_id` | `Period` as root, queries filter by period |
| **Audit** | Soft deletes + explicit `AuditLog` + pivot timestamps | `SoftDeletes`, `withTimestamps()` |

