# Church Ministry Platform — System Architecture

**Version:** 1.0  
**Status:** Final  
**Source of truth:** PRD_V3.md, MVP_SCOPE.md, DATABASE_REQUIREMENTS.md, RBAC_ARCHITECTURE.md, GAP_ANALYSIS.md  
**Target audience:** Engineering team (senior engineers, architects, QA)

---

## 1. Executive Architecture Overview

### 1.1 Architecture Style

The platform uses a **Backend-for-Frontend (BFF)** architecture with **Server Actions** as the API layer. Next.js App Router serves as both the frontend and the API gateway. Supabase provides the database, authentication, and row-level security.

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Edge + Server)                │
│                                                         │
│   Next.js 16 App Router                                 │
│   ┌─────────────────────────────────────────────────┐   │
│   │  Pages (RSC) → Server Actions → Service Layer   │   │
│   │                                              │   │   │
│   │  Client Components ← TanStack Query          │   │   │
│   └──────────────────────────────────────────────┘   │   │
│                          │                              │
├──────────────────────────┼──────────────────────────────┤
│                    Supabase                              │
│   ┌─────────────────────────────────────────────────┐   │
│   │  Auth (email/password, session)                 │   │
│   │  PostgreSQL + RLS (60+ policies)                │   │
│   │  Storage (avatars, imports)                     │   │
│   │  Edge Functions (Phase 2: webhooks, cron)       │   │
│   └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| Framework | Next.js 16 (App Router) | React Server Components, Server Actions, i18n, RSC streaming |
| Language | TypeScript 5+ | Type safety across full stack |
| UI | React 19 + Tailwind 4 + shadcn/ui | Design system consistency, RTL support, dark mode |
| State (server) | React Server Components | Zero JS for static content |
| State (client) | TanStack Query 5 | Server state caching, optimistic updates, invalidation |
| Database | Supabase (PostgreSQL 15) | RLS, auth integration, real-time subscriptions |
| ORM / Client | Supabase JS client (`@supabase/supabase-js`, `@supabase/ssr`) | Type-safe DB access, RLS-aware |
| Auth | Supabase Auth | Built-in email/password, session management, webhooks |
| Validation | Zod 3+ | Schema validation at the boundary |
| i18n | next-intl | RTL support, ICU message format, namespace-based |
| Hosting | Vercel | Next.js-native deployment, edge functions, ISR |
| Monitoring | Sentry + Vercel Analytics | Error tracking, performance monitoring |

### 1.3 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Server Actions over REST/GraphQL | Co-located mutation logic, no API versioning, direct DB access with RLS |
| RLS over schema-per-tenant | Lower operational complexity, shared connection pool, easier migrations |
| Church ID on every table | Enables universal RLS policy pattern: `church_id = get_church_id()` |
| Temporal assignments (start/end date) | Supports annual role changes without data loss |
| Immutable audit log | INSERT-only table; triggers prevent UPDATE/DELETE |
| No ORM abstraction | Supabase JS client is the typed query builder — adding Prisma/etc. adds indirection without benefit |
| App-level audit in MVP, DB triggers in Phase 2 | MVP speed; Phase 2 hardening |

---

## 2. Multi-Tenant Architecture

### 2.1 Isolation Model

**Row-Level Security (RLS)** with `church_id` on every data table.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Church A   │    │   Church B   │    │   Church C   │
│  church_id=1 │    │  church_id=2 │    │  church_id=3 │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
              ┌────────────┴────────────┐
              │  Shared PostgreSQL DB   │
              │  RLS: church_id = auth  │
              └─────────────────────────┘
```

### 2.2 RLS Policy Pattern

Every tenant-scoped table gets exactly three RLS policies:

```sql
-- 1. Tenant isolation (all operations)
CREATE POLICY tenant_isolation ON <table>
  USING (church_id = (SELECT church_id FROM profiles WHERE id = auth.uid()));

-- 2. Insert check
CREATE POLICY tenant_insert ON <table>
  FOR INSERT
  WITH CHECK (church_id = (SELECT church_id FROM profiles WHERE id = auth.uid()));

-- 3. Super Admin bypass (for church-wide reads)
CREATE POLICY super_admin_read ON <table>
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.role_type = 'super_admin'
        AND ur.church_id = <table>.church_id
    )
  );
```

### 2.3 Church ID Resolution

The `church_id` is **never** accepted as a client-supplied parameter. It is derived server-side from the authenticated user's profile:

```typescript
// Helper — every Server Action uses this
async function getChurchId(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthenticationError();
  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new ProfileNotFoundError();
  return profile.church_id;
}
```

### 2.4 Tenant Provisioning Flow

```
Registration Form Submitted
       │
       ▼
Create auth user (admin.auth.admin.createUser)
       │
       ▼
Create church row (churches table)
       │
       ▼
Create profile row (profiles table) — links auth.uid → church_id
       │
       ▼
Seed roles (super_admin, admin, user) via RPC
       │
       ▼
Seed default permissions for each role
       │
       ▼
Assign user as super_admin of new church
       │
       ▼
Send welcome email
```

### 2.5 Cross-Tenant Prevention Checklist

- [ ] No API endpoint accepts `church_id` as a client parameter
- [ ] All service functions derive `church_id` from the authenticated session
- [ ] RLS enabled on every tenant-scoped table (verified in CI)
- [ ] `createAdminClient()` never used for application queries
- [ ] Platform Owner uses separate admin interface with distinct auth

---

## 3. Authentication Architecture

### 3.1 Flow

```
Login Request
       │
       ▼
Server Action: loginAction(email, password)
       │
       ├─► Validate input (Zod)
       ├─► Check account is_active (admin client — no session yet)
       ├─► supabase.auth.signInWithPassword()
       ├─► Update last_login_at
       ├─► Write audit log (login)
       └─► Return success + redirect

Signup Request
       │
       ▼
Server Action: signupAction(values)
       │
       ├─► Validate input (Zod)
       ├─► Create auth user (admin client, email_confirm: true in dev)
       ├─► Create church
       ├─► Create profile
       ├─► Seed roles & permissions
       ├─► Assign super_admin role
       └─► Return success + redirect to login
```

### 3.2 Session Management

| Property | Value |
|----------|-------|
| Provider | Supabase Auth (PKCE flow) |
| Storage | HTTP-only cookies (via `@supabase/ssr`) |
| Session duration | 24 hours (configurable) |
| Refresh | Automatic (Supabase SSR handles token refresh) |
| Logout | `supabase.auth.signOut()` → clear cookies → audit log |

### 3.3 Middleware (Auth Guard)

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  // Public routes: /login, /signup, /forgot-password, /reset-password, /
  if (isPublicRoute(request.nextUrl.pathname)) {
    return response;
  }

  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // Check church is active
  const profile = await getProfile(user.id);
  if (profile && !profile.is_active) {
    await signOut();
    return NextResponse.redirect(new URL(`/${locale}/login?reason=inactive`, request.url));
  }

  return response;
}
```

### 3.4 Password Policy

| Requirement | Value |
|-------------|-------|
| Minimum length | 8 characters |
| Complexity | At least 1 uppercase, 1 lowercase, 1 digit |
| Rate limiting | 5 attempts per 15 minutes per IP |
| Reset flow | Email-based password reset via Supabase Auth |
| History | No repeat of last 5 passwords (Phase 2) |

---

## 4. Authorization & RBAC Enforcement Architecture

### 4.1 Three-Layer Enforcement

