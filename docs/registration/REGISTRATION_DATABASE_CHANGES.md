# Registration Database Changes

**Phase:** 3C — Registration & Church Provisioning  
**Date:** 2026-07-31  
**Status:** Architecture / Specification — **no migrations generated in this phase**

---

## 1. Philosophy

Reuse the existing canonical schema. Add exactly **one** new table (`church_requests`) and a small set of SECURITY DEFINER RPCs. Explicitly **do not** add three candidate tables (`user_registration_requests`, `approval_history`, `onboarding_status`) because they duplicate existing canonical structures (see §5).

---

## 2. Existing Tables Leveraged (unchanged)

| Table | Role in 3C |
|---|---|
| `churches` | Dropdown source; created only by PO provisioning |
| `profiles` | Pending user profile (church_id set at signup) |
| `servants` | The pending/approved/rejected representation (`approval_status`) |
| `user_roles` | Role grant on approval (servant) / provisioning (super_admin) |
| `roles`, `role_permissions`, `permissions` | Seeded per church; `servants.approve`, `tenants.*` permissions |
| `notifications` | Approval notifications (one nullable change — §4.3) |
| `audit_logs` | Approval history / audit trail (append-only) |

---

## 3. New Table: `church_requests`

**Purpose:** persistent store for new-church requests submitted by the public (Part D). One row per request; never deleted; status is the review lifecycle.

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_name_ar | TEXT | NOT NULL |
| church_name_en | TEXT | |
| catechist_name | TEXT | NOT NULL |
| applicant_name | TEXT | NOT NULL |
| email | TEXT | NOT NULL |
| phone | TEXT | |
| notes | TEXT | |
| status | TEXT | NOT NULL DEFAULT 'pending' — domain: `pending` / `approved` / `rejected` |
| reviewed_by | UUID | FK → profiles(id), nullable (set by PO) |
| reviewed_at | TIMESTAMPTZ | nullable |
| decision_notes | TEXT | nullable (optional rejection reason) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_church_requests_status` — partial: `(created_at DESC) WHERE status = 'pending'` — PO queue
- `idx_church_requests_email_pending` — UNIQUE partial: `(lower(email)) WHERE status = 'pending'` — duplicate-request guard
- `idx_church_requests_email` — `(lower(email))` — history lookups / dedupe against new submissions

**Constraints / relationships:**
- `status` CHECK: `status IN ('pending','approved','rejected')`
- `reviewed_by` FK → `profiles(id)` ON DELETE SET NULL
- No church FK — the church may not exist until approval; the approved church id is recorded via `audit_logs.new_values` and (optionally) a `church_id` JSONB slot in `decision_notes`/audit only, keeping the table lean.

**Rationale for keeping it request-only:** the request is the *applicant's own submitted data* (not tenant PII), no account exists yet, and provisioning is a PO action — so `church_requests` needs no tenant-scoping and no applicant-user FK.

---

## 4. RPC Additions (SECURITY DEFINER unless noted)

All functions use `auth.uid()` as the actor and enforce role checks internally (defense in depth — they are the chokepoint for every privilege-granting operation).

> **Count (A8):** 8 functions total — **7 client-facing RPCs** (§4.1–§4.5) + the **`send_notification` helper** (§4.6), which is not exposed to clients.

### 4.1 `list_churches_for_signup()`

```
RETURNS TABLE (id uuid, name_ar text, name_en text, slug text)
SELECT id, name_ar, name_en, slug FROM churches
WHERE is_active = true AND deleted_at IS NULL ORDER BY name_ar;
```
- **Security context:** SECURITY DEFINER (runs as owner; bypasses RLS). Called by anonymous users for the dropdown.
- **Projection-limited:** exposes identity fields only — no contact/subscription data.
- **Alternative considered:** a public `SELECT` RLS policy on `churches` — rejected because RLS cannot limit columns; the RPC limits the exposure surface.

### 4.2 `get_my_access_state()`

```
RETURNS TABLE (
  church_id uuid, church_name_ar text,
  servant_approval_status text,   -- NULL if no servant row
  role_types text[],
  is_active boolean,
  has_roles boolean
)
```
- Reads own profile + servant + user_roles (via `auth.uid()`), joins church name.
- Single round-trip for middleware and the `/pending-approval` page.

### 4.3 `submit_church_request(...)`

Validates payload (zod already on the client/server side), dedupes against `profiles.email`, `church_requests.email` (pending), and existing `churches` names; inserts the row; returns the request id. Guard: no auth required.

### 4.4 `approve_servant(p_servant_id uuid)` / `reject_servant(p_servant_id uuid, p_reason text DEFAULT NULL)`

```
Guards (both):
  - auth.uid() IS NOT NULL
  - user_is_super_admin((SELECT church_id FROM servants WHERE id = p_servant_id))
  - auth.uid() <> p_servant_id                      -- no self-approval
  - (SELECT approval_status FROM servants WHERE id = p_servant_id) = 'pending'

