# Staging Execution Report

**Date:** 2026-07-30  
**Environment:** Local Supabase instance (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`)  
**PostgreSQL version:** 17.6  
**Migrations under test:** 007–022 (Phase 2B)  
**Pre-migration migrations applied:** 001–006  

---

## 1. Environment Summary

| Metric | Pre-Migration | Post-Migration (partial) | Expected |
|--------|---------------|--------------------------|----------|
| Tables | 21 | 25 | 25 |
| Foreign Keys | 52 | — | Per canonical |
| Indexes | 77 | — | Per canonical |
| RLS Policies | 70 | 73 (of 89 claimed) | 89 |
| Enums | 28 | 22 | Per canonical |
| Permissions | 45 | 52 | 52 |
| user_role_type values | 5 (old) | 4 (canonical) | 4 |

**Note:** Post-migration counts are partial — execution did not complete due to failures.

---

## 2. Migration Execution Summary

| Migration | Status | Duration | Issues Found |
|-----------|--------|----------|-------------|
| 007 — services | ✅ PASS | 10ms | 0 |
| 008 — classes | ✅ PASS | 7ms | 0 |
| 009 — churches | ✅ PASS | 7ms | 0 |
| 010 — profiles | ✅ PASS | 4ms | 0 |
| 011 — servants | ✅ PASS | 5ms | 0 |
| 012 — ssa | ✅ PASS | 11ms | 0 |
| 013 — beneficiaries | ✅ PASS | 16ms | 0 |
| 014 — ba | ⚠️ WORKAROUND | — | 1 bug (missing CASCADE on DROP COLUMN) |
| 015 — attendance | ✅ PASS | 12ms | 0 |
| 016 — followups | ⚠️ WORKAROUND | 12ms | 3 bugs (missing FK drop, missing deleted_at, missing DEFAULT drop) |
| 017 — spiritual | ✅ PASS | 9ms | 0 |
| 018 — notifications | ⚠️ WORKAROUND | — | 1 bug (DROP TYPE before column dropped) |
| 019 — audit_logs | ⚠️ WORKAROUND | — | 1 bug (DROP TYPE in same transaction as ALTER COLUMN TYPE) |
| 020 — user_roles | ✅ PASS | 8ms | 0 |
| 021 — roles/perms | ⚠️ WORKAROUND | 8ms | 1 bug (DROP FUNCTION without CASCADE) |
| 022 — RLS | ❌ FAIL | — | **16 policy failures** (10 syntax, 3 semantic, 3 referential) |

---

## 3. Detailed Bug Report

### Migration 014 — `beneficiary_assignments.sql`

**Bug:** `ALTER TABLE beneficiaries DROP COLUMN stage_id` fails because FK `children_stage_id_fkey` depends on the column. The migration does not drop the FK or use `CASCADE`.

**File:** `014_beneficiary_assignments.sql:62`  
**Error:** `cannot drop column stage_id of table beneficiaries because other objects depend on it`  
**Fix applied during execution:** Manual `DROP CONSTRAINT children_stage_id_fkey`, then `DROP COLUMN stage_id CASCADE`.

---

### Migration 016 — `followups_update.sql`

**Bug 1:** `ALTER TABLE followups DROP COLUMN stage_id` fails because FK `followups_stage_id_fkey` depends on the column.

**File:** `016_followups_update.sql:29`  
**Error:** `cannot drop column stage_id of table followups because other objects depend on it`  
**Fix applied:** Manual `DROP CONSTRAINT followups_stage_id_fkey`, then `DROP COLUMN stage_id CASCADE`.

**Bug 2:** Index `idx_followups_servant_status` references `WHERE deleted_at IS NULL` but `followups` table has no `deleted_at` column.

**File:** `016_followups_update.sql:50`  
**Error:** `column "deleted_at" does not exist`  
**Fix applied:** Manual `ALTER TABLE followups ADD COLUMN deleted_at timestamptz`.

**Bug 3:** `ALTER TABLE followups ALTER COLUMN status TYPE followup_status USING status::followup_status` fails because the column has a default value `'scheduled'` that cannot be cast to the new enum.

**File:** `016_followups_update.sql:60`  
**Error:** `default for column "status" cannot be cast automatically to type followup_status`  
**Fix applied:** Manual `ALTER TABLE followups ALTER COLUMN status DROP DEFAULT`.

---

### Migration 018 — `notifications_update.sql`

**Bug:** `DROP TYPE IF EXISTS notification_channel` fails because column `channel_value` (renamed from `channel`) still uses the type. The column is not dropped until line 39, but the DROP TYPE is on line 29.

**File:** `018_notifications_update.sql:29`  
**Error:** `cannot drop type notification_channel because other objects depend on it`  
**Fix applied:** Manual reorder — drop `channel_value` first, then drop types, then add columns.

---

### Migration 019 — `audit_logs_update.sql`

**Bug:** `DROP TYPE IF EXISTS audit_action` fails because the type's dependency is not released within the same transaction as `ALTER COLUMN ... TYPE text`.

**File:** `019_audit_logs_update.sql:54`  
**Error:** `cannot drop type audit_action because other objects depend on it`  
**Fix applied:** Run ALTER COLUMN (commits), then DROP TYPE in separate statement.

---

### Migration 021 — `role_and_permissions.sql`

**Bug:** `DROP FUNCTION IF EXISTS user_has_stage_access(uuid)` fails because existing RLS policies depend on the function.

**File:** `021_role_and_permissions.sql:18`  
**Error:** `cannot drop function user_has_stage_access(uuid) because other objects depend on it`  
**Fix applied:** Use `DROP FUNCTION ... CASCADE` to also drop dependent policies.

---

### Migration 022 — `rls_implementation.sql` — CRITICAL

**Total: 16 policy creation failures**

#### Syntax Errors (10) — `FOR command/command` is invalid PostgreSQL

| Policy | Table | Invalid Syntax | Line |
|--------|-------|---------------|------|
| admin_write | services | `FOR INSERT/UPDATE` | 202 |
| admin_write | stages | `FOR INSERT/UPDATE/DELETE` | 208 |
| admin_write | classes | `FOR INSERT/UPDATE/DELETE` | 214 |
| own_profile | profiles | `FOR INSERT/UPDATE` | 218 |
| admin_write | servant_stage_assignments | `FOR INSERT/UPDATE` | 243 |
| admin_write | beneficiaries | `FOR INSERT/UPDATE` | 288 |
| immutable | beneficiary_assignments | `FOR UPDATE/DELETE` | 296 |
| stage_scope | attendance_sessions | `FOR INSERT/SELECT` | 302 |
| immutable | audit_logs | `FOR UPDATE/DELETE` | 345 |
| platform_owner_write | permissions | `FOR INSERT/UPDATE/DELETE` | 354 |

**Root cause:** PostgreSQL `CREATE POLICY` only accepts a single command type: `ALL`, `SELECT`, `INSERT`, `UPDATE`, or `DELETE`. Compound forms like `INSERT/UPDATE` are not valid syntax.

#### Semantic Errors (3) — INSERT policies need WITH CHECK, not USING

| Policy | Table | Issue | Line |
|--------|-------|-------|------|
| admin_write | beneficiary_assignments | `FOR INSERT USING` → must be `FOR INSERT WITH CHECK` | (in file) |
| record_attendance | attendance_records | `FOR INSERT USING` → must be `FOR INSERT WITH CHECK` | (in file) |
| append_only | audit_logs | `FOR INSERT USING` → must be `FOR INSERT WITH CHECK` | (in file) |

**Root cause:** `FOR INSERT` policies use `WITH CHECK (expression)` in PostgreSQL, not `USING (expression)`.

#### Referential Errors (3) — Columns do not exist on target tables

| Policy | Table | Missing Column | Line |
|--------|-------|----------------|------|
| stage_scope | events | `class_id` | (in file) |
| owner_scope | ai_messages | `user_id` | (in file) |
| owner_scope | document_embeddings | `user_id` | (in file) |

**Root cause:** Policies reference columns that don't exist on the target tables.

---

## 4. Risk Assessment

### Critical Risks

1. **22 RLS policies missing** — 16 fail to create + the DO block that drops old policies ran, but only 73 of the intended 89 new policies exist. Tables have incomplete RLS coverage — some operations may be exposed.

2. **10 syntax errors in migration 022** — The migration file is generating invalid PostgreSQL syntax. Every policy using `FOR command/command` is syntactically wrong and must be rewritten.

3. **3 INSERT policies use wrong clause** — `USING` instead of `WITH CHECK` for INSERT policies is a semantic error.

4. **3 policies reference non-existent columns** — `class_id` on events, `user_id` on ai_messages and document_embeddings.

### Moderate Risks

5. **5 migrations require manual workarounds** — 014, 016, 018, 019, 021 all failed during execution and needed manual intervention. None are safe for unattended execution.

6. **Missing `deleted_at` column** on `followups` table breaks the canonical index.

7. **6 enums not dropped** — `child_status`, `pipeline_stage_type`, `followup_type`, `notification_channel`, `notification_type`, `audit_action` remain as types (though `followup_type`, `notification_channel`, `notification_type`, `audit_action` were dropped manually during execution).

8. **Old RLS functions dropped with CASCADE** — Dropping `user_has_stage_access` with CASCADE also removed existing RLS policies that depended on it, which may have affected other functionality.

### Low Risks

9. `old_metadata` column renamed but not dropped on notifications (known issue from audit).

10. `settings` column remains on churches (known issue from audit).

---

## 5. Final Verdict

**NOT_READY_FOR_PRODUCTION**

### Justification

The migration package has 16 policy creation failures in migration 022 alone, spanning syntax errors, semantic errors, and referential errors. Additionally, 5 of the 16 migrations (014, 016, 018, 019, 021) failed during unattended execution and required manual workarounds. The FINAL_SQL_AUDIT_REPORT.md's "PASS" verdict for these migrations was incorrect — the audit did not catch:

1. **Invalid PostgreSQL syntax** (`FOR INSERT/UPDATE` etc.) in 10 policies
2. **Wrong clause for INSERT policies** (`USING` instead of `WITH CHECK`)
3. **Non-existent column references** in 3 policies
4. **Missing `deleted_at` column** on followups
5. **Missing DEFAULT drop** before enum type change in 016
6. **DROP TYPE ordering issues** in 018 and 019
7. **DROP FUNCTION without CASCADE** in 021
8. **DROP COLUMN without CASCADE** in 014 and 016

### Requirements for READY status

1. Fix all 16 policy creation failures in `022_rls_implementation.sql`
2. Add `CASCADE` to `DROP COLUMN stage_id` in `014_beneficiary_assignments.sql:62`
3. Add `deleted_at` column to followups in `016_followups_update.sql`
4. Add `DROP DEFAULT` before status type change in `016_followups_update.sql:60`
5. Fix DROP TYPE ordering in `018_notifications_update.sql` (drop column before dropping type)
6. Split `019_audit_logs_update.sql` to commit ALTER COLUMN before DROP TYPE
7. Add `CASCADE` to DROP FUNCTION calls in `021_role_and_permissions.sql:13-19`
8. Re-run full staging validation after fixes

---

## Appendix: Verification Results (Partial)

Since migrations did not complete, Phase 3-5 was not conducted. The following post-migration state was verified:

| Check | Result |
|-------|--------|
| Table count | 25 (correct) |
| Policy count | 73 (expected 89 — **16 missing**) |
| Permission count | 52 (correct) |
| user_role_type enum | platform_owner, super_admin, admin, servant (correct) |
| All canonical indexes present | Not verified (migrations incomplete) |
| All FKs correct | Not verified (migrations incomplete) |
| No orphan FKs | Not verified (migrations incomplete) |