```
Layer 1: UI (Component Guards)
┌─────────────────────────────────────────┐
│  <PermissionGuard code="beneficiaries.create">     │
│    <CreateBeneficiaryButton />                    │
│  </PermissionGuard>                               │
│  <RoleGuard role="super_admin">                   │
│    <ManageRolesPanel />                           │
│  </RoleGuard>                                     │
└─────────────────────────────────────────┘
          │
          ▼
Layer 2: Server Action (Application Check)
┌─────────────────────────────────────────┐
│  export async function createBeneficiaryAction() {  │
│    const user = await getUser();                    │
│    if (!user) return { success: false };            │
│    if (!await hasPermission('beneficiaries.create'))│
│      return { success: false };                     │
│    // ... proceed                                   │
│  }                                                  │
└─────────────────────────────────────────┘
          │
          ▼
Layer 3: Database (RLS)
┌─────────────────────────────────────────┐
│  CREATE POLICY tenant_isolation ON beneficiaries    │
│    USING (church_id = get_church_id());              │
│                                                     │
│  CREATE POLICY servant_scope ON beneficiaries         │
│    FOR SELECT                                       │
│    USING (                                           │
│      id IN (SELECT beneficiary_id                    │
│              FROM beneficiary_assignments            │
│              WHERE servant_id = auth.uid())          │
│    );                                                │
└─────────────────────────────────────────┘
```

### 4.2 Permission Check Utility

```typescript
// src/lib/rbac/permission-check.ts

export async function hasPermission(code: PermissionCode): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Load user's permissions (cached per request)
  const permissions = await loadUserPermissions(supabase, user.id);

  return permissions.includes(code);
}

export async function hasStageAccess(
  stageId: string,
  requiredRole: 'admin' | 'user'
): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: assignment } = await supabase
    .from("servant_stage_assignments")
    .select("role")
    .eq("servant_id", user.id)
    .eq("stage_id", stageId)
    .is("end_date", null)
    .single();

  if (!assignment) return false;

  if (requiredRole === 'admin') return assignment.role === 'admin';
  if (requiredRole === 'user') return ['admin', 'user'].includes(assignment.role);
  return false;
}
```

### 4.3 Server Action Permission Pattern

Every mutation Server Action follows this pattern:

```typescript
export async function someAction(input: Input): Promise<ActionResult> {
  // 1. Validate input
  const parsed = schema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  // 2. Authenticate
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Unauthenticated" };

  // 3. Authorize
  if (!(await hasPermission(PERMISSION_CODES.SOME_ACTION))) {
    return { success: false, message: "Unauthorized" };
  }

  // 4. Get church context
  const churchId = await getChurchId(supabase);

  // 5. Execute (pass supabase client, NOT admin client)
  const result = await service.someAction(supabase, churchId, parsed.data);

  // 6. Audit
  await auditLog(supabase, "create", "entity", result.data.id, undefined, parsed.data);

  // 7. Return
  return { success: true, data: result.data };
}
```

---

## 5. Church → Service → Stage → Class Hierarchy

### 5.1 Data Hierarchy

```
Church
  │
  ├── Services (e.g., "Youth Service", "Children's Service")
  │     │
  │     ├── Stages (e.g., "Intermediate", "Advanced")
  │     │     │
  │     │     ├── Classes (optional)
  │     │     │     ├── "First Year"
  │     │     │     └── "Second Year"
  │     │     │
  │     │     └── Beneficiaries (may link directly to Stage or via Class)
  │     │
  │     └── Servant Assignments (servant → stage with role)
  │
  └── Configuration (roles, permissions, settings)
```

### 5.2 Referential Integrity

```sql
-- Services: owned by church
services.church_id → churches.id

-- Stages: owned by service, transitively by church
stages.service_id → services.id
stages.church_id → churches.id

-- Classes: owned by stage, transitively by church
classes.stage_id → stages.id
classes.church_id → churches.id

-- Beneficiary assignments
beneficiary_assignments.service_id → services.id
beneficiary_assignments.stage_id → stages.id
beneficiary_assignments.class_id → classes.id (nullable)
beneficiary_assignments.servant_id → servants.id

-- Servant assignments
servant_stage_assignments.service_id → services.id
servant_stage_assignments.stage_id → stages.id (nullable — servant may serve at service level)
servant_stage_assignments.class_id → classes.id (nullable)
```

### 5.3 Soft Delete Cascade Rules

| Delete Action | Rule |
|--------------|------|
| Soft-delete Service | Blocked if active Stages exist |
| Soft-delete Stage | Blocked if active Beneficiary assignments exist |
| Soft-delete Class | Beneficiaries reassigned to Stage before delete |
| Soft-delete Servant | Assignments ended (`end_date` set), Beneficiaries reassigned |

---

## 6. Complete Database Architecture

See `DATABASE_REQUIREMENTS.md` for full entity definitions.

### 6.1 Table Summary

| # | Table | Tenant-Scoped | MVP | Key Index |
|---|-------|---------------|-----|-----------|
| 1 | churches | N/A (root) | ✅ | slug (unique) |
| 2 | profiles | ✅ (church_id) | ✅ | (church_id, deleted_at) |
| 3 | services | ✅ | ✅ | (church_id, deleted_at) |
| 4 | stages | ✅ | ✅ | (service_id, sort_order) |
| 5 | classes | ✅ | ✅ | (stage_id, sort_order) |
| 6 | servants | ✅ | ✅ | (church_id, approval_status) |
| 7 | servant_stage_assignments | ✅ | ✅ | (servant_id, is_active) |
| 8 | beneficiaries | ✅ | ✅ | (church_id, stage_id, status) |
| 9 | beneficiary_assignments | ✅ | ✅ | (beneficiary_id, is_current) |
| 10 | attendance_sessions | ✅ | ✅ | (stage_id, session_date) unique |
| 11 | attendance_records | ✅ | ✅ | (beneficiary_id, status) |
| 12 | followups | ✅ | ✅ | (servant_id, status, scheduled_at) |
| 13 | spiritual_journal_entries | ✅ | ✅ | (servant_id, entry_date) unique |
| 14 | notifications | ✅ | ✅ | (recipient_id, is_read) |
| 15 | audit_logs | ✅ | ✅ | (church_id, created_at) |
| 16 | roles | ✅ | ✅ | (church_id, role_type) |
| 17 | permissions | ✅ (system) | ✅ | code (unique) |
| 18 | role_permissions | ✅ | ✅ | (role_id, permission_id) unique |
| 19 | user_roles | ✅ | ✅ | (user_id, role_id, end_date) |
| 20 | subscription_plans | N/A | ❌ | code (unique) |

### 6.2 Relationships Diagram

```
churches
  ├── profiles (church_id FK)
  ├── services (church_id FK)
  │     └── stages (service_id FK, church_id FK)
  │           └── classes (stage_id FK, church_id FK)
  ├── servants (church_id FK, profiles.id FK)
  │     └── servant_stage_assignments (servant_id FK, service_id FK, stage_id FK)
  ├── beneficiaries (church_id FK)
  │     └── beneficiary_assignments (beneficiary_id FK, service_id FK, stage_id FK, servant_id FK)
  ├── attendance_sessions (church_id FK, service_id FK, stage_id FK)
  │     └── attendance_records (session_id FK, beneficiary_id FK nullable, servant_id FK nullable)
  ├── followups (church_id FK, beneficiary_id FK, servant_id FK)
  ├── spiritual_journal_entries (church_id FK, servant_id FK)
  ├── notifications (church_id FK, recipient_id FK → profiles.id)
  ├── audit_logs (church_id FK, actor_id FK → profiles.id)
  ├── roles (church_id FK)
  │     └── role_permissions (role_id FK, permission_id FK)
  └── user_roles (church_id FK, user_id FK → profiles.id, role_id FK)
```

