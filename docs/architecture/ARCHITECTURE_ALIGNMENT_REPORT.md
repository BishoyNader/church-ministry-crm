# Architecture Alignment Report

**Date**: 2026-07-30
**Phase**: 1A — Architecture Alignment
**Source of Truth**: 13 planning documents (PRD_V3, GAP_ANALYSIS, MVP_SCOPE, DATABASE_REQUIREMENTS, RBAC_ARCHITECTURE, SYSTEM_ARCHITECTURE, IMPLEMENTATION_ROADMAP, MVP_BACKLOG, SCREEN_INVENTORY, DESIGN_SYSTEM_REQUIREMENTS, DASHBOARD_SPECIFICATIONS, QA_TEST_PLAN, MVP_READINESS_CHECKLIST)

---

## 1. Current State Analysis

### 1.1 Tech Stack (Current vs Planned)

| Layer | Current Implementation | Planning Documents | Alignment |
|-------|----------------------|-------------------|-----------|
| Framework | Next.js 15 (App Router) | Next.js 15 | ✅ |
| UI Library | @base-ui/react + tailwindcss v4 | @base-ui/react + tailwindcss v4 | ✅ |
| Forms | react-hook-form + zod | react-hook-form + zod | ✅ |
| State | zustand | zustand | ✅ |
| i18n | next-intl | next-intl | ✅ |
| Charts | recharts | recharts | ✅ |
| DB/Backend | Supabase (PostgreSQL + Auth) | Supabase | ✅ |
| AI | OpenAI SDK + lancedb | OpenAI SDK + lancedb | ✅ |
| E2E Tests | ❌ None | Playwright (planned) | ❌ Missing |
| Component Docs | ❌ None | Storybook (planned) | ❌ Missing |

