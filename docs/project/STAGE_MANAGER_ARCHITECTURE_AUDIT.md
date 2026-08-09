# Stage Manager — Architecture Audit

**Project:** Church Ministry CRM
**Branch audited:** `feature/role-hierarchy-stage-manager`
**Audit date:** 2026-08-07
**Status:** Pre-implementation audit (no code changed)

---

## 1. Executive Summary

The new **Stage Manager** role (`stage_manager` / أمين مرحلة) is intended to operate
**only inside assigned stage(s)** — manage servants within those stages, view stage
reports, manage attendance and follow-ups — while never managing the whole church.

The audit found that **the database role/permission foundation is 80% ready**:

- Migration `036_role_matrix_stage_manager.sql` already adds the enum value, a
  corrected `seed_church_roles()` (with the Stage Manager permission set), and an
  idempotent backfill for existing churches.
- Migration `037_dashboard_trends_rpc.sql` already enforces stage scope server-side
  for dashboard aggregation.
- The stage-scoping primitive `get_user_stage_ids()` already exists and is wired into
  the RLS write policies for `attendance_sessions`.

However, **read-level stage scoping is NOT enforced** for the data a Stage Manager
handles, and **the app layer is not stage-aware** in most features. Today a
`stage_manager` would see (read) the entire church's beneficiaries, follow-ups,
attendance records, servants, stages, services and classes, and only be constrained
on *writes* in a few places. The navigation and several management pages would also
show controls the role cannot use.

The audit also found one **factually incorrect security assumption** in migration 036
(a reference to a function that no longer exists) and a **role-scoping quirk in
`get_user_stage_ids()`** that also affects `admin`.

---

## 2. Current Role Model

### 2.1 Roles (from the `user_role_type` enum)

| role_type | Scope | Notes |
|---|---|---|
| `platform_owner` | global (`church_id = NULL`) | PO bundle: `tenants.*`, `system.*`, `billing.*`, `users.read`, `reports.*`, `audit.read`, `notifications.read`. No church-data permissions by design (`docs/security/PERMISSION_MATRIX.md` note 1). |
| `super_admin` | whole church | All non-platform permissions (`module NOT IN ('tenants','system')`). Also the "church manager". |
| `admin` | whole church | Ministry operations. **036 fixes a long-standing inversion** where admin lacked `attendance.create`, follow-up CRUD, `notifications.read`, `settings.*`, `services.update/delete`, `classes.delete`, `servants.create`. |
| `servant` | stage-scoped by assignments | Cannot create beneficiaries; can update them. |
| `stage_manager` | **stage-scoped by assignments** | New — added by 036 (role + permissions), not yet fully enforced in app/RLS reads. |

Roles are **per-church** rows in `roles` (`is_system = true` for the built-ins),
granted to users through `user_roles` (with `start_date`/`end_date`, see 020/028).
`platform_owner` is a global grant (`church_id = NULL`), constrained by
`chk_roles_platform_owner_global` (028).

### 2.2 How the frontend learns roles

- `src/features/rbac/services/rbac-queries.ts:33-105` — `loadCurrentUserRbac` reads
  `user_roles` (`.is("end_date", null)`), then `roles`, `role_permissions`,
  `permissions` through the RLS-bound session client.
- `src/features/rbac/hooks/useAccessState.ts:23-41` — one React Query per tree.
- Server actions gate via `checkUserPermission` / `hasPermission`
  (`src/features/rbac/services/rbac.server.ts:16-58`,
  `src/features/rbac/utils/permission-check.ts`).

There is no dedicated server helper that answers *"which stages does the current user
manage as a stage_manager"* — the closest is the DB function `get_user_stage_ids()`
(022:93-114), which is role-agnostic (see §4.4).

---

## 3. Permission Model

### 3.1 Permission catalog

Seeded in `003_seed_permissions.sql` + `021_role_and_permissions.sql`. Canonical codes
used by the frontend are enumerated in `src/features/rbac/constants/permissions.ts`
(51 codes). Full role→permission matrix lives in `docs/security/PERMISSION_MATRIX.md`
(already updated for `stage_manager`).