### 6.3 Ownership Rules

| Table | Owned By | Create | Read | Update | Delete |
|-------|----------|--------|------|--------|--------|
| churches | Platform Owner | Platform Owner | Own church (all users) | Super Admin | Platform Owner |
| profiles | Self | Super Admin, Admin | Varies by role | Self, Super Admin | Super Admin (soft) |
| services | Church (Super Admin) | Super Admin | All | Super Admin, Admin (scoped) | Super Admin |
| stages | Church → Service | Super Admin, Admin (scoped) | All (scoped) | Same as create | Super Admin |
| classes | Church → Service → Stage | Same as stages | Same as stages | Same as stages | Same as stages |
| servants | Church | Super Admin, Admin, Self-registration | Varies (see visibility matrix) | Super Admin, Admin (scoped) | Super Admin |
| beneficiary_assignments | Church | Super Admin, Admin (scoped) | Varies | Immutable (new row) | N/A |
| attendance_records | Church | All (scoped) | Varies | N/A (correct via new record) | Super Admin |
| followups | Servant (creator) | All | Varies | Creator, Super Admin | Creator, Super Admin |
| spiritual_journal | Servant (owner) | Self | Self + Super Admin | Self | None (immutable) |
| notifications | System | System | Recipient | Recipient (mark read) | System (cron) |
| audit_logs | System | System | Super Admin, Platform Owner | None (immutable) | None (immutable) |

### 6.4 Soft Delete Strategy

| Table | deleted_at Column | Cascade Behavior | Hard Delete |
|-------|-------------------|-----------------|-------------|
| churches | ✅ | All tenant data | Cron after 30 days |
| profiles | ✅ | Servant journal anonymized | Cron after church deletion |
| services | ✅ | Blocked if active stages | Manual by Platform Owner |
| stages | ✅ | Blocked if active beneficiaries | Manual |
| classes | ✅ | Beneficiaries reassigned | Manual |
| beneficiaries | ✅ | Attendance/follow-ups kept (anonymized) | Manual |
| followups | ✅ | None | Manual |
| roles | ✅ | N/A (system roles undeletable) | Platform Owner |
| servants | ✅ | Assignments ended | Manual |

**Soft delete pattern:**
```typescript
const { error } = await supabase
  .from("beneficiaries")
  .update({ deleted_at: new Date().toISOString(), status: "inactive" })
  .eq("id", beneficiaryId)
  .eq("church_id", churchId);
```

**Read filter:** Every SELECT query includes `.is("deleted_at", null)`.

### 6.5 Audit Strategy

**MVP approach — app-level audit:**
```typescript
// Shared audit helper in every action file
async function auditLog(
  supabase: SupabaseClient,
  churchId: string,
  action: string,
  entityType: string,
  entityId: string,
  actorId: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
) {
  await supabase.from("audit_logs").insert({
    church_id: churchId,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues ?? null,
    new_values: newValues ?? null,
  });
}
```

**Phase 2 — database-level hardening:**
```sql
CREATE OR REPLACE FUNCTION prevent_audit_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: updates and deletes are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_update_delete();
```

### 6.6 Index Strategy

See `DATABASE_REQUIREMENTS.md` section 6 for the complete index table.

**Critical indexes for MVP:**
```sql
-- Tenant isolation + active records
CREATE INDEX idx_profiles_church_active ON profiles(church_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_beneficiaries_church_stage ON beneficiaries(church_id, stage_id) WHERE deleted_at IS NULL;

-- Attendance absence detection
CREATE INDEX idx_attendance_beneficiary_status ON attendance_records(beneficiary_id, status);

-- Follow-up reminders
CREATE INDEX idx_followups_due ON followups(servant_id, status, scheduled_at) WHERE deleted_at IS NULL;

-- Notification center
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at);

-- Audit viewer
CREATE INDEX idx_audit_church_time ON audit_logs(church_id, created_at DESC);

-- Spiritual journal (unique per day)
CREATE UNIQUE INDEX idx_spiritual_servant_date ON spiritual_journal_entries(servant_id, entry_date);

-- Current beneficiary assignment
CREATE INDEX idx_beneficiary_current ON beneficiary_assignments(beneficiary_id) WHERE is_current = true;
```

---

## 7. Supabase Architecture

### 7.1 Client Hierarchy

```typescript
// src/lib/supabase/

// 1. Browser client (public anon key — RLS enforced)
// client.ts
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// 2. Server client (authenticated — reads cookies)
// server.ts
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, /* ... */ } }
  );
}

// 3. Admin client (service_role — bypasses RLS)
// admin.ts
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

### 7.2 When to Use Each Client

| Client | When | Why |
|--------|------|-----|
| Browser client | Client components (TanStack Query to RPCs) | RLS enforced by user session |
| Server client | Server Actions, Route Handlers, RSC | RLS enforced, cookie-based session |
| Admin client | Auth user creation, signup, pre-login checks | Bypasses RLS — needed when no session exists or managing auth users |

**Rule:** Admin client is used in exactly 3 places:
1. `auth.service.ts` — pre-login `is_active` check
2. `auth.service.ts` — `signUpWithEmail` (`admin.auth.admin.createUser()`)
3. `user.service.ts` — `createUser` (`admin.auth.admin.createUser()`)

### 7.3 Auth Configuration

| Setting | Value |
|---------|-------|
| Auth provider | Email (password) |
| Session length | 24 hours |
| Email confirmation | Required (production), off (development) |
| Password reset | Built-in Supabase flow |
| Rate limiting (auth) | 5 req/15min per IP (Supabase config) |

### 7.4 Storage Configuration

| Bucket | Visibility | Purpose | MVP? |
|--------|------------|---------|------|
| `avatars` | Public (RLS-limited writes) | User profile photos | ✅ |
| `imports` | Private (server-side access) | Excel uploads for processing | ✅ |
| `exports` | Private (signed URLs) | Generated export files | Phase 2 |

**Storage RLS:**
```sql
-- avatars: users can upload only their own avatar
CREATE POLICY avatar_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

### 7.5 Edge Functions (Phase 2)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `check-absence-alerts` | Cron (hourly) | Process attendance records, create notifications |
| `send-email-notification` | DB webhook (notifications) | Send transactional emails via Resend/SendGrid |
| `process-import` | Storage webhook (imports bucket) | Async Excel processing |
| `tenant-cleanup` | Cron (daily) | Hard-delete expired soft-deleted records |

### 7.6 Cron Jobs (Phase 2)

```sql
-- Supabase cron (via pg_cron or Edge Functions)
SELECT cron.schedule('absence-alerts', '0 * * * *', $$SELECT check_absence_alerts()$$);
SELECT cron.schedule('followup-reminders', '0 */6 * * *', $$SELECT process_followup_reminders()$$);
SELECT cron.schedule('tenant-cleanup', '0 3 * * *', $$SELECT hard_delete_expired_tenants()$$);
SELECT cron.schedule('notification-cleanup', '0 4 * * *', $$DELETE FROM notifications WHERE created_at < now() - interval '90 days'$$);
```

---

## 8. Frontend Architecture

### 8.1 Directory Structure