### 1.2 Folder Structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── attendance/page.tsx
│   │   ├── children/[childId]/page.tsx
│   │   ├── children/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── followups/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── stages/page.tsx
│   │   └── users/page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── page.tsx
├── features/
│   ├── auth/
│   ├── children/      (CRUD, attendance, followups)
│   ├── dashboard/     (KPIs, charts, analytics)
│   ├── rbac/          (guards, hooks, constants, utils)
│   ├── stages/        (stage CRUD)
│   └── users/         (user CRUD)
├── components/
│   └── layout/        (app-shell, page-header, etc.)
├── lib/
│   └── supabase/      (client, server, middleware, admin, config)
├── providers/         (theme, query)
└── types/             (database.types.ts - generated)
```

**Missing feature directories**: `services/ministries`, `classes`, `notifications`, `events`, `reports`, `settings`, `servants`

### 1.3 Current DB Schema — 21 Tables, 14 Enums

Tables present:
| Table | Purpose | Status vs PRD |
|-------|---------|--------------|
| `churches` | Tenant root | ❌ Under-built |
| `ministries` | Church sub-orgs | ✅ (named "ministries" not "services") |
| `stages` | Age/stage groups under ministry | ✅ |
| `profiles` | User profiles | ❌ Missing servant fields |
| `roles` | Role definitions | ⚠️ 5 types vs PRD's 4 |
| `permissions` | Permission codes (47 codes) | ⚠️ Needs realignment |
| `role_permissions` | Role ↔ Permission mapping | ✅ |
| `user_roles` | User ↔ Role assignments | ✅ |
| `user_stage_assignments` | User stage-scope | ✅ |
| `children` | Beneficiary records | ❌ Schema mismatch |
| `attendance` | Attendance records | ❌ No session parent |
| `followups` | Follow-up tracking | ⚠️ Status enum mismatch |
| `spiritual_records` | Spiritual milestones | ❌ Keyed to children, not servant journal |
| `events` | Events/camps | ✅ |
| `event_registrations` | Event RSVPs | ✅ |
| `notifications` | Notification records | ❌ Schema mismatch |
| `audit_logs` | Audit trail | ✅ |
| `documents` | File uploads | ✅ |
| `ai_conversations` | AI chat sessions | ✅ |
| `ai_messages` | AI chat messages | ✅ |
| `document_embeddings` | Vector embeddings | ✅ |

### 1.4 Current Route Map

| Route | Permission | Screen | Status vs SCREEN_INVENTORY |
|-------|-----------|--------|---------------------------|
| `/` | Public | Landing page | ✅ |
| `/login` | Public | Login | ✅ |
| `/signup` | Public | Registration | ✅ |
| `/forgot-password` | Public | Password reset | ✅ |
| `/reset-password` | Public | Password reset confirm | ✅ |
| `/dashboard` | `reports.read` | Dashboard | ✅ (basic) |
| `/children` | `children.read` | Child list | ✅ (basic) |
| `/children/[childId]` | `children.read` | Child detail | ✅ (basic) |
| `/attendance` | `attendance.read` | Attendance list | ✅ (basic) |
| `/followups` | `followups.read` | Follow-up list | ✅ (basic) |
| `/stages` | `stages.read` | Stage management | ✅ (basic) |
| `/users` | `users.read` | User management | ✅ (basic) |

**Missing routes**: Services/ministries, classes, notifications, settings, roles/permissions, reports/export, servant management, child edit/create standalone pages

### 1.5 RBAC Implementation

- **5 role types**: `super_admin`, `church_admin`, `stage_leader`, `servant`, `viewer`
- **47 permission codes** organized into modules: auth, churches, users, stages, children, attendance, followups, events, notifications, reports, documents, ai, audit, settings
- **Permission check pattern**: `hasPermission(PERMISSION_CODES.XXX_YYY)` in every server action
- **RLS**: Row-level security on all tenant-scoped tables using `get_user_church_id()` helper
- **Built-in SQL functions**: `user_has_permission()`, `user_has_role()`, `user_has_stage_access()`, `user_is_church_admin_or_above()`

---

## 2. Gap Analysis — Planning Documents vs Current Implementation

### 2.1 Database Schema Gaps (per DATABASE_REQUIREMENTS.md)

#### `churches` table — Under-built
Current columns: `id`, `name_ar`, `name_en`, `slug`, `logo_url`, `settings`, `is_active`, `created_at`, `updated_at`, `deleted_at`

**Missing columns** (required by PRD):
- `contact_email` text
- `contact_phone` text
- `address_ar` text
- `address_en` text
- `subscription_tier` enum ('free', 'starter', 'professional', 'enterprise')
- `subscription_status` enum ('active', 'trial', 'expired', 'cancelled')
- `trial_ends_at` timestamptz
- `feature_flags` jsonb
- `locale` text (different from `settings`)

#### `profiles` table — Missing servant fields
Current columns: `id`, `church_id`, `email`, `phone`, `full_name_ar`, `full_name_en`, `avatar_url`, `preferred_locale`, `is_active`, `last_login_at`, `created_at`, `updated_at`, `deleted_at`

**Missing columns** (required by PRD for servant management):
- `date_of_birth` date
- `gender` gender_type
- `spiritual_title` text (e.g., "مُخَلّص", "خادم", "قس")
- `service_started_at` date

#### `children` table — Schema differs from PRD's `beneficiaries`
Current uses separate `first_name_ar`/`last_name_ar` pattern. PRD specifies `full_name_ar`/`full_name_en`.

**Missing from children** (per PRD beneficiary fields):
- `full_name_ar` text (PRD uses single field, not first/last)
- `full_name_en` text
- `father_mobile` text (separate from parent_phone)
- `mother_mobile` text
- `whatsapp` text
- `confession_father` text
- `school_address_ar` text (has school_name_ar but not full address)

**Extra in current children** (not in PRD):
- `emergency_contact_name`
- `emergency_contact_phone`
- `medical_conditions` (stored as free text vs structured)
- `allergies`
- `medications`

> **Decision needed**: Keep first_name/last_name split (better for sorting/searching) or migrate to full_name as PRD requires.

#### Missing `services` table (PRD uses "services", current uses "ministries")
PRD requires: `id`, `church_id`, `name_ar`, `name_en`, `description_ar`, `description_en`, `is_active`, `sort_order`

Current `ministries` table already satisfies this. **Terminology conflict**: PRD calls these "services", codebase calls them "ministries". Rename required for alignment.

#### Missing `classes` table
PRD's Class-Based structure requires a `classes` table under Stage:
- `id`, `church_id`, `stage_id`, `name_ar`, `name_en`, `capacity`, `is_active`, `sort_order`

**Not present** in current schema. Children currently assigned directly to stage, not to class.

#### Missing `attendance_sessions` table
PRD specifies two-level attendance: `attendance_sessions` (session metadata) → `attendance_records` (per-child).

Current implementation has a flat `attendance` table with no session parent:
- `id`, `church_id`, `child_id`, `stage_id`, `attendance_date`, `status`, `notes`, `recorded_by`

**Gap**: No session grouping (session topic, leader notes, scheduled vs actual).

#### Missing `beneficiary_assignments` table
PRD specifies a separate junction table `beneficiary_assignments` (beneficiary ↔ service ↔ stage).

Current: assignment is embedded directly on the `children` table via `ministry_id` and `stage_id` columns.

**Trade-off**: Current pattern is simpler but less flexible. PRD's separate table allows for multiple service/stage enrollments over time.

#### Missing `spiritual_journal_entries` table
PRD specifies a servant-facing journal (`spiritual_journal_entries`) tied to servants.

Current: `spiritual_records` keys to children, not servants. No servant journal exists.

#### `followups` status enum — Mismatch
Current: `scheduled`, `in_progress`, `completed`, `cancelled`
PRD (GAP_ANALYSIS): `open`, `in_progress`, `completed`, `cancelled`

`'scheduled'` should be `'open'` per PRD specification.

#### `notifications` — Channel/Type mismatch
Current schema:
- `notification_type` enum: `'in_app'`, `'email'`
- `notification_channel` enum: `'absence_alert'`, `'followup_reminder'`, `'birthday'`, `'event_reminder'`, `'system'`

PRD specifies different notification types:
- `type` field should include: absence_alert, followup_reminder, event_reminder, birthday, system_announcement, role_change
- Channel should be a separate concept (in_app, email, sms, whatsapp)

**Gap**: The PRD mixes channel and type in a confusing way. Current implementation separates `type` (in_app/email) from `channel` (absence_alert/etc.) — this is actually more normalized but doesn't match PRD's schema exactly.

### 2.2 RBAC Architecture Gaps (per RBAC_ARCHITECTURE.md)

#### Role Model Mismatch
| PRD Role | Current Role | Notes |
|----------|-------------|-------|
| `platform_owner` | ❌ | System-wide super-admin role |
| `super_admin` | `super_admin` | Same concept |
| `admin` | `church_admin` | Same concept, different name |
| `user` | ❌ | No generic "user" — split into `stage_leader`, `servant`, `viewer` |

Current has **5 role types** vs PRD's **4**. The current model provides more granularity for servant/stage-leader distinction, but lacks a `platform_owner` role.

#### Permission Code Coverage
Current has **47 permission codes** covering: auth, churches, users, stages, children, attendance, followups, events, notifications, reports, documents, ai, audit, settings.

PRD's RBAC_ARCHITECTURE.md defines ~35+ permissions across: church, services, classes, beneficiaries, attendance, followups, reports, notifications, settings, servants, spiritual_records.

**Mismatch**: PRD references `services.manage`/`classes.manage`/`servants.manage` which don't exist in current code. Current has `stages.*`/`children.*`/`users.*` which are named differently.

#### Class-Based Permission Model
PRD specifies permissions scoped to the class hierarchy: Church → Service → Stage → Class.
Current RBAC only scopes to Stage level. There is no class-level permission.

### 2.3 UI/UX Gaps (per SCREEN_INVENTORY & DESIGN_SYSTEM_REQUIREMENTS)

#### Missing Screens
| Screen | Priority | Status |
|--------|----------|--------|
| Services (Ministries) CRUD | P1 | ❌ |
| Classes CRUD | P1 | ❌ |
| Settings page | P1 | ❌ |
| Roles & Permissions management | P1 | ❌ |
| Notification center | P2 | ❌ |
| Servant detail/profile | P2 | ❌ |
| Reports & export | P2 | ❌ |
| Events CRUD | P2 | ✅ (events table exists, no UI) |
| Spiritual journal | P2 | ❌ |
| Child create/edit standalone page | P1 | ⚠️ (inline dialog only) |
| Bulk attendance entry | P1 | ⚠️ (action exists, UI basic) |

#### Missing Dashboard Features (per DASHBOARD_SPECIFICATIONS.md)
- Servant performance metrics (followup completion rates)
- Class-level attendance aggregation
- Service-level pipeline analytics
- Export dashboard data to CSV/PDF
- Real-time notification count in sidebar

### 2.4 Naming Convention Conflicts

| Planning Document Term | Current Codebase Term | Resolution |
|----------------------|----------------------|------------|
| Service | Ministry | Rename required |
| Beneficiary | Child | Rename required |
| Servant (non-leader role) | Servant (role type) | ✅ Already aligned |
| Servant | Profile/User | Reframe as servant management |
| User (generic role) | Stage Leader / Servant / Viewer | Needs mapping |
| Class | (nonexistent) | Needs creation |
| Attendance Session | (nonexistent) | Needs creation |
| Spiritual Journal | Spiritual Records | Partial — records exist but for children, not servants |

### 2.5 Class-Based Structure Verification

PRD requires: **Church → Service → Stage → Class**

Current structure: **Church → Ministry → Stage** (no Class level)

| Level | Current | Required | Impact |
|-------|---------|----------|--------|
| Church | ✅ `churches` | ✅ `churches` | ✅ |
| Service | ⚠️ `ministries` | `services` | Name mismatch, structure OK |
| Stage | ✅ `stages` | ✅ `stages` | ✅ |
| Class | ❌ Missing | `classes` | MVP-blocking — children directly on stage |

**Impact**: The Class level is fundamental to the PRD's organizational model. Without it, attendance grouping, capacity management, and servant assignments cannot operate at the right granularity.

### 2.6 Tenant Model Verification

**Current**: Single-tenant per church. All tables have `church_id` FK. RLS uses `get_user_church_id()` to scope queries. Profiles have exactly one `church_id`.

**PRD**: Same single-tenant model. No multi-tenant church management in MVP.

**Verdict**: ✅ Current implementation matches PRD's tenant model.

### 2.7 Security Verification

| Aspect | Current State | PRD Requirement | Status |
|--------|--------------|-----------------|--------|
| RLS on all tables | ✅ Yes | ✅ Required | ✅ |
| Server-side permission checks | ✅ Yes | ✅ Required | ✅ |
| Service role restricted | ✅ Yes (Phase 0) | ✅ Required | ✅ |
| Input validation (zod) | ✅ Yes | ✅ Required | ✅ |
| Audit logging | ✅ DB triggers + app-level | ✅ Required | ✅ |
| CSP headers | ❌ Not configured | Not specified | ⚠️ |
| Rate limiting | ❌ Not configured | Not specified | ⚠️ |

---

## 3. Recommendations

### 3.1 Database Migration Order (Phase 1B)

1. **Schema alignment migration** — Add missing columns to `churches` and `profiles`. Create `classes` table. Add `attendance_sessions` table. Rename enums/types as needed.
2. **Data migration** — Migrate existing data if columns are renamed. Backfill default values.
3. **Index update** — Add indexes for new columns/tables.
4. **RLS update** — Add RLS policies for new tables, update existing policies for renamed columns.

### 3.2 Terminology Rename Decision

**Options for the "services vs ministries" naming conflict:**

- **Option A**: Rename `ministries` → `services` in codebase (breaking change, requires migration, but aligns with PRD)
- **Option B**: Update PRD to use "ministries" instead of "services" (non-breaking, but creates gap)

**Recommendation**: Option A — rename to align with PRD. The term "service" better reflects the church domain model (e.g., "Sunday School Service" vs "Sunday School Ministry").

**Options for "children vs beneficiaries" naming conflict:**

- **Option A**: Rename `children` → `beneficiaries` (breaking, but PRD-aligned)
- **Option B**: Update PRD to use "children" (non-breaking, appropriate for children's ministry context)

**Recommendation**: Option B — "children" is the correct domain term for a children's ministry CRM. The PRD's "beneficiaries" is generic. Keep "children".

### 3.3 RBAC Realignment

1. Add `platform_owner` role type to `user_role_type` enum
2. Add new permission codes: `services.*`, `classes.*`, `servants.*`, `spiritual_records.*`
3. Update seed functions with new permission mappings
4. Add class-level permission scoping if needed

### 3.4 Implementation Priority for Phase 1B

Based on IMPLEMENTATION_ROADMAP.md and MVP_BACKLOG.md:

| Priority | Task | Dependencies |
|----------|------|-------------|
| P0 | Create `classes` table | None |
| P0 | Rename `ministries` → `services` | None |
| P0 | Add missing columns to `churches`, `profiles` | None |
| P0 | Create `attendance_sessions` table | None |
| P1 | Add `platform_owner` role | RBAC realignment |
| P1 | Update permission codes | RBAC realignment |
| P1 | Migrate children data if schema changes | Schema alignment |
| P1 | Build classes CRUD UI | Classes table |
| P1 | Build services CRUD UI | Rename complete |
| P2 | Servant management screens | Profiles enriched |
| P2 | Attendance session UI | sessions table |
| P2 | Settings page | Churches enriched |
| P2 | Report/export | Dashboard specs |

### 3.5 Pre-Implementation Quick Wins

Changes that can be made immediately with no DB migration:

1. **Naming**: Start using PRD terminology in new code (services, beneficiaries in comments/docs)
2. **Permission codes**: Add new PERMISSION_CODES constants (not yet connected to DB)
3. **Types**: Update TypeScript types to reflect target schema
4. **Comments**: Add TODO markers at schema mismatch locations in current code
5. **Guard components**: Add page-level PermissionGuard for all planned routes

---

## 4. Summary of Key Findings

| Category | Finding | Severity |
|----------|---------|----------|
| Database | Missing `classes` table — fundamental to class-based model | 🔴 Critical |
| Database | Missing `attendance_sessions` table — two-level attendance | 🔴 Critical |
| Database | `churches` under-built — missing subscription/contact fields | 🟡 Medium |
| Database | `profiles` under-built — missing servant fields | 🟡 Medium |
| Database | `children` schema doesn't match PRD beneficiaries spec | 🟡 Medium |
| Database | `followup_status` enum uses 'scheduled' vs PRD's 'open' | 🟢 Minor |
| Naming | `ministries` vs PRD's `services` | 🟡 Medium |
| Naming | `children` vs PRD's `beneficiaries` | 🟢 Minor |
| RBAC | Missing `platform_owner` role | 🟡 Medium |
| RBAC | Missing `services.*`, `classes.*`, `servants.*` permissions | 🟡 Medium |
| RBAC | Permission codes spread across DB + TypeScript constants | 🟢 Minor |
| Screens | 8+ screens missing (services, classes, settings, roles, events, notifications, reports, export) | 🔴 Critical |
| Dashboard | Missing servant metrics, class-level aggregation, export | 🟡 Medium |
| Testing | No E2E tests — Playwright not configured | 🟡 Medium |
| i18n | No extraction tooling configured | 🟢 Minor |
| Class Structure | Church → Service → Stage → Class (missing Class level) | 🔴 Critical |
| Tenant Model | Single-church-per-user matches PRD | ✅ |
| Security | RLS, server-side checks, audit logging all present | ✅ |
| AI Features | Schema in place for Phase 3, not yet in screens | 🟢 Ahead |

**Overall Readiness Score for Phase 1**: 45% — the core framework is solid but significant schema, terminology, and UI gaps must be closed before Phase 1 implementation can begin.