approve:
  1. UPDATE servants SET approval_status='approved', approved_by=auth.uid(),
     approved_at=now() WHERE id=p_servant_id
  2. role := (SELECT id FROM roles
              WHERE church_id = p_church_id AND role_type = 'servant')
     -- A1: roles has NO deleted_at column. The UNIQUE (church_id, role_type)
     -- constraint (migration 001) guarantees at most one 'servant' role per
     -- church, so the lookup is unambiguous without any deleted_at filter.
  3. Role grant (temporal, reactivation-first — A3):
     UPDATE user_roles SET end_date = NULL
       WHERE church_id = p_church_id AND user_id = p_servant_id
         AND role_id = role AND end_date IS NOT NULL;
     IF no row was reactivated THEN
       INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)
         VALUES (p_church_id, p_servant_id, role, auth.uid(), CURRENT_DATE);
     END IF;
     -- No ON CONFLICT DO NOTHING: silently skipping the grant would leave an
     -- approved servant with no active role (see §6.3 for the chosen strategy).
  4. INSERT notification (approval_result / approved) via send_notification
  5. INSERT audit_logs (action='approve', entity_type='servant', old/new values)

reject:
  1. UPDATE servants SET approval_status='rejected', approved_by=auth.uid(),
     approved_at=now()
  2. INSERT notification (approval_result / rejected, reason)
  3. INSERT audit_logs (action='reject', ...)
```

### 4.5 `approve_church_request(p_request_id uuid)` / `reject_church_request(p_request_id uuid, p_reason text DEFAULT NULL)`

```
approve (single transaction — see CHURCH_PROVISIONING_SPEC.md §4.2):
  1. Guard: user_is_platform_owner() AND status='pending'
  2. Create church (slugify + collision suffix; contact_email/phone from request;
     tier='trial', status='active', trial_ends_at=now()+30d)
  3. seed_church_roles(church_id)
  4. Create auth user (admin client inside server action OR a dedicated
     provision_account RPC) + profile + servant(approved, approved_by=auth.uid())
  5. Assign super_admin role in user_roles
  6. status='approved', reviewed_by=auth.uid(), reviewed_at=now()
  7. Notification to applicant (approval_result / approved)
  8. Audit: church_request approve + church create + servant create
  → rollback church + auth user on any failure

reject:
  1. Guard: user_is_platform_owner() AND status='pending'
  2. status='rejected', reviewed_by, reviewed_at, decision_notes=reason
  3. Audit (old/new values)
