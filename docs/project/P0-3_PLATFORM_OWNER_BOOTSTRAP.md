# P0-3 — Platform Owner Bootstrap (F3): Architecture Report

Status: **Analysis complete — no code written yet.**
Scope guard: P0-3 must NOT modify RBAC/RLS beyond PO bootstrap; must not start P0-4.

---

## 1. Root-Cause Analysis: Why a Platform Owner Cannot Exist Today

The schema and RLS were **designed** for a church-less global Platform Owner (PO), but four
`NOT NULL` constraints, a seed function that never creates the role, and zero provisioning
path make the PO structurally impossible.

### 1.1 The design already anticipates the PO (evidence)

| Evidence | Location |
|---|---|
| `role_type` enum includes `platform_owner` | `021_role_and_permissions.sql:22` |
| `user_is_platform_owner()` is **deliberately church-agnostic** (no church filter) | `022_rls_implementation.sql:25-31` |
| `platform_owner_all ON churches` | `022_rls_implementation.sql:195` |
| `platform_owner_read ON audit_logs` | `022_rls_implementation.sql:346` |
| `platform_owner_write ON permissions` | `022_rls_implementation.sql:358` |
| `platform_owner_all ON church_requests` | `023_phase3c_registration.sql:75-76` |
| `notifications.church_id` made **nullable** citing "platform-owner recipients have church_id = NULL" | `023_phase3c_registration.sql:102,108` |
| `approve_church_request` / `reject_church_request` guard on `user_is_platform_owner()` | `023:666-667, 802-803` (recreated in `025:146-147`) |
| `servants` migration explicitly **excludes the platform owner (church_id IS NULL)** from data migration | `011_servants_table.sql:5,35,41` |
| Permission catalog contains `tenants.create/read/update/delete` (+ `system.*`, `billing.read`, `subscriptions.manage`, `support.manage`) added as "9 platform_owner codes" | `021_role_and_permissions.sql:51-57` |

### 1.2 The blockers (verified in SQL)

1. **`roles.church_id` NOT NULL** (`001:244`) + `UNIQUE (church_id, role_type)` (`001:252`)
   → a global (church-less) role row cannot exist.
2. **`user_roles.church_id` NOT NULL** (`001:273`) → a PO grant cannot exist.
3. **`profiles.church_id` NOT NULL** (`001:219`) → the PO has no valid profile.
4. **`servants.church_id` NOT NULL** (`011:14`) → the PO cannot have the *approved servant row*
   that `get_my_access_state()` requires to let the user through the middleware gate.
5. **`seed_church_roles()` never creates `platform_owner`** and always binds to `p_church_id`
   (`021:107-141`). No global-role seeder exists.
6. **No provisioning path** — no RPC or action creates PO rows; `approve_church_request`
   *requires* an existing PO (`not_platform_owner`), so there is a structural chicken-and-egg.

### 1.3 Consequences (today)

- `user_is_platform_owner()` is always `FALSE` → the four `platform_owner_*` policies are inert.
- `approve_church_request` / `reject_church_request` always raise `not_platform_owner`
  → the F3 church onboarding workflow is structurally dead.
- `assertPlatformOwner` (`hasPermission(tenants.read)`, the P0-1-fixed server path) always fails.
- Confirmed RLS **gap**: `profiles` has no self-read policy for a church-less user
  (`tenant_isolation` = `church_id = get_user_church_id()` → `NULL = NULL` → false;
  `super_admin_all` / `admin_scoped` are church-scoped) → even after rows exist, a PO
  cannot `SELECT` their own profile.

---

## 2. Recommended Architecture (Option A: Global Platform Owner)

**Decision: Option A — church-less global PO (`church_id IS NULL`), role-model canonical.**

It is the only option that is consistent with the DB's own design intent (1.1) **and** keeps
the P0-1-fixed `hasPermission` frontend gate working unchanged, because the PO is expressed
as a normal `platform_owner` role with a permission bundle.

### Rejected alternatives

