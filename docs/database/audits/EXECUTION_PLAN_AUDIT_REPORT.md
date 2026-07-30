# Execution Plan Audit Report

**Date:** 2026-07-30  
**Audited Documents:** EXECUTION_PLAN.md, SCHEMA_DIFF_REPORT.md  
**Canonical Sources:** CANONICAL_DATABASE_SPEC.md, CANONICAL_ROLE_MODEL.md, CANONICAL_ASSIGNMENT_MODEL.md, CANONICAL_PERMISSION_CATALOG.md, CANONICAL_RLS_SPEC.md, CANONICAL_DOMAIN_MODEL.md  

---

## Executive Summary

The execution plan is structurally sound but contains **8 blocking issues** and **6 non-blocking improvements** that must be resolved before implementation.

**Verdict: NOT READY — 8 blocking issues found (see §11 for resolution status)**

---

## 1. Canonical Alignment Audit

### Schema Mismatches

| Area | Canonical | Execution Plan | Status |
|------|-----------|----------------|--------|
| `beneficiaries.date_of_birth` | NOT NULL | SET NOT NULL | ⚠️ No NULL-handling for existing rows |
| `beneficiaries.gender` | NOT NULL | SET NOT NULL | ⚠️ No NULL-handling for existing rows |
| `beneficiaries` has `stage_id`? | **No** — `stage_id` NOT in table columns | Index `idx_beneficiaries_church_stage` references `stage_id` | ❌ **BLOCKING** |
| `stages` indexes | `idx_stages_service_sort` on `(service_id, sort_order)` | Not created; old indexes not dropped | ❌ **BLOCKING** |
| `user_roles.assigned_by` | NOT NULL | Not altered | ❌ **BLOCKING** |
| `user_roles.start_date` | DATE NOT NULL | Not added | ❌ **BLOCKING** |
| `user_roles.end_date` | DATE nullable | Not added | ❌ **BLOCKING** |
| `user_roles` index | `idx_user_roles_user_active` on `(user_id, role_id) WHERE end_date IS NULL` | Not created | ❌ **BLOCKING** |
| `events.service_id` | NOT NULL REFERENCES services(id) | Renamed but no FK added, no NOT NULL set | ❌ **BLOCKING** |
| `audit_logs` | `actor_id`, `action` TEXT, no `ip_address`/`user_agent` | **No migration at all** | ❌ **BLOCKING** |
| `servant_stage_assignments` unique | `(servant_id, stage_id, class_id, end_date)` per ASSIGNMENT_MODEL.md | Not included | ❌ **BLOCKING** |
| `attendance_records` index | `(beneficiary_id, status, session_date)` | `(beneficiary_id, status)` only — `session_date` not a column on this table | ⚠️ Cannot verify |
| `profiles.idx_profiles_church_active` | `(church_id) WHERE deleted_at IS NULL` | Plan tries to CREATE INDEX with same name but different definition — will fail | ❌ **BLOCKING** |

### Evidence

**beneficiaries.stage_id reference (CANONICAL_DATABASE_SPEC.md lines 230-258 + lines 582-610):**
Table definition has no `stage_id` column. Index master list references `beneficiaries (church_id, stage_id, status)`. This is a contradiction within the canonical spec itself. The execution plan inherits the contradiction.

**user_roles missing columns (CANONICAL_DATABASE_SPEC.md lines 479-495):**
Full spec requires `assigned_by` NOT NULL, `start_date` DATE NOT NULL, `end_date` DATE nullable, and index `idx_user_roles_user_active`. None of these appear in any migration in the execution plan.

**audit_logs missing migration:**
CANONICAL_DATABASE_SPEC.md lines 409-428 define `actor_id`, `action TEXT`, no `ip_address`/`user_agent`. The SCHEMA_DIFF_REPORT identifies these changes (section 2.5), but no migration in the plan (007-019) implements them.

**events missing FK (CANONICAL_DATABASE_SPEC.md lines 497-507):**
The spec says `service_id | UUID | NOT NULL REFERENCES services(id)`. The plan only renames the column but does not add the FK constraint or NOT NULL.