```
src/
├── app/
│   ├── [locale]/                          # i18n route segment
│   │   ├── layout.tsx                     # Root layout: providers, shell, locale detection
│   │   ├── page.tsx                       # Landing / redirect
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── dashboard/
│   │   ├── services/                      # Service management (CRUD)
│   │   │   ├── [serviceId]/
│   │   │   │   └── stages/
│   │   │   │       └── [stageId]/
│   │   │   │           └── classes/
│   │   ├── servants/
│   │   │   ├── page.tsx                   # Servant list
│   │   │   ├── [servantId]/
│   │   │   ├── pending/                   # Approval queue
│   │   │   └── import/
│   │   ├── beneficiaries/
│   │   │   ├── page.tsx
│   │   │   ├── [beneficiaryId]/
│   │   │   └── import/
│   │   ├── attendance/
│   │   │   ├── record/                    # Record attendance
│   │   │   ├── history/
│   │   │   └── alerts/
│   │   ├── followups/
│   │   ├── spiritual/
│   │   ├── notifications/
│   │   ├── reports/
│   │   └── settings/
│   ├── api/                               # Route Handlers (only where Server Actions can't reach)
│   │   ├── import/
│   │   ├── export/
│   │   └── webhooks/
│   └── admin/                             # Platform Owner admin (separate layout)
│       ├── layout.tsx
│       ├── churches/
│       ├── subscriptions/
│       └── audit/
├── components/
│   ├── ui/                                # shadcn/ui primitives
│   ├── layout/
│   │   ├── app-shell.tsx                  # Authenticated shell
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── mobile-nav.tsx
│   ├── guards/
│   │   ├── permission-guard.tsx
│   │   └── role-guard.tsx
│   └── shared/
│       ├── empty-state.tsx
│       ├── loading-skeleton.tsx
│       ├── error-state.tsx
│       ├── confirm-dialog.tsx
│       └── data-table.tsx
├── features/                              # Feature modules (see section 10)
│   ├── auth/
│   ├── services/
│   ├── stages/
│   ├── classes/
│   ├── servants/
│   ├── beneficiaries/
│   ├── attendance/
│   ├── followups/
│   ├── spiritual/
│   ├── notifications/
│   ├── reports/
│   ├── import-export/
│   ├── audit/
│   ├── settings/
│   └── admin/
├── lib/
│   ├── supabase/                          # Client factories
│   ├── rbac/                              # Permission checks, guards
│   ├── i18n/                              # next-intl config
│   ├── utils/                             # Shared utilities
│   └── validators/                        # Zod schemas
└── types/
    ├── database.types.ts                  # Generated Supabase types
    └── common.ts                          # Shared types
```

### 8.2 Component Architecture

```
Pages (RSC)
  └── Client Components (hydration boundaries)
        ├── Data fetching: TanStack Query (useSuspenseQuery)
        ├── Mutations: Server Actions (via useActionState or custom hook)
        ├── UI: shadcn/ui primitives
        └── Guards: PermissionGuard, RoleGuard
```

### 8.3 Data Fetching Strategy

| Data Type | Method | Caching |
|-----------|--------|---------|
| Page-level data (list) | RSC → direct Supabase query | HTTP cache (CDN) |
| Page-level data (detail) | RSC → direct Supabase query | HTTP cache |
| Interactive data (search, filters) | TanStack Query | Client cache (stale-5s) |
| Mutations | Server Action → TanStack Query invalidation | Revalidate |
| Dashboard widgets | RSC → direct Supabase aggregate query | HTTP cache + stale-30s |

### 8.4 RSC → Server Action → TanStack Query Flow

```
1. RSC renders page skeleton with Suspense boundaries
2. RSC fetches initial data directly from Supabase (fast, no JS)
3. Client hydrates with TanStack Query for interactive data
4. User triggers mutation → Server Action
5. Server Action: validate → auth → authorize → execute → audit
6. TanStack Query invalidates affected queries
7. UI updates optimistically

Benefits:
  - Zero JS for initial page load
  - No API versioning
  - TypeScript types flow from DB → Server Action → Client
  - Auth + RBAC enforced at the action boundary
```

### 8.5 i18n Architecture

```typescript
// src/i18n/request.ts
export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));

// Navigation uses next-intl's routing
// <Link href="/dashboard"> → locale-aware: /ar/dashboard or /en/dashboard

// RTL detection in layout:
const direction = locale === 'ar' ? 'rtl' : 'ltr';
<html lang={locale} dir={direction}>
```

---

## 9. Backend Architecture

### 9.1 Server Actions as API

**Design principles:**
1. One file per feature module: `src/features/<module>/actions/<entity>.actions.ts`
2. Every action is an `"use server"` function
3. Every mutation action follows the same 7-step pattern (section 4.3)
4. Read actions also authenticate and authorize
5. Return type is always `ActionResult<T>` with `success`, `message`, `fieldErrors`, `data`

### 9.2 Service Layer

**Design principles:**
1. Services contain pure database logic — no auth checks, no permission checks
2. Services accept `supabase: SupabaseClient` as first parameter
3. Services accept `churchId` as second parameter (for RLS scope)
4. Services return `{ data, error }` — never throw
5. Services are stateless (no class instances)

```typescript
// Pattern for every service function
export async function listBeneficiaries(
  supabase: SupabaseClient,
  churchId: string,
  filters: BeneficiaryFilters,
): Promise<ServiceResult<BeneficiaryListItem[]>> {
  try {
    let query = supabase
      .from("beneficiaries")
      .select("id, full_name_ar, full_name_en, ...")
      .eq("church_id", churchId)
      .is("deleted_at", null);

    if (filters.stage_id) query = query.eq("stage_id", filters.stage_id);
    if (filters.search) query = query.or(`full_name_ar.ilike.%${filters.search}%`);

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data: data as BeneficiaryListItem[], error: null };
  } catch {
    return { data: null, error: "Failed to load beneficiaries." };
  }
}
```

### 9.3 Error Handling

```typescript
// Custom error types
class AuthenticationError extends Error { code = 'UNAUTHENTICATED'; }
class AuthorizationError extends Error { code = 'FORBIDDEN'; }
class ValidationError extends Error { code = 'VALIDATION_ERROR'; fields: Record<string, string>; }
class NotFoundError extends Error { code = 'NOT_FOUND'; }
class ConflictError extends Error { code = 'CONFLICT'; }

// Global error handler wrapper
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  defaultMessage = "An unexpected error occurred."
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { success: false, message: "You must be logged in." };
    }
    if (error instanceof AuthorizationError) {
      return { success: false, message: "You do not have permission." };
    }
    if (error instanceof ValidationError) {
      return { success: false, message: error.message, fieldErrors: error.fields };
    }
    console.error("[action]", error);
    return { success: false, message: defaultMessage };
  }
}
```

---

## 10. Feature Module Architecture

### 10.1 Module Structure

Every feature module follows this structure:

```
src/features/<module>/
├── actions/
│   └── <entity>.actions.ts        # Server Actions
├── services/
│   └── <entity>.service.ts        # Database operations
├── components/
│   ├── <entity>-list.tsx          # List component
│   ├── <entity>-form.tsx          # Create/Edit form
│   ├── <entity>-detail.tsx        # Detail view
│   └── <entity>-actions.tsx       # Action buttons
├── hooks/
│   └── use-<entity>.ts            # TanStack Query hooks
├── schemas/
│   └── <entity>.schema.ts         # Zod validation schemas
├── types/
│   └── <entity>.types.ts          # TypeScript types
└── index.ts                       # Public exports
```

### 10.2 Module Responsibilities