| Option | Idea | Why rejected |
|---|---|---|
| B: "Platform church" | A dedicated church tenant (`slug='platform'`) owns the PO role | Semantically muddled: `user_is_platform_owner()` is global, so the PO would still see *all* churches while *belonging* to a fake tenant; the fake church must be excluded from signup lists, analytics, and billing everywhere — perpetual special-casing debt. |
| C: Hardcoded owner | A `platform_settings` row holding the PO `auth.uid`; `user_is_platform_owner()` checks it | Breaks the role model: the frontend `assertPlatformOwner` uses `hasPermission(tenants.read)`, so Option C would require special-casing every PO gate on the client. |

### Architecture

```
Platform Owner (auth.users + profiles.church_id = NULL + servants.church_id = NULL)
   └─ global role: roles(church_id = NULL, role_type = 'platform_owner')   [unique, exactly 1]
        └─ role_permissions ← platform bundle (tenants.*, subscriptions.manage, billing.read,
                              system.metrics, system.audit, support.manage, users.read,
                              reports.read, reports.export, audit.read, notifications.read)
        └─ user_roles(church_id = NULL, user_id, role_id, start_date)      [single active grant]
```

Key properties:

- **`user_is_platform_owner()` needs no change** — it is church-agnostic; once the grant row
  exists it returns `TRUE`, activating all four existing `platform_owner_*` policies.
- **`get_user_church_id()` returns `NULL`** for the PO → every tenant-isolation policy
  correctly excludes the PO from church data (isolation preserved). Platform-wide access is
  expressed only through the explicit `platform_owner_*` policies.
- **Middleware works unchanged**: `get_my_access_state()` (`023:346`, LEFT JOIN on church)
  yields `has_roles = true`, `servant_approval_status = approved`, `is_active = true`
  → `hasAccess` → PO lands on `/dashboard` (whose PermissionGate needs `reports.read`,
  included in the bundle).
- **SECURITY DEFINER is sufficient** for all writes; the only service-role touchpoints are
  (a) `auth.admin.createUser` for the PO account and (b) executing the bootstrap RPC —
  the exact pattern already used by the church-approval flow.

### Every frontend surface affected (implementation plan, no code yet)

| Surface | Change |
|---|---|
| **NEW** `src/features/platform/actions/platform-owner.admin.actions.ts` | `bootstrapPlatformOwnerAction` → `createAdminClient().auth.admin.createUser(...)` + `rpc('bootstrap_platform_owner', ...)`. Requires `SUPABASE_SERVICE_ROLE_KEY` server-side. |
| `src/features/churches/actions/church-request.admin.actions.ts` | **No change** — `assertPlatformOwner` / `hasPermission(tenants.read)` pass for the PO via the P0-1 path. |
| `src/app/[locale]/(app)/admin/church-requests/page.tsx` | **No change** — PermissionGuard `tenants.read` passes for the PO. |
| `src/components/layout/app-shell.tsx` | Add role-aware nav item (e.g. "Church Requests"/"Platform") visible to PO only — no entry exists today. Flagged for the polish phase, not P0-3. |
| `src/types/registration.ts` | Add bootstrap RPC call types if invoked from an action. |
| i18n (`ar`/`en` messages) | Any new nav label (follow the existing missing-keys pattern; ~22 known gaps). |

---

## 3. Migration 026 Specification

File: `supabase/migrations/026_platform_owner_bootstrap.sql` (single forward migration,
with verification block per project convention).

### 3.1 Schema (additive, low-risk)

```sql
-- 1. Allow the single global role / grant / PO rows (church_id NULL)
ALTER TABLE roles        ALTER COLUMN church_id DROP NOT NULL;
ALTER TABLE user_roles   ALTER COLUMN church_id DROP NOT NULL;
ALTER TABLE profiles     ALTER COLUMN church_id DROP NOT NULL;
ALTER TABLE servants     ALTER COLUMN church_id DROP NOT NULL;

-- 2. Preserve "exactly one" guarantees that the dropped UNIQUE/NOT NULL gave church rows
CREATE UNIQUE INDEX uq_roles_global_platform_owner
  ON roles (role_type) WHERE church_id IS NULL;

CREATE UNIQUE INDEX uq_user_roles_active_global
  ON user_roles (user_id, role_id) WHERE church_id IS NULL AND end_date IS NULL;
```