---

## 2. Role Model Validation

### PASS / FAIL

| Check | Result |
|-------|--------|
| Is pending_user in the canonical role model? | **YES** — CANONICAL_ROLE_MODEL.md lines 276-311 |
| Where is pending_user handled in the execution plan? | **Correctly** — via `servants.approval_status = 'pending'`. Not in the enum. |
| Does the `user_role_type` enum match? | **YES** — `platform_owner, super_admin, admin, servant` |
| Any role values missing? | **NO** |
| Any unauthorized values? | **NO** |

**Verdict: PASS ✅**

---

## 3. Servants Migration Validation

### Question 1: Does every profile become a servant?

**NO — and the plan incorrectly assumes yes.**

CANONICAL_ROLE_MODEL.md line 46: "Has servant record: No" for Platform Owner.  
CANONICAL_DOMAIN_MODEL.md line 65: "not every profile is a servant (e.g., platform owner has a profile outside any church)."

The plan's migration 011 uses:
```sql
INSERT INTO servants ...
FROM profiles
WHERE deleted_at IS NULL;
```
This creates a servant record for **every non-deleted profile, including the platform owner**. Platform owner has `church_id = NULL` and must NOT have a servant record.

### Question 2: Is servant a domain entity or merely a role?

**Domain entity.** CANONICAL_DOMAIN_MODEL.md lines 74-84: Defines Servant as a separate entity with its own lifecycle, approval flow, and relationships.

### Question 3: Does the migration introduce records not defined by the model?

**YES** — platform owner profiles would get servant records, violating the model.

### Fix Required

```sql
INSERT INTO servants (id, church_id, ...)
SELECT id, church_id, NULL, 'approved', now(), now()
FROM profiles
WHERE deleted_at IS NULL AND church_id IS NOT NULL;
```

**Verdict: ❌ FAIL — must exclude church_id IS NULL (platform owner)**

---

## 4. Beneficiaries Data Preservation Audit

### Column Drop Analysis

| Dropped Column | In Canonical? | Data Loss Risk | Verdict |
|---------------|---------------|----------------|---------|
| `first_name_ar` | ❌ Merged → `full_name_ar` | None — data preserved in merge | ✅ Intentional |
| `last_name_ar` | ❌ Merged → `full_name_ar` | None — data preserved in merge | ✅ Intentional |
| `first_name_en` | ❌ Merged → `full_name_en` | None — data preserved in merge | ✅ Intentional |
| `last_name_en` | ❌ Merged → `full_name_en` | None — data preserved in merge | ✅ Intentional |
| `emergency_contact_name` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |
| `emergency_contact_phone` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |
| `allergies` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |
| `medical_conditions` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |
| `medications` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |
| `confession_frequency` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |
| `spiritual_notes` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |
| `school_name_ar` | ❌ Replaced by `school` | Partial — names dropped | ⚠️ Acceptable |
| `grade_level` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |
| `ministry_id` | ❌ In BA table | None — via `beneficiary_assignments` | ✅ Intentional |
| `pipeline_stage` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |
| `enrolled_at` | ❌ As `start_date` in BA | Partial — not migrated automatically | ⚠️ Should migrate to BA |
| `created_by` | ❌ As `assigned_by` in BA | Partial — not migrated automatically | ⚠️ Should migrate to BA |
| `parent_address_ar` | ❌ Replaced by `address` | Partial — not the same semantics | ⚠️ Acceptable |
| `father_name_ar` | ❌ Not in spec | **Irreversible** — **DATA LOSS** | ❌ **BLOCKING** |
| `mother_name_ar` | ❌ Not in spec | **Irreversible** — **DATA LOSS** | ❌ **BLOCKING** |
| `parent_phone` | ❌ Split to `father_mobile`/`mother_mobile` | **Not migrated** — parent_phone data lost | ❌ **BLOCKING** |
| `parent_email` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |
| `baptism_date` | ❌ Not in spec | **Irreversible** — not migrated | ✅ Intentional |

