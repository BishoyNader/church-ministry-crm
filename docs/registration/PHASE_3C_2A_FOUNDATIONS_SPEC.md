# Phase 3C.2A Foundations Implementation Specification

**Date:** 2026-08-01
**Parent:** `PHASE_3C_APPLICATION_IMPLEMENTATION_PLAN.md` (approved, verdict `READY_TO_IMPLEMENT`)
**Type:** File-level implementation specification. No code, no file modifications, no patches (planning only).
**Audience:** Implementers executing Phase 3C.2A.

---

## 0. Scope

Phase 3C.2A Foundations covers four workstreams:

1. **Permission System Audit & Re-sync** — align the frontend `PERMISSION_CODES` constants with the DB's final canonical catalog (post-`021`).
2. **Audit Logging Alignment** — remove all writes to the dropped `audit_logs.user_id` column; enforce the 019 schema.
3. **`user_roles` Write Path Audit** — classify every write location; rewrite `assignRoles` to the canonical temporal model.
4. **RPC Integration Stubs** — create typed wrappers for the 8 Phase 3C RPCs plus shared helpers, ready for consumers in 3C.2B–2D.

Sections 1–5 are read-only audits of the current tree (evidence-based, exact paths/symbols). Section 6 is the deliverable matrix. Section 7 is the execution package.

---

## 1. Permission System Audit

### 1.1 Current constants

**File:** `src/features/rbac/constants/permissions.ts`
**Symbols:** `PERMISSION_CODES` (45 codes), `PermissionCode` (union type), `PERMISSION_LIST`.

Current catalog (symbol → code):

```
AUTH_LOGIN "auth.login" · AUTH_MANAGE "auth.manage"
CHURCHES_READ "churches.read" · CHURCHES_UPDATE "churches.update" · CHURCHES_MANAGE "churches.manage"
USERS_READ "users.read" · USERS_CREATE "users.create" · USERS_UPDATE "users.update" · USERS_DELETE "users.delete" · USERS_MANAGE "users.manage"
STAGES_READ/CREATE/UPDATE/DELETE "stages.*"
CHILDREN_READ/CREATE/UPDATE/DELETE/EXPORT "children.*"
ATTENDANCE_READ/CREATE/UPDATE/DELETE/EXPORT "attendance.*"
FOLLOWUPS_READ/CREATE/UPDATE/DELETE "followups.*"
EVENTS_READ/CREATE/UPDATE/DELETE "events.*"
NOTIFICATIONS_READ/CREATE/MANAGE "notifications.*"
REPORTS_READ/EXPORT "reports.*"
DOCUMENTS_READ/CREATE/DELETE "documents.*"
AI_USE "ai.use" · AI_MANAGE "ai.manage"
AUDIT_READ "audit.read" · SETTINGS_READ "settings.read" · SETTINGS_UPDATE "settings.update"
```

### 1.2 Authoritative target catalog (canonical 52)

**Source of truth:** `docs/database/specifications/CANONICAL_PERMISSION_CATALOG.md`, **cross-verified against the post-`021` DB state** in `supabase/migrations/021_role_and_permissions.sql`:

- `021` **deletes**: `users.create`, `users.delete`, `users.manage`, `attendance.update`, `attendance.delete`, `notifications.create`, `churches.manage`, `children.export`, `events.*`(4), `documents.*`(3), `ai.use`, `ai.manage`, `auth.login`, `auth.manage`, `churches.read`, `churches.update` (`021:41–48`, `021:95–103`).
- `021` **renames** `children.*` → `beneficiaries.*` (`021:88–91`).
- `021` **adds**: `beneficiaries.transfer`, `tenants.*`(4), `subscriptions.manage`, `billing.read`, `system.metrics`, `system.audit`, `support.manage`, `services.*`(4), `classes.*`(4), `servants.*`(6), `spiritual.*`(2), `import.execute`, `export.execute` (`021:51–85`).

**Final canonical 52 codes** (target set for the constants rewrite):