Notes:
- Postgres treats `NULL`s as distinct in unique indexes, so the existing
  `UNIQUE (church_id, role_type)` and `uq_user_roles_active` do **not** police NULL-church
  rows; the two partial indexes restore the invariant.
- `servants` PK is `id REFERENCES profiles(id)` (`011`); the PO servant row uses the same id
  as the profile — no FK change needed.
- `notifications.church_id` already nullable (`023:108`); `audit_logs.church_id` nullable via
  `write_audit_log` (`019`). No change.

### 3.2 Objects

**`seed_platform_owner_role()`** (plain function; called only inside the bootstrap RPC):

```sql
-- Insert the global role (idempotent via partial unique index)
INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
VALUES (NULL, 'platform_owner', 'مدير النظام الأساسي', 'Platform Owner', true)
ON CONFLICT DO NOTHING;  -- guarded by uq_roles_global_platform_owner

-- Grant only codes that actually exist in the permissions catalog (robust to drift)
INSERT INTO role_permissions (role_id, permission_id, created_by)
SELECT r.id, p.id, NULL
FROM roles r, permissions p
WHERE r.church_id IS NULL AND r.role_type = 'platform_owner'
  AND p.code = ANY (ARRAY[
        'tenants.create','tenants.read','tenants.update','tenants.delete',
        'subscriptions.manage','billing.read',
        'system.metrics','system.audit','support.manage',
        'users.read','reports.read','reports.export','audit.read','notifications.read'
      ])
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id);
```

**`bootstrap_platform_owner(p_auth_user_id uuid, p_full_name_ar text, p_email text,
p_phone text DEFAULT NULL) RETURNS uuid`** — `SECURITY DEFINER`, owner `postgres`:

1. **Single-flight guard** (prevents a second PO; multi-owner is out of scope):
   ```sql
   IF EXISTS (
     SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE r.church_id IS NULL AND r.role_type = 'platform_owner'
       AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
   ) THEN RAISE EXCEPTION 'platform_owner_already_exists'; END IF;
   ```
2. `PERFORM seed_platform_owner_role();` and fetch the global role id.
3. Upsert `profiles (id = p_auth_user_id, church_id = NULL, email, full_name_ar, ...)`
   → `ON CONFLICT (id) DO NOTHING`.
4. Upsert `servants (id = p_auth_user_id, church_id = NULL, approval_status = 'approved',
   approved_by = NULL, approved_at = now())` → `ON CONFLICT (id) DO NOTHING`.
5. `INSERT INTO user_roles (church_id = NULL, user_id, role_id, assigned_by = NULL,
   start_date = CURRENT_DATE)`.
6. `PERFORM write_audit_log(NULL, 'create', 'platform_owner', p_auth_user_id, NULL,
   jsonb_build_object(...));` (actor is NULL — service-role bootstrap; documented).
7. `RETURN v_role_id;`

**Privileges** (critical security boundary):

```sql
REVOKE ALL ON FUNCTION seed_platform_owner_role() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION seed_platform_owner_role() TO service_role;

REVOKE ALL ON FUNCTION bootstrap_platform_owner(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION bootstrap_platform_owner(uuid, text, text, text) TO service_role;
```

→ **Normal users cannot self-promote.** The first PO is created by the platform operator
through the server action (service role), mirroring the existing church-approval pattern.

### 3.3 RLS fix (ships in the same migration)

```sql
-- PO (and every user) may read their own profile. Required because the PO's
-- church_id is NULL, so tenant_isolation (church_id = get_user_church_id()) is false for them.
CREATE POLICY own_read ON profiles FOR SELECT USING (id = auth.uid());
```

This is additive and safe (a user can always read their own row; no data leaks).

### 3.4 Explicitly unchanged

- `user_is_platform_owner()`, `user_is_super_admin()`, `get_user_church_id()` — no edits.
- `seed_church_roles()` — untouched (PO role is created by the new seeder only).
- All four existing `platform_owner_*` policies — no edits, they activate once the grant exists.
- `approve_servant` — PO does not approve servants (church-scoped `super_admin`).

---

