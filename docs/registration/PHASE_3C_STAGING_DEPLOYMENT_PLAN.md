# Phase 3C.3 — Staging Deployment Plan

**Phase:** 3C — Registration & Church Provisioning
**Stage:** 3C.3 — Staging Deployment Readiness Review
**Date:** 2026-08-01
**Target:** `supabase/migrations/023_phase3c_registration.sql` → staging environment
**Staging Supabase ref:** `dyfgflmrsmzgvpknbesi` (https://dyfgflmrsmzgvpknbesi.supabase.co)
**Vercel project:** `church-ministry-crm-staging` (branch `staging`)
**Companion docs:**
- `PHASE_3C_MIGRATION_AUDIT_REPORT.md` (verdict: **GO**, 0 BLOCKING / 0 HIGH / 0 MEDIUM / 4 LOW / 3 INFO)
- `PHASE_3C_GO_NO_GO_VERDICT.md` (verdict: **GO**, gate: P0.1–P0.7 + scratch V1–V6)
- `PHASE_3C_MIGRATION_EXECUTION_PLAN.md` (S1–S12, D-1…D-8, R1–R5)
- `PHASE_3C_SECURITY_REMEDIATION.md` (C-1/C-2/C-3, A4, R-1…R-16)
- `PHASE_3C_STAGING_TEST_MATRIX.md` (flows + security + audit tests)
- `PHASE_3C_STAGING_ROLLBACK_PLAN.md`
- `PHASE_3C_STAGING_GO_LIVE_GATE.md` (sign-off gate)

---

## 1. Executive Summary

Migration 023 has a **GO** audit verdict with **zero BLOCKING, zero HIGH, zero MEDIUM** findings; the 4 LOW
items (F-001…F-004) are documentation/robustness nits with recorded dispositions and **do not block
execution**. The batch is a **single transaction** (`BEGIN` 023:21 → `COMMIT` 023:875), is **non-destructive**
(zero DML on existing rows), is additive except for four policy replacements and one constraint swap, and has a
documented in-place reverse (R1–R5) plus a primary snapshot-restore rollback.

This plan prepares the **complete staging execution package**:

1. **Staging Risk Review** (task 1) — every risk class in the batch, classified with window + mitigation.
2. **Staging Pre-Flight Checklist** (task 2) — exact checks (migration history, schema version, object
   existence, policy existence, trigger existence, role/permission, backup).
3. **Staging Execution Order** (task 3) — Step 0 (backup) → Step 6 (sign-off gate).
4. Test matrix (task 4) and rollback package (task 5) live in the companion documents.

**Resulting verdict:** `READY_FOR_STAGING_EXECUTION` (subject to §7 conditions).

---

## 2. Deployment Scope

### 2.1 What 023 ships (S1–S12, per the execution plan)

| Step | Object | 023 refs | Type |
|---|---|---|---|
| S1 | `church_requests` table + 3 indexes + `trg_church_requests_updated_at` | 023:29–64 | Additive |
| S2 | `church_requests` RLS + 5 policies | 023:71–97 | Additive |
| S3 | `notifications.church_id` → NULLABLE | 023:108 | Alteration (1 column) |
| S4 | `user_roles.tenant_isolation` → SELECT-only (C-1) | 023:119–121 | **Policy replacement** |
| S5 | `servants.tenant_isolation` → SELECT-only (C-2) | 023:131–133 | **Policy replacement** |
| S6 | `notifications.tenant_isolation` → SELECT-only (C-3) | 023:144–146 | **Policy replacement** |
| S7 | `profiles.own_profile_insert` hardening | 023:158–166 | **Policy replacement** |
| S8 | Drop UNIQUE constraint + `uq_user_roles_active` partial UNIQUE index (A3) | 023:181–185 | Constraint swap |
| S9 | `audit_trigger_fn` recreation + dead-trigger drop (A4) | 023:199–237 | Function recreate |
| S10 | 6 audit triggers (A4) | 023:245–273 | Trigger recreate |
| S11 | 8 SECURITY DEFINER RPCs | 023:291–830 | Additive |
| S12 | RPC privilege lockdown | 023:844–873 | Privilege change |

### 2.2 What 023 does NOT touch

- No DML on existing rows (audit §2.5: full scan confirmed zero).
- No changes to `permissions`/`roles` catalog (permission count stays 52 — plan §4).
- No changes to `idx_user_roles_user_active` (retained, A10/D-7).
- No change to `audit_logs` immutability policies (`immutable_update`/`immutable_delete`, 022:348–349).
- No new tables beyond `church_requests`.

---

## 3. Staging Risk Review (Task 1)

Legend — **Severity:** `CRIT` = must not proceed without mitigation; `HIGH` = gate on pre-flight; `MED` =
monitor / small window; `LOW` = benign, documented. **Window:** where the risk materializes.

### 3.1 Irreversible operations

| ID | Risk | 023 refs | Severity | Window / notes | Mitigation |
|---|---|---|---|---|---|
| IR-1 | `DROP CONSTRAINT user_roles_church_id_user_id_role_id_key` | 023:181 | **MED** | Reverse (re-add) is **blocked if archived+active duplicate grants exist** (R4 precondition). Not a data loss — uniqueness is immediately re-established by `uq_user_roles_active` in the same transaction (023:183). | Pre-flight **P0.4** (zero duplicate active grants) before apply; **RC-2** (duplicate scan) before any in-place rollback. |
| IR-2 | `notifications.church_id DROP NOT NULL` | 023:108 | **MED** | Reverse `SET NOT NULL` is **blocked if any `church_id IS NULL` row exists** (R2 precondition). PO-alert rows written after deploy can create such rows. | Keep FK; document R2 blocker; clear/reassign any NULL rows before rollback. Precedence: `audit_logs.church_id` already nullable. |
| IR-3 | Drop of `tenant_isolation` (×3) + `own_profile_insert` | 023:119, 131, 144, 158 | **LOW** | Fully reversible — exact 022 definitions are known and quoted in R3. | In-place reverse DDL documented (R3). |
| IR-4 | `DROP TRIGGER IF EXISTS audit_attendance ON attendance_backup_20260730` | 023:237 | **LOW** | Dead trigger on a renamed backup table (015); dropped for fidelity only. | None needed — no live impact. |
| IR-5 | `CREATE OR REPLACE FUNCTION audit_trigger_fn` (S9) + 6 triggers (S10) | 023:199–273 | **LOW** | Pre-019 function and triggers were CASCADE-dropped by 019; nothing is being replaced, only restored. Reverse = `DROP FUNCTION` + 6 `DROP TRIGGER` (R5). | Documented; exact-state reverse fidelity noted in R5. |

**No operation in the batch deletes or rewrites existing user data.** The two "hard to reverse" items (IR-1,
IR-2) are *constraint/column* reversions with known blockers and preconditions, not data-loss paths.

### 3.2 Lock-heavy operations

| ID | Risk | 023 refs | Severity | Window | Mitigation |
|---|---|---|---|---|---|
| LC-1 | Every DDL takes **ACCESS EXCLUSIVE (AX)** locks; the whole batch is one transaction, so locks are held for batch duration | entire file | **MED** | AX on `church_requests` (new, no contention), `notifications`, `user_roles`, `servants`, `profiles`. All small tables; catalog ops; expected sub-second. The **S8 index build** is the dominant lock hold. | Apply in a **maintenance window / low-traffic period**; staging has no production load. Do not interleave 023 with concurrent DDL. |
| LC-2 | S8 `CREATE UNIQUE INDEX uq_user_roles_active` — full scan + sort of `user_roles` under AX | 023:183 | **MED** | Only statement that scans existing rows. Table is small (role grants); expect sub-second. | P0.4 guarantees the build succeeds; index is **partial** (`WHERE end_date IS NULL`) so archived rows are skipped. |

### 3.3 Index rebuilds

| ID | Risk | 023 refs | Severity | Window | Mitigation |
|---|---|---|---|---|---|
| IDX-1 | `uq_user_roles_active` unique-index build | 023:183 | **MED** | Rebuild on existing rows (see LC-2). `CREATE UNIQUE INDEX IF NOT EXISTS` — pre-existing state would be skipped, so P0.1 (no prior 023) is mandatory. | P0.1 + P0.4. |
| IDX-2 | 3 new indexes on `church_requests` (empty new table) | 023:49–60 | **LOW** | None — table is empty at creation. | — |
| IDX-3 | Backing index of the dropped UNIQUE constraint auto-drops | 023:181 | **LOW** | Replaced by `uq_user_roles_active` in the same transaction; uniqueness never momentarily lost at COMMIT. | Ordered drop→create inside one transaction. |

### 3.4 Policy replacement windows

| ID | Risk | 023 refs | Severity | Window | Mitigation |
|---|---|---|---|---|---|
| PL-1 | S4–S7: `DROP POLICY` + `CREATE POLICY` | 023:119–121, 131–133, 144–146, 158–166 | **MED** | **No unprotected window:** DROP + CREATE run in one transaction; a failure rolls back to the 022 policies intact. The real exposure is *behavioral*: writes that relied on the removed `FOR ALL` clauses stop working the instant the batch commits. | **P0.5** (no authenticated-client write paths against `user_roles`/`servants`/`notifications` in `src/`) before apply; new write paths (RPCs) ship in the **same** transaction (S11). |
| PL-2 | `profiles.own_profile_insert` becomes fail-closed (D-5) | 023:158–166 | **LOW** | The `EXISTS (churches …)` subquery is evaluated under caller RLS → any authenticated self-insert is denied after commit. Signup path is the service-role admin client (RLS-bypassed) so the primary flow is unaffected (V5/R-16). | Verified by R-16 (self-insert denied, service-role allowed). |

### 3.5 Trigger recreation windows

| ID | Risk | 023 refs | Severity | Window | Mitigation |
|---|---|---|---|---|---|
| TG-1 | S10 recreates 6 `audit_*` triggers | 023:245–273 | **MED** | The 6 triggers do **not exist pre-batch** (dropped by 019's CASCADE), so `DROP TRIGGER IF EXISTS` is a no-op and each `CREATE TRIGGER` only *adds* coverage. There is **no audit-coverage regression window** — the coverage gap is pre-existing and this batch closes it. | Verify immediately post-apply (**V4**) so no DML gap is mistaken for trigger failure. |
| TG-2 | `trg_church_requests_updated_at` on new table | 023:62–64 | **LOW** | New table; no existing rows. | — |

### 3.6 Function replacement risks

| ID | Risk | 023 refs | Severity | Window | Mitigation |
|---|---|---|---|---|---|
| FN-1 | `CREATE OR REPLACE FUNCTION audit_trigger_fn` | 023:199–231 | **LOW** | No existing dependent objects (all CASCADE-dropped by 019). `SECURITY DEFINER` + `SET search_path = public, auth` (D-3). | V4: function-def assertion (`actor_id`, TEXT action). |
| FN-2 | 8 new RPCs (collision-free) | 023:291–830 | **LOW** | All new names; verified against `PHASE_3C_MIGRATION_COLLISION_REPORT.md`. Execution-time deps (`write_audit_log` 019, `seed_church_roles` 021, `user_is_platform_owner`/`user_is_super_admin`/`get_user_church_id` 022) must exist → guaranteed by pre-flight object checks (PF-3). | Pre-flight PF-3; V3. |
| FN-3 | SECURITY DEFINER exposure (privilege escalation via new functions) | 023:291–830 | **MED** | Every definer function is guarded internally (`auth.uid()`, `user_is_platform_owner`, `user_is_super_admin`, `auth.uid() <> p_servant_id`, status idempotency) and all set `search_path`. | V3 privilege assertions + security matrix (SE-01…SE-14). |

### 3.7 Risk register summary

| Class | Worst severity | Count | Gate |
|---|---|---|---|
| Irreversible ops | MED (IR-1, IR-2) | 5 | P0.4 / RC-2 precondition documented |
| Lock-heavy ops | MED (LC-1, LC-2) | 2 | Maintenance window |
| Index rebuilds | MED (IDX-1) | 3 | P0.1 + P0.4 |
| Policy replacements | MED (PL-1) | 2 | P0.5 + same-transaction RPCs |
| Trigger recreations | MED (TG-1) | 2 | V4 immediate verification |
| Function replacement | MED (FN-3) | 3 | V3 + security matrix |
| **Total** | **MED (no HIGH/CRIT)** | **17** | — |

**Conclusion:** no HIGH or CRITICAL deployment risk. All MED items are bounded by pre-flight checks (P0.1–P0.7)
and immediate post-apply verification (V1–V4), all of which are in this plan.

---

## 4. Staging Pre-Flight Checklist (Task 2)

Run **against the staging DB** before Step 2. Every check must PASS; record evidence. Any FAIL → **HALT** (see
§4.8).

### 4.1 Migration history validation

| # | Check | SQL / method | Pass criterion |
|---|---|---|---|
| PF-1 | Migration history table shows 001–022 applied, **no 023** | `SELECT version, name FROM supabase_migrations ORDER BY version DESC LIMIT 5;` | Latest row is `022…`; no row matches `023*` |
| PF-2 | No partial prior 3C batch | `SELECT to_regclass('public.church_requests') IS NULL;` | `t` (P0.1) |
| PF-3 | Migration history is contiguous and clean | `SELECT count(*) FROM supabase_migrations WHERE name NOT LIKE '%backup%';` (reconcile vs 001–022 list) | Count matches expected applied set; no gaps |

### 4.2 Schema version validation

| # | Check | SQL / method | Pass criterion |
|---|---|---|---|
| PF-4 | Dependency tables exist | `SELECT to_regclass('public.churches'), to_regclass('public.profiles'), to_regclass('public.servants'), to_regclass('public.roles'), to_regclass('public.user_roles'), to_regclass('public.notifications'), to_regclass('public.audit_logs'), to_regclass('public.attendance_backup_20260730'), to_regclass('public.followups'), to_regclass('public.attendance_sessions'), to_regclass('public.attendance_records'), to_regclass('public.beneficiaries');` | All non-NULL |
| PF-5 | Dependency functions exist | `SELECT proname FROM pg_proc JOIN pg_namespace n ON n.oid = pronamespace WHERE n.nspname='public' AND proname IN ('handle_updated_at','write_audit_log','seed_church_roles','get_user_church_id','user_is_platform_owner','user_is_super_admin');` | All 6 present |
| PF-6 | `gen_random_uuid` available (pgcrypto) | `SELECT gen_random_uuid() IS NOT NULL;` | `t` |
| PF-7 | `user_roles` UNIQUE constraint present (target of S8 drop) | `SELECT conname FROM pg_constraint WHERE conrelid='user_roles'::regclass AND contype='u';` | contains `user_roles_church_id_user_id_role_id_key` (P0.3) |
| PF-8 | `idx_user_roles_user_active` retained (020) | `SELECT to_regclass('public.idx_user_roles_user_active');` | non-NULL (A10/D-7) |
| PF-9 | `notifications.old_metadata` present (undocumented 018 leftover) | `SELECT count(*) FROM information_schema.columns WHERE table_name='notifications' AND column_name='old_metadata';` | `1` (P0.2 / A9) |
| PF-10 | `notifications.church_id` is currently NOT NULL | `SELECT is_nullable FROM information_schema.columns WHERE table_name='notifications' AND column_name='church_id';` | `NO` (will become `YES` after S3) |

### 4.3 Object existence validation

| # | Check | SQL / method | Pass criterion |
|---|---|---|---|
| PF-11 | No `church_requests` objects of any kind | `SELECT count(*) FROM pg_class WHERE relname LIKE 'church_requests%'; SELECT count(*) FROM pg_trigger WHERE tgname='trg_church_requests_updated_at';` | `0` both |
| PF-12 | No pre-existing `uq_user_roles_active` | `SELECT to_regclass('public.uq_user_roles_active');` | NULL |
| PF-13 | No pre-existing 3C RPCs / audit function collisions | `SELECT count(*) FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace WHERE n.nspname='public' AND proname IN ('send_notification','list_churches_for_signup','get_my_access_state','submit_church_request','approve_servant','reject_servant','approve_church_request','reject_church_request','audit_trigger_fn');` | `0` (audit_trigger_fn expected absent post-019) |

### 4.4 Policy existence validation

| # | Check | SQL / method | Pass criterion |
|---|---|---|---|
| PF-14 | 022 baseline `tenant_isolation` policies present with `FOR ALL` | `SELECT tablename, policyname, cmd, permissive FROM pg_policies WHERE schemaname='public' AND policyname='tenant_isolation' AND tablename IN ('user_roles','servants','notifications') ORDER BY tablename;` | exactly 3 rows, all `cmd='ALL'` |
| PF-15 | `profiles.own_profile_insert` = 022 baseline | `SELECT pg_get_expr(qual, 'profiles'::regclass) FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='own_profile_insert';` | equals `(id = auth.uid())` (no `churches` EXISTS yet) |
| PF-16 | `audit_logs` immutability intact (must survive 023 untouched) | `SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname IN ('immutable_update','immutable_delete');` | 2 rows present |

### 4.5 Trigger existence validation

| # | Check | SQL / method | Pass criterion |
|---|---|---|---|
| PF-17 | Confirm the pre-batch audit gap is real (no `audit_*` triggers on the 6 target tables) | `SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname LIKE 'audit\_%' AND NOT t.tgisinternal ORDER BY c.relname;` | No rows on profiles/user_roles/followups/attendance_sessions/attendance_records/beneficiaries |
| PF-18 | Dead `audit_attendance` trigger present on backup table (drop target) | `SELECT count(*) FROM pg_trigger WHERE tgname='audit_attendance' AND tgrelid='attendance_backup_20260730'::regclass;` | `1` (will be dropped by 023:237) |

### 4.6 Role / permission validation

| # | Check | SQL / method | Pass criterion |
|---|---|---|---|
| PF-19 | Postgres roles exist (grant targets for S12) | `SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');` | 3 rows |
| PF-20 | Permission catalog = canonical 52 | `SELECT count(*) FROM permissions;` | `52` (021 baseline) |
| PF-21 | Role type enum = 4 canonical values | `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='user_role_type' ORDER BY e.enumsortorder;` | `platform_owner, super_admin, admin, servant` |
| PF-22 | **No duplicate active role grants** | `SELECT church_id, user_id, role_id FROM user_roles WHERE end_date IS NULL GROUP BY 1,2,3 HAVING COUNT(*) > 1;` | **0 rows** (P0.4 — guarantees `uq_user_roles_active` builds) |
| PF-23 | Test fixtures present for the test matrix | At least one church with a seeded `super_admin` role; at least one active platform-owner grant | Query `roles`/`user_roles` join returns ≥1 super_admin and ≥1 platform_owner |
| PF-24 | No current authenticated-client write path against the 3 closed tables | `grep -rnE "(from\(['\"]user_roles|from\(['\"]servants|from\(['\"]notifications)[\s\S]*\.(insert|update|delete)\(" src/` + audit already found 0 | No non-admin client writes (P0.5) |

### 4.7 Backup validation

| # | Check | Method | Pass criterion |
|---|---|---|---|
| PF-25 | P0.6 snapshot taken and verified | `pg_dump` (logical, full DB) + targeted table dump; then `pg_restore --list <dump>` / `psql -c "SELECT 1" < dump` smoke | Dump file non-empty, restorable, SHA-256 recorded; targeted tables (`notifications`, `user_roles`, `servants`, `profiles`) present in dump |
| PF-26 | Backup immutable (read-only) | `chmod a-w <dumpfile>` + store outside the target DB | No write access to snapshot |
| PF-27 | Scratch-project gate (P0.7) recorded | Scratch project has 001–023 applied; V1–V6 executed and logged there | Scratch V1–V6 all PASS (see `STAGING_DRY_RUN_PLAN` precedent) |

### 4.8 Pre-flight exit rule

- All checks PF-1…PF-27 **PASS** → proceed to Step 2.
- Any **FAIL**:
  - Data-remediation class (PF-22 duplicate grants) → fix data first, re-run.
  - Environment class (PF-1/PF-3 migration history) → do **not** apply; escalate.
  - Documentation class (PF-24 audit trailing) → confirm by code inspection, record, proceed.

---

## 5. Staging Execution Order (Task 3)

Legend — outputs feed the sign-off gate (Step 6). Every step has a HALT rule; record evidence per step.

### Step 0 — Backup

**Purpose:** restore baseline for the primary rollback path (batch is non-destructive → snapshot restore is lossless).

| # | Action | Command (exact) | Pass criterion |
|---|---|---|---|
| S0.1 | Full logical backup | `pg_dump --file=staging_023_pre_$(date +%Y%m%d).sql --format=plain --no-owner <STAGING_DB_URL>` (or `-Fc` custom for `pg_restore`) | Exit 0; file size > 0 |
| S0.2 | Targeted table snapshot (rollback-critical objects) | `pg_dump -t public.notifications -t public.user_roles -t public.servants -t public.profiles -t public.audit_logs -Fc <STAGING_DB_URL>` | 5 tables present in archive |
| S0.3 | Checksum + seal | `sha256sum <dumpfile>`; `chmod a-w <dumpfile>` | Hash recorded in the execution log; file read-only |
| S0.4 | Restore smoke test (optional but recommended) | restore S0.1 into the scratch project and `SELECT count(*)` on a sample of the 5 tables | Row counts match source |

**HALT if:** dump fails, is empty, or restore smoke fails → do not proceed.

### Step 1 — Pre-flight verification

Execute the full **§4 checklist** (PF-1…PF-27) against staging. Record each result in the execution log.

**HALT if:** any environment/data-remediation check FAILs (§4.8).

### Step 2 — Apply migration 023

| # | Action | Method | Pass criterion |
|---|---|---|---|
| S2.1 | Apply the single-transaction batch | Supabase CLI `supabase db push` scoped to staging **or** execute `supabase/migrations/023_phase3c_registration.sql` in the SQL Editor (file is one `BEGIN/COMMIT`) | Exit 0; `COMMIT` reached; no error output |
| S2.2 | Confirm atomic outcome | A failure anywhere inside the batch rolls everything back — verify no partial objects if exit ≠ 0 | `to_regclass('public.church_requests')` matches the success/failure outcome exactly |

**HALT if:** any error → the transaction rolled back by design; do **not** retry without triage. Confirm no
partial apply (S2.2).

### Step 3 — Database verification

Run V1–V4 of the migration file's embedded verification block (023:878–919) against staging:

| Verify | What | Pass criterion |
|---|---|---|
| V1 — Schema | `church_requests` table/columns; `notifications.church_id` nullable = YES; 3 `church_requests` indexes; `uq_user_roles_active` present; old UNIQUE constraint absent | All match 023 verification block |
| V2 — Policies | 5 `church_requests` policies (exact cmd/permissive set); `tenant_isolation` on user_roles/servants/notifications = `cmd='SELECT'`; `own_profile_insert` qual contains `churches` | All match 023:888–895 |
| V3 — Functions & privileges | 8 RPCs + `audit_trigger_fn` present, `prosecdef=true`, `search_path` set; `send_notification` EXECUTE denied for anon/authenticated; list/submit allowed for anon; `get_my_access_state` authenticated-only | `has_function_privilege` asserts match 023:903–908 |
| V4 — Audit continuity | function def uses `actor_id`; exactly 6 `audit_*` triggers; `audit_attendance` absent; smoke DML on the 6 audited tables produces `create/update/delete` rows with `entity_id` NOT NULL | All match 023:909–919 |

**HALT if:** any V1–V4 assertion fails → proceed to the **Rollback Plan** (§6 of companion C).

### Step 4 — Registration workflow validation

Execute the **workflow section** of `PHASE_3C_STAGING_TEST_MATRIX.md` (task 4):

- **Existing church:** EC-01 request → EC-02 approval → EC-03 rejection (+ edge cases).
- **New church:** NC-01 submission → NC-02 approval → NC-03 rejection (+ edge cases).

**HALT if:** any primary flow (approve/reject/provision) FAILs → rollback path C.

### Step 5 — Security validation

Execute the **security + audit sections** of the test matrix (R-1…R-16 real-session regression, S12
privilege asserts, audit continuity) using **real RLS-enforcing sessions — no service role** for negative
cases.

**HALT if:** any security test FAILs (self-escalation, self-approval, cross-church, notification spoof, audit
immutability) → rollback path C.

### Step 6 — Sign-off gate

Run `PHASE_3C_STAGING_GO_LIVE_GATE.md` (task 6):

- All 6 success criteria marked PASS with evidence.
- Pre-execution conditions (P0.1–P0.7) confirmed satisfied.
- Approver records final verdict: `READY_FOR_STAGING_EXECUTION` / `REQUIRES_CHANGES` / (post-apply)
  `STAGING_VERIFIED` or `ROLLED_BACK`.

**Outputs:** completed gate document + execution log entries for Steps 0–6.

---

## 6. Supporting packages

| Package | Document | Contents |
|---|---|---|
| Test matrix | `PHASE_3C_STAGING_TEST_MATRIX.md` | Existing-church request/approval/rejection; new-church submit/approve/reject; security (R-1…R-16 + privilege lockdown); audit generation + trigger verification |
| Rollback plan | `PHASE_3C_STAGING_ROLLBACK_PLAN.md` | Trigger criteria, decision tree, execution order (snapshot restore + in-place R1–R5), verification |
| Go-live gate | `PHASE_3C_STAGING_GO_LIVE_GATE.md` | Success criteria, sign-off checklist, verdict |

---

## 7. Conclusion & Verdict

`READY_FOR_STAGING_EXECUTION` — subject to the following conditions (all already defined in this plan):

1. **P0.1–P0.7 pre-flight** passes on the staging DB (§4), in particular **P0.4** (no duplicate active grants)
   and **P0.6** (backup snapshot).
2. **Scratch-first:** 001–023 + V1–V6 validated in the scratch project before live staging apply (P0.7 gate).
3. **Maintenance window** for Step 2 (AX locks; batch expected sub-second).
4. Residual LOW items F-001…F-004 tracked as documentation/robustness, **none blocking**; dispositions recorded
   in the audit report.