| Module | Codes |
|---|---|
| attendance | `attendance.create` `attendance.export` `attendance.read` |
| audit | `audit.read` |
| beneficiaries | `beneficiaries.create` `beneficiaries.delete` `beneficiaries.read` `beneficiaries.transfer` `beneficiaries.update` |
| billing | `billing.read` |
| classes | `classes.create` `classes.delete` `classes.read` `classes.update` |
| export | `export.execute` |
| followups | `followups.create` `followups.delete` `followups.read` `followups.update` |
| import | `import.execute` |
| notifications | `notifications.manage` `notifications.read` |
| reports | `reports.export` `reports.read` |
| servants | `servants.approve` `servants.assign` `servants.create` `servants.delete` `servants.read` `servants.update` |
| services | `services.create` `services.delete` `services.read` `services.update` |
| settings | `settings.read` `settings.update` |
| spiritual | `spiritual.create` `spiritual.read` |
| stages | `stages.create` `stages.delete` `stages.read` `stages.update` |
| system | `subscriptions.manage` `support.manage` `system.audit` `system.metrics` |
| tenants | `tenants.create` `tenants.delete` `tenants.read` `tenants.update` |
| users | `users.read` `users.update` |

### 1.3 Obsolete codes in the constants (deleted from / renamed away from DB in `021`)

| Symbol | Code | DB status (021) | Replacement |
|---|---|---|---|
| `CHILDREN_READ` | `children.read` | renamed → `beneficiaries.read` | `BENEFICIARIES_READ` |
| `CHILDREN_CREATE` | `children.create` | renamed → `beneficiaries.create` | `BENEFICIARIES_CREATE` |
| `CHILDREN_UPDATE` | `children.update` | renamed → `beneficiaries.update` | `BENEFICIARIES_UPDATE` |
| `CHILDREN_DELETE` | `children.delete` | renamed → `beneficiaries.delete` | `BENEFICIARIES_DELETE` |
| `CHILDREN_EXPORT` | `children.export` | deleted | `export.execute` |
| `ATTENDANCE_UPDATE` | `attendance.update` | deleted | — (use `attendance.create`/none) |
| `ATTENDANCE_DELETE` | `attendance.delete` | deleted | — |
| `USERS_CREATE` | `users.create` | deleted | `servants.create` (super_admin-scoped gate, §3.3) |
| `USERS_DELETE` | `users.delete` | deleted | `servants.delete` (super_admin-scoped gate) |
| `USERS_MANAGE` | `users.manage` | deleted | `servants.assign` / `servants.approve` |
| `EVENTS_READ/CREATE/UPDATE/DELETE` | `events.*` | deleted | — |
| `DOCUMENTS_READ/CREATE/DELETE` | `documents.*` | deleted | — |
| `AI_USE` / `AI_MANAGE` | `ai.use` / `ai.manage` | deleted | — |
| `AUTH_LOGIN` / `AUTH_MANAGE` | `auth.login` / `auth.manage` | deleted | — |
| `CHURCHES_READ/UPDATE/MANAGE` | `churches.*` | deleted | `tenants.read` / `tenants.update` / `tenants.create` |
| `NOTIFICATIONS_CREATE` | `notifications.create` | deleted | `notifications.manage` (server-side only) |

### 1.4 Missing codes (canonical, absent from constants)

```
beneficiaries.create/delete/read/transfer/update (5)
billing.read (1)
classes.create/delete/read/update (4)
export.execute (1)
import.execute (1)
servants.approve/assign/create/delete/read/update (6)
services.create/delete/read/update (4)
spiritual.create/read (2)
subscriptions.manage (1)
support.manage (1)
system.audit (1)
system.metrics (1)
tenants.create/delete/read/update (4)
```

### 1.5 Affected actions (obsolete code → permanently denied today)

**`src/features/children/actions/child.actions.ts`** — entire children module gate is dead:

| Line | Symbol | Status |
|---|---|---|
| 130, 168, 766, 801, 836 | `PERMISSION_CODES.CHILDREN_READ` | always deny |
| 209 | `PERMISSION_CODES.CHILDREN_CREATE` | always deny |
| 270, 345 | `PERMISSION_CODES.CHILDREN_UPDATE` | always deny |
| 391 | `PERMISSION_CODES.CHILDREN_DELETE` | always deny |
| 496 | `PERMISSION_CODES.ATTENDANCE_UPDATE` | always deny |
| 443, 492, 541, 584, 636, 682, 729 | `ATTENDANCE_CREATE/READ`, `FOLLOWUPS_*` | valid |

**`src/features/users/actions/user.actions.ts`**:

| Line | Symbol | Action | Status |
|---|---|---|---|
| 190 | `USERS_CREATE` | `createUserAction` | always deny |
| 322 | `USERS_DELETE` | `deactivateUserAction` | always deny |
| 413, 473 | `USERS_MANAGE` | `assignRolesAction`, `assignStagesAction` | always deny |
| 95, 140, 525, 548 | `USERS_READ` | list/get/getRoles/getStages | valid |

**`src/features/stages/actions/stage.actions.ts`**:

| Line | Symbol | Status |
|---|---|---|
| 559 | `PERMISSION_CODES.USERS_MANAGE` (stage-assignment gate) | always deny |
| 103, 138, 325, 518, 611, 179, 366, 227, 418, 279, 472 | `STAGES_*` | valid |

**`src/features/dashboard/actions/dashboard.actions.ts:25`** — `REPORTS_READ` valid; no change.

### 1.6 Affected guards (`PermissionGuard permission="…"` literal strings)

| File | Line | Code | Status |
|---|---|---|---|
| `src/app/[locale]/children/page.tsx` | 22 | `children.read` | **dead** → `beneficiaries.read` |
| `src/app/[locale]/children/[childId]/page.tsx` | 22 | `children.read` | **dead** → `beneficiaries.read` |
| `src/features/children/components/child-detail-page.tsx` | 89, 95 | `children.update`, `children.delete` | dead → `beneficiaries.update/delete` |
| `src/features/children/components/child-list-page.tsx` | 110 | `children.create` | dead → `beneficiaries.create` |
| `src/features/children/components/child-table.tsx` | 90, 100 | `children.update`, `children.delete` | dead → `beneficiaries.update/delete` |
| `src/features/stages/components/stage-row.tsx` | 68 | `users.manage` | dead → `servants.assign` |
| `src/app/[locale]/attendance/page.tsx` | 22 | `attendance.read` | valid |
| `src/app/[locale]/followups/page.tsx` | 22 | `followups.read` | valid |
| `src/app/[locale]/dashboard/page.tsx` | 22 | `reports.read` | valid |
| `src/app/[locale]/stages/page.tsx` | 25 | `stages.read` | valid |
| `src/app/[locale]/users/page.tsx` | 25 | `users.read` | valid |

### 1.7 Affected UI permission checks

| File | Line | Symbol | Status |
|---|---|---|---|
| `src/features/dashboard/components/quick-actions.tsx` | 10 | `CHILDREN_CREATE` | dead → `BENEFICIARIES_CREATE` |
| `src/features/dashboard/components/quick-actions.tsx` | 11–13 | `FOLLOWUPS_CREATE`, `ATTENDANCE_CREATE`, `REPORTS_READ` | valid |
| `src/features/stages/components/ministry-card.tsx` | 74, 84, 94 | `stages.create/update/delete` | valid |
| `src/features/stages/components/stage-row.tsx` | 78, 88 | `stages.update/delete` | valid |
| `src/features/children/components/attendance-page.tsx` | 207 | `attendance.create` | valid |
| `src/features/children/components/followup-list-page.tsx` | 136, 291, 301, 311 | `followups.*` | valid |

**Impact summary:** the children module (pages + all actions) and all role/stage assignment actions are **already non-functional** in the current tree because their gate codes were deleted/renamed by `021`. The re-sync is a functional restoration, not a cosmetic rename.

---

## 2. Audit Logging Audit

### 2.1 Target schema (`supabase/migrations/019_audit_logs_update.sql`)

- `user_id` → renamed to **`actor_id`** (`019:12`); `action` → **TEXT** (`019:18`); `ip_address`/`user_agent` dropped (`019:24–25`); **`entity_id` NOT NULL** (`019:31–32`); `metadata` jsonb added (`019:38`).
- Canonical write helper available: `write_audit_log(p_church_id, p_action, p_entity_type, p_entity_id, p_old_values, p_new_values)` (`019:57–70`) — sets `actor_id = auth.uid()`.

### 2.2 Mismatch register

