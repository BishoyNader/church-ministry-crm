# Platform Owner / Multi-Tenant Administration Sprint — Audit & Plan

**Project:** Church Ministry CRM  
**Version:** 1.1  
**Date:** 2026-08-04  
**Status:** Audit Complete — Plan Ready for Review  
**Scope:** Audit + Gap Analysis + Architecture + Phased Implementation Plan. **No code written yet.**

---

## Executive Summary

The platform is functionally complete and production-hardened (RLS/RBAC PASS, migrations 001–031 aligned), but the **Platform Owner (PO) administration surface is missing**. The PO can bootstrap, review church requests, and read audit logs, but **cannot**:
- List / create / edit / deactivate churches directly.
- Provision a Church Super Admin for a church created directly.
- Import users (bulk) across churches.
- Manage users through the existing church-scoped UI (its `profile.church_id` is NULL).

This sprint closes those gaps. **Critical finding:** because the PO has `church_id = NULL`, the existing RLS-bound user/role/stage actions (which all filter on the actor's `profile.church_id`) **do not work for the PO**. The PO provisioning path must be service-role (admin client) + SECURITY DEFINER RPCs, mirroring the existing `approve_church_request` pattern — never RLS-bound.

---

## Deliverable 1 — Current-State Audit

### 1.1 Database Schema Audit (verified against migrations 001–031)

#### churches table (001 + 009 + 023)
- **Exists:** ✅ Fully implemented.
- **Base columns (001):** `id, name_ar, name_en, slug, logo_url, settings (jsonb), is_active, created_at, updated_at, deleted_at`.
- **Provisioning columns (009):** `contact_email, contact_phone, address_ar, address_en, subscription_tier (default 'trial'), subscription_status (default 'active'), trial_ends_at, feature_flags (jsonb), locale (default 'ar')`.
  - **Correction to earlier draft:** these columns **DO exist** (009). The draft's claim they were "missing" was wrong.
- **Indexes:** `idx_churches_slug` (partial), `idx_churches_subscription_status` (partial, 009). `idx_churches_active` was dropped by 009.
- **RLS policies (022):** `tenant_read` (SELECT id = get_user_church_id()), `platform_owner_all` (FOR ALL, user_is_platform_owner()), `super_admin_update` (UPDATE id = get_user_church_id() AND user_is_super_admin(id)).
- **CRUD status:** No direct Create/Edit/Deactivate UI. Churches are created only via `approve_church_request` (023) or the service-role admin client. **The `platform_owner_all` policy already grants the PO full CRUD on churches** — no RLS change needed.

#### church_requests table (023)
- **Exists:** ✅ Fully implemented.
- **Columns:** `id, church_name_ar, church_name_en, catechist_name, applicant_name, email, phone, notes, status (pending/approved/rejected), reviewed_by, reviewed_at, decision_notes, created_at, updated_at`.
- **RLS (023):** `platform_owner_all` (ALL), `applicant_read` (SELECT by JWT email), `public_insert` (INSERT pending), `immutable_review` (UPDATE false), `immutable_delete` (DELETE false).
- **UI:** `AdminChurchRequestsPage` (list/approve/reject + invite link). ✅ Working.

#### roles table (001 + 021 + 026)
- **Exists:** ✅ Fully implemented.
- `role_type` enum (021): `platform_owner, super_admin, admin, servant`. Old `church_admin/stage_leader/viewer` mapped to `admin/servant`.
- `church_id` nullable (026) for the global `platform_owner` role; `uq_roles_global_platform_owner` ensures exactly one global PO role.
- **Missing:** No `churches.*` permission codes (deleted in 021). Church management is expressed via `tenants.*` codes.

#### user_roles table (001 + 020 + 023 + 026 + 031)
- **Exists:** ✅ Fully implemented.
- Temporal model: `start_date`, `end_date`, `assigned_by` (NOT NULL, 020). Partial unique `uq_user_roles_active` on active grants (023).
- `church_id` nullable (026) for global PO grants; `uq_user_roles_active_global` enforces single active global grant.
- **Security (031 F1):** `super_admin_all` now has `WITH CHECK` — super_admin can only grant roles within their own church, and only to users of that church. **Cannot escalate to global/PO.** Do not weaken.

#### profiles table (001 + 026 + 027)
- **Exists:** ✅ Fully implemented.
- `church_id` nullable (026) for the PO profile.
- **RLS (027 T4):** `church_id` immutable to RLS writers; `admin_write` policy for the USERS_UPDATE flow; `own_read` (026) for the PO to read own profile.

#### servants table (011 + 023 + 026)
- **Exists:** ✅ Fully implemented.
- `church_id` nullable (026) for the PO servant row.
- **Key gate:** `get_my_access_state()` (023) requires an **approved** servant row to pass the middleware gate. `createUser` (user.service.ts) currently does **NOT** create a servant row — a directly-created user cannot pass the gate. **Confirmed gap.**

### 1.2 RBAC / Permission System Audit (verified)

#### Permission catalog (021 + 031)
- **Platform codes:** `tenants.create/read/update/delete`, `system.metrics`, `system.audit`, `support.manage`, `subscriptions.manage`, `billing.read`.
- **Church codes:** `beneficiaries.*`, `attendance.*`, `followups.*`, `servants.*`, `services.*`, `classes.*`, `stages.*`, `spiritual.*`, `users.*`, `notifications.*`, `reports.*`, `import.execute`, `export.execute`, `audit.read`, `settings.*`.
- **No `churches.*` codes** — `churches.read/update` were **deleted** in 021. `tenants.*` is the PO-only church-management surface.

#### PO permission bundle (026 `seed_platform_owner_role`)
`tenants.create/read/update/delete`, `subscriptions.manage`, `billing.read`, `system.metrics`, `system.audit`, `support.manage`, `users.read`, `reports.read`, `reports.export`, `audit.read`, `notifications.read`.

#### Role seed (021 `seed_church_roles`)
- **Super Admin:** all permissions (incl. `tenants.*`, `system.*`).
- **Admin:** limited set (no `tenants.*`, no `system.*`, no `servants.approve/delete`).
- **Servant:** read + create subset (no `tenants.*`, no `system.*`, no `users.*`).

#### RLS helper functions (022/027)
- `user_is_platform_owner()` — church-agnostic. ✅
- `user_is_super_admin(church_id)` — **coalesces NULL to `get_user_church_id()`**. For the PO, `get_user_church_id()` = NULL → PO is not a super_admin of any church. ✅ Correct isolation.
- `user_has_permission_in_church(code, church_id)` (027 T1) — church-scoped permission check. ✅

### 1.3 Existing UI Audit (verified)

| Surface | Status | Notes |
|---------|--------|-------|
| Church Requests (list/approve/reject) | ✅ | `/admin/church-requests` |
| Church List | ❌ Missing | No route, no nav item |
| Church Create (direct) | ❌ Missing | Only via request approval |
| Church Edit | ❌ Missing | — |
| Church Deactivate/Activate | ❌ Missing | — |
| Church Statistics | ❌ Missing | — |
| Church Provisioning Wizard | ❌ Missing | — |
| User List | ✅ | `/users` |
| User Create | ✅ | `UserForm` |
| User Edit | ✅ | `UserForm` |
| User Deactivate | ✅ | In list |
| Role Assignment | ✅ | Required in schema + UI |
| Stage Assignment | ✅ | In create form |
| User Import | ❌ Missing | Only beneficiary import |
| Invitation/set-password flow | ❌ Missing | `createUser` uses `email_confirm: true` + password directly |
| Beneficiary Import/Export | ✅ | `import-export` module |

**Correction to earlier draft:** role selection is **NOT optional** — `createUserSchema.roleIds` requires `.min(1)` and the `UserForm` labels it with `*`. The real UX issues are: no servant auto-create, no invitation flow, and no clear role descriptions.

### 1.4 API / Route Audit (verified)

- **Routes present:** `/admin/church-requests`, `/users`, `/import-export`, `/dashboard`, `/audit`, `/services`, `/classes`, `/stages`, `/approvals`, `/settings`, `/notifications`, `/reports`, `/children`, `/attendance`, `/followups`, `/servants`, `/spiritual-journal`.
- **Missing:** `/admin/churches` (list), `/admin/churches/[id]` (detail), `/admin/churches/create` (wizard).
- **API endpoints:** `GET /api/health`, `POST /api/cron/notifications`. No church-management API needed (server actions suffice).

### 1.5 Hooks / Services / Actions Audit (verified)

| Feature | Hooks | Services | Actions | Status |
|---------|-------|----------|---------|--------|
| Churches | `useChurchesForSignup` | `churches.service` (signup only) | `listChurchesForSignupAction` | ⚠️ Signup only |
| Church Requests | `useChurchRequests`, `useApproveChurchRequest`, `useRejectChurchRequest` | `provisioning.service`, `church-request.service` | `listChurchRequestsAction`, `approveChurchRequestAction`, `rejectChurchRequestAction` | ✅ Full flow |
| Users | `useUserList/Detail/Create/Update/Deactivate/AssignRoles/AssignStages/Roles/Stages` | `user.service` | `listUsersAction`, `getUserAction`, `createUserAction`, `updateUserAction`, `deactivateUserAction`, `assignRolesAction`, `assignStagesAction`, `getRolesAction`, `getStagesAction` | ⚠️ CRUD works for church admins; **fails for PO** (see below) |
| Import/Export | `usePreviewImport`, `useImportBeneficiaries` | `import-export.service` | `previewImportAction`, `importBeneficiariesAction`, `exportDataAction` | ⚠️ Beneficiaries only |
| Platform Owner | — | `platform-owner.service` | `bootstrapPlatformOwnerAction` | ✅ One-time bootstrap |

### 1.6 Critical Findings (verified)

1. **PO `church_id` = NULL breaks existing church-scoped actions.** `listUsersAction`, `getUserAction`, `createUserAction`, `assignRolesAction`, `assignStagesAction`, `getRolesAction`, `getStagesAction` all read `profile.church_id` from the actor and pass it as a filter. For the PO, `profile.church_id` is NULL → these actions return nothing or fail. The PO **cannot** manage users across churches through the existing RLS-bound UI.
2. **`createUser` does not create a servant row.** Directly-created users cannot pass the `get_my_access_state()` middleware gate (requires an approved servant row). Confirmed in `user.service.ts` (`createUser` creates auth user + profile + roles + stage assignments only).
3. **`get_user_church_id()` = NULL for PO** means `user_is_super_admin(NULL)` is false for the PO — the PO cannot use any super_admin-scoped RLS path. PO provisioning must be service-role + SECURITY DEFINER RPCs.
4. **`approve_church_request` (023) is the canonical atomic provisioning pattern** — church + `seed_church_roles` + profile + approved servant + super_admin grant + notification + 3 audit rows, all in one transaction. This is the template for the new "create church + super admin" flow.

---

## Deliverable 2 — Gap Analysis

### GAP-1: Church Management Module (HIGH)
**Problem:** PO cannot list/create/edit/deactivate churches or view stats.
**What exists:** `churches` table (all columns incl. contact/subscription), `tenants.*` codes, `platform_owner_all` RLS, `seed_church_roles`, `write_audit_log`, `send_notification`.
**What's needed:** list page, create/edit form, activate/deactivate toggle, stats, server actions, i18n, nav item + route.
**DB impact:** ✅ None (all columns exist).
**RLS impact:** ✅ None (`platform_owner_all` covers ALL).
**RBAC impact:** ✅ `tenants.*` already granted to PO.
**Note:** Reads must use the service-role admin client (PO's `church_id` is NULL, so RLS-bound `churches` SELECT with `tenant_read` won't expose rows; the `platform_owner_all` policy does allow it, but the admin-client path is cleaner and avoids the NULL-church filter in reusable service code).

### GAP-2: Church Super Admin Creation (HIGH)
**Problem:** After direct church creation, there is no way to provision the first Super Admin.
**What exists:** `approve_church_request` (canonical atomic pattern), `seed_church_roles`, `send_notification`, `createUser` (service-role, but no servant + no PO-scoped church target).
**What's needed:** A `create_church_super_admin` SECURITY DEFINER RPC (or combined `create_church_with_super_admin`) that atomically creates: church → seed roles → profile → approved servant → super_admin grant → notification → audit.
**Recommendation:** **Option A — combined wizard** (Create Church + Super Admin in one transactional flow) for the initial provisioning path, with a separate "Add Super Admin to existing church" step for later.
**DB impact:** ⚠️ New SECURITY DEFINER RPC (migration 032).
**RLS impact:** ✅ Service-role + SECURITY DEFINER (bypasses RLS, existing pattern).
**RBAC impact:** ✅ `tenants.create` + `servants.create` cover the flow; RPC enforces `user_is_platform_owner()` internally.

### GAP-3: User Creation UX Fixes (MEDIUM)
**Problem:** Directly-created users have no servant row (can't pass middleware gate); no invitation flow; role labels unclear.
**What exists:** `createUser` (service-role), role required in schema+UI, `assignRoles`/`assignStages` super_admin-guarded.
**What's needed:**
- Auto-create an **approved servant row** in `createUser` (atomic).
- Add an invitation/set-password-link option (mirror `bootstrapPlatformOwnerAction`'s `generateLink`).
- Add role descriptions/labels in the form.
**Recommendation:** Role stays **required** at creation (already enforced). Add servant auto-create + invitation option. Do NOT auto-create servant rows for PO-managed cross-church users without a church target.
**DB impact:** ✅ None (add servant INSERT to `createUser`).
**RLS impact:** ✅ Service-role (unchanged).
**RBAC impact:** ✅ None.

### GAP-4: Bulk User Import (HIGH)
**Problem:** No user import from CSV/Excel.
**What exists:** Beneficiary import pattern: `ImportUploadArea` (file upload, 10MB/extension gate), `parseImportFile` (CSV/XLSX → preview rows), `validateBeneficiaryRows` (duplicate detection), `importBeneficiaries` (service-role/RPC insert), summary + audit. `import.execute` permission exists.
**What's needed:** User import (preview → validate → import → summary), cross-church support for PO, auto servant creation, invitation for imported users.
**Architecture proposal:**
- Reuse the existing parse/validate/preview pipeline (make it generic).
- New `UserImportRow` schema + `validateUserRows` (duplicate email/phone, valid role, valid church for PO).
- Import executes via a **SECURITY DEFINER RPC** (`import_users`) for atomicity — service-role/admin-client batch inserts are not transactional across auth.users + profiles + servants + user_roles.
- **Church Super Admin** imports within their church (`import.execute` + servant auto-create). **PO** imports across churches (requires `church` column in file; `tenants.create` gate).
- Random password + invitation link for each imported user (production only).
**DB impact:** ⚠️ New SECURITY DEFINER RPC `import_users` (migration 032).
**RLS impact:** ✅ Service-role / SECURITY DEFINER.
**RBAC impact:** ⚠️ Church-scoped: `import.execute`. Cross-church: `tenants.create` + `import.execute` (enforced in the action, not just DB).

### GAP-5: Church Provisioning Workflow (HIGH)
**Problem:** No complete onboarding flow for new churches created directly.
**What's needed:** Step wizard: Create Church → Configure Church → Create Super Admin → Assign Roles → Ready. Reuses GAP-1 + GAP-2.
**UX proposal:** A single `Create Church` wizard page (`/admin/churches/create`) with steps and a final summary; the backend action is one atomic transaction (church + roles + super admin + servant + notification + audit). Rollback on any step failure.
**DB impact:** ✅ None beyond GAP-2's RPC.
**RLS impact:** ✅ PO bypass via RPC.
**RBAC impact:** ✅ `tenants.*` + `servants.create`.

---

## Deliverable 3 — Recommended Architecture

### 3.1 Principles (must not be violated)
- **No RLS/RBAC weakening.** All new DB writes go through SECURITY DEFINER RPCs (existing pattern) or the service-role admin client. Never add a permissive `FOR ALL` tenant policy.
- **PO writes are service-role + SECURITY DEFINER**, because the PO's `church_id` is NULL and `user_is_super_admin(NULL)` is false.
- **Every RPC enforces `user_is_platform_owner()` (or `user_has_permission_in_church`) internally** and writes audit rows.
- **Atomicity:** church + roles + super admin + servant + notification + audit in one transaction.
- **No `churches.*` codes** — reuse `tenants.*`. (Optionally add `churches.read` back later if needed, but not required.)

### 3.2 Proposed Module Structure

```
src/features/churches/
├── actions/
│   ├── church.actions.ts                  ← NEW: listChurches, createChurch, updateChurch, deactivateChurch, getChurchStats
│   ├── church-provisioning.actions.ts     ← NEW: createChurchWithSuperAdminAction
│   └── church-request.admin.actions.ts    ← EXISTING
├── components/
│   ├── churches-page.tsx                  ← NEW: list + search + filter + status
│   ├── church-form-dialog.tsx             ← NEW: create/edit
│   ├── church-detail-page.tsx             ← NEW: detail + stats + users
│   ├── church-provisioning-wizard.tsx     ← NEW: multi-step wizard
│   └── admin-church-requests-page.tsx     ← EXISTING
├── hooks/
│   ├── use-churches.ts                    ← EXTEND: CRUD hooks
│   └── use-church-requests.ts             ← EXISTING
├── services/
│   ├── churches.service.ts                ← EXTEND: CRUD via admin client
│   └── provisioning.service.ts            ← EXTEND: createChurchWithSuperAdmin
├── schemas/church.schema.ts               ← NEW: Zod
├── types/church.types.ts                  ← NEW: TS types
└── index.ts                               ← UPDATE
```

```
src/features/import-export/
├── components/
│   ├── import-export-page.tsx             ← EXISTING — add user import tab
│   ├── import-upload-area.tsx             ← EXISTING — make generic
│   ├── user-import-area.tsx               ← NEW
│   └── export-actions.tsx                 ← EXISTING — add user export
├── schemas/import-export.schema.ts        ← EXTEND: user import schema
├── services/import-export.service.ts      ← EXTEND: parseUserImport, validateUserRows
├── actions/import-export.actions.ts       ← EXTEND: previewUserImportAction, importUsersAction
├── hooks/use-import-export.ts             ← EXTEND
└── types/import-export.types.ts           ← EXTEND
```

### 3.3 Routes

```
/app/[locale]/(app)/
├── admin/
│   ├── church-requests/                   ← EXISTING
│   └── churches/                          ← NEW
│       ├── page.tsx                       ← NEW: list
│       ├── create/page.tsx                ← NEW: wizard
│       └── [churchId]/page.tsx            ← NEW: detail + stats
├── users/                                 ← EXISTING
└── import-export/                         ← EXISTING
```

### 3.4 Permission Model

| Permission | Current Owner | New Owner | Notes |
|------------|---------------|-----------|-------|
| `tenants.read` | PO | PO | List churches (admin client) |
| `tenants.create` | PO | PO | Create church / wizard |
| `tenants.update` | PO | PO | Edit church |
| `tenants.delete` | PO | PO | Deactivate church |
| `import.execute` | Admin+ | Admin+ | Church-scoped user import |
| `tenants.create` + `import.execute` | PO | PO | Cross-church user import |
| `servants.create` | Super Admin | Super Admin + PO | Super Admin creation |

### 3.5 Data Flow (PO provisioning)

```
PLATFORM OWNER (church_id = NULL)
    │
    ├── Create Church + Super Admin (wizard)
    │   └── createChurchWithSuperAdminAction
    │       └── create_church_with_super_admin RPC (SECURITY DEFINER, PO-only)
    │           ├── INSERT churches (name, slug, contact, subscription)
    │           ├── seed_church_roles(church_id)
    │           ├── INSERT profiles (auth user)
    │           ├── INSERT servants (approved)
    │           ├── INSERT user_roles (super_admin grant)
    │           ├── send_notification (onboarding)
    │           └── write_audit_log ×3 (church, profile, servant)
    │
    ├── Edit / Deactivate Church
    │   └── updateChurchAction / deactivateChurchAction → admin client UPDATE
    │
    ├── View Churches / Stats
    │   └── listChurchesAction / getChurchStatsAction → admin client SELECT
    │
    └── Import Users (cross-church)
        └── importUsersAction → import_users RPC (SECURITY DEFINER, PO-only)
            └── per row: auth user + profile + approved servant + role grant + audit
```

---

## Deliverable 4 — Implementation Plan (Phased)

### Phase 1: Church Management CRUD (HIGH — 3–4 days)
**Objective:** PO can list/create/edit/activate/deactivate churches and view stats.
**Files:**
| File | Action |
|------|--------|
| `src/features/churches/types/church.types.ts` | CREATE |
| `src/features/churches/schemas/church.schema.ts` | CREATE |
| `src/features/churches/services/churches.service.ts` | EXTEND (admin-client CRUD) |
| `src/features/churches/actions/church.actions.ts` | EXTEND (list/create/update/deactivate/stats) |
| `src/features/churches/hooks/use-churches.ts` | EXTEND |
| `src/features/churches/components/churches-page.tsx` | CREATE |
| `src/features/churches/components/church-form-dialog.tsx` | CREATE |
| `src/features/churches/components/church-detail-page.tsx` | CREATE |
| `src/features/churches/index.ts` | UPDATE |
| `src/app/[locale]/(app)/admin/churches/page.tsx` | CREATE |
| `src/app/[locale]/(app)/admin/churches/[churchId]/page.tsx` | CREATE |
| `src/components/layout/app-shell.tsx` | UPDATE (nav item, `tenants.read`) |
| `src/messages/en.json`, `src/messages/ar.json` | UPDATE |
**RBAC impact:** ✅ None — `tenants.*` already granted.
**RLS impact:** ✅ None — `platform_owner_all` covers ALL; use admin client for reads.
**Migration:** ✅ None.
**Risks:** LOW — PO reads must use admin client (NULL church_id). Verify no RLS-bound read leaks into service.
**Validation:** PO can list/create/edit/activate/deactivate; church-scoped users cannot access; `tsc`/`lint`/`build`.

### Phase 2: Church Super Admin Creation (HIGH — 2–3 days)
**Objective:** PO can provision a Super Admin (directly or in wizard).
**Files:**
| File | Action |
|------|--------|
| `supabase/migrations/032_church_provisioning.sql` | CREATE (`create_church_with_super_admin` RPC + `create_church_super_admin` RPC) |
| `src/features/churches/services/provisioning.service.ts` | EXTEND |
| `src/features/churches/actions/church-provisioning.actions.ts` | CREATE |
| `src/features/churches/hooks/use-churches.ts` | EXTEND |
| `src/features/users/services/user.service.ts` | EXTEND (servant auto-create in `createUser`) |
| `src/features/users/actions/user.actions.ts` | EXTEND (PO-safe create path) |
| `src/messages/en.json`, `src/messages/ar.json` | UPDATE |
**RBAC impact:** ✅ `tenants.create` + `servants.create`; RPC enforces `user_is_platform_owner()`.
**RLS impact:** ✅ Service-role + SECURITY DEFINER (existing pattern).
**Migration:** ⚠️ **032** — new SECURITY DEFINER RPCs (service_role-only EXECUTE, mirroring 026/023).
**Risks:** MEDIUM — atomicity (all-or-nothing: church + roles + profile + servant + grant + notification + audit). Follow 023's `approve_church_request` exactly.
**Validation:** PO creates church + Super Admin atomically; Super Admin logs in immediately; servant row exists; super_admin grant active; notification + 3 audit rows; `tsc`/`lint`/`build`.

### Phase 3: User Creation UX Fixes (MEDIUM — 1–2 days)
**Objective:** Fix `createUser` to auto-create approved servant rows; add invitation option; clarify role labels.
**Files:**
| File | Action |
|------|--------|
| `src/features/users/services/user.service.ts` | EXTEND (servant INSERT in `createUser`, atomic) |
| `src/features/users/components/user-form.tsx` | UPDATE (invitation option, role descriptions) |
| `src/features/users/actions/user.actions.ts` | UPDATE (invitation link step in prod) |
| `src/features/auth/services/auth.service.ts` | VERIFY signup also creates servant |
| `src/messages/en.json`, `src/messages/ar.json` | UPDATE |
**RBAC impact:** ✅ None.
**RLS impact:** ✅ Service-role.
**Migration:** ✅ None.
**Risks:** LOW — ensure `createUser` rollback deletes the servant row on failure (use transaction / delete on error like the existing auth-user cleanup).
**Validation:** create user → servant row auto-created; role required (already); invitation link generated in prod; existing flows unaffected; `tsc`/`lint`/`build`.

### Phase 4: Bulk User Import (HIGH — 3–4 days)
**Objective:** PO (cross-church) and Church Super Admin (church-scoped) import users from CSV/Excel.
**Files:**
| File | Action |
|------|--------|
| `supabase/migrations/032_church_provisioning.sql` | EXTEND (`import_users` RPC, service_role + authenticated grants) |
| `src/features/import-export/types/import-export.types.ts` | EXTEND (UserImportRow, summary) |
| `src/features/import-export/schemas/import-export.schema.ts` | EXTEND (user import schema) |
| `src/features/import-export/services/import-export.service.ts` | EXTEND (parseUserImport, validateUserRows) |
| `src/features/import-export/actions/import-export.actions.ts` | EXTEND (previewUserImportAction, importUsersAction) |
| `src/features/import-export/hooks/use-import-export.ts` | EXTEND |
| `src/features/import-export/components/import-upload-area.tsx` | REFACTOR (generic) |
| `src/features/import-export/components/user-import-area.tsx` | CREATE |
| `src/features/import-export/components/import-export-page.tsx` | UPDATE (user import tab) |
| `src/messages/en.json`, `src/messages/ar.json` | UPDATE |
**RBAC impact:** ⚠️ Church-scoped: `import.execute`. Cross-church (PO): `tenants.create` + `import.execute` (enforced in action).
**RLS impact:** ✅ Service-role / SECURITY DEFINER.
**Migration:** ⚠️ **032** — `import_users` RPC (auth user + profile + approved servant + role grant + audit per row, atomic).
**Risks:** MEDIUM — duplicate email/phone detection, role/church validation, random password + invitation link (prod), DB auth-user creation limits.
**Validation:** valid CSV import; duplicate detection; role/church validation; import summary; PO cross-church; SA church-scoped; audit rows; `tsc`/`lint`/`build`.

### Phase 5: Church Provisioning Wizard (MEDIUM — 2–3 days)
**Objective:** Complete onboarding wizard: Create Church → Configure → Create Super Admin → Assign Roles → Ready.
**Files:**
| File | Action |
|------|--------|
| `src/features/churches/components/church-provisioning-wizard.tsx` | CREATE (multi-step, reuses Phase 1 + 2) |
| `src/features/churches/components/church-config-form.tsx` | CREATE |
| `src/features/churches/components/church-admin-creation.tsx` | CREATE |
| `src/features/churches/components/church-provisioning-summary.tsx` | CREATE |
| `src/features/churches/actions/church-provisioning.actions.ts` | EXTEND |
| `src/app/[locale]/(app)/admin/churches/create/page.tsx` | CREATE |
| `src/messages/en.json`, `src/messages/ar.json` | UPDATE |
**RBAC impact:** ✅ `tenants.*` + `servants.create`.
**RLS impact:** ✅ RPC (PO-only).
**Migration:** ✅ None beyond 032.
**Risks:** LOW — wizard state management; atomicity via one RPC (any step failure rolls back).
**Validation:** full wizard flow; atomicity; church appears in list; Super Admin logs in; `tsc`/`lint`/`build`.

---

## Implementation Order

```
Phase 1: Church Management CRUD (3–4 days)
    ↓
Phase 2: Church Super Admin Creation + migration 032 (2–3 days)
    ↓
Phase 3: User Creation UX Fixes (1–2 days) — parallel with Phase 2
    ↓
Phase 4: Bulk User Import (3–4 days) — after Phase 3
    ↓
Phase 5: Church Provisioning Wizard (2–3 days) — depends on Phase 1 + 2
```
**Total:** 11–16 days.
**Parallel tracks:** Track A = P1→P2→P5; Track B = P3→P4 (parallel with Track A).

---

## Migration 032 Summary (single migration, all additive)

1. `create_church_with_super_admin(...)` — SECURITY DEFINER, service_role-only EXECUTE, PO-only guard. Atomic: church + roles + profile + approved servant + super_admin grant + notification + audit.
2. `create_church_super_admin(p_church_id, p_auth_user_id, ...)` — SECURITY DEFINER, PO-only. Add Super Admin to an existing church.
3. `import_users(...)` — SECURITY DEFINER. PO-only (cross-church) or SA-only (church-scoped, checks `import.execute`). Per-row: auth user + profile + approved servant + role grant + audit.
4. **No changes** to any existing table, policy, or function. No RLS/RBAC weakening.

---

## Rollback Plan

- **Phase 1–5 code:** `git revert` per-phase commits.
- **Migration 032:** `DROP FUNCTION` the 3 RPCs (additive; no table/policy changes). Restore pre-sprint backup if needed.

---

## Pre-Implementation Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
```
All must pass before starting Phase 1.

---

**Document Version:** 1.1  
**Last Updated:** 2026-08-04  
**Status:** Ready for Architecture Review — awaiting approval before implementation.