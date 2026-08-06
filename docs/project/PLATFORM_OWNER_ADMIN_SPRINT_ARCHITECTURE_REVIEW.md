# Architecture Review Addendum — Platform Owner / Multi-Tenant Administration Sprint

**Project:** Church Ministry CRM  
**Document Version:** 1.0  
**Date:** 2026-08-04  
**Status:** Architecture Review — Final  
**Prerequisite:** `PLATFORM_OWNER_ADMIN_SPRINT_AUDIT_AND_PLAN.md` (v1.1) — this addendum builds on those verified findings.

---

## Confirmation of Existing Findings

All six findings from the audit are **verified correct**:

| Finding | Status | Notes |
|---------|--------|-------|
| 1. No Church Management module | ✅ Confirmed | `/admin/churches` route missing; no nav item; only `useChurchesForSignup` exists (signup dropdown) |
| 2. No Church Super Admin provisioning | ✅ Confirmed | Only `approve_church_request` (023) creates a Super Admin atomically, but that path is church-request → approval → church. No direct PO path. |
| 3. `createUser` does not create servant records | ✅ Confirmed | `user.service.ts` `createUser` creates auth user + profile + roles + stage assignments. No servant INSERT. `get_my_access_state()` requires an approved servant row. |
| 4. No bulk user import | ✅ Confirmed | `import-export` module is beneficiary-only. `ImportEntityType` = `"beneficiaries"` only. No user import types, schemas, or actions. |
| 5. No church provisioning wizard | ✅ Confirmed | No multi-step wizard UI. No `create/page.tsx` route. |
| 6. PO `church_id = NULL` breaks church-scoped actions | ✅ Confirmed | `listUsersAction`, `getUserAction`, `getRolesAction`, `getStagesAction` all read `profile.church_id` from the actor → NULL for PO → return nothing or fail. `user_is_super_admin(NULL)` is false. |

**Beneficiary domain model:** Confirmed that `beneficiary` is NOT a user role. Beneficiaries exist in `beneficiaries` table with `beneficiary_assignments` linking to stages/services. The RBAC hierarchy (platform_owner → super_admin → admin → servant) is entirely separate from the beneficiary domain. No changes needed.

---

## Task 1 — Provisioning Strategy Review

### Options

#### Option A: Two separate RPCs (`create_church` + `create_church_super_admin`)

The Phase 1 + Phase 2 plan proposes:
1. Church CRUD via admin-client (Phase 1 — no migration)
2. `create_church_super_admin(p_church_id, p_auth_user_id, ...)` RPC (Phase 2 — migration 032)

These could be called sequentially by the frontend.

#### Option B: Single atomic `provision_church(...)` RPC

```
provision_church(
  p_church_name_ar, p_church_name_en, p_slug, p_contact_email, p_contact_phone,
  p_auth_user_id, p_full_name_ar, p_full_name_en, p_email, p_phone
)
```

Performs in one transaction:
1. INSERT churches (name, slug, contact, subscription)
2. `seed_church_roles(church_id)`
3. INSERT profiles (auth user, church_id = church_id)
4. INSERT servants (approved)
5. INSERT user_roles (super_admin grant)
6. `send_notification` (onboarding)
7. `write_audit_log` × 3 (church, profile, servant)

### Comparison

| Aspect | Option A (Two RPCs) | Option B (Single RPC) |
|--------|---------------------|------------------------|
| **Atomicity** | Two separate transactions. If the frontend creates a church but crashes before creating the Super Admin, the church exists with no admin. | One transaction. If anything fails, the entire provisioning is rolled back. |
| **Pattern reuse** | `create_church_super_admin` mirrors `approve_church_request` (023) closely. | Matches `approve_church_request` (023) exactly — that function already does all 7 steps. |
| **Flexibility** | PO can create a church first, then add a Super Admin later (or add multiple). | Single-shot. If the PO needs to add another Super Admin later, a separate `create_church_super_admin` RPC is still needed. |
| **Frontend complexity** | Sequential calls — simpler to build but requires error handling for the partial-failure case. | Single call — simpler frontend, no partial-failure handling. |
| **Security boundary** | Two RPCs = two attack surfaces, each with `user_is_platform_owner()` guard. | One RPC = one attack surface. |
| **Audit trail** | Two audit operations (church create, user create). | Three audit rows in one transaction (church, profile, servant). |
| **Rollback** | Church created but no admin → manual cleanup or re-run. | Single transaction rollback — no cleanup needed. |
| **Operational use** | The PO may want to create a church structure first, then provision the admin later (e.g., when the admin is ready). | Forces the admin to be created at the same time as the church. |

### Recommendation: Option B (`provision_church`) as primary + Option A (`create_church_super_admin`) as secondary

**Rationale:**

1. **`approve_church_request` (023) is the canonical pattern.** It already provisions a church + roles + profile + servant + super_admin grant + notification + 3 audit rows atomically. `provision_church` is the direct platform-owner equivalent of `approve_church_request`. The pattern is proven, tested, and production-hardened.