### 3.2 Stage Manager permission set (as drafted in 036:77-87)

Granted: `beneficiaries.read/create/update`, `attendance.read/create/export`,
`followups.read/create/update/delete`, `services.read`, `stages.read`,
`classes.read`, `servants.read`, `notifications.read`, `reports.read`.

Not granted: `stages.create/update/delete`, `servants.create/update/delete/assign`,
`services.update/delete`, `classes.update/delete`, `beneficiaries.transfer/delete`,
`reports.export`, `users.*`, `settings.*`, `import/export.execute`, `audit.read`.

**Assessment:** the set matches the requirement ("manage only assigned stages") and
keeps `stage_manager` strictly below `admin`. Deliberate decisions to confirm with the
product owner before implementation:

1. `attendance.export` and `beneficiaries.update` **are** granted, but `reports.export`
   is not. Confirm whether "view stage reports" implies export of those reports.
2. `beneficiaries.update` is granted; `beneficiaries.transfer` is not — a Stage Manager
   can edit a beneficiary but cannot move them between stages. Acceptable; flagging.
3. `servants.read` but not `servants.assign` — "manage servants inside stage" means
   *coordinate*, not *assign*; confirm the intended operation (e.g. view/contact
   servants of the stage, record their attendance).

### 3.3 Enforcement layering (current)

| Layer | Mechanism | Covers Stage Manager today? |
|---|---|---|
| RLS writes | `user_has_permission_in_church()` (027 T1) + stage scope | Partial — see §4.3 |
| RLS reads | `tenant_isolation` (church-wide SELECT) | **No stage scope** |
| Server actions | `hasPermission()` per action | Permission-level only, not stage-level |
| SECURITY DEFINER RPCs | `get_dashboard_trends` (037) | **Yes** (only RPC with stage scope) |
| UI | `PermissionGuard`, sidebar `permission` gates | Permission-level only |

---

## 4. RLS & Stage-Scoping Analysis

### 4.1 The stage-scope primitive

`get_user_stage_ids()` — `022_rls_implementation.sql:93-114`:

- super_admin → all non-deleted stages of the church;
- everyone else → distinct `stage_id` from `servant_stage_assignments`
  (`servant_id = auth.uid() AND is_active AND end_date IS NULL`).

`get_user_class_ids()` (022:116-137) mirrors this for classes. `get_user_service_ids()`
(022:71-91) likewise.

**This is the function a `stage_manager`'s scope flows through.** It already returns
non-empty values for a stage_manager *as long as the user has active
`servant_stage_assignments` rows* — which `create_church_user` (034) can create via its
`p_stage_ids` parameter. No schema change is needed to give a Stage Manager a scope.

### 4.2 Where stage scope IS enforced (write paths)

- `attendance_sessions` — `stage_scope_write` / `stage_scope_update`
  (`027_rbac_rls_hardening.sql:205-216`): INSERT/UPDATE require
  `stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids())`.
  A stage_manager can therefore create/update sessions **only in assigned stages.**
- `get_dashboard_trends` (037): non-admins are intersected to their assigned stages
  for every bucket (attendance trends, by-stage, children-per-stage,
  follow-up counts via `beneficiary_assignments`).

### 4.3 Where stage scope is NOT enforced (read surfaces)

All reads are church-wide (`tenant_isolation` SELECT on every tenant table):

- `beneficiaries` (027:136-138) — SELECT church-wide; UPDATE gated by permission only.
- `beneficiary_assignments` (027:161-163) — SELECT church-wide.
- `attendance_records` (027:226-238) — SELECT church-wide; INSERT/UPDATE only require
  `recorded_by = auth.uid()` (no beneficiary-must-be-in-my-stage check).
- `followups` (027:246-257) — SELECT church-wide; `followups_write` gated by
  `followups.create/update/delete` permission only. **No `stage_id` column exists on
  `followups`** (dropped 016:30), so follow-up scope must be derived through
  `beneficiary_assignments` (exactly what 037 does).