```

**Why RPCs for these paths:** they grant access or create tenants. Executing as the caller keeps `auth.uid()` authoritative, makes the invariants (no self-approval, PO-only, status-guarded) inescapable, and centralizes the audit/notification side effects atomically.

### 4.6 Notification helper `send_notification(p_church_id uuid, p_recipient_id uuid, ...)`

SECURITY DEFINER INSERT wrapper for `notifications` (RLS `recipient_scope` blocks cross-user inserts). Called by the RPCs/server actions above. Not exposed to clients directly.

---

## 5. Tables Deliberately NOT Added

| Candidate | Verdict | Rationale |
|---|---|---|
| `user_registration_requests` | **Not needed** | `servants.approval_status='pending'` already represents the pre-approval state (canonical role model). A separate table duplicates `servants` and splits approval state across two stores. |
| `approval_history` | **Not needed** | `audit_logs` is append-only, RLS-protected, and already records every `approve`/`reject` with old/new values and timestamps. A parallel history table would be redundant. |
| `onboarding_status` | **Not needed** | Fully derivable: `servants.approval_status` + presence of `user_roles` + `church_requests.status` (new-church path). Adding a table invites drift. |

---

## 6. Schema Alterations to Existing Tables

### 6.1 `notifications.church_id` → NULLABLE (optional but recommended)

- **Why:** platform-owner recipients have `church_id = NULL` (no church). Sending the optional "new church request" alert (§8.2 of `CHURCH_PROVISIONING_SPEC.md`) or future system announcements requires a NULL church_id.
- **Precedent:** `audit_logs.church_id` is already nullable.
- **RLS impact:** existing policies still hold — `recipient_scope` (own rows) is role-independent; `tenant_isolation` (`church_id = get_user_church_id()`) simply contributes `NULL` (falsy) for PO rows, which is fine because `recipient_scope` grants access.
- **Risk:** low; one-line `ALTER TABLE notifications ALTER COLUMN church_id DROP NOT NULL;`. Keep the FK.

**Pre-migration verification (A9):** migration `018` left a column `old_metadata jsonb` (renamed from `metadata`, never dropped) that is undocumented in `CANONICAL_DATABASE_SPEC.md` and absent from the stale `database.types.ts`. Confirm its presence on the live DB before the batch. `send_notification`'s INSERT must reference `data` only and never `old_metadata`. Regenerating `database.types.ts` (task 1.14) reconciles the stale type set (it still lists 021-dropped functions).

### 6.2 `profiles.own_profile_insert` policy hardening (recommended)

Add `WITH CHECK (id = auth.uid() AND EXISTS (SELECT 1 FROM churches c WHERE c.id = church_id AND c.is_active AND c.deleted_at IS NULL))` so a self-inserted profile cannot claim an arbitrary/nonexistent church. (Primary path uses the admin client; this is defense in depth.)

### 6.3 `user_roles` write discipline

All role changes (approval grant, provisioning, `assignRoles`) must **insert new rows / set `end_date`** — never delete history. This aligns with the canonical temporal model and fixes the existing `assignRoles` delete behavior (see `REGISTRATION_RBAC_IMPACT.md` §3).

**Temporal re-grant strategy (A3) — CHOSEN: reactivation-first.**

When re-approval targets a previously archived grant, the RPC **reactivates the historical row**:

```sql
UPDATE user_roles SET end_date = NULL
  WHERE church_id = p_church_id AND user_id = p_servant_id
    AND role_id = role AND end_date IS NOT NULL;
```

and only inserts a new row if no historical row was reactivated. Rationale:

- The existing **non-partial** `UNIQUE (church_id, user_id, role_id)` (migration 001) makes archive-and-insert illegal while an archived row still exists — a fresh INSERT would collide. Reactivation avoids that trap entirely.
- Reactivation preserves grant continuity (original `assigned_by` / `start_date`); the re-approval event itself is recorded in `audit_logs`.
- This is applied in both `approve_servant` (§4.4) and the rewritten `assignRoles` helper (P0.2).

**Supporting DDL (P0.2 batch):** replace the non-partial `UNIQUE (church_id, user_id, role_id)` constraint with a **partial unique index**:

```sql
CREATE UNIQUE INDEX uq_user_roles_active ON user_roles (church_id, user_id, role_id)
  WHERE end_date IS NULL;