2. **Atomicity is critical.** A church with no admin is a dead tenant. The `provision_church` RPC guarantees that either the full tenant is provisioned or nothing is created. This is the same guarantee that `approve_church_request` provides.

3. **A separate `create_church_super_admin` RPC is still needed** for the operational case where a church already exists but needs an additional Super Admin (e.g., replacing a departing admin, adding a co-admin). This is a separate, simpler RPC that only creates profile + servant + super_admin grant for an existing church.

4. **The frontend wizard** (Phase 5) calls `provision_church` once. The separate "add admin to existing church" flow (Church Detail page) calls `create_church_super_admin`.

### Security Implications

- Both RPCs must enforce `user_is_platform_owner()` internally (same guard as `approve_church_request`).
- Both RPCs must be `SECURITY DEFINER` with `SET search_path = public, auth` (matching 023/026).
- Both RPCs must be `REVOKE`d from `PUBLIC/anon/authenticated` and `GRANT`ed to `service_role` only (matching 026 S8). The server action calls them via the admin client.
- `create_church_super_admin` must additionally verify the target church exists (`SELECT 1 FROM churches WHERE id = p_church_id AND deleted_at IS NULL`).
- `create_church_super_admin` must be idempotent: if the target user already has a profile + servant + super_admin grant in this church, it should return success (not error). This matches the `ON CONFLICT DO UPDATE` pattern in `bootstrap_platform_owner` (026 S7).

### RLS Implications

- **None.** Both RPCs are SECURITY DEFINER and bypass RLS. The existing `platform_owner_all` policy on churches is unaffected.
- The `super_admin_all` WITH CHECK on `user_roles` (031 F1) is bypassed by SECURITY DEFINER — the RPC's owner is the function definer, not the calling user. This is correct and intentional (same as `approve_church_request`).

### Operational Implications

- The PO must have the target user's auth account already created (via `auth.admin.createUser` in the server action, mirroring `bootstrapPlatformOwnerAction`). The RPC does not create auth users — the server action does that.
- In production, the server action should generate an invitation link (same pattern as `bootstrapPlatformOwnerAction` line 144–157).
- The `provision_church` RPC needs a slug parameter. The server action must generate a unique slug (`ensureUniqueSlug` pattern from `provisioning.service.ts`).

### Rollback Implications

- Both RPCs are additive. If a rollback is needed, `DROP FUNCTION` the two RPCs. No data is orphaned because the RPCs are the only new objects.
- If `provision_church` was called and succeeded, rolling back the RPC does not delete the church — the DML is already committed. A manual cleanup query would be needed. This is the same risk as `approve_church_request`.

---

## Task 2 — User Domain Model Review

### Current State

`createUser()` (user.service.ts) creates:
```
auth.users  (via admin.auth.admin.createUser)
    ↓
profiles  (INSERT into profiles)
    ↓
roles  (INSERT into user_roles)
    ↓
stage assignments  (INSERT into servant_stage_assignments)
```

**Missing:** `servants` row.

### Impact Analysis

#### Impact on `get_my_access_state()` (023 S11-3)

The function queries:
```sql
LEFT JOIN servants s ON s.id = p.id AND s.deleted_at IS NULL
```

If no servant row exists, `servant_approval_status` is NULL. The middleware currently checks for `approval_status = 'approved'` to allow access. A user with no servant row would fail this check — effectively a **dead account**.

#### Impact on middleware

The middleware calls `get_my_access_state()` to determine:
- Whether the user is approved (has an approved servant row)
- Whether the user has roles
- Which church they belong to

Without a servant row, the user cannot pass the middleware gate. The only way to create a usable account is through the signup flow (which creates a pending servant row in `submit_church_request` + `approve_church_request`) or through the bootstrap flow (which creates an approved servant row).

#### Impact on approvals

The `approve_servant` / `reject_servant` RPCs (023 S11-5/S11-6) operate on `servants` rows. If `createUser` creates a servant row with `approval_status = 'approved'`, the approval flow is bypassed (which is correct for directly-created users — the admin deliberately created them).

#### Impact on reporting

The `servants` export (`exportData` in import-export.service.ts) queries `servants` joined with `profiles`. Users without servant rows would be invisible in servant reports. This is a correctness issue.

### Recommendation: Servant row becomes a required invariant

**Design:**

```
auth.users (admin.auth.admin.createUser)
    ↓
profiles (INSERT)
    ↓
servants (INSERT, approval_status = 'approved', atomic)
    ↓
roles (INSERT into user_roles)
    ↓
stage assignments (INSERT into servant_stage_assignments)
```

**Rules:**

1. **Every church-scoped user must have a servant row.** `createUser` inserts a servant row with `approval_status = 'approved'` in the same transaction. If the servant INSERT fails, the entire `createUser` rolls back.

2. **Platform Owner is the ONLY exception.** The PO has a servant row with `church_id = NULL` (created by `bootstrap_platform_owner`, 026 S7). This is already correct.

3. **The servant row is created with `approval_status = 'approved'`** because the user is being created by an authorized admin. The approval workflow is for self-registration (signup), not for admin-created accounts.