| Module | Key Entities | MVP? |
|--------|-------------|------|
| auth | Login, signup, password reset, session | ✅ |
| services | Church service CRUD | ✅ |
| stages | Stage CRUD within service | ✅ |
| classes | Class CRUD within stage | ✅ |
| servants | Servant CRUD, import, approval, assignment | ✅ |
| beneficiaries | Beneficiary CRUD, import, transfer, history | ✅ |
| attendance | Session recording, bulk, alerts | ✅ |
| followups | CRUD, reminders, history | ✅ |
| spiritual | Journal CRUD, privacy enforcement, audit | ✅ |
| notifications | In-app center, alerts, reminders | ✅ |
| reports | Role-specific dashboards | ✅ |
| import-export | Excel pipeline, templates, validation | ✅ |
| audit | Log viewer | ✅ |
| settings | Church config, roles, permissions | ✅ |
| admin (Phase 2) | Platform Owner: tenants, subscriptions, billing | ❌ |

### 10.3 Module Boundaries

```
┌──────────────────────────┐
│      Server Action       │ ← Public API boundary
│  (auth + permission)     │
└──────────┬───────────────┘
           │ calls
           ▼
┌──────────────────────────┐
│      Service Function    │ ← App logic boundary
│  (no auth, pure DB)      │
└──────────┬───────────────┘
           │ queries
           ▼
┌──────────────────────────┐
│      Supabase Client     │ ← Data boundary
│  (RLS enforced)          │
└──────────────────────────┘
```

**Rules:**
- Actions never call other actions (no cross-module action calls)
- Services can call other services (e.g., attendance service calls beneficiary service)
- Components never import services directly
- Hooks never import actions directly (they receive action references via props or context)

---

## 11. Dashboard Architecture

### 11.1 Dashboard Types

| Dashboard | Route | Audience | Data Source |
|-----------|-------|----------|-------------|
| Super Admin | `/[locale]/dashboard` | super_admin | Church-wide aggregates |
| Admin | `/[locale]/dashboard` | admin (scoped) | Service/Stage aggregates |
| User | `/[locale]/dashboard` | user | Personal aggregates |

### 11.2 Widget Architecture

```typescript
// Each dashboard is composed of widgets
interface DashboardWidget {
  id: string;
  title: string;
  type: 'stat' | 'chart' | 'list' | 'alert';
  query: () => Promise<WidgetData>;
  roles: RoleType[];
  refreshInterval: number; // seconds
}

// Widgets are defined in the reports feature module
// Rendered by the dashboard page component
// Data fetched via RSC (Suspense per widget)
```

### 11.3 MVP Dashboard Widgets

**Super Admin:**
- Total servants (active, pending)
- Total beneficiaries
- Current week attendance rate
- Follow-up completion rate
- Pending approvals count
- Consecutive absence alerts
- Recent activity feed

**Admin (scoped to assigned services):**
- Attendance rate per stage
- Beneficiary count per stage
- Servant count per stage
- Overdue follow-ups
- Weekly attendance trend

**User:**
- My assigned beneficiaries count
- Today's attendance status
- Upcoming follow-ups
- Overdue follow-ups
- Spiritual journal streak (current consecutive days)

### 11.4 Data Aggregation Strategy (MVP)

All dashboard queries are **server-side aggregate queries** executed directly against Supabase:

```typescript
// Example: attendance rate for a stage
async function getStageAttendanceRate(
  supabase: SupabaseClient,
  churchId: string,
  stageId: string,
): Promise<number> {
  const { count: total } = await supabase
    .from("attendance_records")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .eq("stage_id", stageId);

  const { count: present } = await supabase
    .from("attendance_records")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .eq("stage_id", stageId)
    .eq("status", "present");

  return total > 0 ? (present / total) * 100 : 0;
}
```

**Scaling:** MVP aggregates are computed on-the-fly. Phase 2 introduces materialized views for dashboard data.

---

## 12. Notification Architecture

### 12.1 Notification Engine

```
Trigger Event (e.g., attendance recorded, follow-up due)
       │
       ▼
Notification Service
       │
       ├─► Check if notification type is enabled for recipient
       ├─► Create notification row (in-app)
       ├─► If email enabled → queue email (Phase 2: Edge Function)
       ├─► If WhatsApp enabled → queue WhatsApp (Phase 3)
       └─► Return
```

### 12.2 Notification Types (MVP)

```typescript
const NOTIFICATION_TYPES = {
  CONSECUTIVE_ABSENCE: "consecutive_absence",
  FOLLOWUP_DUE: "followup_due",
  FOLLOWUP_OVERDUE: "followup_overdue",
  APPROVAL_REQUIRED: "approval_required",
  APPROVAL_RESULT: "approval_result",
  BIRTHDAY: "birthday",
  ATTENDANCE_REMINDER: "attendance_reminder",
  MISSING_ATTENDANCE: "missing_attendance",
} as const;
```

### 12.3 Absence Alert Detection

```typescript
// Run after each attendance session submission
async function checkConsecutiveAbsences(
  supabase: SupabaseClient,
  churchId: string,
  stageId: string,
): Promise<void> {
  const threshold = 3;

  const { data: absentBeneficiaries } = await supabase.rpc(
    "get_consecutive_absent_beneficiaries",
    { p_church_id: churchId, p_stage_id: stageId, p_threshold: threshold }
  );

  for (const beneficiary of absentBeneficiaries ?? []) {
    await createNotification({
      churchId,
      recipientId: beneficiary.responsible_servant_id,
      type: "consecutive_absence",
      titleAr: `غياب متكرر - ${beneficiary.full_name_ar}`,
      titleEn: `Consecutive Absence - ${beneficiary.full_name_en}`,
      data: { beneficiary_id: beneficiary.id },
    });
  }
}
```

### 12.4 SQL Function for Absence Detection

```sql
CREATE OR REPLACE FUNCTION get_consecutive_absent_beneficiaries(
  p_church_id UUID,
  p_stage_id UUID,
  p_threshold INT DEFAULT 3
)
RETURNS TABLE (
  beneficiary_id UUID,
  full_name_ar TEXT,
  full_name_en TEXT,
  responsible_servant_id UUID,
  consecutive_count BIGINT
) LANGUAGE SQL STABLE AS $$
  WITH recent_sessions AS (
    SELECT id FROM attendance_sessions
    WHERE church_id = p_church_id
      AND stage_id = p_stage_id
    ORDER BY session_date DESC
    LIMIT 10
  ),
  absent_streak AS (
    SELECT
      ar.beneficiary_id,
      COUNT(*) FILTER (WHERE ar.status = 'absent') AS absent_count
    FROM attendance_records ar
    JOIN recent_sessions rs ON ar.session_id = rs.id
    WHERE ar.church_id = p_church_id
    GROUP BY ar.beneficiary_id
    HAVING COUNT(*) FILTER (WHERE ar.status = 'absent') >= p_threshold
  )
  SELECT
    a.beneficiary_id,
    b.full_name_ar,
    b.full_name_en,
    ba.servant_id AS responsible_servant_id,
    a.absent_count
  FROM absent_streak a
  JOIN beneficiaries b ON b.id = a.beneficiary_id
  JOIN beneficiary_assignments ba ON ba.beneficiary_id = a.beneficiary_id AND ba.is_current = true;
$$;
```

### 12.5 In-App Notification UI

```typescript
// Notification center component
// src/features/notifications/components/notification-center.tsx

interface NotificationBellProps {
  unreadCount: number;  // RSC-fetched
}

// Dropdown: last 10 notifications (TanStack Query, refetch every 60s)
// Full page: /[locale]/notifications (RSC with pagination)
// Mark-as-read: Server Action
// Click: navigate to context (e.g., /beneficiaries/{id})
```

---

## 13. Attendance Engine Architecture

### 13.1 Session Flow

