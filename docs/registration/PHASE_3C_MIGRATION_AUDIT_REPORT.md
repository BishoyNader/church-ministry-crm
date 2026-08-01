# Phase 3C.2 — Migration Audit Report

**Audit role:** Independent Principal Database Auditor
**Date:** 2026-07-31
**Target:** `supabase/migrations/023_phase3c_registration.sql` (957 lines)
**Baseline:** migrations 001–022 (applied, verified). 023 **not yet executed** on any DB.
**Method:** line-by-line verification of the actual SQL against the approved canonical set —
`PHASE_3C_MIGRATION_EXECUTION_PLAN.md` (S1–S12, D-1…D-8, §1.2 signatures, §1.3 grants, R1–R5),
`PHASE_3C_OBJECT_CHANGE_MATRIX.md`, `PHASE_3C_SECURITY_REMEDIATION.md` (C-1/C-2/C-3, A4, R-1…R-16),
`REGISTRATION_DATABASE_CHANGES.md`, `CHURCH_PROVISIONING_SPEC.md`, `REGISTRATION_WORKFLOW_SPEC.md`,
`REGISTRATION_RBAC_IMPACT.md`, plus the actual object shapes in migrations 001/009/010/011/013/015/016/018/019/020/021/022.
**Audit scope:** Schema, RLS, RPC, Audit System, Data Safety, Canonical Compliance. No SQL was modified or regenerated.

---

## 1. Executive Summary

**Verdict: GO.**

| Severity | Count |
|---|---|
| BLOCKING | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 4 |
| INFO (non-actionable / favorable) | 3 |

The migration implements every locked decision (S1–S12, D-1…D-8) with no material deviation from the
canonical surface. All three security remediations are correctly implemented and verified against the
actual 022 baseline policies: **C-1 (user_roles self-escalation) closed, C-2 (servants self-approval)
closed, C-3 (notification spoofing) closed**. The A4 audit subsystem is fully restored (function + exactly
6 triggers + dead-trigger drop). The batch is single-transaction, contains **zero DML on existing rows**,
and every rollback step (R1–R5) is documented and viable. All 4 LOW findings are documentation/robustness
nits; none block execution.

---

## 2. Verification Evidence (per audit category)

### 2.1 Schema — PASS

| Check | Result | Evidence |
|---|---|---|
| `church_requests` 14 columns match `REGISTRATION_DATABASE_CHANGES.md` §3 exactly | PASS | 023:29–46 vs spec §3 (all 14 columns, types, defaults, nullability identical) |
| `status` CHECK `('pending','approved','rejected')` | PASS | 023:44–45 |
| `reviewed_by` FK → `profiles(id)` ON DELETE SET NULL | PASS | 023:39 |
| `trg_church_requests_updated_at` BEFORE UPDATE → `handle_updated_at()` (exists, 001:117) | PASS | 023:62–64 |
| 3 indexes (status queue partial, email-pending UNIQUE partial, email) | PASS | 023:49–60 vs spec §3 |
| `notifications.church_id` → nullable, FK `notifications_church_id_fkey` kept | PASS | 023:108; no FK alteration in file |
| S8: drop `user_roles_church_id_user_id_role_id_key` (001:278) + `uq_user_roles_active` partial UNIQUE index | PASS | 023:181–185; constraint name confirmed via 001 inline UNIQUE + plan P0.3 |
| `idx_user_roles_user_active` (020) retained untouched | PASS | 020:35; no statement in 023 touches it (A10/D-7) |
| `attendance_backup_20260730` dead `audit_attendance` trigger dropped | PASS | 023:237 (015 renamed `attendance`→backup) |

### 2.2 RLS — PASS (all four security remediations verified against the actual 022 baseline)

| Check | Result | Evidence |
|---|---|---|
| C-1: `user_roles.tenant_isolation` → SELECT-only | PASS | 023:119–121. Remaining write policy on `user_roles` after change: only `super_admin_all` (022:371). Pending user is role-less → `user_is_super_admin` false → self-assign INSERT impossible. |
| C-2: `servants.tenant_isolation` → SELECT-only | PASS | 023:131–133. Write policies left: only `super_admin_all` (022:225). `admin_read` (022:226) is SELECT-only and preserves own-row read. Self-approval UPDATE impossible. |
| C-3: `notifications.tenant_isolation` → SELECT-only | PASS | 023:144–146. Cross-recipient INSERT denied; own-row access preserved via `recipient_scope` (022:340). |
| S7: `profiles.own_profile_insert` hardened (id = auth.uid() AND EXISTS active non-deleted church) | PASS | 023:158–166, exact match to plan S7 (fail-closed per D-5) |
| `church_requests` 5 policies: `platform_owner_all` ALL, `applicant_read` SELECT, `public_insert` INSERT, `immutable_review`/`immutable_delete` **permissive** deny | PASS | 023:75–97. NOT `AS RESTRICTIVE` (A2 correct — permissive deny does not block the PO). `immutable_review` has `WITH CHECK (false)` → spoofed `status='approved'` UPDATE rejected. |
| PO-only review writes (R-12) / applicant cannot mutate own request (R-11) | PASS | Only write policies on `church_requests` are `platform_owner_all` (PO) and the permissive denies. |