- `stages`, `services`, `classes` (027:98-127) — SELECT church-wide (read-only for a
  stage_manager anyway, but the whole list is visible).
- `servants` — `own_read`/church scope; a stage_manager sees all church servants.

**Consequence:** a stage_manager holding `reports.read` and `attendance.read` can read
**every** beneficiary, follow-up and attendance record in the church through the
existing server actions (which query by `church_id` only). Tenant isolation to *other
churches* is intact — this is an intra-church, stage-level over-exposure.

### 4.4 ⚠️ Critical finding — `user_has_stage_access()` does not exist

Migration `036` (lines 16-18) states:

> "Stage access remains bound by servant_stage_assignments rows via the existing
> user_has_stage_access() policies — a stage_manager without stage assignments has no
> stage scope."

**This is incorrect.** `user_has_stage_access(uuid)` was dropped in
`021_role_and_permissions.sql:18` (`DROP FUNCTION IF EXISTS user_has_stage_access(uuid)
CASCADE`) and **never recreated**. Its original definition (001:652-662) referenced the
now-removed `user_stage_assignments` table and the renamed `church_admin` role type —
so it could not have been restored as-is anyway. No policy in the live schema uses it
(the 002/005 usages were superseded by 022/027).

**Impact:** the 036 migration is functionally correct *despite* the comment — the real
enforcement comes from `get_user_stage_ids()` — but the documentation is wrong. This
must be corrected in the migration header before merge, and the Stage Manager
implementation must rely on `get_user_stage_ids()`, not `user_has_stage_access()`.

### 4.5 ⚠️ Role-scoping quirk — `get_user_stage_ids()` affects `admin` too

`get_user_stage_ids()` only grants full church scope to **super_admin**. An `admin`
with no `servant_stage_assignments` rows gets an **empty** array, which means:

- `attendance_sessions` write policies (`stage_scope_write/update`) reject an admin's
  upserts unless the admin is also stage-assigned.
- `get_dashboard_trends` scopes an admin to their assignments as well (037:43 —
  `user_is_admin(v_church_id)` returns true for admin, so the admin branch is actually
  "full church"; the RPC treats `admin` as full scope while the RLS write policies do
  not — an **inconsistency**).

This is pre-existing, but any Stage Manager work must decide the canonical rule:
*stage scope = `servant_stage_assignments` for everyone below super_admin*, or
*admins are church-wide*. Documented here so the implementation does not compound it.

### 4.6 Data-model notes relevant to stage scoping

1. **Stage assignment is also the "who is a servant of a stage" record.** A
   `stage_manager`'s own scope rows live in the same `servant_stage_assignments` table
   that defines who the servants of a stage are. Clean, but means "servants inside my
   stage" = same-table query filtered by `stage_id`.
2. **`servants.id = profiles.id`** (auth user id). `create_church_user` (034) always
   creates an approved `servants` row, so a provisioned stage_manager can sign in and
   is eligible for assignments.
3. **`followups` has no `stage_id`.** Stage-manager follow-up views/reports must join
   `followups.beneficiary_id → beneficiary_assignments(beneficiary_id, stage_id)`
   (current assignment). Re-adding a denormalized `stage_id` is possible but needs a
   sync trigger; prefer the join for now (037 already proves the pattern).
4. **Attendance upsert conflict-target mismatch (pre-existing):** app upserts use
   `onConflict: "church_id,service_id,stage_id,session_date"`
   (`src/features/children/services/child.service.ts:341,404`) but the DB constraint is
   `UNIQUE (stage_id, session_date)` (`015_attendance_restructure.sql:22`). Not Stage
   Manager-specific, but it will surface when stage-scoped attendance flows are added.
5. **`classes` are children of `stages`** (008); `get_user_class_ids()` gives Stage
   Managers class scope automatically via assignments.

---

## 5. Server Actions / Services Audit (stage-awareness)