```
Servant opens attendance page
       │
       ▼
Select stage + date
       │
       ▼
Fetch beneficiaries in stage (RSC)
       │
       ▼
Display attendance grid
  ├─► Single mode: mark each beneficiary individually
  └─► Bulk mode: mark all as present, then adjust
       │
       ▼
Submit attendance records (Server Action)
  ├─► Validate input (Zod)
  ├─► Authenticate + authorize (hasStageAccess)
  ├─► UPSERT attendance_records (one per beneficiary)
  ├─► Write audit log
  ├─► Check concurrent absence threshold
  │     └─► If ≥3 → create notification
  └─► Return success
```

### 13.2 Attendance Record Types

```typescript
interface BeneficiaryAttendanceRecord {
  session_id: string;
  beneficiary_id: string;
  status: 'present' | 'absent' | 'excused';
  notes?: string;
}

interface ServantAttendanceRecord {
  session_id: string;
  servant_id: string;
  status: 'present' | 'absent' | 'excused';
  notes?: string;
}
```

### 13.3 Bulk Attendance Input

```typescript
// Server Action
export async function batchAttendanceAction(
  stageId: string,
  sessionDate: string,
  records: Array<{ beneficiaryId: string; status: AttendanceStatus }>
): Promise<ActionResult<{ created: number }>> {
  // 1. Auth + permission check
  // 2. Get or create session
  // 3. Upsert records
  // 4. Check absent thresholds
  // 5. Audit
  // 6. Return count
}
```

### 13.4 Absence Alert Triggers

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Consecutive absences | ≥3 sessions | Notify responsible servant |
| Low attendance rate | <50% over 4 weeks | Notify responsible servant + Admin |
| Missing attendance | Session date + 2h no records | Notify Admin |

---

## 14. Spiritual Growth Module Architecture

### 14.1 Privacy Architecture

```
┌─────────────────────────────────────────────┐
│            Spiritual Journal Entry            │
│  owner: servant_id (creator)                 │
│  visibility:                                 │
│    - servant (owner): FULL access            │
│    - super_admin (Priest): READ access       │
│    - admin: NO access                        │
│    - user (other): NO access                 │
│    - platform_owner: NO access               │
│  export: NEVER                               │
│  audit: EVERY priest access logged           │
└─────────────────────────────────────────────┘
```

### 14.2 Enforcement Points

| Layer | Enforcement |
|-------|------------|
| UI | `PermissionGuard` hides spiritual section from non-authorized roles |
| Server Action | Checks `hasPermission('spiritual.read')` AND ownership or super_admin role |
| RLS | Policy: `servant_id = auth.uid() OR (SELECT role_type FROM user_roles WHERE user_id = auth.uid()) = 'super_admin'` |
| Audit | Every `SELECT` by a non-owner is logged via DB trigger or app-level |

### 14.3 Daily Entry Schema

```typescript
interface SpiritualJournalEntry {
  id: string;
  church_id: string;
  servant_id: string;
  entry_date: string;  // YYYY-MM-DD, unique per servant
  morning_prayer: boolean;
  third_hour_prayer: boolean;
  sixth_hour_prayer: boolean;
  ninth_hour_prayer: boolean;
  sunset_prayer: boolean;
  sleep_prayer: boolean;
  bible_reading: boolean;
  confession: boolean;
  communion: boolean;
  spiritual_notes: string | null;  // free text
  created_at: string;
  updated_at: string;
}
```

### 14.4 RLS Policy

```sql
CREATE POLICY spiritual_owner_or_priest ON spiritual_journal_entries
  FOR ALL
  USING (
    -- Owner
    servant_id = auth.uid()
    OR
    -- Priest (super_admin in same church)
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.role_type = 'super_admin'
        AND ur.church_id = spiritual_journal_entries.church_id
    )
  );
```

### 14.5 Priest Access Audit

```typescript
// Wrapper when Priest reads spiritual records
async function readSpiritualJournal(
  supabase: SupabaseClient,
  churchId: string,
  servantId: string,
  priestId: string,
): Promise<SpiritualJournalEntry[]> {
  // 1. Verify priest is super_admin
  // 2. Query entries (RLS allows it)
  // 3. Log each access in audit_logs
  await auditLog(supabase, churchId, "access", "spiritual_journal", servantId, priestId);

  return supabase
    .from("spiritual_journal_entries")
    .select("*")
    .eq("church_id", churchId)
    .eq("servant_id", servantId)
    .order("entry_date", { ascending: false });
}
```

---

## 15. Import/Export Architecture

### 15.1 Import Pipeline (MVP)

```
1. User downloads template (.xlsx)
       │
       ▼
2. User fills template, uploads via form
       │
       ▼
3. Server Action receives File (formidable or native)
       │
       ▼
4. Parse Excel (xlsx library)
       │
       ▼
5. Validate each row (Zod schema)
       │
       ▼
6. Validation report: { success_count, error_rows: [{ row, field, reason }] }
       │
       ▼
7. If errors → show report, allow download of error CSV
8. If no errors → confirm import
       │
       ▼
9. Execute inserts in transaction (all or nothing)
10. Audit log
```

### 15.2 Excel Parsing Service

```typescript
// src/features/import-export/services/import.service.ts
import * as XLSX from "xlsx";

export async function parseImportFile<T>(
  file: File,
  schema: ZodSchema<T>,
): Promise<{ valid: T[]; errors: ImportError[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const valid: T[] = [];
  const errors: ImportError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = schema.safeParse(rows[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({
        row: i + 2,  // 1-indexed + header row
        fields: Object.fromEntries(
          result.error.issues.map((issue) => [issue.path.join("."), issue.message])
        ),
      });
    }
  }

  return { valid, errors };
}
```

### 15.3 Export Pipeline (Phase 2)

```typescript
export async function exportToExcel<T>(
  data: T[],
  columns: { header: string; key: keyof T }[],
  filename: string,
): Promise<{ url: string }> {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data, { header: columns.map(c => c.key as string) });
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  // Upload to Supabase Storage (exports bucket)
  const { data: upload } = await supabase.storage
    .from("exports")
    .upload(`${churchId}/${filename}_${Date.now()}.xlsx`, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

  // Generate signed URL (1 hour expiry)
  const { data: { signedUrl } } = await supabase.storage
    .from("exports")
    .createSignedUrl(upload.path, 3600);

  return { url: signedUrl };
}
```

---

## 16. Audit Log Architecture

### 16.1 MVP (App-Level)

```typescript
// Shared audit helper
async function auditLog(
  supabase: SupabaseClient,
  churchId: string,
  action: 'create' | 'update' | 'delete' | 'access',
  entityType: string,
  entityId: string,
  actorId: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
): Promise<void> {
  // Fire-and-forget — audit log failure should not block the main operation
  try {
    await supabase.from("audit_logs").insert({
      church_id: churchId,
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
    });
  } catch (error) {
    console.error("[audit] Failed to write log:", error);
  }
}
```

### 16.2 Phase 2 (DB-Level)

```sql
-- Immutability trigger
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutability
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- Automatic audit for key tables (example: beneficiaries)
CREATE OR REPLACE FUNCTION audit_beneficiary_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (church_id, actor_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (
    COALESCE(NEW.church_id, OLD.church_id),
    auth.uid(),
    TG_OP,
    'beneficiary',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_beneficiary
  AFTER INSERT OR UPDATE OR DELETE ON beneficiaries
  FOR EACH ROW EXECUTE FUNCTION audit_beneficiary_changes();
```

### 16.3 Audit Viewer

```typescript
// Route: /[locale]/settings/audit
// Available to: super_admin, platform_owner
// Features:
//   - Paginated list (25 per page)
//   - Filters: entity_type, action, actor, date range
//   - Expanded view: show old_values → new_values diff
//   - Export: CSV download (Phase 2)
```