| File | Function | Current schema mismatch | Required correction |
|---|---|---|---|
| `src/features/auth/services/auth.service.ts` | `signInWithEmail` (:83) | ✅ already fixed in working tree (`actor_id`, `entity_id`) | none — retain |
| `src/features/auth/services/auth.service.ts` | `signOut` (:246) | ✅ already fixed in working tree | none — retain |
| `src/features/children/actions/child.actions.ts` | `auditLog` helper (insert at :65) | inserts `user_id: user.id` — column does not exist (019); `entity_id` present | `user_id` → `actor_id: user.id`; consolidate into `src/lib/audit.ts` |
| `src/features/stages/actions/stage.actions.ts` | `auditLog` helper (insert at :58) | inserts `user_id: user.id` | `user_id` → `actor_id: user.id`; consolidate into `src/lib/audit.ts` |
| `src/features/users/actions/user.actions.ts` | `auditLog` helper (insert at :54) | inserts `user_id: user.id` | `user_id` → `actor_id: user.id`; consolidate into `src/lib/audit.ts` |

### 2.3 Correction design

- **New shared helper** `src/lib/audit.ts` — `auditLog(supabase, { action, entityType, entityId, oldValues, newValues })` mirroring the existing three local helpers but emitting `actor_id`/`entity_id` and resolving `church_id` from the caller profile. Three files delegate to it.
- Preferred write path: call `write_audit_log` RPC via the authenticated client (actor = `auth.uid()` automatically) where a session exists; fall back to direct insert via admin client only where no session actor is meaningful (e.g., pre-approval signup events in 3C.2B).
- All inserts must supply `entity_id` (NOT NULL) — already the case at all four sites.
- No other `user_id:` audit references exist (verified: only the 3 action helpers; `auth.service.ts` already corrected).

---

## 3. User Roles Write Path Audit

All locations touching `user_roles` (`src/`):

| Location | Operation | Classification | Why |
|---|---|---|---|
| `src/features/auth/services/auth.service.ts:185` (`signUpWithEmail`) | INSERT (super_admin self-grant) | **REMOVE** (with `signUpWithEmail`, Phase 3C.2B) | 021 canonical model forbids self-escalation; 023 removed the only signup role-insert path. Signup grants no roles; approval/provisioning RPCs own role grants. |
| `src/features/users/services/user.service.ts:191` (`createUser`) | INSERT via admin (service-role) | **STAY (service-role)** | Service role legitimately bypasses RLS; `createUser` is a deliberate super_admin provisioning action. 023 closes anon/self write paths only — service-role writes remain the canonical privileged path. Re-gate the caller: `createUserAction` (`user.actions.ts:190`) is dead (`USERS_CREATE`) → super_admin-scoped (`servants.create` + explicit super_admin check). |
| `src/features/users/services/user.service.ts:282` (`assignRoles`) | DELETE + INSERT via anon client | **REWRITE** (reactivation-first + service-role) | (a) post-023 `user_roles.tenant_isolation` is SELECT-only → anon DELETE/INSERT denied for non-super-admins (only `super_admin_all` permits same-church super_admin writes); (b) `.delete()` violates canonical temporal model (A3) — must set `end_date` and **reactivate archived grants** (safe only with partial unique index `uq_user_roles_active`, `023` S8); (c) caller gate `USERS_MANAGE` is obsolete (`user.actions.ts:413`). |
| `src/features/users/actions/user.actions.ts:347` (`deactivateUserAction` super-admin count) | SELECT | **Remains valid** | Read-only; unaffected by 023 policy change. |
| `src/features/rbac/services/rbac.service.ts:31, 203` | SELECT | **Remains valid** | Read-only RBAC resolution; 023 preserves SELECT paths (`tenant_isolation`, `own_read`, `admin_read`, `super_admin_all`). |
| `src/features/users/services/user.service.ts:55, 113` | SELECT (role listing) | **Remains valid** | Read-only. |

**Rewrite contract for `assignRoles`:**
1. Read current grants `WHERE user_id = ? AND church_id = ?`.
2. For each dropped role: `UPDATE user_roles SET end_date = CURRENT_DATE WHERE user_id AND role_id AND end_date IS NULL`.
3. For each added role: if an archived grant exists (`end_date IS NOT NULL`) → **reactivate** (`end_date = NULL`); else INSERT `{church_id, user_id, role_id, assigned_by, start_date}`.
4. Execute via **admin client** (service role) so the operation is not subject to the SELECT-only tenant policy.
5. Gate: super_admin only (canonical — admins cannot grant roles).

---

## 4. Authentication Flow Audit

### 4.1 Current flow (to be replaced)