```

This makes the temporal model fully canonical: only *active* grants are unique, so reassignment (archive-and-insert) and re-approval can never collide with an archived row. The old constraint is dropped.

The constraint to drop is **`user_roles_church_id_user_id_role_id_key`** (auto-generated from the inline `UNIQUE` in migration 001:278). **A10 (decision): `idx_user_roles_user_active` (020) is RETAINED** — it is redundant with `uq_user_roles_active` for uniqueness but preserves the user→role join path used by scope lookups; dropping it is optional cleanup, not required by 3C.

---

## 7. New RLS Policies (Δ vs `022`)

| Table | Policy | Operation | Rule |
|---|---|---|---|
| `church_requests` | `platform_owner_all` | ALL | `user_is_platform_owner()` |
| `church_requests` | `applicant_read` | SELECT | `email = auth.jwt()->>'email'` (own request visibility) |
| `church_requests` | `public_insert` | INSERT | `true` with CHECK `status = 'pending'` (public submission) |
| `church_requests` | `immutable_review` | UPDATE | **PERMISSIVE deny** — `USING (false) WITH CHECK (false)`; **NOT `AS RESTRICTIVE`** |
| `church_requests` | `immutable_delete` | DELETE | **PERMISSIVE deny** — `USING (false)` |

**Policy semantics (A2):** `immutable_review` / `immutable_delete` are **permissive** deny policies. RLS ORs permissive policies, so the platform owner's `platform_owner_all` (the only legitimate UPDATE/DELETE writer) still passes while every other role is denied. They must **not** be created `AS RESTRICTIVE` — a restrictive deny is ANDed and would block the platform owner's own `platform_owner_all` UPDATE, locking the review queue. For UPDATE, `WITH CHECK (false)` is required so the *new* row value is also rejected (a spoofed `status='approved'` via `UPDATE … SET`), not just the old row.

`churches` needs **no** new public read policy — the projection-limited RPC (§4.1) is the public surface.

---

## 8. Audit Logging Summary (approval trail)

| Action | entity_type | old_values | new_values |
|---|---|---|---|
| Registration submitted | `servant` | — | `{approval_status:'pending'}` |
| Approve (existing church) | `servant` | `{approval_status:'pending'}` | `{approval_status:'approved', role_id}` |
| Reject (existing church) | `servant` | `{approval_status:'pending'}` | `{approval_status:'rejected'}` |
| Church request submitted | `church_request` | — | `{status:'pending'}` |
| Approve (new church) | `church_request` | `{status:'pending'}` | `{status:'approved', church_id}` |
| Reject (new church) | `church_request` | `{status:'pending'}` | `{status:'rejected'}` |
| Church created | `church` | — | `{name_ar, slug, subscription_tier}` |

Immutability: `audit_logs` has `immutable_update` / `immutable_delete` deny policies (`022`).

### 8.1 Audit subsystem restoration (A4) — REQUIRED in the 3C migration batch

**Root cause (corrected):** migration `019` runs `DROP TYPE IF EXISTS audit_action CASCADE`. `audit_trigger_fn` (migration `001`) declares `v_action audit_action`, so CASCADE **drops the function and all five dependent triggers** (`audit_children`, `audit_attendance`, `audit_profiles`, `audit_user_roles`, `audit_followups`). Migration `019` only recreates `write_audit_log()` — it **never** recreates `audit_trigger_fn` or the triggers. Net effect today: a **silent audit gap** (DML succeeds, but no audit rows are written for those tables) — not an error path. Additionally, migration `015` renamed `attendance` → `attendance_backup_20260730`, so the old `audit_attendance` trigger now sits on the dead backup table.

**Restoration plan (P0.3):**
1. Recreate `audit_trigger_fn()` with:
   - `actor_id` (not the pre-019 `user_id` column);
   - `action` as **TEXT** (no `audit_action` enum — it was dropped);
   - INSERT `(church_id, actor_id, action, entity_type, entity_id, old_values, new_values)`;
   - `entity_type := TG_TABLE_NAME`, `entity_id := COALESCE(NEW.id, OLD.id)` (satisfies the `entity_id NOT NULL` constraint from 019).
2. Recreate triggers (`AFTER INSERT OR UPDATE OR DELETE`, `FOR EACH ROW`):
   - `audit_profiles` → `profiles`
   - `audit_user_roles` → `user_roles`
   - `audit_followups` → `followups`
   - `audit_attendance_sessions` → `attendance_sessions` (new — replaces the dead `audit_attendance`)
   - `audit_attendance_records` → `attendance_records` (new)
   - `audit_beneficiaries` → `beneficiaries` (new)
   - `DROP TRIGGER IF EXISTS audit_attendance ON attendance_backup_20260730` (dead trigger on the renamed backup table).

   > **M-2 (corrected):** the pre-019 trigger list referenced `audit_children → children`, but migration `013:12` renamed
   > `children` → `beneficiaries` and the table was never recreated — that reference would fail at migration time.
   > The trigger is **omitted** here: beneficiary coverage is provided by the new `audit_beneficiaries`. Legacy audit
   > rows written before 013 retain `entity_type = 'children'` and are unaffected.
3. Verification SQL (scratch project before migration; live DB after migration):
```sql
-- (a) function exists and targets actor_id
SELECT pg_get_functiondef('audit_trigger_fn()'::regprocedure) LIKE '%actor_id%' AS uses_actor_id;