### 2.3 RPC — PASS

| Check | Result | Evidence |
|---|---|---|
| All 8 RPCs present, signatures match plan §1.2 (D-1) byte-for-byte | PASS | 023:291–830 vs plan §1.2 |
| All 8 `SECURITY DEFINER` + `SET search_path = public, auth` (D-3) | PASS | every function header 023:291–830; also `audit_trigger_fn` 023:199–204 |
| D-6: `submit_church_request` writes audit row in-txn (`church_request`/`create`/status pending, `church_id=NULL`) | PASS | 023:446–453 |
| §4.4 guards on approve/reject_servant: auth.uid() NOT NULL, no self-approval, `user_is_super_admin(servant church)`, status=`pending`; A3 reactivation-first; **no `ON CONFLICT DO NOTHING`** | PASS | 023:482–537 (approve), 577–625 (reject). Reactivation-first 023:521–537. |
| D-8: `approve_church_request` validates `auth.users` exists **and** email matches request (case-insensitive) | PASS | 023:688–698 |
| §4.2 atomic provisioning: church (trial baseline §9) + `seed_church_roles` + profile + approved servant + super_admin grant + request approved + notification + 3 audit rows | PASS | 023:717–780 (single function body = single txn) |
| §4.2/§4.3 slug format guard + lowercase + `churches.slug` UNIQUE as final defense | PASS | 023:711–714 (001:147 slug UNIQUE) |
| §4.3 reject: PO + pending, sets `decision_notes`, audit | PASS | 023:798–828 |
| A9: `send_notification` references canonical `data` column only — never `old_metadata` | PASS | 023:310–316. `notifications.data` exists (018:36), `old_metadata` is the 018-renamed leftover, untouched. `body_ar` NOT NULL (001:495) → COALESCE to `''` (023:315). `channel` text NOT NULL (018:28) → passed with default `'in_app'`. |
| S12 grants match plan §1.3 exactly | PASS | 023:844–873. `send_notification`: revoked from PUBLIC/anon/authenticated/service_role, **no grant**; list/submit → anon+authenticated; get_my_access_state → authenticated; approve/reject ×4 → authenticated+service_role. All REVOKE signatures match the function argument types exactly. |

### 2.4 Audit System (A4) — PASS

| Check | Result | Evidence |
|---|---|---|
| Root cause confirmed in baseline | — | 001:82–83 `audit_action` enum; 001:782–834 `audit_trigger_fn` (declares `v_action audit_action`) + 5 triggers (`audit_children`, `audit_attendance`, `audit_profiles`, `audit_user_roles`, `audit_followups`); 019:54 `DROP TYPE IF EXISTS audit_action CASCADE` silently dropped function + triggers; 019 recreates only `write_audit_log`. |
| `audit_trigger_fn` recreated with `actor_id` (not `user_id`), `action` TEXT, `entity_type := TG_TABLE_NAME`, `entity_id := COALESCE(NEW.id, OLD.id)` satisfying `entity_id NOT NULL` (019:32) | PASS | 023:199–231 vs 019:12 (`user_id`→`actor_id`), 019:18 (action TEXT), 019:32 (entity_id NOT NULL) |
| Exactly 6 triggers on the 6 specified tables, `DROP TRIGGER IF EXISTS` before each; **no `audit_children`** (013 renamed children→beneficiaries, M-2) | PASS | 023:245–273. Tables all verified to carry `id` + `church_id`: profiles(001), user_roles(001), followups(001:382), attendance_sessions(015:12), attendance_records(015:31), beneficiaries(013). |
| `write_audit_log` compatibility (D-4): every RPC call passes `entity_id` | PASS | 023:446–453, 552–559, 618–625, 768–780, 824–828 — all 5 call sites pass a non-null `entity_id` (request/servant/church/user id). |
| D-3 inside `audit_trigger_fn` (`SET search_path = public, auth`) so `auth.uid()` and `audit_logs` resolve safely | PASS | 023:203–204 |
| Audit log immutability preserved (`immutable_update`/`immutable_delete`, 022:348–349) | PASS | 023 touches neither policy |

### 2.5 Data Safety — PASS

| Check | Result | Evidence |
|---|---|---|
| Zero DML (INSERT/UPDATE/DELETE) on existing rows in the batch | PASS | Full scan: only CREATE TABLE / ALTER / DROP POLICY+CREATE / DROP CONSTRAINT+CREATE INDEX / CREATE FUNCTION / CREATE TRIGGER / GRANT / REVOKE. No `UPDATE`/`DELETE`/`INSERT` outside function bodies. |
| Single `BEGIN`/`COMMIT` — any failure rolls back the entire batch | PASS | 023:21, 875 |
| Safe failure under violated pre-conditions | PASS | If P0.4's no-duplicate-active-grants guard is not met, `uq_user_roles_active` (023:183) fails → whole txn aborts (no partial apply). If duplicate archived+active rows exist at rollback, R4 documents the blocker. |
| `notifications.church_id` nullable never removes the FK | PASS | 023:108 only; FK kept (matrix §3) |
| Idempotence-friendly DDL | PASS | `DROP POLICY IF EXISTS`, `DROP TRIGGER IF EXISTS`, `DROP CONSTRAINT IF EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS` (023:119,131,144,158,181,183,237,245–270) |

