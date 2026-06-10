# SICATA — Diagram Arsitektur Sistem

> File ini berisi diagram arsitektur sistem SICATA dalam format Mermaid.
> Buka di GitHub, GitLab, atau editor yang mendukung Mermaid untuk melihat diagram.

---

## 1. Diagram Arsitektur Sistem (System Architecture)

```mermaid
graph TB
    subgraph Actors["Pengguna Sistem"]
        A1[("👤 Admin")]
        A2[("👨‍🏫 Dosen")]
        A3[("👨‍🎓 Mahasiswa")]
    end

    subgraph Frontend["Frontend — Next.js 16 (TypeScript)"]
        direction TB
        F1["App Router<br/>admin/* | dosen/* | mahasiswa/*"]
        F2["Components<br/>Shadcn UI + Radix UI"]
        F3["State Management<br/>React Context + Hooks"]
        F4["API Client<br/>Axios + Bearer Token"]
    end

    subgraph Backend["Backend — Laravel 12 API (PHP 8.2+)"]
        direction TB
        B1["Laravel Sanctum<br/>Token Auth"]
        B2["Middleware<br/>auth:sanctum + role RBAC"]
        
        subgraph Controllers["Controllers (48)"]
            C1["AuthController"]
            C2["Admin Controllers"]
            C3["Dosen Controllers"]
            C4["Mahasiswa Controllers"]
            C5["Shared Controllers"]
        end

        subgraph Services["Service Layer (15)"]
            S1["GroupStateMachine"]
            S2["GroupService"]
            S3["FinalizationService"]
            S4["BiddingService"]
            S5["SchedulingService"]
            S6["GradeCalculationService"]
            S7["WorkflowService"]
            S8["PeerReviewService"]
            S9["NotificationService"]
            S10["AutoMatchmakerService"]
        end

        subgraph Observers["Observers"]
            O1["GroupObserver"]
            O2["GroupMemberObserver"]
            O3["BidObserver"]
        end

        subgraph Jobs["Queue Jobs"]
            J1["RecalculateGroupStatus"]
            J2["RefreshGroupReadiness"]
            J3["RefreshGroupReadinessBatch"]
        end

        subgraph Models["Eloquent Models (49)"]
            M1["User | Role | Period"]
            M2["Group | GroupMember"]
            M3["Title | Bid | Supervision"]
            M4["Document | DocumentType"]
            M5["Schedule | SeminarSchedule"]
            M6["ExpoEvent | ExpoRegistration"]
            M7["TaSubmission | TaDefenseSchedule"]
            M8["Assessment Components"]
            M9["PeerReview | PeerReviewIndicator"]
            M10["Notification | AuditLog"]
            M11["GradeConfiguration | GradeConsistencyCheck"]
            M12["DigitalSignature"]
        end
    end

    subgraph Database["Database Layer"]
        DB1[("PostgreSQL<br/>(Production — AWS Neon)")]
        DB2[("SQLite<br/>(Development Fallback)")]
        DB3[("Redis<br/>(Cache & Queue)")]
    end

    %% Actor Connections
    A1 --> F1
    A2 --> F1
    A3 --> F1

    %% Frontend to Backend
    F4 --> B1
    F4 --> B2

    %% Backend Flow
    B1 --> B2
    B2 --> C1
    B2 --> C2
    B2 --> C3
    B2 --> C4
    B2 --> C5
    
    C1 --> S1
    C1 --> S2
    C2 --> S1
    C2 --> S2
    C2 --> S3
    C2 --> S4
    C2 --> S5
    C3 --> S1
    C3 --> S2
    C3 --> S6
    C3 --> S8
    C4 --> S1
    C4 --> S2
    C4 --> S4
    C4 --> S8
    
    S1 --> M2
    S2 --> M2
    S3 --> M10
    S4 --> M3
    S5 --> M5
    S6 --> M11
    S7 --> M2
    S8 --> M9
    S9 --> M10

    M1 --> DB1
    M2 --> DB1
    M3 --> DB1
    M4 --> DB1
    M5 --> DB1
    M6 --> DB1
    M7 --> DB1
    M8 --> DB1
    M9 --> DB1
    M10 --> DB1
    M11 --> DB1
    M12 --> DB1

    DB1 -.-> DB2
    DB1 -.-> DB3

    %% Observers watch Models
    M2 -.-> O1
    M2 -.-> O2
    M3 -.-> O3
    O1 -.-> J1
    O2 -.-> J2
    O3 -.-> J2
    J1 -.-> M2
    J2 -.-> M2
```