### Irreversible Data Loss Not Explicitly Authorized

The canonical spec does not explicitly say "remove father_name_ar" or "remove mother_name_ar." These columns existed in the `children` table and are being dropped. The `confession_father` field in the canonical spec stores the name of the confession father (priest), not the biological father's name.

The `father_name_ar` and `mother_name_ar` fields contain the beneficiary's parents' names. The canonical beneficiaries table has `father_mobile`, `mother_mobile`, and `confession_father` but no father/mother name fields. **This data is being dropped without explicit canonical authorization** — the canonical spec simply doesn't mention these fields, which implies removal, but the data loss should be acknowledged and migration should archive these values in `notes` or a `_backup` column.

**Verdict: ❌ BLOCKING — father_name_ar, mother_name_ar, parent_phone data loss without migration/archive plan**

---

## 5. Attendance Architecture Validation

### Questions

1. **Can multiple classes under the same stage have attendance on the same date?**  
   **NO** — `UNIQUE(stage_id, session_date)` prevents this.

2. **Does the canonical model require class-level attendance?**  
   **Not in MVP.** CANONICAL_DATABASE_SPEC.md line 302: "Class-level sessions deferred to Phase 3."

3. **Is the proposed uniqueness constraint correct?**  
   **YES** — matches canonical spec exactly.

**Verdict: PASS ✅**

---

## 6. Permission Catalog Validation

### Count Comparison

| Category | Canonical | Plan | Result |
|----------|-----------|------|--------|
| Total codes | 52 | 53 | ❌ Mismatch |
| Codes added | 18 | 18 | ✅ |
| Codes renamed | 4 | 4 | ✅ |
| Codes deleted | 10 | 10 | ✅ |

### Codes the plan keeps but canonical removes (7 extra)

| Code | Canonical Status |
|------|-----------------|
| `users.create` | ❌ Not in canonical (users module has only read, update) |
| `users.delete` | ❌ Not in canonical |
| `users.manage` | ❌ Not in canonical |
| `attendance.update` | ❌ Not in canonical (attendance: create, read, export only) |
| `attendance.delete` | ❌ Not in canonical |
| `notifications.create` | ❌ Not in canonical (notifications: read, manage only) |
| `churches.manage` | ❌ Not in canonical (churches: read, update only) |

### Codes the plan misses but canonical requires (10 missing)

| Code | Module | Recipient |
|------|--------|-----------|
| `beneficiaries.transfer` | beneficiaries | super_admin, admin |
| `tenants.create` | tenants (PO) | platform_owner |
| `tenants.read` | tenants (PO) | platform_owner |
| `tenants.update` | tenants (PO) | platform_owner |
| `tenants.delete` | tenants (PO) | platform_owner |
| `subscriptions.manage` | system (PO) | platform_owner |
| `billing.read` | system (PO) | platform_owner |
| `system.metrics` | system (PO) | platform_owner |
| `system.audit` | system (PO) | platform_owner |
| `support.manage` | system (PO) | platform_owner |

### seed_church_roles function issues

The plan's `seed_church_roles` assigns `beneficiaries.transfer` but that code doesn't exist in the plan's permission set. The function is also missing `stages.delete` and `classes.delete` for the admin role, while the canonical permission-to-role mapping says admin gets `stages.delete` and `classes.delete`... actually let me check.

From CANONICAL_PERMISSION_CATALOG.md role mapping:
- stages.delete: super_admin only
- classes.delete: super_admin only  
- beneficiaries.transfer: super_admin, admin

The plan's seed function:
- Admin gets: stages.create, stages.update (no stages.delete — correct per mapping ✅)
- Admin gets: classes.create, classes.update (no classes.delete — correct per mapping ✅)
- Admin does NOT get beneficiaries.transfer — but canonical says admin DOES get it ❌

And the admin also misses:
- `attendance.read` is there ✅
- `followups.read` is there ✅  
- Missing: `stages.read` is there ✅