```
signup (public /signup)
  signup-form (free-text churchNameAr/En)  ──► signupAction  ──► signUpWithEmail
    └─ auth user create (anon signUp | admin.createUser)
    └─ churches INSERT {name_ar, name_en, slug}          ← free-text church creation
    └─ profiles INSERT {id, church_id, email, names}     ← profile creation
    └─ seed_church_roles(church_id)                      ← role bootstrapping
    └─ roles SELECT super_admin → user_roles INSERT      ← self-assigned super_admin
    └─ redirect /login?signup=success

login
  signInWithEmail → profile is_active check → last_login_at → audit(login)
  loginAction → redirect /dashboard (always)

church creation   → only via signup (above); no PO approval
role assignment   → assignRoles (DELETE+INSERT, anon, dead USERS_MANAGE gate)
profile creation  → only via signup; super_admin row self-authorized
```

### 4.2 Required Phase 3C flow (target; implemented in 3C.2B, foundational pieces in 3C.2A)

```
signup (existing church, public /signup)
  signup-form (church dropdown ← list_churches_for_signup)  ──► signupAction ──► registerExistingChurchUser
    └─ email dedupe (getProfileByEmail)
    └─ churches lookup (is_active, deleted_at IS NULL)        ← no INSERT
    └─ auth user create (admin)
    └─ profiles INSERT {id, church_id, email, names, phone}   ← profile creation
    └─ servants INSERT {id, church_id, approval_status='pending'}   ← NO user_roles
    └─ send_notification → every active super_admin ('approval_required')
    └─ audit (create / registration_request)
    └─ redirect /login?signup=pending | /pending-approval

church request (public /church-request)
  submit_church_request RPC → church_requests pending row → audit

approval (super_admin): approve_servant/reject_servant RPCs
  → servant status flip + servant role grant (reactivation-first) + notification + audit
provisioning (platform_owner): approve_church_request RPC (atomic)
  → church + profile + servant(approved) + super_admin role + notification + audit

login
  signInWithEmail → profile checks → access-state aware redirect
  pending/rejected/zero-role → /pending-approval ; approved → /dashboard

role assignment   → assignRoles rewritten (end-date archival, reactivation, service-role, super_admin gate)
profile creation  → signup (pending servant) or PO provisioning (approved super_admin)
```

### 4.3 What 3C.2A owns vs defers

| Concern | 3C.2A | 3C.2B+ |
|---|---|---|
| `assignRoles` temporal rewrite, service-role, gates | ✅ §3.3 | — |
| Permission gates unblocked (children, users, stages) | ✅ §1 | — |
| Audit inserts corrected | ✅ §2 | — |
| RPC wrappers stubbed | ✅ §5 | consumed |
| `registerExistingChurchUser`, dropdown, `/church-request`, servant-at-signup | — | ✅ |

---

## 5. RPC Integration Plan

Wrappers are created in 3C.2A as typed service functions (no UI consumers yet); consumers land in 3C.2B–2D.

| RPC (023) | Caller client | Planned wrapper location (new files unless noted) | Frontend consumers |
|---|---|---|---|
| `list_churches_for_signup()` | anon / authenticated | `src/features/churches/services/churches.service.ts` → `listChurchesForSignup()` | signup church dropdown (3C.2B) |
| `submit_church_request(...)` | anon / authenticated | `src/features/churches/services/church-request.service.ts` → `submitChurchRequest(input)` | `/church-request` form via `submitChurchRequestAction` (3C.2B) |
| `get_my_access_state()` | authenticated | `src/features/auth/services/access.service.ts` → `getMyAccessState()` | `src/proxy.ts`, `src/lib/supabase/middleware.ts`, `/pending-approval`, `loginAction`, `PendingGate` (3C.2C) |
| `approve_servant(uuid)` | authenticated | `src/features/users/services/approval.service.ts` → `approveServant(servantId)` | users "Pending registrations" queue via `approveServantAction` (3C.2D) |
| `reject_servant(uuid, text?)` | authenticated | same file → `rejectServant(servantId, reason?)` | users queue via `rejectServantAction` (3C.2D) |
| `approve_church_request(uuid, uuid, text)` | authenticated | `src/features/churches/services/provisioning.service.ts` → `approveChurchRequest(requestId, authUserId, slug)` | `/admin/church-requests` via `approveChurchRequestAction` (3C.2D) |
| `reject_church_request(uuid, text?)` | authenticated | same file → `rejectChurchRequest(requestId, reason?)` | `/admin/church-requests` via `rejectChurchRequestAction` (3C.2D) |
| `send_notification(...)` | **server only** (admin/service-role) | `src/features/notifications/services/notification.service.ts` → `sendNotification(payload)` | `registerExistingChurchUser` (3C.2B); no direct client consumers |

