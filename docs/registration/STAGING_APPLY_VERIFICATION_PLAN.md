# Phase 3C.2A.5 — Staging Apply Verification Plan

**Purpose:** prove migration 023 produced exactly the intended state on staging. Executes immediately after apply (Step 5 of the checklist); each block returns a boolean verdict that must be **true** for the overall gate to pass.

**Alignment:** V1–V4 = migration's embedded VERIFICATION block (`023:878–919`), executed **after** the batch commits. V5 = security regression. V6 = workflow smoke. V0 = atomicity check from the checklist.

**Amendments vs the migration's embedded assertions:**
- V3 lists **9** expected `pg_proc` rows: the migration's block lists 8 client RPCs only; add `audit_trigger_fn` (redefined by S9, `is_immutable` semantics unchanged — `CREATE OR REPLACE`).
- V4 asserts **exactly 6** audit triggers **after** checklist Step 3 (`audit_children` stray dropped). If Step 3 was skipped, expect 7.

---

## V0 — Atomicity / batch success (immediate)

```sql
SELECT to_regclass('public.church_requests') IS NOT NULL AS applied_ok;
```
**Expect:** `t`. `f` ⇒ whole batch rolled back; go to rollback path (do not re-apply blind).

---

## V1 — Schema (tables, columns, indexes)

```sql
-- (1) 3 tables created
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
  AND c.relname IN ('church_requests','servant_approvals','servant_rejections');
-- EXPECT: 3

-- (2) notifications.church_id now NULLABLE
SELECT is_nullable FROM information_schema.columns
WHERE table_name='notifications' AND column_name='church_id';
-- EXPECT: YES

-- (3) 3 indexes on church_requests
SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='church_requests';
-- EXPECT: 3 (pk_church_requests, idx_church_requests_status, idx_church_requests_created_by)
```

---

## V2 — Policies

```sql
-- (1) Exactly 5 policies on church_requests
SELECT policyname, cmd, permissive FROM pg_policies
WHERE schemaname='public' AND tablename='church_requests' ORDER BY policyname;
-- EXPECT: applicant_read|SELECT|P ; immutable_delete|DELETE|P ;
--   immutable_review|UPDATE|P ; platform_owner_all|ALL|P ; public_insert|INSERT|P

-- (2) tenant_isolation now SELECT-only on the 3 existing tables (C-1/C-2/C-3)
SELECT count(*) FROM pg_policies
WHERE schemaname='public' AND policyname='tenant_isolation' AND cmd='SELECT'
  AND tablename IN ('user_roles','servants','notifications');
-- EXPECT: 3

-- (3) profiles.own_profile_insert carries the church_requests EXISTS guard
SELECT pg_get_expr(qual, oid) IS NOT NULL FROM pg_policies
WHERE schemaname='public' AND tablename='profiles' AND policyname='own_profile_insert';
-- EXPECT: t
```

---

## V3 — Functions & privileges

```sql
-- (1) 9 functions present
SELECT count(*) FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace
WHERE n.nspname='public' AND proname IN
  ('audit_trigger_fn','send_notification','list_churches_for_signup','get_my_access_state',
   'submit_church_request','approve_servant','reject_servant','approve_church_request',
   'reject_church_request');
-- EXPECT: 9

-- (2) send_notification EXECUTE revoked from PUBLIC + the 3 roles
SELECT count(*) FROM (
  SELECT grantee FROM information_schema.routine_privileges
  WHERE routine_name='send_notification' AND privilege_type='EXECUTE'
    AND grantee IN ('PUBLIC','anon','authenticated','service_role')
) x;
-- EXPECT: 0

-- (3) submit_church_request + list_churches_for_signup: anon AND authenticated
SELECT count(*) FROM information_schema.routine_privileges
WHERE routine_name IN ('submit_church_request','list_churches_for_signup')
  AND grantee IN ('anon','authenticated') AND privilege_type='EXECUTE';
-- EXPECT: 4

-- (4) get_my_access_state: authenticated ONLY (no anon)
SELECT count(*) FROM information_schema.routine_privileges
WHERE routine_name='get_my_access_state' AND grantee='anon' AND privilege_type='EXECUTE';
-- EXPECT: 0

-- (5) 4 approval RPCs: authenticated + service_role (no anon)
SELECT count(*) FROM information_schema.routine_privileges
WHERE routine_name IN ('approve_servant','reject_servant','approve_church_request','reject_church_request')
  AND grantee='anon' AND privilege_type='EXECUTE';
-- EXPECT: 0

-- (6) user_roles: partial unique uq_user_roles_active exists
SELECT to_regclass('public.uq_user_roles_active');
-- EXPECT: uq_user_roles_active

-- (7) user_roles: old UNIQUE constraint dropped
SELECT count(*) FROM pg_constraint
WHERE conrelid='user_roles'::regclass AND contype='u'
  AND conname='user_roles_church_id_user_id_role_id_key';
-- EXPECT: 0

-- (8) audit_logs immutability preserved
SELECT count(*) FROM pg_policies
WHERE schemaname='public' AND tablename='audit_logs'
  AND policyname IN ('immutable_update','immutable_delete');
-- EXPECT: 2
```