| Feature | Server action (gate) | Service scope today | Stage-aware? |
|---|---|---|---|
| Dashboard KPIs | `dashboard` service → `getDashboardData` (`dashboard.service.ts:337`) | church-wide `head` counts + lists (`nextFollowupsDue`, `recentChildren` limit 20/5) | **No** (KPIs and lists leak church-wide numbers; only the RPC trends are scoped). |
| Dashboard trends | `get_dashboard_trends` RPC (037) | stage-scoped for non-admins | **Yes** |
| Reports | `getReportsDataAction` (`reports.actions.ts:36`, `REPORTS_READ`) | `getReportsData` (`reports.service.ts:90`) church-wide; optional `filters.stageId` is only an optional filter, not enforced | **No** |
| Report filters | `getReportsFilterOptionsAction` (`reports.actions.ts:9`) | lists all services/stages/profiles of church | **No** |
| Report export | `exportReportsCsvAction` (`reports.actions.ts:63`, `REPORTS_EXPORT`) | same church-wide data | **No** (and SM lacks the permission) |
| Children list | `children` service (`child.service.ts:27-64`) | church-wide; optional `filters.stage_id` | No (optional filter only) |
| Attendance upsert | `children` service (`child.service.ts:337-341,400-404`) | church-wide query, `recorded_by = auth.uid()` | Partial (RLS stage scope on sessions) |
| Follow-ups | `child.service.ts:590-642` | church-wide; resolves stage via `beneficiary_assignments[0]` for display | No |
| Servants | `listServantsAction` (`servant.actions.ts:108`, `SERVANTS_READ`) | church-wide | No |
| Stages | `listStagesAction` (`stage.actions.ts`, `STAGES_READ`) | `listStages` (`stage.service.ts:271`) church-wide | No |
| Services/Classes | `services.actions.ts:47`, `classes.actions.ts:61` | church-wide | No |

**Server-action gates are permission-only** (`hasPermission(...)`); none resolve the
actor's stage set. Even after 036, a stage_manager can call any action whose permission
the role holds and pass an arbitrary `stageId`/`churchId` filter — RLS is the only thing
that stops cross-stage *writes* to `attendance_sessions`, and nothing stops cross-stage
*reads*.

---

## 6. Navigation & UI Audit

### 6.1 Sidebar (`src/components/layout/app-shell.tsx:19-38`)

Items are permission-gated. With the 036 permission set, a `stage_manager` would see:

- ✅ dashboard, reports, children, attendance, follow-ups, servants, notifications,
  stages, services, classes
- ❌ approvals (`servants.approve`), import/export (`import.execute`),
  churches (`tenants.read`), users (`users.read`), audit (`audit.read`),
  settings (`settings.read`)

`dashboard` is gated on `reports.read`; the dashboard page already shows a scope notice
for servant/stage_manager (`dashboard-page.tsx:33-38`).

### 6.2 Page-level exposure without stage context

Several routes are *permission-gated only* and would render their full management UI
for a stage_manager (actions would then fail at the permission gate):

- `/stages` (`stage-management-page.tsx`) — ministry/stage CRUD, stage-user assignment
  dialogs, delete dialogs. A stage_manager sees all of it read-only.
- `/services`, `/classes` — CRUD pages.
- `/attendance`, `/children`, `/followups`, `/reports` — church-wide lists/tables with
  create/edit controls the role partially holds.

There is **no stage filter** in the app shell, the children list, the servants list, or
the reports page that would scope a stage_manager to their assigned stages. The reports
page does have a `stageId` filter control, but it is user-selectable, not role-scoped.

### 6.3 Already done (working tree, uncommitted)

- `user-list-page.tsx:42-45` — role filter already includes `stage_manager`.
- `dashboard-page.tsx:33-38` — scope notice for stage_manager.
- i18n already contains `users.roleFilter.stageManager` (en/ar).

### 6.4 User management integration points

- `create_church_user` (034) accepts `p_role_ids` + `p_stage_ids` → a super_admin or PO
  can already provision a Stage Manager **with** their assigned stages.
- `UserForm` (`user-form.tsx:186-300`) lets the assigner pick roles and stages.
- `change_church_manager` / `deactivate_church_user` (035) are orthogonal.

---

## 7. Reports Impact