---

## 17. Security Architecture

### 17.1 Defense in Depth

```
Internet
    │
    ▼
┌──────────────────────┐
│  Vercel WAF          │ ← DDoS protection, IP blocking
├──────────────────────┤
│  Next.js Middleware   │ ← Auth check, redirect if unauthenticated
├──────────────────────┤
│  Server Actions       │ ← Input validation (Zod), auth, permission check
├──────────────────────┤
│  Service Layer        │ ← Church ID derivation (never from client)
├──────────────────────┤
│  Supabase RLS         │ ← Row-level security on every query
├──────────────────────┤
│  PostgreSQL           │ ← Encrypted at rest (AES-256)
└──────────────────────┘
```

### 17.2 Security Checklist

- [ ] All env vars validated at startup (missing vars → build failure)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` never in client bundle (enforced by Next.js env prefix)
- [ ] No secrets in `.env.example` — placeholders only
- [ ] All Server Actions validate input via Zod
- [ ] All Server Actions authenticate
- [ ] All mutation Server Actions authorize
- [ ] All DB queries pass through RLS
- [ ] `church_id` never accepted from client — always derived from session
- [ ] Audit log is append-only (app-level, enforced via permission in MVP; DB trigger in Phase 2)
- [ ] Rate limiting on auth endpoints (Supabase config)
- [ ] CORS restricted to app domain
- [ ] Content Security Policy headers
- [ ] SQL injection prevented via parameterized queries (Supabase client)
- [ ] XSS prevented via React's built-in escaping

### 17.3 Environment Variable Security

```bash
# .env.local.example — NEVER contains real values
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Verified by CI: no real credentials in .env.example
# Verified by CI: .env.local in .gitignore
```

---

## 18. Performance Architecture

### 18.1 MVP Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Page load (server) | <2s P95 | Vercel Analytics |
| Page load (client) | <1s TTI | Lighthouse |
| API response | <200ms P95 | Server Action timing |
| First Contentful Paint | <1.5s | Lighthouse |
| Largest Contentful Paint | <2.5s | Lighthouse |
| Cumulative Layout Shift | <0.1 | Lighthouse |

### 18.2 Optimization Strategies

| Technique | Where | Impact |
|-----------|-------|--------|
| RSC for list pages | All list pages | Zero JS for initial render |
| Streaming with Suspense | Dashboard widgets | Progressive rendering |
| Optimistic updates | Attendance, follow-ups | Instant feedback |
| TanStack Query caching | Client data | Reduced refetch |
| Supabase connection pooling | Database | Reduced connection overhead |
| RLS-filtered queries | All DB access | No application-level filtering |
| Selective indexes | Key query paths | Sub-millisecond lookups |
| Compressed responses | Vercel edge | Reduced bandwidth |

### 18.3 N+1 Query Prevention

```typescript
// BAD: N+1 (separate query per beneficiary)
for (const beneficiary of beneficiaries) {
  const { data } = await supabase.from("attendance_records").select("*").eq("beneficiary_id", beneficiary.id);
}

// GOOD: Single query with join
const { data } = await supabase
  .from("beneficiaries")
  .select("*, attendance_records(*)")
  .eq("church_id", churchId)
  .in("id", beneficiaryIds);
```

### 18.4 Connection Pooling

```sql
-- Supabase project settings
-- Pool size: 15 (MVP), 30 (Phase 2)
-- PgBouncer mode: Transaction
```

---

## 19. Monitoring & Observability

### 19.1 MVP

| Tool | What We Monitor |
|------|-----------------|
| Vercel Analytics | Page views, web vitals, server timing |
| Sentry | Error tracking (server + client), performance traces |
| Supabase Dashboard | DB connections, query performance, auth events |
| Manual health check | `/api/health` endpoint |

### 19.2 Health Check Endpoint

```typescript
// src/app/api/health/route.ts
export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.from("churches").select("id").limit(1);

  if (error) {
    return NextResponse.json({ status: "unhealthy", error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION,
  });
}
```

### 19.3 Phase 2

- Error tracking with source maps
- APM (Sentry performance)
- Custom dashboard (Platform Owner)
- Database query profiling
- User session replays (for support)

---

## 20. Migration Strategy

### 20.1 Database Migrations

```
supabase/migrations/
├── 001_core_schema.sql           # churches, profiles, services, stages, classes
├── 002_servants.sql              # servants, servant_stage_assignments
├── 003_beneficiaries.sql         # beneficiaries, beneficiary_assignments
├── 004_attendance.sql            # attendance_sessions, attendance_records
├── 005_followups.sql             # followups
├── 006_spiritual.sql             # spiritual_journal_entries
├── 007_notifications.sql         # notifications
├── 008_audit.sql                 # audit_logs (with immutability trigger in Phase 2)
├── 009_rbac.sql                  # roles, permissions, role_permissions, user_roles
├── 010_rls_policies.sql          # All RLS policies
├── 011_seed_data.sql             # Default roles, permissions
├── 012_indexes.sql               # Performance indexes
└── 013_functions.sql             # Absence detection, church_id helpers
```

### 20.2 Migration Tool

Supabase CLI (`supabase migration up`) — each migration is a SQL file run in order.

### 20.3 Migration Rules

- Every migration is reversible (include `-- DOWN` commented section for rollback)
- Migrations are run in CI/CD pipeline (not manually)
- Zero-downtime migrations: prefer `ADD COLUMN` over `ALTER COLUMN`, avoid long-running locks
- MVP migration = 001 through 012 applied in order
- Phase 2 migration: adds triggers, cron functions, materialized views

### 20.4 Seed Data

```sql
-- 011_seed_data.sql
-- Seed roles for each church (run on church creation, not in migration)
CREATE OR REPLACE FUNCTION seed_church_roles(p_church_id UUID)
RETURNS void AS $$
DECLARE
  super_admin_role_id UUID;
  admin_role_id UUID;
  user_role_id UUID;
BEGIN
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES
    (p_church_id, 'super_admin', 'مدير عام', 'Super Admin', true),
    (p_church_id, 'admin', 'مشرف', 'Admin', true),
    (p_church_id, 'user', 'خادم', 'User', true)
  RETURNING id INTO super_admin_role_id;

  -- Assign all permissions to super_admin
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT super_admin_role_id, id FROM permissions;
END;
$$ LANGUAGE plpgsql;
```

---

## 21. Deployment Architecture

### 21.1 Vercel + Supabase

```
┌──────────────────────────────────────────────────────┐
│  Vercel                                               │
│                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Production  │  │ Staging     │  │ Preview     │   │
│  │ (main)      │  │ (staging)   │  │ (PR branch) │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │               │               │            │
└─────────┼───────────────┼───────────────┼────────────┘
          │               │               │
          ▼               ▼               ▼
┌──────────────────────────────────────────────────────┐
│  Supabase                                              │
│                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Production  │  │ Staging     │  │ Review (DB) │   │
│  │ DB          │  │ DB          │  │ (branch)    │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                        │
│  Projects: All share one Supabase project (RLS-enforced)│
└──────────────────────────────────────────────────────┘
```

### 21.2 Environment Branches

| Environment | Vercel Branch | Supabase Branch | Purpose |
|-------------|---------------|-----------------|---------|
| Local | N/A | Local (docker) | Development |
| Development | `develop` | `dev` | Integration testing |
| Staging | `staging` | `staging` | Pre-production validation |
| Production | `main` | `main` | Live |

### 21.3 Build Configuration

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Server-only env vars (NOT in env block — never exposed to client)
  // SUPABASE_SERVICE_ROLE_KEY is available at runtime via process.env
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};
```