## 4. Risk Assessment

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Dropping `NOT NULL` on 4 columns | Low | Additive; no existing NULL rows. Partial unique indexes restore the invariants (3.1). |
| R2 | Pre-existing RLS gap: PO cannot read own profile | Med | Fixed atomically in the same migration (`own_read`, 3.3). |
| R3 | `get_user_church_id()` = NULL for PO → tenant policies return false for PO | Med | Correct isolation. Future platform features must add explicit `platform_owner_*` policies, never reuse tenant ones. Documented. |
| R4 | Middleware/dashboard for PO: `get_my_access_state` needs approved servant + `reports.read` | Low | Bootstrap creates the approved servant row; `reports.read` is in the bundle. Dashboard KPI cards render empty (no church) — known, out of P0-3 scope. |
| R5 | `tenants.*` / bundle codes missing from permissions table | Low | `seed_platform_owner_role` uses `SELECT ... WHERE code = ANY(...)` so it grants only existing codes; `tenants.*` confirmed present (`021:54-57`). |
| R6 | Self-promotion via bootstrap RPC | Low | `service_role`-only EXECUTE + single-flight guard (3.2). |
| R7 | No live DB in this environment | Med | 024/025 already blocked on this; P0-3 verification is static (SQL review + tsc/lint/build) until credentials are available. |
| R8 | Multi-PO not supported | Low | Enforced by `platform_owner_already_exists`; future phase can relax. |

---

## 5. Rollback Strategy

Primary: **restore from backup snapshot** (migration is additive).

Targeted down (also ship as the file's verification/rollback block):

1. `DROP FUNCTION bootstrap_platform_owner(uuid, text, text, text);`
2. `DROP FUNCTION seed_platform_owner_role();`
3. `DROP POLICY own_read ON profiles;`
4. `DROP INDEX uq_user_roles_active_global;`
5. `DROP INDEX uq_roles_global_platform_owner;`
6. Delete PO rows (guarded — only the NULL-church rows): `DELETE FROM user_roles WHERE church_id IS NULL; DELETE FROM servants WHERE church_id IS NULL; DELETE FROM profiles WHERE church_id IS NULL;`
7. `ALTER TABLE roles / user_roles / profiles / servants ALTER COLUMN church_id SET NOT NULL;`

---

## 6. Verification Checklist

**Static (this environment):**
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` pass (new bootstrap action included).
- [ ] Migration 026 reviewed: SQL only touches the 6 blockers (4 columns, 2 indexes) + 2 functions + 1 policy; no RBAC semantics changed.

**DB-level (scratch DB / local Supabase when credentials exist):**
- [ ] Before: `SELECT user_is_platform_owner();` → `false`.
- [ ] Run 026; `SELECT role_type FROM roles WHERE church_id IS NULL;` → exactly 1 (`platform_owner`).
- [ ] `bootstrap_platform_owner('<po uid>', ...)` via service role → returns role_id.
- [ ] `profiles`/`servants`/`user_roles` PO rows all have `church_id = NULL`; servant `approval_status = 'approved'`.
- [ ] `SELECT user_is_platform_owner();` → `true` as the PO user.
- [ ] Second `bootstrap_platform_owner` call → raises `platform_owner_already_exists`.
- [ ] As a normal authenticated user: `EXECUTE bootstrap_platform_owner` → permission denied.
- [ ] As PO: `SELECT * FROM church_requests WHERE status = 'pending';` → rows visible (`platform_owner_all`).
- [ ] As PO: `approve_church_request` on a pending request → creates church + `super_admin` grant (`025` flow); `reject_church_request` works.
- [ ] As PO: `SELECT * FROM profiles WHERE id = auth.uid();` → own row (`own_read`).
- [ ] As PO: `has_permission('tenants.read')` via the P0-1 server path → `true`.
- [ ] As PO: `/ar/dashboard` via middleware → 200 (not redirected to pending-approval).
- [ ] Church-scoped smoke: `super_admin` of an existing church still sees only their church (isolation preserved).

---

## Open Items for Sign-Off

1. **Approve Option A** (global PO, `church_id = NULL`) before implementation.
2. Confirm the PO **permission bundle** contents (3.2 list) — especially whether `reports.read`
   should gate the PO dashboard or a future `system.metrics` dashboard replaces it (P0-5).
3. Decide whether migration 026 is written now but applied when DB credentials are available
   (same constraint as 024/025), or deferred entirely until the DB is reachable.