---

## 2. State Machine Grup

```mermaid
stateDiagram-v2
    [*] --> FORMING
    [*] --> FORMING_SOLO

    FORMING --> READY_FOR_BIDDING: Anggota cukup
    FORMING --> WAITING_SUPERVISOR_APPROVAL: Submit proposal
    FORMING --> DISSOLVED: Grup bubar

    FORMING_SOLO --> WAITING_SUPERVISOR_APPROVAL: Submit proposal
    FORMING_SOLO --> TITLE_APPROVED: Proposal disetujui
    FORMING_SOLO --> DISSOLVED: Grup bubar

    READY_FOR_BIDDING --> FORMING: Anggota kurang
    READY_FOR_BIDDING --> WAITING_SUPERVISOR_APPROVAL: Submit proposal
    READY_FOR_BIDDING --> TITLE_APPROVED: Bid diterima
    READY_FOR_BIDDING --> READY_FOR_FINALIZATION: Leader ready
    READY_FOR_BIDDING --> DISSOLVED: Grup bubar

    WAITING_SUPERVISOR_APPROVAL --> TITLE_APPROVED: Solo approved
    WAITING_SUPERVISOR_APPROVAL --> READY_FOR_BIDDING: Reguler approved
    WAITING_SUPERVISOR_APPROVAL --> DISSOLVED: Grup bubar

    TITLE_APPROVED --> READY_FOR_FINALIZATION: Leader ready
    TITLE_APPROVED --> KELOMPOK_FINAL: Finalisasi (merge)
    TITLE_APPROVED --> DISSOLVED: Grup bubar

    READY_FOR_FINALIZATION --> KELOMPOK_FINAL: Admin finalisasi batch
    READY_FOR_FINALIZATION --> READY_FOR_BIDDING: Leader revert
    READY_FOR_FINALIZATION --> DISSOLVED: Grup bubar

    KELOMPOK_FINAL --> PDC1_ACTIVE

    PDC1_ACTIVE --> READY_FOR_SEMPRO
    READY_FOR_SEMPRO --> SEMPRO_DONE: Lulus SEMPRO
    READY_FOR_SEMPRO --> PDC1_ACTIVE: Gagal SEMPRO

    SEMPRO_DONE --> PDC2_ACTIVE
    PDC2_ACTIVE --> PDC2_READY_FOR_EXPO
    PDC2_READY_FOR_EXPO --> EXPO_REGISTERED
    EXPO_REGISTERED --> EXPO_DONE: Lulus EXPO
    EXPO_REGISTERED --> PDC2_ACTIVE: Gagal EXPO
    EXPO_REGISTERED --> PDC2_READY_FOR_EXPO: Batal EXPO

    EXPO_DONE --> READY_FOR_TA_INDIVIDUAL
    READY_FOR_TA_INDIVIDUAL --> CLOSED: Semua defended

    DISSOLVED --> [*]
    CLOSED --> [*]
```

---

## 3. Alur Data End-to-End