**Typing:** hand-typed `Database` overrides for the 8 RPC signatures in `src/types/` (or a `src/types/registration.ts` module) until `database.types.ts` is regenerated against the post-023 staging schema (3C.2A.4 validation).

---

## 6. Deliverables Matrix

| # | File | Change type | Priority |
|---|---|---|---|
| D1 | `src/features/rbac/constants/permissions.ts` | REWRITE — canonical 52 codes, rename `CHILDREN_*`→`BENEFICIARIES_*`, add `SERVANTS_*`, `TENANTS_*`, `CLASSES_*`, `SERVICES_*`, `BENEFICIARIES_*`, `SPIRITUAL_*`, `BILLING_READ`, `SUBSCRIPTIONS_MANAGE`, `SUPPORT_MANAGE`, `SYSTEM_AUDIT`, `SYSTEM_METRICS`, `IMPORT_EXECUTE`, `EXPORT_EXECUTE`; drop obsolete symbols | P0 |
| D2 | `src/features/children/actions/child.actions.ts` | FIX — audit `user_id`→`actor_id`; re-sync permission symbols (`CHILDREN_*`→`BENEFICIARIES_*`, drop `ATTENDANCE_UPDATE`) | P0 |
| D3 | `src/features/stages/actions/stage.actions.ts` | FIX — audit `user_id`→`actor_id`; re-sync `USERS_MANAGE` (stage-assignment gate) | P0 |
| D4 | `src/features/users/actions/user.actions.ts` | FIX — audit `user_id`→`actor_id`; re-sync `USERS_CREATE/DELETE/MANAGE` gates (§3.3 / §1.5) | P0 |
| D5 | `src/lib/audit.ts` | NEW — shared audit helper (`actor_id`, `entity_id`, `write_audit_log` path) | P0 |
| D6 | `src/features/users/services/user.service.ts` | REWRITE — `assignRoles` reactivation-first + admin client | P0 |
| D7 | `src/app/[locale]/children/page.tsx`, `[childId]/page.tsx` | UPDATE — guard codes → `beneficiaries.read` | P0 |
| D8 | `src/features/children/components/child-detail-page.tsx`, `child-list-page.tsx`, `child-table.tsx` | UPDATE — guard codes → `beneficiaries.*` | P0 |
| D9 | `src/features/stages/components/stage-row.tsx` | UPDATE — `users.manage` → `servants.assign` (line 68) | P0 |
| D10 | `src/features/dashboard/components/quick-actions.tsx` | UPDATE — `CHILDREN_CREATE` → `BENEFICIARIES_CREATE` (line 10) | P1 |
| D11 | `src/features/churches/services/churches.service.ts` | NEW — `listChurchesForSignup` wrapper | P1 |
| D12 | `src/features/churches/services/church-request.service.ts` | NEW — `submitChurchRequest` wrapper | P1 |
| D13 | `src/features/churches/services/provisioning.service.ts` | NEW — `approveChurchRequest` / `rejectChurchRequest` wrappers | P1 |
| D14 | `src/features/users/services/approval.service.ts` | NEW — `approveServant` / `rejectServant` / `listPendingServants` | P1 |
| D15 | `src/features/notifications/services/notification.service.ts` | NEW — `sendNotification` (admin), `listMyNotifications`, `unreadCount`, `markRead` | P1 |
| D16 | `src/features/auth/services/access.service.ts` | NEW — `getMyAccessState` wrapper | P1 |
| D17 | `src/lib/utils/slug.ts` | NEW — relocate `generateSlug` from `auth.service.ts` (shared util) | P2 |
| D18 | `src/features/auth/services/auth.service.ts` | UPDATE — `getProfileByEmail` helper (pre-signup dedupe); remove `signUpWithEmail` in 3C.2B | P2 |
| D19 | `src/types/registration.ts` (new) | NEW — typed RPC response overrides for the 8 functions | P1 |
| D20 | `src/types/database.types.ts` | UPDATE — regenerate after 023 applies to staging (3C.2A.4 validation) | P1 |
| D21 | `src/features/rbac/services/rbac.service.ts` | VERIFY — no change expected; confirm empty permission resolution for zero-role users | P2 |