-- (b) expected triggers present
SELECT c.relname, t.tgname
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE t.tgname LIKE 'audit\_%' AND NOT t.tgisinternal
ORDER BY c.relname;

-- (c) smoke test: DML on each audited table then assert audit rows appear
--     e.g. for beneficiaries: INSERT / UPDATE / DELETE a test row, then
SELECT COUNT(*) >= 3 FROM audit_logs
WHERE entity_type = 'beneficiaries' AND action IN ('create','update','delete');
```
4. The RPCs write audit rows explicitly and remain the trusted path; the triggers are defense-in-depth for DML performed outside the RPCs.

---

## 9. Index Impact Summary

| Object | Change |
|---|---|
| `church_requests` | 3 indexes (new) |
| `churches` | no change (`slug` UNIQUE reused) |
| `servants` | no change (`idx_servants_church_approval` reused) |
| `user_roles` | `idx_user_roles_user_active` retained (A10); `uq_user_roles_active` replaces the UNIQUE constraint's backing index |
| `notifications` | no change (existing indexes; FK becomes nullable) |

---

## 10. Estimated Migration Surface

1. `CREATE TABLE church_requests` (+ indexes, constraints)
2. `ALTER TABLE notifications ALTER COLUMN church_id DROP NOT NULL` (optional)
3. RPCs: `list_churches_for_signup`, `get_my_access_state`, `submit_church_request`, `approve_servant`, `reject_servant`, `approve_church_request`, `reject_church_request`, `send_notification`
4. `church_requests` RLS policies (incl. **permissive-deny** `immutable_review`/`immutable_delete` — A2)
5. **Policy replacements (security remediation — no other existing policy is modified):**
   - `user_roles.tenant_isolation` → SELECT-only (C-1)
   - `servants.tenant_isolation` → SELECT-only (C-2)
   - `notifications.tenant_isolation` → SELECT-only (C-3, recommended)
6. `profiles.own_profile_insert` policy replacement (hardening)
7. **Audit subsystem restoration (A4):** recreate `audit_trigger_fn` (actor_id, TEXT action) + **6 triggers** (`profiles`, `user_roles`, `followups`, `attendance_sessions`, `attendance_records`, `beneficiaries`); drop dead `audit_attendance` on `attendance_backup_20260730` (M-2: `audit_children` is omitted — `children` was renamed to `beneficiaries` in 013)
8. **Temporal re-grant support (A3, P0.2 batch):** replace non-partial `UNIQUE (church_id, user_id, role_id)` with partial unique index `ON user_roles (church_id, user_id, role_id) WHERE end_date IS NULL`
9. Regenerate `src/types/database.types.ts`

All other changes are additive (new table, new RPCs, new policies, one nullable column). Rollback = drop RPCs + table, revert column, restore the three policy definitions, drop the recreated audit triggers, restore the UNIQUE constraint.
