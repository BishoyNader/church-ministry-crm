# Phase 3C Security Remediation

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Status:** Specification amendment — approved for implementation
**Companion docs:** `REGISTRATION_DATABASE_CHANGES.md` (A1–A4), `REGISTRATION_RBAC_IMPACT.md` (§4–§5), `SPEC_CHANGE_LOG.md`, `IMPLEMENTATION_READINESS_VERDICT.md`

---

## 1. Executive Summary

Phase 3C.1 architecture validation found **two blocking RLS vulnerabilities and one hardening gap** that the original specifications had incorrectly concluded were absent. All three are pre-existing in migrations 001–022, but they become exploitable the moment 3C replaces today's "every signup becomes `super_admin`" flow with pending-user signups:

- **C-1 (CRITICAL):** self-escalation to `super_admin` via a direct `user_roles` INSERT.
- **C-2 (HIGH):** self-approval / arbitrary same-church servant-row mutation via a direct `servants` UPDATE.
- **C-3 (MEDIUM):** same-church cross-recipient notification INSERT (spoofing).

In addition, the audit-trigger subsystem was found to be **silently absent** (dropped by migration 019's `DROP TYPE audit_action CASCADE`), not merely "at risk" — a silent audit gap (A4).

This document defines the exact policy replacements, the audit restoration plan, attack-path examples, and the regression matrix. After remediation, all approval criteria in `IMPLEMENTATION_READINESS_VERDICT.md` are satisfied and the phase is **APPROVED_FOR_MIGRATION_GENERATION** (see `PHASE_3C_DATABASE_IMPLEMENTATION_GATE.md` re-gate).

---

## 2. Findings

### 2.1 C-1 — `user_roles` self-escalation to `super_admin` (CRITICAL)

**Where:** `user_roles.tenant_isolation`

```sql
CREATE POLICY tenant_isolation ON user_roles
  FOR ALL USING (church_id = get_user_church_id());
```

(migration `022_rls_implementation.sql`; mirrored in `CANONICAL_RLS_SPEC.md` §2.19)

**Why it becomes exploitable under 3C:** a pending user has a `profiles` row with a real `church_id` (3C design), so `get_user_church_id()` returns their church. RLS ORs permissive policies; for INSERT, `tenant_isolation`'s `USING` acts as the `WITH CHECK` for the new row. No policy or constraint checks `user_id` or `role_id`.

**Attack path:**
```sql
-- (1) Discover the church's super_admin role id.
--     roles.read_all (022) lets any same-church user SELECT roles.
SELECT r.id FROM roles r
WHERE r.church_id = <attacker's church> AND r.role_type = 'super_admin';

-- (2) Grant it to yourself — pending user OR plain servant.
INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)
VALUES (<attacker's church>, auth.uid(), <super_admin role id>, auth.uid(), CURRENT_DATE);
-- passes tenant_isolation (church_id = own church); no RPC guard, no audit.
```

**Result:** full church takeover — every canonical permission (`servants.approve`, `servants.assign`, `tenants.*`, all writes) becomes available, bypassing the 3C approval workflow.

**Why masked today:** the current `signUpWithEmail` already grants every new user `super_admin`, so the write hole is indistinguishable from intended behavior. 3C removes that backdoor; the hole must be closed in the same release or it becomes the new escalation vector.

### 2.2 C-2 — `servants` self-approval / cross-user mutation (HIGH)

**Where:** `servants.tenant_isolation`

```sql
CREATE POLICY tenant_isolation ON servants
  FOR ALL USING (church_id = get_user_church_id());
```

(migration `022`)

**Attack paths:**
```sql
-- (a) Self-approval: flip your own status.
UPDATE servants SET approval_status = 'approved'
WHERE id = auth.uid();
-- passes tenant_isolation (same church); bypasses approve_servant RPC + audit.

-- (b) Mutate any other pending user's row in the same church.
UPDATE servants SET approval_status = 'rejected'
WHERE church_id = get_user_church_id() AND id <> auth.uid();
```

Combined with C-1: self-approve → self-assign `super_admin` → complete bypass of the 3C approval workflow with no audit trail.

### 2.3 C-3 — Notification write bypass (MEDIUM)

**Where:** `notifications.tenant_isolation`

```sql
CREATE POLICY tenant_isolation ON notifications
  FOR ALL USING (church_id = get_user_church_id());
```

(migration `022`)

**Attack path:**
```sql
INSERT INTO notifications (church_id, recipient_id, notification_type,
                           title_ar, title_en, body_ar, channel, sent_at)
VALUES (get_user_church_id(), <any same-church user>,
        'system', '…', '…', '…', 'in_app', now());
```

`recipient_scope` only authorizes rows where the recipient is self; `tenant_isolation` (FOR ALL) authorizes the INSERT for any same-church row regardless of recipient. Impact: notification spoofing/phishing within the church. Not privilege escalation, hence MEDIUM.

---

## 3. Required Policy Changes

Only the three `tenant_isolation` policies below plus the already-planned `profiles.own_profile_insert` replacement are modified. **No other existing policy is changed** — all remaining migration work is additive (new table, new RPCs, new policies, one nullable column).

| Table | Policy | Before | After | Effect |
|---|---|---|---|---|
| `user_roles` | `tenant_isolation` | `FOR ALL USING (church_id = get_user_church_id())` | `FOR SELECT USING (church_id = get_user_church_id())` | Same-church users can read role grants; INSERT/UPDATE/DELETE removed (C-1) |
| `servants` | `tenant_isolation` | `FOR ALL USING (church_id = get_user_church_id())` | `FOR SELECT USING (church_id = get_user_church_id())` | Same-church reads preserved (incl. own pending row via existing `admin_read`); writes restricted to `super_admin_all` + RPCs (C-2) |
| `notifications` | `tenant_isolation` | `FOR ALL USING (church_id = get_user_church_id())` | `FOR SELECT USING (church_id = get_user_church_id())` | Own-row access fully covered by `recipient_scope`; cross-recipient inserts impossible (C-3) |

### 3.1 Resulting write paths

| Table | Allowed writers |
|---|---|
| `user_roles` | `super_admin_all` (same-church super_admin via app), SECURITY DEFINER RPCs (`approve_servant`, `approve_church_request`, temporal helper), service-role admin client |
| `servants` | `super_admin_all`, SECURITY DEFINER RPCs (`approve_servant` / `reject_servant`), service-role admin client |
| `notifications` | `send_notification` (SECURITY DEFINER), service-role admin client |

### 3.2 Invariant restated

Within the **3C-controlled surface** (the rows and tables 3C introduces or explicitly closes), a pending user's RLS surface is exactly: own `profiles` row (read + update), own `servants` row (read via `admin_read`), own `notifications` (read via `recipient_scope`), own `church_requests` rows (read via `applicant_read`) — and **nothing** that grants roles, approves servants, or writes notifications. Every write in the 3C flow passes through a SECURITY DEFINER RPC with explicit `auth.uid()` guards **or the service-role admin client** (used for signup-time `profiles`/`servants` creation in `register_existing_church_user`, which runs with RLS bypass). Approval transitions remain RPC-only. (A7)

**Scope boundary (A6):** this invariant covers the 3C-controlled surface only. It does **not** claim blanket zero-trust: migration 022's `tenant_isolation` policies on operational tables are church-scoped, not role-gated, so a pending user retains same-church SELECT and DML on those tables. That pre-existing posture is **accepted residual risk** — unchanged by 3C, documented in §3.3, and deliberately excluded from the remediation's guarantee.

### 3.3 Accepted residual risk — church-scoped operational access for pending users (A6)

**Decision (2026-07-31):** accept and document. **Do not** scope-expand the remediation.

- Pending users are role-less, so **permission resolution is empty** (no `user_roles`, no assignment scopes) — every role-gated RPC and every role-derived policy returns 0 rows for them.
- However, migration 022's `tenant_isolation` is `FOR ALL USING (church_id = get_user_church_id())` on ~18 operational tables and is **church-scoped, not role-gated**. Because a pending user has a real `church_id`, they pass it for SELECT and DML (INSERT/UPDATE/DELETE) on services, stages, classes, beneficiaries, beneficiary_assignments, servant_stage_assignments, attendance_sessions, attendance_records, followups, spiritual_journal_entries, events, event_registrations, documents, ai_conversations, ai_messages, document_embeddings, roles, role_permissions — and can read `profiles`/`audit_logs`/`churches`/`user_roles`/`servants`. Notably they could **delete the church's `super_admin` role row** (CASCADE-revoking all grants) or write beneficiary/attendance/followup/event/document data.
- **Why accepted:** role-gating every operational policy (or adding a deny-for-role-less policy on the `deny_admin_spiritual` precedent) is a broad, orthogonal RLS redesign far larger than 3C's scoped surface of "close the write paths + additive work". It is tracked as a separate security item and is **explicitly out of scope** for the 3C migration batch.
- **Consequence:** the regression matrix asserts role-gated surfaces return 0 rows (R-8) and the three closed write surfaces are denied (R-1…R-5, R-9, R-8A). It does **not** assert blanket 0 rows on the operational tables above.

---

## 4. Audit Trigger Restoration Plan (A4)

**Root cause:** migration `019` runs `DROP TYPE IF EXISTS audit_action CASCADE`. `audit_trigger_fn` (migration `001`) declares `v_action audit_action`, so CASCADE drops the function and all five dependent triggers (`audit_children`, `audit_attendance`, `audit_profiles`, `audit_user_roles`, `audit_followups`). Migration `019` only recreates `write_audit_log()`; it never recreates `audit_trigger_fn` or the triggers. Net effect today: **silent audit gap**. Migration `015` also renamed `attendance` → `attendance_backup_20260730`, leaving the old `audit_attendance` trigger on a dead backup table.

**Restoration steps (P0.3, part of the 3C migration batch):**

1. **Recreate `audit_trigger_fn()`** — `actor_id` (not `user_id`), `action TEXT` (no enum), `entity_type := TG_TABLE_NAME`, `entity_id := COALESCE(NEW.id, OLD.id)` (satisfies `entity_id NOT NULL`, 019):
```sql
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_church_id uuid;
  v_action text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create'; v_new := to_jsonb(NEW); v_church_id := NEW.church_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update'; v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_church_id := NEW.church_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete'; v_old := to_jsonb(OLD); v_church_id := OLD.church_id;
  END IF;

  INSERT INTO audit_logs (church_id, actor_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (v_church_id, auth.uid(), v_action, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

2. **Recreate triggers** (`AFTER INSERT OR UPDATE OR DELETE`, `FOR EACH ROW`):
   - `audit_profiles` → `profiles`
   - `audit_user_roles` → `user_roles`
   - `audit_followups` → `followups`
   - `audit_attendance_sessions` → `attendance_sessions` (new)
   - `audit_attendance_records` → `attendance_records` (new)
   - `audit_beneficiaries` → `beneficiaries` (new)
   - `DROP TRIGGER IF EXISTS audit_attendance ON attendance_backup_20260730;`

   > **M-2 (corrected):** the pre-019 trigger list referenced `audit_children → children`, but migration `013:12`
   > renamed `children` → `beneficiaries` and the table was never recreated. The trigger is **omitted** — beneficiary
   > coverage is provided by `audit_beneficiaries`. Legacy audit rows pre-013 retain `entity_type = 'children'`.

3. **Verification SQL** (scratch project before migration; live DB after migration):
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

4. The RPCs write audit rows explicitly and remain the trusted path; the restored triggers are defense-in-depth for DML performed outside the RPCs.

---

## 5. Regression Test Matrix

All tests run against a scratch Supabase project with a seed church, using real RLS-enforcing sessions (no service role).

| ID | Test | Method | Expected | Guards |
|---|---|---|---|---|
| R-1 | Pending user self-assigns role | `INSERT INTO user_roles` as pending user | **DENIED** (0 rows) | C-1 — self-escalation closed |
| R-2 | Servant self-assigns `super_admin` | same INSERT as an approved servant | **DENIED** (0 rows) | C-1 |
| R-3 | Pending user self-approves | `UPDATE servants SET approval_status='approved' WHERE id=auth.uid()` | **DENIED** (0 rows) | C-2 — self-approval closed |
| R-4 | Pending user mutates another same-church servant | direct UPDATE on `id <> auth.uid()` | **DENIED** (0 rows) | C-2 |
| R-5 | Cross-church approval | super_admin of A calls `approve_servant` on B's servant (RPC + direct UPDATE) | **RPC rejects / UPDATE denied** | No cross-church approval |
| R-6 | Legit approval flow | super_admin calls `approve_servant` (RPC) | Succeeds; servant role granted; audit row `action='approve'` | Approval workflow intact |
| R-7 | Pending user reads own servant row | `SELECT` own `servants` row | 1 row (via `admin_read`) | `/pending-approval` UX intact |
| R-8 | Pending user zero-permission sweep | `SELECT` across **role-gated** surfaces: `user_roles` (any role rows), RPC permission checks, assignment-scoped reads | **0 rows / DENIED** | No role-gated access for pending users (A6) |
| R-8A | Pending user closed write surfaces | direct INSERT/UPDATE/DELETE on `user_roles`, `servants`, `notifications` | **DENIED** (0 rows) | C-1/C-2/C-3 |
| R-9 | Notification spoof | INSERT notification for another same-church recipient | **DENIED** (0 rows) | C-3 |
| R-10 | `send_notification` works | invoke SECURITY DEFINER helper for PO + super_admin recipients | Succeeds; `church_id` NULL allowed for PO | Notification integration + nullable column |
| R-11 | Applicant cannot mutate request | UPDATE/DELETE own `church_requests` row | **DENIED** (permissive deny) | A2 |
| R-12 | PO updates request | PO UPDATE via `platform_owner_all` | Succeeds (permissive deny must NOT block PO) | A2 |
| R-13 | Re-approval after demotion | approve → archive (`end_date`) → re-approve | Historical row reactivated; exactly one active grant; no silent no-op | A3 |
| R-14 | Audit trigger smoke tests | DML on beneficiaries/profiles/user_roles/followups/attendance_sessions/attendance_records | `audit_logs` rows appear for create/update/delete | A4 (M-2: `children` → `beneficiaries`) |
| R-15 | Audit log immutability | UPDATE / DELETE on `audit_logs` | **DENIED** (`immutable_update`/`immutable_delete`) | Audit integrity |

---

## 6. Final Security Posture After Remediation

- **Pending users:** zero role rows (empty permission resolution); 3C write surfaces (role grants, servant approval, notifications) closed; retain the pre-existing church-scoped operational read/DML posture as **accepted residual risk** (§3.3).
- **Role grants:** `super_admin` → PO-only (provisioning RPC); `servant` → same-church super_admin (approve RPC). Both audited.
- **Servant writes:** approval transitions via `approve_servant` / `reject_servant` RPCs only; no client UPDATE path.
- **Notification writes:** `send_notification` (SECURITY DEFINER) chokepoint only; `church_id` nullable for PO recipients.
- **Audit:** RPCs write explicitly (trusted path) + restored triggers (defense-in-depth) + immutable log policies.
- **Temporal roles:** reactivation-first re-approval (A3) + partial unique index on active grants.
- **Church isolation:** unchanged and verified — cross-church reads/writes denied at both RLS and RPC layers.

**Accepted residual risks (non-blocking):**
- **Pending users retain same-church church-scoped operational access** (022 `tenant_isolation` FOR ALL on ~18 tables, incl. role-row deletion) — **accepted and documented (A6, §3.3)**; role-gated surfaces and the three 3C write surfaces are still closed; tracked for a dedicated RLS role-gating pass.
- Same-church SELECT of `roles` / role grants remains read-only — consistent with the canonical RLS spec (§2.18/§2.19).
- `platform_owner_all` on `church_requests` lets the PO update rows directly; the RPC is the audited path (PO trust model).
- Public `submit_church_request` is rate-limited and manually reviewed (deployment item).