---

## V4 — Audit continuity (amended pass criteria)

```sql
-- (1) Exactly 6 non-internal audit triggers AFTER Step 3 drop
SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
WHERE t.tgname LIKE 'audit\_%' AND NOT t.tgisinternal ORDER BY c.relname;
-- EXPECT (post-apply, Step 3 ran): exactly
--   attendance_records  audit_attendance_records
--   attendance_sessions audit_attendance_sessions
--   beneficiaries       audit_beneficiaries
--   followups           audit_followups
--   profiles            audit_profiles
--   user_roles          audit_user_roles
--   audit_attendance ABSENT (dropped by 023:237); audit_children ABSENT (Step 3).
-- IF STEP 3 SKIPPED: expect 7 — the stray audit_children(beneficiaries) row persists
--   (023 drops audit_attendance but NOT audit_children) → duplicate audits on beneficiaries.

-- (2) audit_trigger_fn now refers to actor_id, not user_id
SELECT prosrc FROM pg_proc WHERE proname='audit_trigger_fn';
-- EXPECT: contains 'actor_id' and NOT 'user_id'
-- (S9 redefinition removes the audit_action dependency; type "audit_action" error must be gone)

-- (3) RUNTIME WRITE TEST — proves the repair (fails pre-apply, passes post-apply)
-- SAFE: fires the trigger on a temp table (no FK/heavy-DML side effects), fully rolled back.
-- Pre-apply this block throws 'type "audit_action" does not exist' — that error MUST be gone.
BEGIN;
CREATE TEMP TABLE _v4_probe (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), church_id uuid);
CREATE TRIGGER _v4_probe_trg AFTER INSERT OR UPDATE OR DELETE ON _v4_probe
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
INSERT INTO _v4_probe (church_id) VALUES (NULL);
DELETE FROM _v4_probe;
SELECT count(*) >= 2 AS wrote_audit_rows FROM audit_logs WHERE entity_type='_v4_probe';
ROLLBACK;
-- EXPECT: wrote_audit_rows = t and NO error (insert + delete = >= 2 rows).

-- (4) audit_logs immutability holds under the new writer (uses actor_id, no user_id)
SELECT to_regtype('public.audit_action') IS NULL AS type_dropped; -- t (019 baseline)
```

---

## V5 — Security regression (real sessions)

Execute `PHASE_3C_STAGING_TEST_MATRIX.md` §4 SE-01…SE-15 (R-1…R-16). Every DENIED expectation must return a denial (0 rows / RLS violation), never an error that leaks data. Never use the service-role key for negative cases.

| Test | Expectation |
|---|---|
| SE-01 self-escalation | DENIED |
| SE-02/SE-03/SE-04 self-approval (servant + church) | DENIED |
| SE-05 cross-church | DENIED |
| SE-06/SE-07 notification spoof | DENIED |
| SE-09 own-profile insert | authenticated DENIED, service-role OK (SE-09a) |
| SE-10/SE-11 request immutability | DENIED |
| SE-13 PO-only gates | non-PO DENIED |
| SE-14 signup listing | own church only |

**Pass:** 0 failures. **Any failure ⇒ rollback.**

---

## V6 — Workflow smoke (test matrix)

| Flow | Test IDs | Expectation |
|---|---|---|
| Existing church | EC-01, EC-02, EC-03 (+02a/03a idempotency) | approve ⇒ grant + audit + notification; reject ⇒ no grant; idempotent re-call |
| New church | NC-01, NC-02, NC-03 (+NC-02a/02b atomicity) | atomic provisioning; negative cases create nothing |
| Pending-approval routing | EC-01c/02c, EC-03b | `/pending-approval` vs `/dashboard` via `get_my_access_state` |

**Pass:** all primary + negative cases green. **Any primary-case failure ⇒ rollback.** Negative-case failure (e.g., NC-02a created rows) is also rollback-triggering per RC-7.

---

## 5. Success criteria summary

| ID | Criterion | Verdict |
|---|---|---|
| V0 | `church_requests` exists immediately post-apply | t |
| V1 | 3 tables, `church_id` nullable, 3 indexes | t |
| V2 | 5 policies exact, tenant_isolation SELECT-only on 3 tables, own_profile guard present | t |
| V3 | 9 functions, privilege matrix exact, `uq_user_roles_active` in / old UNIQUE out, audit immutability | t |
| V4 | 6 triggers, `actor_id` function, runtime write test error-free with >=2 audit rows | t |
| V5 | All SE/R tests pass | t |
| V6 | All EC/NC/SE flows pass | t |

**Overall:** `STAGING_VERIFIED` iff every row is `t`. Otherwise follow `STAGING_APPLY_ROLLBACK_CONFIRMATION.md`.