Wait, let me check again against CANONICAL_ROLE_MODEL.md admin permissions:
- `beneficiaries.transfer` ✅ plan has it in admin seed
- `attendance.read` ✅
- `attendance.export` ✅
- `followups.read` ✅
- `import.execute`, `export.execute` ✅

Actually looking at the plan's seed function more carefully, `beneficiaries.transfer` IS included for admin. But the permission code itself wasn't added to the permissions table (the 18 added codes don't include it). So the seed references a code that doesn't exist.

**Verdict: ❌ BLOCKING — count mismatch (53 vs 52), 7 extra codes kept, 10 missing codes (including all platform_owner codes)**

---

## 7. Assignment Architecture Validation

### Servant Stage Assignments

| Check | Result |
|-------|--------|
| Role values match canonical? | ✅ `service_admin`, `stage_leader`, `class_leader`, `servant` |
| Table structure matches? | ✅ |
| Unique constraint per ASSIGNMENT_MODEL.md §1.1? | ❌ **Missing** `(servant_id, stage_id, class_id, end_date)` |
| Active assignment logic (`is_active`, `end_date`)? | ✅ |
| Transfer workflow support? | ✅ (via `end_date` temporal tracking) |

### Beneficiary Assignments

| Check | Result |
|-------|--------|
| Immutability (`is_current` pattern)? | ✅ |
| Transfer workflow support? | ✅ |
| Ownership chain (Church→Admin→Servant)? | ✅ |
| Data migration preserves existing assignments? | ⚠️ Uses two-step INSERT + UPDATE — risky |

### Evidence

CANONICAL_ASSIGNMENT_MODEL.md line 32: "Unique constraint: (servant_id, stage_id, class_id, end_date) prevents duplicate active assignments at the same scope."

The execution plan's `servant_stage_assignments` DDL does not include this constraint. Without it, duplicate active assignments are possible, which violates the assignment model.

**Verdict: ❌ BLOCKING — missing unique constraint on servant_stage_assignments**

---

## 8. RLS Migration Safety Review

### Approach Analysis

**Planned approach:** "Drop all existing policies and recreate 89 policies."

| Risk | Rating | Detail |
|------|--------|--------|
| Window without RLS | **HIGH** | Between dropping old policies and creating new ones, ALL tables are readable/writable by any authenticated user. A failure mid-migration leaves data unprotected. |
| Dependency on migration order | **MEDIUM** | Migration 020 (RLS) runs after 019 (role enum change). Between 019 and 020, RLS policies reference old functions/role types that may have been dropped by CASCADE. |
| Transactional safety | **LOW** | The plan doesn't specify whether the 89 policies are created atomically. |

### Recommended Deployment Approach

**Table-by-table within a single transaction:**

```sql
BEGIN;
  -- Table 1: Drop old, add new for churches
  DROP POLICY IF EXISTS ... ON churches;
  CREATE POLICY tenant_read ON churches FOR SELECT ...;
  CREATE POLICY platform_owner_all ON churches FOR ALL ...;
  CREATE POLICY super_admin_update ON churches FOR UPDATE ...;
  -- Repeat for all 25 tables
COMMIT;
```

This ensures there is NEVER a table without RLS. The window is reduced to microseconds per table rather than minutes for the full suite.

### Risk Rating: **HIGH** (mitigatable)

**Verdict: ⚠️ NON-BLOCKING — deploy table-by-table in single transaction instead**

---

## 9. Migration Sequencing Validation

| Migration | Dependency Status | Risk | Notes |
|-----------|------------------|------|-------|
| 007 — services | ✅ Clean | LOW | Standard table copy + FK rename |
| 008 — classes | ✅ Clean | LOW | New table, no data |
| 009 — churches | ✅ Clean | LOW | Add columns with defaults |
| 010 — profiles | ❌ Has issue | MEDIUM | `CREATE INDEX idx_profiles_church_active` will fail — index already exists with different definition |
| 011 — servants | ❌ Has issue | MEDIUM | Must exclude church_id IS NULL |
| 012 — servant_stage_assignments | ✅ Clean | LOW | Standard table copy |
| 013 — beneficiaries | ❌ Has issue | HIGH | Column drops cause irreversible data loss (father_name, mother_name, parent_phone) |
| 014 — beneficiary_assignments | ⚠️ Risky | MEDIUM | Two-step data migration (wrong data first, then correct) |
| 015 — attendance restructure | ✅ Clean | LOW | Standard table split with backup |
| 016 — followups | ✅ Clean | LOW | Standard FK + enum update |
| 017 — spiritual_journal | ✅ Clean | LOW | New table |
| 018 — notifications | ✅ Clean | LOW | Standard column changes |
| 019 — role + perms | ❌ Has issue | HIGH | `DROP TYPE CASCADE` drops functions; permission count wrong; missing codes |
| 020 — RLS | ⚠️ Has issue | HIGH | Window without RLS protection |

### Explicit FK Ordering Risk

Migration 013 renames `followups.child_id → beneficiary_id` and `spiritual_records.child_id → beneficiary_id`. Migration 016 then tries to DROP CONSTRAINT `followups_child_id_fkey` and add new FK. However, after 013 renames the column, the FK constraint name may be different or may have been updated automatically when `children` was renamed to `beneficiaries`. PostgreSQL preserves FK constraint names through RENAME operations, so `followups_child_id_fkey` still exists but now references `beneficiaries(id)` — so the DROP in 016 will succeed. ✅

**Verdict: ❌ BLOCKING — index collision in 010, data loss in 013, CASCADE risk in 019**

---

## 10. Final Verdict

### 🔴 NOT READY — 8 Blocking Issues

| # | Issue | Source | Fix Required |
|---|-------|--------|-------------|
| 1 | **Missing user_roles columns + index** | CANONICAL_DATABASE_SPEC.md §§ user_roles | Add migration for `assigned_by` NOT NULL, `start_date`, `end_date`, and `idx_user_roles_user_active` |
| 2 | **Missing audit_logs migration** | CANONICAL_DATABASE_SPEC.md §§ audit_logs | Add migration for `user_id→actor_id`, `action→TEXT`, drop `ip_address`/`user_agent`, add indexes |
| 3 | **Missing events FK + NOT NULL** | CANONICAL_DATABASE_SPEC.md §§ events | Add FK to services(id) and SET NOT NULL after renaming ministry_id |
| 4 | **Permission catalog mismatch (53≠52)** | CANONICAL_PERMISSION_CATALOG.md | Remove 7 extra codes, add 10 missing codes (incl. all platform_owner codes), add beneficiaries.transfer |
| 5 | **servant_stage_assignments missing unique constraint** | CANONICAL_ASSIGNMENT_MODEL.md §1.1 | Add `UNIQUE (servant_id, stage_id, class_id, end_date)` |
| 6 | **beneficiaries data loss — father/mother names + parent_phone** | CANONICAL_DATABASE_SPEC.md §§ beneficiaries | Archive dropped data to `notes` or backup table before dropping columns |
| 7 | **beneficiaries.stage_id index references non-existent column** | CANONICAL_DATABASE_SPEC.md Index Master List | Clarify: index must be removed OR stage_id column must be added to beneficiaries table. Per table definition, stage_id does NOT belong on beneficiaries. |
| 8 | **010: idx_profiles_church_active index collision** | Current migration 001 vs plan | Drop existing `idx_profiles_church_active` before recreating with different definition |

### ⚠️ Non-Blocking Improvements (6)

| # | Issue | Recommendation |
|---|-------|---------------|
| 1 | **Servant migration includes platform owner** | Add `AND church_id IS NOT NULL` to INSERT...SELECT |
| 2 | **beneficiaries.date_of_birth/gender NOT NULL may fail** | Add `WHERE date_of_birth IS NOT NULL AND gender IS NOT NULL` guard or set defaults before NOT NULL |
| 3 | **Missing stages index migration** | Add DROP old stages indexes, CREATE `idx_stages_service_sort` |
| 4 | **RLS drop-all approach creates exposure window** | Use table-by-table in single transaction |
| 5 | **beneficiary_assignments two-step data migration** | Resolve service_id from stage BEFORE insert, not after |
| 6 | **019: DROP TYPE CASCADE may break functions before 020 runs** | Order 020 before 019, or explicitly drop dependent functions in 019 |

### Summary

The execution plan has the structure right — 16 migrations in the correct order, covering all major schema transformations. However, the 8 blocking issues above represent schema elements that are simply absent from the plan, data that would be destroyed without migration, and permission codes that don't match the canonical catalog. These must be corrected before implementation can proceed.

The role model, assignment model, attendance architecture, and RLS policy design are all correct per canonical sources.

---

## 11. Resolution Summary (Post-Audit Fixes)

**Date:** 2026-07-30  
**Status:** ALL ISSUES RESOLVED ✅

All 8 blocking issues and 6 non-blocking improvements have been addressed in the updated EXECUTION_PLAN.md and SCHEMA_DIFF_REPORT.md. The plan now has 16 migrations (007-022).

| # | Issue | Fix Applied | Migration |
|---|-------|-------------|-----------|
| 1 | Missing `user_roles` columns + index | Added `start_date`, `end_date`, `assigned_by` NOT NULL, `idx_user_roles_user_active` | `020_user_roles_update.sql` |
| 2 | Missing `audit_logs` migration | `user_id→actor_id`, `action→TEXT`, drop `ip_address`/`user_agent`, new indexes | `019_audit_logs_update.sql` |
| 3 | Missing events FK + NOT NULL | Added FK `(service_id) REFERENCES services(id)`, `SET NOT NULL` | `007_services_table.sql` |
| 4 | Permission catalog 53≠52 | Removed 7 extra codes, added 10 missing (including PO codes), total = 52 | `021_role_and_permissions.sql` |
| 5 | Missing servant_stage_assignments UNIQUE | Added `UNIQUE (servant_id, stage_id, class_id, end_date)` | `012_servant_stage_assignments.sql` |
| 6 | Beneficiaries data loss | Archived `father_name_ar`/`mother_name_ar`/`parent_phone` to `notes` before DROP | `013_beneficiaries_table.sql` |
| 7 | `beneficiaries.stage_id` index | Changed to `idx_beneficiaries_church_status(church_id, status)`; canonical spec corrected | `013_beneficiaries_table.sql` + `CANONICAL_DATABASE_SPEC.md` |
| 8 | `idx_profiles_church_active` collision | Added `DROP INDEX IF EXISTS` before CREATE | `010_profiles_add_columns.sql` |

### Improvements Resolved

| # | Improvement | Fix Applied | Migration |
|---|-------------|-------------|-----------|
| 1 | Servant migration includes platform owner | Added `AND church_id IS NOT NULL` | `011_servants_table.sql` |
| 2 | `date_of_birth`/`gender` NOT NULL may fail | Added UPDATE guards before NOT NULL | `013_beneficiaries_table.sql` |
| 3 | Missing stages index migration | Drop old 3 indexes, CREATE `idx_stages_service_sort` | `007_services_table.sql` |
| 4 | RLS drop-all exposure window | Table-by-table within single transaction | `022_rls_implementation.sql` |
| 5 | Beneficiary_assignments two-step | Single-step via JOIN in INSERT | `014_beneficiary_assignments.sql` |
| 6 | `DROP TYPE CASCADE` breaks functions | Explicitly drop dependent functions before CASCADE | `021_role_and_permissions.sql` |

### Re-Audit Verdict

**Verdict: READY ✅** — All 8 blocking issues and 6 non-blocking improvements resolved. EXECUTION_PLAN.md and SCHEMA_DIFF_REPORT.md updated to reflect all fixes. Canonical spec index master list corrected for beneficiaries.