---

## 22. Environment Strategy

### 22.1 Local Development

```bash
# Required (local .env.local)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Supabase local stack (Docker)
supabase start
# Starts: PostgreSQL, Auth API, Storage API, Realtime, Edge Functions
# Local dashboard: http://localhost:54323
```

### 22.2 Environment Variables by Environment

| Variable | Local | Dev | Staging | Production |
|----------|-------|-----|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | localhost:54321 | dev-project.supabase.co | staging-project.supabase.co | prod-project.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local anon | dev anon | staging anon | prod anon |
| `SUPABASE_SERVICE_ROLE_KEY` | local service_role | dev service_role | staging service_role | prod service_role |
| `NEXT_PUBLIC_APP_URL` | http://localhost:3000 | https://dev.church.app | https://staging.church.app | https://church.app |
| `SENTRY_DSN` | - | dev dsn | staging dsn | prod dsn |

### 22.3 Runtime Checks

```typescript
// src/lib/supabase/config.ts — validates env at startup
export function validateEnv(): void {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  // Verify URL format
  try {
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
  }
}
```

---

## 23. CI/CD Strategy

### 23.1 Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, staging, develop]
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test

  # Deploy to Vercel (automatic for each branch)
  deploy:
    needs: [lint, typecheck, test]
    if: github.ref == 'refs/heads/main'
    uses: vercel/actions/.github/workflows/deploy.yml@v4
```

### 23.2 Quality Gates

| Gate | Tool | Threshold |
|------|------|-----------|
| Lint | ESLint | Zero errors, zero warnings |
| Types | TypeScript | Zero errors |
| Tests | Vitest | 80% line coverage (MVP), 90% (Phase 2) |
| Build | Next.js | Successful build |
| Security | npm audit | Zero critical/high vulnerabilities |

### 23.3 Supabase Migration in CI

```yaml
# Separate job for DB migrations
db-migrate:
  runs-on: ubuntu-latest
  steps:
    - uses: supabase/setup-cli@v1
    - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
    - run: supabase db push
```

---

## 24. Testing Strategy

### 24.1 Test Pyramid

```
         ╱─────╲
        ╱  E2E  ╲          ← 5% (MVP) — critical paths only
       ╱─────────╲
      ╱  Integration  ╲    ← 25% (MVP) — Server Actions + Services
     ╱─────────────────╲
    ╱     Unit Tests     ╲  ← 70% (MVP) — utilities, validation, permissions
   ╱───────────────────────╲
```

### 24.2 What to Test (MVP)

| Layer | What | Tool | Target Coverage |
|-------|------|------|-----------------|
| Validation | Zod schemas | Vitest | 100% of schema files |
| Permission | `hasPermission`, `hasStageAccess` | Vitest | 100% of permission paths |
| Services | CRUD operations for each entity | Vitest + Supabase local | 1 integration test per service |
| Actions | Auth + permission + execution flow | Vitest (mocked Supabase) | 1 test per action |
| RLS | Church isolation, role-based access | Vitest + Supabase local | 1 test per RLS policy |
| UI | Component rendering | Vitest + Testing Library | Key components only |

### 24.3 Test Structure

```
tests/
├── unit/
│   ├── schemas/           # Zod validation tests
│   ├── permissions/       # Permission check tests
│   └── utils/             # Utility function tests
├── integration/
│   ├── services/          # Service + Supabase tests (local DB)
│   ├── actions/           # Server Action integration tests
│   └── rls/               # RLS policy tests
└── e2e/
    └── critical-paths.spec.ts  # Playwright (Phase 2)
```

### 24.4 RLS Test Example

```typescript
// tests/integration/rls/beneficiary-isolation.test.ts
import { createClient } from "@supabase/supabase-js";

describe("Beneficiary RLS Isolation", () => {
  it("should not allow church A to see church B beneficiaries", async () => {
    const clientA = await authenticateAs("church_a_user");
    const clientB = await authenticateAs("church_b_user");

    // Create beneficiary in church A
    await clientA.from("beneficiaries").insert({
      church_id: churchAId,
      full_name_ar: "test",
      // ...
    });

    // Church B should not see it
    const { data } = await clientB.from("beneficiaries").select("id");
    expect(data).not.toContainEqual(expect.objectContaining({ full_name_ar: "test" }));
  });
});
```

---

## 25. Technical Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|------|------------|--------|------------|-------|
| 1 | RLS performance degrades with 100+ churches | Low | High | Connection pooling, query optimization, PgBouncer. Ready for schema-per-tenant if needed. | DB Engineer |
| 2 | Server Action timeout (10s Vercel limit) for large imports | Medium | High | Async import processing via Edge Function + Storage webhook (Phase 2). MVP: limit rows to 500 per import. | Backend |
| 3 | Arabic RTL layout breaks with shadcn/ui components | Medium | Medium | Test all components in RTL mode. Use logical CSS properties (inset-inline-start, margin-inline-end). | Frontend |
| 4 | TanStack Query cache invalidation misses after Server Action | Medium | Medium | Use query key conventions. Invalidate by key pattern, not individual key. Test all mutation paths. | Frontend |
| 5 | Concurrent absence alerts overwhelm notification system | Low | Medium | Debounce: coalesce alerts per beneficiary per day. Async notification creation. | Backend |
| 6 | Auth session refresh fails for long-running sessions | Low | Medium | `@supabase/ssr` handles refresh automatically. Monitor refresh failures in Sentry. | Fullstack |
| 7 | Excel import encoding issues with Arabic characters | Medium | Low | Force UTF-8 encoding. Test with real Arabic Excel files. Provide template download. | Backend |
| 8 | Migration rollback complexity | Medium | Medium | Every migration has a commented rollback section. Test rollback in CI against staging. | DB Engineer |
| 9 | Platform Owner impersonation security | Low | Critical | Dedicated admin auth boundary. Read-only by default. Full audit trail on all Platform Owner actions. | Backend |
| 10 | Spiritual data privacy breach via analytics | Low | Critical | Spiritual data excluded from all analytics queries and exports. Separate audit trail. | Backend |

---

## Appendix A: Key Decisions Log

| Decision | Date | Rationale |
|----------|------|-----------|
| RLS over schema-per-tenant | MVP | Lower ops cost, shared pool, easier migrations |
| Server Actions over REST | MVP | Co-located logic, no versioning, direct DB access |
| next-intl over next-i18next | MVP | Better RSC support, smaller bundle, active maintenance |
| Supabase over custom auth | MVP | Built-in sessions, RLS integration, password reset |
| App-level audit over DB triggers | MVP | Faster MVP delivery; DB triggers in Phase 2 |
| Optional Class entity | MVP | Not all churches use classes; avoid complexity for those that don't |

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| Church | A tenant — fully isolated instance of the platform |
| Service | A major ministry area (e.g., Youth Service, Children's Service) |
| Stage | A subdivision within a Service (e.g., Intermediate Stage) |
| Class | An optional subdivision within a Stage (e.g., First Year) |
| Super Admin | Priest — highest authority within a church |
| Admin | Ministry Leader — manages one or more services |
| User | Servant — works directly with beneficiaries |
| Beneficiary | A child or student receiving ministry |
| RLS | Row-Level Security — PostgreSQL feature for tenant isolation |
| RSC | React Server Component — renders on the server, zero JS |
| Server Action | Next.js `"use server"` function — replaces API routes |
| Service Role | Supabase admin role that bypasses RLS |