- The reports module (`src/features/reports`) computes everything **client-side from
  church-wide selects** (`reports.service.ts:90-331`). For a stage_manager this returns
  the entire church's attendance rate, stage comparison, servant/beneficiary tables.
- Options: (a) filter the existing query by the actor's stage set server-side, or
  (b) add a stage-scoped SECURITY DEFINER RPC `get_stage_reports(...)` mirroring the
  037 pattern (recommended — keeps enforcement in the DB, avoids trusting a
  client-supplied `stageId`).
- The dashboard trend RPC (037) is the template: `v_scope` computed from
  `servant_stage_assignments`, defensive intersection with caller input, REVOKE/GRANT
  lockdown, `auth.uid()` guards.

---

## 8. Findings Summary

| # | Severity | Finding |
|---|---|---|
| F1 | **High (doc)** | `036` references `user_has_stage_access()` which was dropped in 021 and never recreated. Fix the comment; rely on `get_user_stage_ids()`. |
| F2 | **High** | No DB-level **read** stage scope: beneficiaries, follow-ups, attendance_records, servants, stages/services/classes are church-wide SELECTs. Stage Manager can read all church data. |
| F3 | **High** | No server-action stage resolution: every action is permission-gated only; client-supplied `stageId`/`churchId` filters are never validated against the actor's scope. |
| F4 | **Medium** | Reports module is church-wide and client-aggregated; no stage-scoped RPC. |
| F5 | **Medium** | Dashboard `getDashboardData` KPIs + recent lists are church-wide while the RPC trends are stage-scoped → inconsistent numbers for stage_manager. |
| F6 | **Medium** | `followups` lost `stage_id` (016); stage scoping must join `beneficiary_assignments` (037 pattern) or re-add the column. |
| F7 | **Medium** | `get_user_stage_ids()` does not give `admin` full church scope (only super_admin) → admin attendance writes depend on assignments; inconsistent with 037's `user_is_admin` branch. |
| F8 | **Low** | Navigation shows management pages (stages/services/classes) read-only to stage_manager; needs role-aware action gating in-page. |
| F9 | **Low** | `attendance_records` INSERT/UPDATE has no "beneficiary belongs to the stage" check; a stage_manager could record attendance for out-of-stage beneficiaries in an in-scope session. |
| F10 | **Low (pre-existing)** | attendance_sessions upsert `onConflict` target mismatch (app vs 015 constraint). |
| F11 | **Info** | 036/037 + dashboard/user-list stage_manager touches already exist **uncommitted** in the working tree; review before implementing on top. |

---

## 9. Security Posture Assessment

- **Tenant (church) isolation:** intact. No change proposed touches `church_id`
  boundaries.
- **Privilege escalation risk:** low. `stage_manager` is strictly below `admin`; no
  self-assignment path exists (`assignRolesAction` and `create_church_user` are gated by
  super_admin/PO).
- **Primary risk to close:** intra-church over-read by stage_manager (F2/F3) and the
  client-supplied-filter trust gap (F3). Both must be fixed in the implementation plan.
- **Attack surface added by 036/037:** none new beyond the role itself; 037 scopes
  itself and 036 is data-only.

---

## 10. Navigation Impact (final)

| Nav item | Stage Manager visibility (post-036) | Required change |
|---|---|---|
| dashboard | visible | already scoped notice; scope KPIs (F5) |
| reports | visible | stage-scope server-side (F4) |
| children | visible | add stage filter, server-enforced (F3) |
| attendance | visible | restrict stage selector to assigned (F3) |
| follow-ups | visible | scope by beneficiary→stage (F6) |
| servants | visible | filter to stage |
| stages | visible | render read-only, assigned-only |
| services / classes | visible | read-only (info-only) |
| notifications | visible | OK |
| approvals / import-export / churches / users / audit / settings | hidden | OK |

**No new top-level route is required.** All Stage Manager needs can be delivered by
scoping existing routes + a stage filter control.

---

*See `STAGE_MANAGER_IMPLEMENTATION_PLAN.md` for the remediation plan and rollback.*