4. **The `createUser` function must be atomic.** If any step fails, all previous steps are rolled back. The existing pattern (delete auth user on failure, lines 183, 194, 209, 213 in user.service.ts) is fragile. A better approach would be to use the `import_users` SECURITY DEFINER RPC (Task 4) for multi-row imports, but for single-user creation, the existing sequential approach with cleanup on failure is acceptable.

### Migration Implications

- **No data migration needed** for existing users. The `servants` table already has rows for all existing profiles (created by migration 011, which ran `INSERT INTO servants ... SELECT id, church_id, ... FROM profiles WHERE church_id IS NOT NULL`). Any user created after 011 but before this fix would lack a servant row, but this is a small window.
- **Low risk:** A one-time verification query can identify any profiles without servant rows:
  ```sql
  SELECT p.id, p.email, p.full_name_ar
  FROM profiles p
  LEFT JOIN servants s ON s.id = p.id
  WHERE s.id IS NULL AND p.church_id IS NOT NULL;
  ```
  If any exist, they can be backfilled with `INSERT INTO servants (id, church_id, approval_status, ...) VALUES (...)`.

---

## Task 3 — Migration 032 Design Review

### Purpose

Migration 032 is a **single, additive migration** that creates the SECURITY DEFINER RPCs needed for the PO provisioning flow. It does NOT modify any existing table, policy, function, or index.

### Objects Affected

| Object | Type | Action |
|--------|------|--------|
| `provision_church(...)` | SECURITY DEFINER RPC | **CREATE** |
| `create_church_super_admin(...)` | SECURITY DEFINER RPC | **CREATE** |
| `import_users(...)` | SECURITY DEFINER RPC | **CREATE** (if Phase 4 is included) |

### New RPCs Required

#### RPC 1: `provision_church(p_church_name_ar, p_church_name_en, p_slug, p_contact_email, p_contact_phone, p_address_ar, p_auth_user_id, p_full_name_ar, p_full_name_en, p_email, p_phone)`

**Purpose:** Atomic church + Super Admin provisioning. Direct PO equivalent of `approve_church_request`.

**Returns:** `uuid` (the new church_id)

**Guards:**
- `auth.uid() IS NOT NULL` (authenticated)
- `user_is_platform_owner()` (PO only)
- Slug format: `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$` (same as 023 S11-7)
- Church name dedupe: no existing church with same name_ar or name_en
- Auth user exists: `SELECT 1 FROM auth.users WHERE id = p_auth_user_id`
- Auth user email matches p_email (same D-8 check as 023)

**Transaction body (sequential):**
1. `INSERT INTO churches (name_ar, name_en, slug, contact_email, contact_phone, address_ar, subscription_tier, subscription_status, trial_ends_at, feature_flags, locale)`
2. `PERFORM seed_church_roles(v_church_id)`
3. `INSERT INTO profiles (id, church_id, email, full_name_ar, full_name_en, phone, preferred_locale)`
4. `INSERT INTO servants (id, church_id, approval_status, approved_by, approved_at)`
5. `SELECT id FROM roles WHERE church_id = v_church_id AND role_type = 'super_admin'` → `v_role_id`
6. `INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)`
7. `PERFORM send_notification(...)` (onboarding)
8. `PERFORM write_audit_log(...)` × 3 (church, profile, servant)
9. `RETURN v_church_id`

**Privileges:** `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION ... TO service_role;`

**Pattern reference:** `approve_church_request` (023 S11-7) — the structure is identical.

#### RPC 2: `create_church_super_admin(p_church_id, p_auth_user_id, p_full_name_ar, p_full_name_ar, p_email, p_phone)`

**Purpose:** Add a Super Admin to an existing church. Used when the PO needs to add a second admin or replace an existing one.

