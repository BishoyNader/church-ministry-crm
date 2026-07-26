# Church Ministry CRM — System Architecture

## Overview

Church Ministry CRM is a multi-tenant SaaS platform for managing church ministries, children, attendance, follow-ups, events, and AI-assisted insights. The system is designed for Arabic-first users with full RTL support, role-based access control, and strict tenant isolation.

---

## Architecture Principles

| Principle | Implementation |
|-----------|----------------|
| Multi-tenancy | Every data row scoped by `church_id`; RLS enforced at database level |
| Separation of concerns | UI, business logic, and data layer are isolated |
| Security by default | RBAC + RLS + input validation + audit logging |
| Arabic-first | Default locale `ar`, RTL layout, bilingual content fields |
| Performance | Pagination, indexed queries, TanStack Query caching |
| Scalability | Feature-based modules, stateless API, Supabase managed Postgres |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│  Next.js 15 App Router · React · Tailwind · shadcn/ui · RTL        │
│  TanStack Query · Zustand · React Hook Form · Zod                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE (Edge)                                │
│  Pages (Static + SSR) · Workers (Edge Functions) · CDN             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APPLICATION                              │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │   /app      │  │  /features   │  │  /actions · /services   │   │
│  │  (Routes)   │  │  (Modules)   │  │  (Business Logic)       │   │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘   │
│         │                │                       │                  │
│         └────────────────┴───────────────────────┘                  │
│                               │                                     │
│                    ┌──────────┴──────────┐                          │
│                    │   /lib · /hooks     │                          │
│                    │   Data Access Layer │                          │
│                    └──────────┬──────────┘                          │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Supabase Auth  │  │  Supabase DB    │  │ Supabase Storage│
│  Email · Phone  │  │  PostgreSQL     │  │  Photos · Docs  │
│  JWT Sessions   │  │  pgvector · RLS │  │  Signed URLs    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │                     │
          │                     ▼
          │            ┌─────────────────┐
          │            │  OpenAI API     │  (Phase 3)
          │            │  RAG · Tools    │
          │            └─────────────────┘
          │
          ▼
┌─────────────────┐  ┌─────────────────┐
│  Resend (Email) │  │  Sentry         │
│  Notifications  │  │  Monitoring     │
└─────────────────┘  └─────────────────┘
```

---

## Application Layers

### 1. Presentation Layer (`/app`, `/components`)

- **App Router**: Route groups for `(auth)`, `(dashboard)`, and `(public)`
- **Layouts**: Root layout with RTL/LTR switching, theme provider, locale provider
- **Components**: Shared UI primitives (shadcn/ui) and layout shells
- **Features**: Feature-specific UI colocated under `/features`

Responsibilities: rendering, user interaction, form state, optimistic UI, accessibility.

### 2. Feature Layer (`/features`)

Each feature is a self-contained module:

```
/features/{feature-name}/
  components/     # Feature-specific UI
  hooks/          # Feature-specific React hooks
  schemas/        # Zod validation schemas
  types/          # TypeScript types
  utils/          # Feature helpers
  index.ts        # Public API barrel export