---

## 7. Execution Package

### Phase 3C.2A.1 — Permission system re-sync

**Scope:** rewrite `PERMISSION_CODES` to the canonical 52; update `PermissionCode` union; fix every call site using obsolete codes (actions, guards, quick-actions); restore functional gating for children/users/stages modules.
**Affected files:** D1, D2 (gates), D3 (gates), D4 (gates), D7, D8, D9, D10.
**Dependencies:** none (self-contained; do first).
**Validation criteria**
- `grep -rn "USERS_MANAGE\|USERS_CREATE\|USERS_DELETE\|CHILDREN_\|churches\.\|children\.\|events\.\|documents\.\|ai\.\|auth\.login\|auth\.manage\|attendance\.update\|attendance\.delete\|notifications\.create" src/` returns **zero** matches.
- `npm run typecheck` passes (all literal `PermissionGuard` strings satisfy `PermissionCode`).
- Children module actions and guards no longer always-deny; `createUserAction`/`deactivateUserAction`/`assignRolesAction`/`assignStagesAction` gate on valid, role-granted codes (behavior verified with a super_admin session against staging).

### Phase 3C.2A.2 — Audit logging alignment

**Scope:** introduce `src/lib/audit.ts`; convert the three action helpers to `actor_id`/`entity_id`; route through `write_audit_log` where a session exists.
**Affected files:** D5, D2, D3, D4.
**Dependencies:** 3C.2A.1 (shared-file churn); 019 already applied on staging.
**Validation criteria**
- `grep -rn "user_id:" src/` yields zero audit-related matches.
- Trigger create/update/deactivate/login actions on staging → rows appear in `audit_logs` with `actor_id` populated, `entity_id` non-null, no errors logged.

### Phase 3C.2A.3 — `user_roles` write path

**Scope:** rewrite `assignRoles` to reactivation-first, admin-client, super_admin-gated; re-gate `createUserAction`; leave signup removal to 3C.2B.
**Affected files:** D6, D4, D1 (if new gate symbols needed).
**Dependencies:** 3C.2A.1; migration 023 applied to staging (partial unique index `uq_user_roles_active`, S8).
**Validation criteria**
- No `DELETE` remains on `user_roles` in `src/`.
- Re-assign: previous grant gets `end_date = CURRENT_DATE`; re-grant of a previously-archived role reactivates (`end_date = NULL`) with no duplicate active row.
- `assignRolesAction` succeeds for a super_admin and is denied for an admin (canonical).
- `createUserAction` succeeds under the new gate.

### Phase 3C.2A.4 — RPC wrappers, shared helpers, types

**Scope:** create the 6 wrapper services (D11–D16), shared slug util (D17), `getProfileByEmail` (D18), typed RPC overrides (D19); regenerate `database.types.ts` post-023 (D20).
**Affected files:** D11–D19, D20.
**Dependencies:** 3C.2A.1–.3; migration 023 on staging (RPCs present).
**Validation criteria**
- Anon client can call `list_churches_for_signup()`; authenticated can call `get_my_access_state()`; approve/reject wrappers surface RPC exceptions (`not_super_admin`, `self_approval_not_allowed`, `request_already_pending`, etc.) as typed errors.
- `sendNotification` is importable only from server contexts (no client import path).
- `database.types.ts` includes `church_requests`, `church_requests_status`, and the 8 RPC signatures.
- `npm run lint` + `npm run typecheck` clean across the tree.

---

## 8. Final Verdict

# `READY_TO_CODE`

- All four workstreams are **file-scoped corrections/additions within the existing architecture** (server actions → services → RPC; anon/admin client split). No new framework, no restructuring, no schema work beyond consuming `023`.
- Every deliverable has an exact file path, change type, priority, dependency, and validation criterion (Sections 6–7).
- Two design decisions are resolved here and need no further architecture input:
  1. **createUser/deactivateUser gating** → super_admin-scoped (`servants.create` / `servants.delete` + explicit super_admin check), per canonical role model (admins cannot grant roles; `021` admin grants exclude role-grant codes).
  2. **assignRoles** → admin-client, reactivation-first (valid under `uq_user_roles_active`, `023` S8).

**Recheck triggers (halt code before proceeding if unmet):** migration `023` not yet on staging, or `database.types.ts` regen (D20) blocked — 3C.2A.3/3C.2A.4 validation depends on them.