```mermaid
sequenceDiagram
    participant M as Mahasiswa
    participant F as Frontend (Next.js)
    participant B as Backend (Laravel)
    participant D as Database (PostgreSQL)
    participant Q as Queue/Redis

    Note over M,D: FASE 1: PEMBENTUKAN GRUP
    M->>F: Login + Pilih Periode
    F->>B: POST /api/login
    B->>B: Sanctum auth
    B->>F: Token + User
    F->>F: Simpan token (Context)
    M->>F: Buat grup / Gabung grup
    F->>B: POST /api/mahasiswa/group
    B->>B: GroupService
    B->>D: Insert group + members
    B->>Q: Dispatch RefreshGroupReadiness
    Q->>B: Update readiness status
    B->>F: Group created

    Note over M,D: FASE 2: PENENTUAN JUDUL
    M->>F: Bid judul / Propose judul
    F->>B: POST /api/mahasiswa/bids
    B->>B: BiddingService
    B->>D: Insert bid
    B->>F: Bid submitted

    Dosen->>F: Review bid
    F->>B: PUT /api/dosen/bids/{id}/recommend
    B->>B: Approve/reject
    B->>D: Update bid status
    B->>F: Bid reviewed

    Note over M,D: FASE 3: FINALISASI
    Admin->>F: Finalisasi batch
    F->>B: POST /api/admin/finalization/finalize-period/{id}
    B->>B: FinalizationService.validate()
    B->>D: Check all groups
    B->>B: Atomic commit/rollback
    B->>D: Update groups → KELOMPOK_FINAL
    B->>F: Finalization result

    Note over M,D: FASE 4-6: PDC1 → SEMPRO → PDC2 → EXPO → TA
    M->>F: Upload dokumen
    F->>B: POST /api/mahasiswa/documents
    B->>D: Insert document
    Dosen->>F: Review dokumen
    F->>B: PUT /api/dosen/documents/{id}
    B->>D: Update status → APPROVED/REJECTED
    B->>F: Document reviewed

    Admin->>F: Jadwalkan SEMPRO
    F->>B: POST /api/admin/sempro/schedule
    B->>B: SchedulingService
    B->>B: Conflict detection
    B->>D: Insert seminar_schedules
    B->>D: Auto-generate evaluations
    B->>F: Schedule created

    M->>F: Ikut seminar
    Dosen->>F: Evaluasi
    F->>B: POST /api/dosen/sempro/{id}/evaluate
    B->>D: Insert scores
    B->>B: GradeCalculationService
    B->>F: Evaluation saved

    Note over M,D: FASE 7: PENUTUPAN
    Admin->>F: Recalculate grades
    F->>B: POST /api/admin/grade-consistency/recheck
    B->>D: Check grades
    B->>F: Consistency report
```

---

## 4. Deployment Architecture

```mermaid
graph LR
    subgraph Client["Client Side"]
        BROWSER["Browser"]
    end

    subgraph CDN["CDN / Hosting"]
        STATIC["Static Assets<br/>(Next.js Build)"]
    end

    subgraph Server["Server Side"]
        direction TB
        API["Laravel API<br/>PHP 8.2+"]
        QUEUE_WORKER["Queue Worker<br/>(php artisan queue:work)"]
        SCHEDULER["Scheduler<br/>(php artisan schedule:run)"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL<br/>AWS Neon")]
        REDIS[("Redis<br/>(Cache)")]
        STORAGE[("File Storage<br/>(Local/S3)")]
    end

    BROWSER --> STATIC
    BROWSER --> API
    API --> PG
    API --> REDIS
    API --> STORAGE
    QUEUE_WORKER --> PG
    QUEUE_WORKER --> REDIS
    SCHEDULER --> QUEUE_WORKER
```

---

## 5. Pola Arsitektur (Design Patterns)

```mermaid
graph TB
    subgraph Patterns["Pola Arsitektur SICATA"]
        direction TB

        P1["API-First<br/>Frontend & Backend terpisah<br/>Komunikasi via REST JSON"]
        P2["Service Layer<br/>Business logic di Services<br/>Controller hanya orchestrator"]
        P3["State Machine<br/>GroupStateMachine<br/>14 status + transisi valid"]
        P4["Observer<br/>Auto-refresh readiness<br/>Saat data grup/anggota berubah"]
        P5["Period-based<br/>Multi-Tenancy<br/>Data di-scope per period_id"]
        P6["Repository<br/>Akses database<br/>Terpusat via Repositories"]
        P7["Atomic Batch<br/>Finalisasi all-or-nothing<br/>Commit/Rollback"]
    end

    P1 --> P2
    P1 --> P3
    P2 --> P6
    P3 --> P4
    P4 --> P5
    P7 --> P5
```