```

Phase 1 features: `auth`, `users`, `stages`, `children`, `attendance`, `dashboard`.

### 3. Business Logic Layer (`/actions`, `/services`)

- **Server Actions** (`/actions`): Mutations invoked from the client; validate input, enforce permissions, call services
- **Services** (`/services`): Pure business logic, orchestration, no React dependencies

```
Client → Server Action → Service → Supabase Client → Database (RLS)
```

### 4. Data Access Layer (`/lib`)

- Supabase client factories (browser, server, admin)
- Query builders and typed database helpers
- Permission checking utilities
- Audit log writer

### 5. Cross-Cutting Concerns

| Concern | Location | Mechanism |
|---------|----------|-----------|
| Authentication | `/lib/supabase`, middleware | Supabase Auth JWT |
| Authorization | `/lib/permissions`, RLS | RBAC + stage scoping |
| Validation | `/features/*/schemas` | Zod |
| i18n | `/lib/i18n` | next-intl or custom |
| Theming | `/components/providers` | next-themes |
| Error tracking | `/lib/sentry` | Sentry SDK |
| Audit | `/services/audit` | DB trigger + service |

---

## Multi-Tenancy Model

```
Church (tenant root)
  ├── Ministries
  │     └── Stages (age groups / service units)
  ├── Users (profiles + roles)
  ├── Children (assigned to stage)
  ├── Attendance, Follow-ups, Events, ...
  └── Audit logs, Documents, AI conversations
```

**Tenant isolation rules:**

1. Every table includes `church_id` (except global `permissions`)
2. All queries filter by the authenticated user's `church_id`
3. Supabase RLS policies enforce isolation — no application bypass
4. Super Admin can manage multiple churches (future); Church Admin scoped to one church
5. Stage Leader and Servant scoped to assigned stages via `user_stage_assignments`

---

## Authentication Flow

```
┌──────────┐    login/signup     ┌──────────────┐
│  Client  │ ──────────────────► │ Supabase Auth│
└──────────┘                     └──────┬───────┘
     ▲                                  │ JWT
     │                                  ▼
     │                          ┌──────────────┐
     │    session cookie        │  Middleware  │
     └──────────────────────────│  (Next.js)   │
                                └──────┬───────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │  profiles    │
                                │  user_roles  │
                                └──────────────┘
```

**Login methods:** email + password, phone + OTP.

**First user bootstrap:** On church creation, the registering user receives `super_admin` role via database trigger.

**Session management:** Supabase SSR cookies; optional "Remember Me" extends session duration.

---

## Authorization Model (RBAC)

```
Permissions (global catalog)
       │
       ▼
Role Permissions (per church role)
       │
       ▼
User Roles (user ↔ role ↔ church)
       │
       ▼
User Stage Assignments (stage-scoped access)
```

| Role | Scope | Capabilities |
|------|-------|--------------|
| Super Admin | Platform | Full access, church management |
| Church Admin | Church | All church data, user management |
| Stage Leader | Assigned stages | Manage children, attendance, follow-ups in stage |
| Servant | Assigned stages | Record attendance, view children, limited edits |
| Viewer | Assigned stages | Read-only access |

**Enforcement points:**

1. **Database (RLS)**: Primary enforcement — policies check role + stage assignment
2. **Server Actions**: Permission check before mutation
3. **Frontend**: Hide/disable UI elements based on permissions (UX only, not security)

---

## Data Flow Patterns

### Read (Query)

```
Page/Component
  → useQuery (TanStack Query)
    → Server Action or Route Handler
      → Service.getX(churchId, filters)
        → supabase.from('table').select().eq('church_id', churchId)
          → RLS validates access
            → Return typed data
```

### Write (Mutation)

```
Form Submit
  → useMutation (TanStack Query)
    → Server Action (Zod validate + permission check)
      → Service.createX(data)
        → supabase.from('table').insert(data)
          → RLS validates access
            → Audit log trigger fires
              → Invalidate query cache
```

---

## API Design

Phase 1 uses **Server Actions** exclusively (no REST API surface). Route Handlers reserved for:

- Webhooks (Phase 4 — WhatsApp)
- File upload callbacks
- Health checks

All Server Actions follow this contract:

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
```

---

## Storage Architecture

```
Supabase Storage Buckets:
  church-assets/     → church logos
  child-photos/      → child profile photos
  documents/         → PDFs, Excel, general files

Path convention:
  {church_id}/{entity_type}/{entity_id}/{filename}

Access:
  - Private buckets with signed URLs (1-hour expiry)
  - RLS on storage.objects mirrors database policies
```

---

## Internationalization (i18n)

| Aspect | Default | Optional |
|--------|---------|----------|
| UI language | Arabic (`ar`) | English (`en`) |
| Text direction | RTL | LTR |
| Content fields | `*_ar` primary | `*_en` secondary |
| Date/number format | `ar-EG` locale | `en-US` locale |

Implementation: `next-intl` with locale stored in cookie/user preference.

---

## Security Architecture

```
┌─────────────────────────────────────────────┐
│              Defense in Depth               │
├─────────────────────────────────────────────┤
│ 1. Cloudflare WAF + DDoS protection        │
│ 2. Next.js middleware (auth + CSRF)        │
│ 3. Zod input validation (server actions)   │
│ 4. RBAC permission checks (server)         │
│ 5. Supabase RLS (database)                 │
│ 6. Audit logging (all mutations)           │
│ 7. Rate limiting (auth endpoints)          │
│ 8. Signed URLs (file access)               │
└─────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
GitHub Repository
       │
       ▼
Cloudflare Pages (CI/CD)
       │
       ├── Build: next build
       ├── Env vars: Supabase keys, OpenAI, Resend, Sentry
       └── Deploy: Edge SSR + Static assets
       
Supabase Project (managed)
       ├── PostgreSQL + pgvector
       ├── Auth
       ├── Storage
       └── Edge Functions (future)
```

**Environments:** `development` (local Supabase), `staging`, `production`.

---

## Phase 1 Module Map

```
/auth          → Login, signup, password reset, session
/users         → User CRUD, role assignment, stage assignment
/stages        → Ministry and stage management
/children      → Child profiles, timeline (attendance only in P1)
/attendance    → Weekly recording, history, basic stats
/dashboard     → KPIs: total children, attendance rate, stage breakdown
```

Modules planned for later phases are defined in the database schema but not implemented in Phase 1.

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 15 App Router | SSR, Server Actions, Cloudflare Pages support |
| Database | Supabase (Postgres) | Auth + DB + Storage + RLS in one platform |
| State (server) | TanStack Query | Caching, invalidation, optimistic updates |
| State (client) | Zustand | Minimal global UI state (sidebar, locale) |
| Forms | React Hook Form + Zod | Performance + type-safe validation |
| UI | shadcn/ui + Tailwind | Accessible, customizable, RTL-compatible |
| Hosting | Cloudflare Pages | Edge performance, global CDN |
| Monitoring | Sentry | Error tracking, performance monitoring |