### 2.6 Canonical Compliance — PASS (with 2 doc-mismatch findings, §3)

Every object created/modified matches the change matrix and both specs; the `seed_church_roles` (021)
super_admin→all-permissions contract is honored by `approve_church_request`'s reliance on the seeded
`super_admin` role (023:737–746). Permission catalog: **no new codes introduced** (plan §4) — confirmed,
no `INSERT INTO permissions`/`roles` in 023.

---

## 3. Findings

### BLOCKING — none

### HIGH — none

### MEDIUM — none

### LOW

| ID | Severity | Location | Finding | Disposition |
|---|---|---|---|---|
| F-001 | LOW | `PHASE_3C_OBJECT_CHANGE_MATRIX.md` §1 ("12 cols"); `PHASE_3C_MIGRATION_EXECUTION_PLAN.md` §5 V1 ("12 columns") | Doc count miscount: the matrix header and plan V1 label `church_requests` as "12 cols/columns", but both docs list **14** columns — and the SQL (023:29–46) matches the listed 14 exactly. Column **set** is canonical; only the count label is wrong. | Correct the two labels to 14 in a doc-maintenance pass. Non-blocking. |
| F-002 | LOW | 023:81–82 | **Favorable deviation:** plan S2 locks `applicant_read` as `email = auth.jwt()->>'email'`; SQL uses `lower(email) = lower(auth.jwt()->>'email')`. Stored request emails are always lowercase (submit RPC normalizes, 023:414), so the LOWER() form is a strict robustness superset (handles mixed-case JWT email claims). | Record as an intentional favorable deviation in the generation record. No change required. |
| F-003 | LOW | 023:417 | **Case-sensitive dedupe-1:** `submit_church_request` checks `EXISTS (SELECT 1 FROM profiles WHERE email = v_email)` (raw column vs lowercased input), and `idx_profiles_email` (010:30) is on raw `email`, not `lower(email)`. A stored mixed-case profile email would not be caught. Worst case is a fail-closed PK collision on the later `profiles` INSERT in `approve_church_request` (id = existing auth user → duplicate key) → transaction aborts with a generic error. No data corruption or privilege impact. | Recommend `lower(profiles.email) = v_email` for robustness; optional hardening, not a blocker. |
| F-004 | LOW | 023:521–524 | **Reactivation edge:** the reactivation `UPDATE user_roles SET end_date = NULL` targets **all** archived rows for `(church_id, user_id, role_id)`. If >1 archived row ever coexists (only possible if the app-layer `assignRoles` uses archive-and-insert **without** reactivation-first), `uq_user_roles_active` is violated and the approve txn aborts (fail-closed). The migration's own writers (`approve_servant`, `approve_church_request`) never create this state. | Operational note: `assignRoles` must also follow reactivation-first per plan §6.3. Non-blocking. |

### INFO (documented / intentional / favorable)

| ID | Severity | Location | Note |
|---|---|---|---|
| F-005 | INFO | 023:86–87 | N-10 verified as specified: `public_insert` constrains only `status`, so `reviewed_by/reviewed_at/decision_notes` are settable at submit. Every review field an attacker can set is overwritten by the review RPCs (023:749–751, 819–822). Documented non-blocking in plan §3 S2. |
| F-006 | INFO | 023:427–434 | Marginal anon existence oracle: dedupe-3 probes names of non-deleted churches (`deleted_at IS NULL`), which is one bit more than `list_churches_for_signup` exposes (also requires `is_active`). Informs only inactive-but-not-deleted church names; no impact. |
| F-007 | INFO | 023:245–273 + RPC audit calls | Intentional audit double-write for RPC-driven DML (restored triggers fire on RPC writes **and** the RPCs write explicit rows). Defense-in-depth per A4 §4 step 4. The `action` differs (trigger `'update'` vs explicit `'approve'`/`'reject'`/`'create'`), so no ambiguity. |

---

## 4. Pre-Execution Conditions (already defined in the plan, restated)

1. Run pre-flight **P0.1–P0.7** against the live DB before applying 023 (P0.4 guarantees the `uq_user_roles_active`
   build; P0.5 confirms no current authenticated-client write paths break under SELECT-only policies; P0.6 is the
   rollback snapshot; P0.7 is the scratch-project requirement).
2. Apply in the scratch project first and execute **V1–V6** there (V5 covers R-1…R-16, incl. R-16 fail-closed
   profile self-insert).

## 5. Conclusion

`023_phase3c_registration.sql` is compliant with the approved Phase 3C.2 surface. Zero blocking or high findings;
the four LOW items are documentation/robustness nits and three INFO items are documented/intentional. Safe to
execute after P0.1–P0.7 on the target environment.