**Returns:** `uuid` (the user's role grant id)

**Guards:**
- `auth.uid() IS NOT NULL`
- `user_is_platform_owner()` (PO only)
- Church exists: `SELECT 1 FROM churches WHERE id = p_church_id AND deleted_at IS NULL`
- Auth user exists: `SELECT 1 FROM auth.users WHERE id = p_auth_user_id`
- Auth user email matches p_email (D-8)

**Transaction body:**
1. `INSERT INTO profiles (id, church_id, email, full_name_ar, ...) ON CONFLICT (id) DO UPDATE SET ...` (idempotent, matching 026)
2. `INSERT INTO servants (id, church_id, approval_status, ...) ON CONFLICT (id) DO UPDATE SET ...` (idempotent)
3. `SELECT id FROM roles WHERE church_id = p_church_id AND role_type = 'super_admin'`
4. `INSERT INTO user_roles (church_id, user_id, role_id, ...) ON CONFLICT DO NOTHING` (idempotent)
5. `PERFORM send_notification(...)` (onboarding)
6. `PERFORM write_audit_log(...)` × 2 (profile, servant)

#### RPC 3: `import_users(p_rows jsonb, p_church_id uuid)`

**Purpose:** Bulk import users. See Task 4 for full design.

### Constraints Required

- **No new UNIQUE constraints** — existing `uq_user_roles_active` (023) and `uq_user_roles_active_global` (026) already enforce the active-grant invariants.
- **No new CHECK constraints** — existing `church_requests_status_check` (023) is the only status constraint needed.
- **No new NOT NULL constraints** — all existing constraints are sufficient.

### Audit Requirements

Every RPC must write audit rows:
- `provision_church`: 3 rows (church, profile, servant)
- `create_church_super_admin`: 2 rows (profile, servant)
- `import_users`: 1 row per imported user (servant)

Audit rows must use `write_audit_log` (SECURITY DEFINER, 019/031 F2). The RPCs are SECURITY DEFINER, so they bypass the `write_audit_log` privilege lockdown (031 F2 grants `service_role` only — the RPC's definer runs as the function owner, which is `postgres` or the schema owner, and has implicit execute permission).

### Rollback Considerations

- **Migration 032 is additive** — no existing objects are modified or dropped. Rollback is:
  ```sql
  DROP FUNCTION IF EXISTS provision_church(uuid, uuid, text, text, text, text, text, text, text, text, text);
  DROP FUNCTION IF EXISTS create_church_super_admin(uuid, uuid, text, text, text, text);
  DROP FUNCTION IF EXISTS import_users(jsonb, uuid);
  ```
- No data cleanup is needed. Any churches created by `provision_church` before the rollback would remain, but this is acceptable — the rollback only removes the ability to create new ones.
- **Full rollback:** restore the pre-032 backup snapshot.

---

## Task 4 — User Import Architecture Review

### Options Compared

#### Option A: Direct inserts (admin-client batch)

The server action loops over rows and calls `createUser` (admin-client) for each.

| Aspect | Evaluation |
|--------|------------|
| **Security** | Service-role bypasses RLS, so no permission escalation. But each row is a separate transaction — no atomicity. |
| **Complexity** | Low. Reuse existing `createUser` service. |
| **Maintainability** | Low. Any change to the user creation flow requires updating the loop. |
| **Auditability** | Per-row audit via `writeAuditLog` is possible but adds complexity. |
| **RLS compatibility** | N/A (service-role bypass). |
| **Church isolation** | The server action enforces `import.execute` (church-scoped) or `import.execute` + `tenants.create` (cross-church). |
| **Atomicity** | **None.** If the 10th of 100 rows fails, rows 1–9 are committed. The server action cannot roll back auth.users. |
| **Performance** | 1 HTTP round-trip per row → slow for 1000+ rows. |

#### Option B: SECURITY DEFINER `import_users` RPC

A single RPC that receives a JSONB array of rows and processes them atomically.

| Aspect | Evaluation |
|--------|------------|
| **Security** | SECURITY DEFINER, service_role-only EXECUTE, internal `user_is_platform_owner()` or `user_has_permission_in_church('import.execute', ...)` guard. No RLS bypass by unauthorized users. |
| **Complexity** | Medium. PL/pgSQL JSONB iteration with FOR loop. |
| **Maintainability** | High. All import logic is in one place. Changes to the user creation model are reflected in the RPC. |
| **Auditability** | Per-row audit inside the loop. Single transaction — all audit rows are committed together. |
| **RLS compatibility** | Bypassed (SECURITY DEFINER). Correct and intentional. |
| **Church isolation** | Enforced by the RPC guard: PO passes `p_church_id = 'all'` or a specific church_id; SA is locked to their own church. |
| **Atomicity** | **Full.** If any row fails, the entire import is rolled back. No partial imports. |
| **Performance** | Single round-trip. JSONB parsing is fast. 1000 rows in one transaction. |

#### Option C: Background-job import pipeline

Upload file → store in a staging table → trigger a background job (e.g., pg_cron, pgmq, or a Supabase Edge Function) → process rows asynchronously → send notification when done.

| Aspect | Evaluation |
|--------|------------|
| **Security** | Good. Staging table with RLS, job runs as service-role. |
| **Complexity** | **High.** Requires a staging table, a job queue, a worker, and a notification system. |
| **Maintainability** | Low. Multiple moving parts. |
| **Auditability** | Good. Staging table provides a record of all import attempts. |
| **RLS compatibility** | Staging table can have RLS. |
| **Church isolation** | Enforced by RLS on the staging table. |
| **Atomicity** | **Per-row.** The background job can process rows individually and report failures. |
| **Performance** | Best for very large imports (10K+ rows). No HTTP timeout concerns. |
| **Overhead** | Significant. Staging table schema, job worker, error handling, user notification. |

### Recommendation: Option B (SECURITY DEFINER RPC)

**Rationale:**

1. **Pattern reuse.** The existing `approve_church_request` (023) and `bootstrap_platform_owner` (026) are both SECURITY DEFINER RPCs that create auth users + profiles + roles atomically. `import_users` follows the same pattern.

2. **Atomicity is critical for imports.** A partial import (Option A) leaves the system in an inconsistent state — some users exist, some don't. The admin must manually clean up. Option B guarantees all-or-nothing.

3. **Complexity is acceptable.** The PL/pgSQL loop over JSONB array is straightforward. The `approve_church_request` RPC (023 S11-7) is ~120 lines — `import_users` would be similar.

4. **Performance is adequate.** A single RPC call with 1000 rows completes in seconds. The JSONB payload is well within the 1 GB PostgREST request limit.

5. **Option C is over-engineering.** The current requirement is hundreds of users, not tens of thousands. Background jobs add deployment complexity (Supabase Edge Functions, pgmq, or a custom worker). This can be added later if needed.

### RPC Signature

```sql
import_users(
  p_rows jsonb,        -- Array of {email, full_name_ar, full_name_en, phone, role_type, church_id?, stage_id?}
  p_church_id uuid,    -- Target church (NULL for PO cross-church, each row must have church_id)
  p_generate_password boolean DEFAULT true,
  p_send_invitation boolean DEFAULT false
)
RETURNS TABLE (
  row_index integer,
  status text,          -- 'imported', 'skipped', 'error'
  user_id uuid,
  error_message text
)
```

**Design notes:**
- Returns a result set so the frontend can display a summary (matching the existing `ImportSummary` pattern).
- PO cross-church import: `p_church_id = NULL`, each row has its own `church_id`.
- Church Super Admin import: `p_church_id = their church_id`, `church_id` in rows is ignored.
- Passwords: generated via `gen_random_uuid()` truncated to 12 chars (or use `encode(gen_random_bytes(6), 'hex')`).
- Invitation: calls `send_notification` for each imported user (same pattern as `approve_church_request`).
- Deduplication: check for existing email in `profiles` and `church_requests` (same pattern as `submit_church_request`, 023 S11-4).

---

## Task 5 — Phase Ordering Review

### Current Order (from audit)

```
Phase 1: Church Management CRUD (3–4 days)
    ↓
Phase 2: Church Super Admin Creation (2–3 days) + migration 032
    ↓
Phase 3: User Creation UX Fixes (1–2 days) — parallel
    ↓
Phase 4: Bulk User Import (3–4 days)
    ↓
Phase 5: Church Provisioning Wizard (2–3 days)
```

### Proposed New Order

```
Phase 1: Church Management CRUD (3–4 days)
    ↓
Phase 2: Church Provisioning Core (2–3 days) + migration 032
    ↓
Phase 3: Church Provisioning Wizard (1–2 days)
    ↓
Phase 4: User Creation UX Fixes (1–2 days) — parallel
    ↓
Phase 5: Bulk User Import (3–4 days)
```

### Comparison

| Aspect | Current Order | Proposed Order | Reasoning |
|--------|---------------|----------------|-----------|
| **Provisioning atomicity** | Church created first (Phase 1), then Super Admin (Phase 2) — gap between them | Both in Phase 2 via `provision_church` | No dead-church window. The wizard (Phase 3) immediately follows the core. |
| **Wizard delivery** | Phase 5 — last deliverable | Phase 3 — third deliverable | The wizard is the most visible UX outcome. Delivering it earlier provides immediate value for testing. |
| **User creation UX** | Phase 3 — early | Phase 4 — moved back | Servant auto-create is important but not blocking for provisioning. The wizard in Phase 3 uses `provision_church` RPC which already creates servant rows. |
| **User import** | Phase 4 — middle | Phase 5 — last | User import is complex and riskier. Delivering it last allows the provisioning flow to stabilize first. |
| **Dependencies** | Phase 5 depends on Phase 1 + 2 | Phase 3 depends on Phase 1 + 2 | Same dependency chain. The wizard cannot exist without the CRUD and the RPC. |
| **Parallel tracks** | Track A: P1→P2→P5; Track B: P3→P4 | Track A: P1→P2→P3; Track B: P4→P5 | The wizard (P3) and user UX (P4) can be parallel. Import (P5) can start after the RPCs are stable. |
| **Testing value** | Wizard is tested last | Wizard is tested early | Early testing of the provisioning flow catches bugs before they affect other work. |

### Recommendation: Adopt the Proposed Order

**Detailed phase breakdown:**

#### Phase 1: Church Management CRUD (3–4 days)
*No migration needed.*
- `churches.service.ts` — admin-client CRUD (list, create, update, deactivate, stats)
- `church.actions.ts` — server actions
- `use-churches.ts` — hooks
- `churches-page.tsx` — list + search + filter + status badges
- `church-form-dialog.tsx` — create/edit form
- `church-detail-page.tsx` — detail + stats + user count + action buttons
- Routes: `/admin/churches`, `/admin/churches/[churchId]`
- Nav item: `tenants.read` permission
- i18n: en.json + ar.json

#### Phase 2: Church Provisioning Core (2–3 days) + migration 032
- **Migration 032:** `provision_church(...)` + `create_church_super_admin(...)` RPCs
- `provisioning.service.ts` — call RPCs via admin client
- `church-provisioning.actions.ts` — `provisionChurchAction`, `createChurchSuperAdminAction`
- `user.service.ts` — servant auto-create in `createUser`
- **Phase 2a:** Quick "Add Super Admin" button on church detail page (uses `create_church_super_admin`)

#### Phase 3: Church Provisioning Wizard (1–2 days)
- `church-provisioning-wizard.tsx` — multi-step wizard
- `church-config-form.tsx` — step 1: church info
- `church-admin-creation.tsx` — step 2: admin info + password
- `church-provisioning-summary.tsx` — step 3: review + confirm
- Route: `/admin/churches/create`
- Calls `provision_church` RPC on final step

#### Phase 4: User Creation UX Fixes (1–2 days, parallel)
- `user.service.ts` — servant INSERT in `createUser` (atomic)
- `user-form.tsx` — invitation option, role descriptions
- `user.actions.ts` — invitation link generation in prod

#### Phase 5: Bulk User Import (3–4 days)
- **Migration 032 extension:** `import_users(...)` RPC
- `import-export.service.ts` — parseUserImport, validateUserRows
- `import-export.actions.ts` — preview + import actions
- `user-import-area.tsx` — import UI
- `import-export-page.tsx` — add user import tab

---

## Deliverable A — Architecture Review Findings

### Summary of Findings

| # | Finding | Severity | Decision |
|---|---------|----------|----------|
| 1 | `provision_church` should be a single atomic RPC, not two separate RPCs | HIGH | ✅ Adopt Option B (combined RPC) + keep `create_church_super_admin` as secondary |
| 2 | Servant row must be a required invariant for all church-scoped users | HIGH | ✅ Add servant INSERT to `createUser` |
| 3 | Migration 032 is additive; 3 new RPCs, no existing objects modified | MEDIUM | ✅ Approved as designed |
| 4 | `import_users` SECURITY DEFINER RPC is the right approach | HIGH | ✅ Adopt Option B |
| 5 | Phase ordering should be P1 → P2 → P3 → P4 → P5 | MEDIUM | ✅ Adopt proposed order |

### Security Verification

All new RPCs follow the same security pattern:
- `SECURITY DEFINER` with `SET search_path = public, auth` (023/026 pattern)
- Internal `user_is_platform_owner()` guard (or `user_has_permission_in_church` for SA-scoped import)
- `REVOKE` from `PUBLIC/anon/authenticated`, `GRANT` to `service_role`
- Called by server actions via admin client
- `write_audit_log` for every operation
- `send_notification` for user-facing events

---

## Deliverable B — Final Approved Architecture

### Data Flow (Final)

```
PLATFORM OWNER (church_id = NULL)
    │
    ├── Provision Church + Super Admin (wizard)
    │   └── provisionChurchAction → admin client → provision_church RPC
    │       ├── INSERT churches (name, slug, contact, subscription)
    │       ├── seed_church_roles(church_id)
    │       ├── INSERT profiles (auth user)
    │       ├── INSERT servants (approved)
    │       ├── INSERT user_roles (super_admin grant)
    │       ├── send_notification (onboarding)
    │       └── write_audit_log × 3 (church, profile, servant)
    │
    ├── Edit / Deactivate Church
    │   └── updateChurchAction / deactivateChurchAction → admin client UPDATE
    │
    ├── View Churches / Stats
    │   └── listChurchesAction / getChurchStatsAction → admin client SELECT
    │
    ├── Add Super Admin to Existing Church
    │   └── createChurchSuperAdminAction → admin client → create_church_super_admin RPC
    │       ├── INSERT profiles (ON CONFLICT DO UPDATE)
    │       ├── INSERT servants (ON CONFLICT DO UPDATE)
    │       ├── INSERT user_roles (ON CONFLICT DO NOTHING)
    │       ├── send_notification (onboarding)
    │       └── write_audit_log × 2
    │
    ├── Import Users (cross-church)
    │   └── importUsersAction → admin client → import_users RPC
    │       └── per row: auth user + profile + approved servant + role grant + audit
    │
    └── User CRUD (within a church)
        └── createUserAction → admin client → createUser service
            ├── admin.auth.admin.createUser
            ├── INSERT profiles
            ├── INSERT servants (approval_status = 'approved')  ← NEW FIX
            ├── INSERT user_roles
            └── INSERT servant_stage_assignments
```

### Module Structure (Final)

```
src/features/churches/
├── actions/
│   ├── church.actions.ts                  ← Phase 1: list/create/update/deactivate/stats
│   ├── church-provisioning.actions.ts     ← Phase 2: provisionChurch, createChurchSuperAdmin
│   └── church-request.admin.actions.ts    ← EXISTING
├── components/
│   ├── churches-page.tsx                  ← Phase 1
│   ├── church-form-dialog.tsx             ← Phase 1
│   ├── church-detail-page.tsx             ← Phase 1
│   ├── church-provisioning-wizard.tsx     ← Phase 3
│   ├── church-config-form.tsx             ← Phase 3
│   ├── church-admin-creation.tsx          ← Phase 3
│   ├── church-provisioning-summary.tsx    ← Phase 3
│   └── admin-church-requests-page.tsx     ← EXISTING
├── hooks/
│   ├── use-churches.ts                    ← Phase 1: CRUD hooks
│   └── use-church-requests.ts             ← EXISTING
├── services/
│   ├── churches.service.ts                ← Phase 1: admin-client CRUD
│   └── provisioning.service.ts            ← Phase 2: RPC calls
├── schemas/church.schema.ts               ← Phase 1
├── types/church.types.ts                  ← Phase 1
└── index.ts                               ← Phase 1
```

### Routes (Final)

```
/app/[locale]/(app)/
├── admin/
│   ├── church-requests/                   ← EXISTING
│   └── churches/                          ← Phase 1
│       ├── page.tsx                       ← Phase 1: list
│       ├── create/page.tsx                ← Phase 3: wizard
│       └── [churchId]/page.tsx            ← Phase 1: detail + stats + add admin button
├── users/                                 ← EXISTING (Phase 4: improved)
└── import-export/                         ← EXISTING (Phase 5: user import tab)
```

---

## Deliverable C — Recommended Migration 032 Scope

### Purpose

Add three SECURITY DEFINER RPCs for Platform Owner provisioning. No table, column, index, policy, or existing function is modified.

### Objects

| Object | Type | Purpose |
|--------|------|---------|
| `provision_church(...)` | FUNCTION | Atomic church + Super Admin creation |
| `create_church_super_admin(...)` | FUNCTION | Add Super Admin to existing church |
| `import_users(...)` | FUNCTION | Bulk user import (optional — Phase 5) |

### RPC Signatures

```sql
-- RPC 1: Atomic church provisioning
provision_church(
  p_church_name_ar text,
  p_church_name_en text DEFAULT NULL,
  p_slug text,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_address_ar text DEFAULT NULL,
  p_auth_user_id uuid,
  p_full_name_ar text,
  p_full_name_en text DEFAULT NULL,
  p_email text,
  p_phone text DEFAULT NULL
) RETURNS uuid  -- returns the new church_id

-- RPC 2: Add Super Admin to existing church
create_church_super_admin(
  p_church_id uuid,
  p_auth_user_id uuid,
  p_full_name_ar text,
  p_full_name_en text DEFAULT NULL,
  p_email text,
  p_phone text DEFAULT NULL
) RETURNS uuid  -- returns the user_id

-- RPC 3: Bulk user import
import_users(
  p_rows jsonb,
  p_church_id uuid DEFAULT NULL,
  p_generate_password boolean DEFAULT true,
  p_send_invitation boolean DEFAULT false
) RETURNS TABLE (
  row_index integer,
  status text,
  user_id uuid,
  error_message text
)
```

### Guards (all RPCs)

- `SECURITY DEFINER` with `SET search_path = public, auth`
- `auth.uid() IS NOT NULL` — authenticated
- `user_is_platform_owner()` — PO only (RPC 1, 2, and PO-mode of RPC 3)
- `user_has_permission_in_church('import.execute', p_church_id)` — SA-mode of RPC 3
- Parameter validation (NOT NULL checks, slug format, email format)
- Input validation (church name dedupe, auth user exists, email match)

### Privileges

```sql
REVOKE ALL ON FUNCTION provision_church(...) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION provision_church(...) TO service_role;

REVOKE ALL ON FUNCTION create_church_super_admin(...) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_church_super_admin(...) TO service_role;

REVOKE ALL ON FUNCTION import_users(...) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION import_users(...) TO service_role, authenticated;
```

**Note:** `import_users` is granted to `authenticated` in addition to `service_role` because the SA-mode (church-scoped import) requires the calling user's RLS identity to be checked. The RPC internally checks `user_has_permission_in_church` which reads `auth.uid()`. If the RPC is only callable via `service_role`, the SA's identity is lost. The server action can pass the `auth.uid()` as a parameter, but the cleaner pattern is to allow `authenticated` EXECUTE and let the RPC enforce the guard. This matches the `approve_servant` / `reject_servant` pattern (023 S12), which grants `authenticated` EXECUTE with internal guards.

### Audit Requirements

Each RPC writes audit logs via `write_audit_log`:
- `provision_church`: 3 rows (church create, profile create, servant create)
- `create_church_super_admin`: 2 rows (profile create, servant create)
- `import_users`: 1 row per imported user (servant create)

### Rollback

```sql
DROP FUNCTION IF EXISTS provision_church(text, text, text, text, text, text, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS create_church_super_admin(uuid, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS import_users(jsonb, uuid, boolean, boolean);
```

No data cleanup needed. The RPCs are the only new objects.

---

## Deliverable D — Updated Phase Roadmap

```
Phase 1: Church Management CRUD (3–4 days)
  ├── churches.service.ts (admin-client CRUD)
  ├── church.actions.ts (server actions)
  ├── use-churches.ts (hooks)
  ├── churches-page.tsx (list + search + filter + status)
  ├── church-form-dialog.tsx (create/edit)
  ├── church-detail-page.tsx (detail + stats + add admin button)
  ├── Routes: /admin/churches, /admin/churches/[churchId]
  ├── Nav item: tenants.read
  ├── i18n: en.json + ar.json
  └── Migration: NONE
    ↓

Phase 2: Church Provisioning Core (2–3 days) + migration 032
  ├── Migration 032: provision_church + create_church_super_admin RPCs
  ├── provisioning.service.ts (RPC calls)
  ├── church-provisioning.actions.ts (provisionChurch, createChurchSuperAdmin)
  ├── user.service.ts (servant auto-create in createUser)
  ├── Quick "Add Super Admin" button on church detail page
  ├── i18n: en.json + ar.json
  └── Migration: 032 (PART 1: RPC 1 + RPC 2)
    ↓

Phase 3: Church Provisioning Wizard (1–2 days)
  ├── church-provisioning-wizard.tsx (multi-step)
  ├── church-config-form.tsx (step 1)
  ├── church-admin-creation.tsx (step 2)
  ├── church-provisioning-summary.tsx (step 3)
  ├── Route: /admin/churches/create
  └── i18n: en.json + ar.json
    │
    ├── Phase 4: User Creation UX Fixes (1–2 days, parallel)
    │   ├── user.service.ts (servant INSERT atomic)
    │   ├── user-form.tsx (invitation, role descriptions)
    │   ├── user.actions.ts (invitation link)
    │   └── i18n: en.json + ar.json
    │
    └── Phase 5: Bulk User Import (3–4 days, after Phase 4)
        ├── Migration 032 (PART 2: import_users RPC)
        ├── import-export.service.ts (parse, validate)
        ├── import-export.actions.ts (preview, import)
        ├── user-import-area.tsx (import UI)
        ├── import-export-page.tsx (user tab)
        └── i18n: en.json + ar.json
```

**Total:** 11–16 days (same as original estimate, but reordered for earlier wizard delivery).

**Parallel tracks:**
- Track A: P1 → P2 → P3 (sequential)
- Track B: P4 → P5 (sequential, starts after P2, parallel with P3)

---

## Deliverable E — Risks and Mitigations

| Risk | Severity | Impact | Mitigation |
|------|----------|--------|------------|
| **PO `church_id = NULL` breaks existing user actions** | HIGH | PO cannot manage users through existing UI | All PO provisioning flows use admin-client + SECURITY DEFINER RPCs. The existing church-scoped user actions are not modified. |
| **`provision_church` RPC duplicate name** | LOW | Name collision with existing function | Check existing function names: `list_churches_for_signup`, `approve_church_request`, `submit_church_request`, `bootstrap_platform_owner`, `seed_church_roles`, `seed_platform_owner_role`. No collision. |
| **`provision_church` slug collision** | MEDIUM | Church creation fails on duplicate slug | Server action generates unique slug before calling RPC (use `ensureUniqueSlug` from `provisioning.service.ts`). The `churches.slug` UNIQUE constraint is the final defense. |
| **`create_church_super_admin` idempotency** | LOW | Subsequent calls fail if user already exists | Use `ON CONFLICT DO UPDATE` / `ON CONFLICT DO NOTHING` pattern (matching 026 S7). Return success if user already has super_admin role. |
| **`import_users` JSONB size limit** | MEDIUM | Very large imports exceed request limits | Document a 1000-row limit per call. For larger imports, split into batches. The server action can handle batching. |
| **Auth user creation rate limits** | MEDIUM | Supabase auth.admin.createUser has rate limits | Batch imports should respect rate limits. A 1-second delay between batches is recommended. |
| **Servant auto-create breaks existing mid-ware** | LOW | Users without servant rows still exist | Run a one-time verification query before Phase 4 to identify profiles without servant rows. Backfill with a data migration if needed. |
| **Wizard state loss on page refresh** | LOW | User loses progress | Use URL search params to persist wizard state (step index + partial data). Each step saves to session storage. |
| **Migration 032 conflicts with future migrations** | LOW | Sequential migration number collision | 032 is the next available number (001–031 exist). Future migrations use 033+. |
| **RLS regression from SECURITY DEFINER** | NONE | — | SECURITY DEFINER functions bypass RLS intentionally. This is the same pattern used by all existing provisioning RPCs (023, 026). No RLS policies are modified. |

---

## Final Architecture Decision Record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Provisioning strategy | **Single `provision_church` RPC** + separate `create_church_super_admin` | Atomicity, pattern reuse (023), no dead-church window |
| User domain model | **Servant row is a required invariant** for all church-scoped users | `get_my_access_state()` requires it; reporting requires it; approvals depend on it |
| Migration 032 scope | **3 additive RPCs**, no existing objects modified | Minimal risk, easy rollback, follows existing pattern |
| User import approach | **SECURITY DEFINER `import_users` RPC** | Atomicity, pattern reuse, acceptable complexity, single round-trip |
| Phase ordering | **P1 → P2 → P3 → P4 → P5** | Earlier wizard delivery, parallel tracks, stable core before import |
| PO write path | **Admin client + SECURITY DEFINER RPCs** | PO's `church_id = NULL` breaks RLS-bound writes; this is the only correct pattern |
| Permission model | **Reuse `tenants.*`** — no new `churches.*` codes | Existing codes are sufficient; no RBAC change needed |

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-04  
**Status:** Architecture Review Complete — Ready for Implementation Approval