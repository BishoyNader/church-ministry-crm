# Data Migration Risk Review

**Date:** 2026-07-30
**Source Documents:** ARCHITECTURE_ALIGNMENT_REPORT.md, DATABASE_MIGRATION_PLAN.md, DATABASE_REQUIREMENTS.md

---

## 1. Breaking Changes

### 1.1 Table Renames

| Change | Impact | Severity |
|--------|--------|----------|
| `ministries` → `services` | All code referencing `ministries` table breaks. All FK references (`stages.ministry_id`, `events.ministry_id`, `children.ministry_id`) must update. | 🔴 Critical |
| `children` → `beneficiaries` | All code, types, queries, RLS policies referencing `children` break. FK references (`attendance.child_id`, `followups.child_id`) must update. | 🔴 Critical |
| `attendance` → `attendance_sessions` + `attendance_records` | All attendance code breaks. Complete restructure — not just rename. | 🔴 Critical |
| `user_stage_assignments` → `servant_stage_assignments` | All stage assignment code breaks. Schema expanded (new columns). | 🔴 Critical |

### 1.2 Column Changes

| Table | Change | Impact | Severity |
|-------|--------|--------|----------|
| `children` → `beneficiaries` | `first_name_ar` + `last_name_ar` → `full_name_ar` | All name references break. Search/indexing code must change. | 🔴 Critical |
| `children` → `beneficiaries` | `ministry_id`, `stage_id`, `pipeline_stage`, `enrolled_at`, `emergency_contact*`, `allergies`, `medical_conditions`, `medications`, `confession_frequency`, `spiritual_notes`, `school_name_ar`, `grade_level`, `parent_*`, `father_name_ar`, `mother_name_ar`, `created_by` **all removed** | Data migration required. Some fields lost if not migrated to new schema. | 🔴 Critical |
| `followups` | `child_id` → `beneficiary_id`, `created_by` → `servant_id`, `stage_id` removed | FK + FK references break. | 🟡 Medium |
| `followups` | `status` enum changed: `'scheduled'` → `'open'` | All existing follow-up records with `status = 'scheduled'` must be remapped. | 🟡 Medium |
| `notifications` | `user_id` → `recipient_id`, `type` → `channel`, `channel` → removed | Notification querying code and RLS must be rewritten. | 🟡 Medium |

### 1.3 Enum Changes

| Enum | Change | Impact | Severity |
|------|--------|--------|----------|
| `user_role_type` | `'church_admin'` → `'admin'`, `'stage_leader'` + `'servant'` + `'viewer'` → `'user'`, add `'platform_owner'` | All role-based RLS policies, permission checks, and guards must update. | 🔴 Critical |
| `followup_status` | `'scheduled'` → `'open'` | Application logic for follow-up status filtering breaks. | 🟡 Medium |

### 1.4 Schema Restructures

| Change | Impact | Severity |
|--------|--------|----------|
| Flat `attendance` → hierarchical `attendance_sessions` + `attendance_records` | All attendance APIs, queries, dashboards, and alerts break. | 🔴 Critical |
| Embedded assignment (`children.ministry_id`, `children.stage_id`) → `beneficiary_assignments` | All beneficiary → stage/servant resolution code breaks. | 🔴 Critical |
| `spiritual_records` (child-focused) → `spiritual_journal_entries` (servant-focused) | No data migration possible. Separate feature sets. Old table deprecated. | 🟡 Medium |

---

## 2. Existing Data Risks

### 2.1 Data Loss Risks

| Risk | Scenario | Mitigation |
|------|----------|------------|
| First/last name merge | `first_name_ar` + `' '` + `last_name_ar` → `full_name_ar`: if last_name_ar is empty, result has leading space | Use `TRIM(CONCAT(first_name_ar, ' ', COALESCE(last_name_ar, '')))` |
| Emergency contact data loss | `children.emergency_contact_name` and `emergency_contact_phone` have no equivalent in target `beneficiaries` schema | Keep backup table. Decide with PO whether to add as optional columns. |
| Medical data loss | `allergies`, `medical_conditions`, `medications` have no equivalent in target schema | Move to a separate `beneficiary_medical` table if needed, or add as optional JSONB on beneficiaries. |
| Spiritual notes loss | `children.spiritual_notes` has no equivalent in target schema | Move to `spiritual_journal_entries.spiritual_notes` per-beneficiary? Or discard if PO agrees. |
| Pipeline stage loss | `pipeline_stage` removed from beneficiaries (PRD doesn't include pipeline tracking) | Data is lost unless PO requests pipeline be preserved elsewhere. |
| Attendance date→session join | If two stages share same date, `attendance_sessions.UNIQUE(stage_id, session_date)` prevents conflicts. Existing flat `attendance` table has no `UNIQUE(stage_id, child_id, attendance_date)` conflict. | Verify no existing data has duplicate `(stage_id, child_id, attendance_date)` before migration. If duplicates exist, deduplicate or keep most recent. |

### 2.2 Data Integrity Risks

| Risk | Scenario | Mitigation |
|------|----------|------------|
| Orphaned attendance records | `attendance.child_id` references a deleted child. Migration to `attendance_records` will fail FK constraint on `beneficiaries`. | Before migration, delete or reassign orphaned records. |
| Servant-less beneficiaries | `beneficiary_assignments.servant_id` is NOT NULL. If a beneficiary has no servant assigned, migration fails. | Assign to stage_leader of their stage, or use a placeholder. |
| Stage-less beneficiaries | If a beneficiary's `stage_id` is NULL (not allowed by schema but check), migration fails. | Validate all data before migration. Set to default stage. |
| Duplicate assignment conflicts | `beneficiary_assignments.UNIQUE(beneficiary_id)` — only one current assignment per beneficiary. Existing data has one `stage_id` per child, so this should be safe. | Validate no child has multiple active `ministry_id`/`stage_id` combos. |

### 2.3 Size Considerations

| Table | Estimated Rows | Migration Complexity |
|-------|---------------|---------------------|
| `children` | ~1,000–10,000 | Low — simple INSERT SELECT |
| `attendance` | ~10,000–100,000 | Medium — join to create sessions |
| `followups` | ~1,000–5,000 | Low — simple FK updates |
| `user_stage_assignments` | ~100–1,000 | Low — few rows |
| `ministries` | ~10–100 | Low — tiny dataset |
| `spiritual_records` | ~0–1,000 | N/A — no migration |

**Performance note:** All migrations are single-transaction operations. For <100K rows, expect sub-second execution. No concerns.

---

## 3. Permission Risks

### 3.1 Role Mapping

| Current Role | Target Role | Risk |
|-------------|-------------|------|
| `super_admin` | `super_admin` | ✅ Direct mapping — no change |
| `church_admin` | `admin` | 🟡 Permissions may shrink if current `church_admin` had super_admin-scoped permissions in the old 47-code set |
| `stage_leader` | `user` (with `stage_leader` assignment role) | 🔴 **Critical** — if current `stage_leader` had `children.create` permission, they lose it in target `user` role. Create permissions are admin-only in PRD. |
| `servant` | `user` | ✅ Direct mapping |
| `viewer` | `user` | 🟡 Viewers currently get ALL read permissions. In target, `user` has scoped read. If a viewer previously could read all beneficiaries, they lose that access. |

### 3.2 Permission Code Remapping

| Current Code | Target Code | Risk |
|-------------|-------------|------|
| `children.read` | `beneficiaries.read` | 🟡 All code-level references must update. Role-permission mappings in DB must update. |
| `children.create` | `beneficiaries.create` | Same as above. |
| `children.update` | `beneficiaries.update` | Same as above. |
| `children.delete` | `beneficiaries.delete` | Same as above. |
| `children.export` | (removed) | 🔴 If any role had this permission, it will be orphaned after DELETE. |

### 3.3 Stage Assignment Permission Changes

| Current | Target | Risk |
|---------|--------|------|
| All `user_stage_assignments` grant stage access implicitly | `servant_stage_assignments.role` determines level: `servant` vs `stage_leader` | 🔴 **Critical** — all current assignments must default to `role = 'servant'` (most restrictive). Stage leaders must be manually upgraded to `stage_leader` after migration. |

If an admin currently manages multiple stages through `user_stage_assignments`, and the migration sets their role to `servant`, they will lose visibility of all beneficiaries not individually assigned to them.

**Mitigation:** Use a conservative default role mapping:

| Current | Default Target Role |
|---------|-------------------|
| super_admin → super_admin (not in ssa) | — |
| church_admin → ssa.role = 'service_admin' for all stages in church | ✅ Preserves admin access |
| stage_leader → ssa.role = 'stage_leader' for their stages | ✅ Preserves stage-level access |
| servant → ssa.role = 'servant' for their stages | ✅ Restrictive but correct |
| viewer → ssa.role = 'servant' for their stages, OR no assignment | 🟡 Viewers will see fewer beneficiaries |

---

## 4. Rollback Scenarios

### 4.1 Scenario: First/last name merge produces bad data

**Detection:** After migration, count beneficiaries with NULL `full_name_ar` or with leading spaces.
**Rollback:** Restore `children_backup` table. Re-run migration with corrected `TRIM(CONCAT(...))` logic.
**Impact:** Low — no data loss, re-runnable.

### 4.2 Scenario: Servant-less beneficiaries block `beneficiary_assignments` FK

**Detection:** Migration transaction fails with FK violation.
**Rollback:** Transaction rolls back automatically. No changes applied.
**Fix:** Identify all active beneficiaries without a stage-level servant assignment. Assign defaults or add to migration as `servant_id` optional (PRD requires it — decide with PO).

### 4.3 Scenario: Duplicate attendance records block `session_id` migration

**Detection:** Migration INSERT fails on `UNIQUE(stage_id, session_date)` constraint.
**Rollback:** Transaction rolls back.
**Fix:** Deduplicate: keep the first `attendance` record per `(stage_id, attendance_date)` pair, or verify that current schema's UNIQUE constraint prevents this.

### 4.4 Scenario: Role permission mapping incorrect

**Detection:** Users report missing access (e.g., stage_leader can't create children).
**Rollback:** Revert `user_role_type` enum migration. Restore old role/permission mappings from backup.
**Fix:** Update permission seed data to grant `beneficiaries.create` to admin role, ensure `stage_leader` assignment role is correctly mapped.

### 4.5 Scenario: Application code not updated before migration

**Detection:** App crashes on every page load referencing old table/column names.
**Rollback:** Restore database from backup. Deploy app code first, then run migration.
**Prevention:** Strict deployment order: (1) deploy updated app code with backward compatibility, (2) run migration, (3) deploy cleanup that removes backward-compat code.

---

## 5. Validation Checklist

### 5.1 Pre-Migration Validation

Run these checks on the production database before migration:

- [ ] **No orphaned FK references:** `SELECT COUNT(*) FROM attendance a WHERE NOT EXISTS (SELECT 1 FROM children c WHERE c.id = a.child_id)`
- [ ] **No duplicate attendance records:** Check for `(stage_id, child_id, attendance_date)` duplicates in `attendance`
- [ ] **All children have ministry_id + stage_id:** `SELECT COUNT(*) FROM children WHERE ministry_id IS NULL OR stage_id IS NULL`
- [ ] **Profile completeness:** `SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL AND church_id IS NOT NULL`
- [ ] **Permission integrity:** `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code LIKE 'children.%'` (will all be updated)
- [ ] **Role distribution:** `SELECT r.role_type, COUNT(ur.user_id) FROM user_roles ur JOIN roles r ON r.id = ur.role_id GROUP BY r.role_type` (know your role counts before migration)
- [ ] **Backup exists:** Verify database dump file exists and is readable

### 5.2 Post-Migration Validation

Run these checks after migration:

- [ ] **Row count match:** Each `INSERT ... SELECT` produced equal or near-equal row counts
- [ ] **No orphaned rows:** Check FK integrity on all new/renamed tables
- [ ] **Permission codes renamed:** `SELECT code FROM permissions WHERE code LIKE 'beneficiaries.%'` returns expected codes
- [ ] **Roles updated:** `SELECT DISTINCT role_type FROM roles` returns `['platform_owner', 'super_admin', 'admin', 'user']`
- [ ] **Stage assignments migrated:** `SELECT COUNT(*) FROM servant_stage_assignments` equals `SELECT COUNT(*) FROM user_stage_assignments_backup`
- [ ] **Beneficiary assignments created:** `SELECT COUNT(*) FROM beneficiary_assignments WHERE is_current = true` equals `SELECT COUNT(*) FROM beneficiaries WHERE status = 'active'`
- [ ] **Attendance sessions created:** `SELECT COUNT(*) FROM attendance_sessions` matches distinct `(stage_id, attendance_date)` pairs from backup
- [ ] **Attendance records migrated:** `SELECT COUNT(*) FROM attendance_records` equals `SELECT COUNT(*) FROM attendance_backup WHERE child_id IS NOT NULL`

### 5.3 Application-Level Validation

- [ ] **Super Admin can see all beneficiaries:** Log in as super_admin → verify all beneficiaries visible
- [ ] **Admin sees service-scoped data:** Verify admin sees only beneficiaries in assigned services
- [ ] **Servant sees only assigned beneficiaries:** Verify servant cannot browse outside their assignment
- [ ] **Stage leader sees all beneficiaries in stage:** Verify stage-assigned user can see entire stage roster
- [ ] **Spiritual journal isolated:** Verify admin cannot see spiritual journals; super_admin can
- [ ] **Notifications delivered:** Verify existing notifications are readable by the correct recipients
- [ ] **Attendance recording works:** Create new session + records. Verify they appear on dashboard.

---

## 6. Risk Summary Matrix

| # | Risk | Likelihood | Impact | Priority | Mitigation |
|---|------|------------|--------|----------|------------|
| R1 | First/last name merge produces dirty data | Medium | Low | 🟡 Medium | Use TRIM + COALESCE. Verify after migration. |
| R2 | Servant-less beneficiaries block migration | Medium | High | 🔴 High | Pre-migration query to identify orphans. Decide default servant. |
| R3 | Duplicate attendance records block session creation | Low | Medium | 🟡 Medium | Pre-migration deduplication query. |
| R4 | Role permission mapping too restrictive | Medium | High | 🔴 High | Conservative default mapping. Manual override for stage_leader→admin upgrade. |
| R5 | App code deployed before migration | Low | Critical | 🔴 High | Strict deployment order documented. |
| R6 | Data migration produces wrong role assignments | Medium | High | 🔴 High | Default all to `servant`, have post-migration script to upgrade stage leaders. |
| R7 | Viewers lose read access to church data | Medium | Medium | 🟡 Medium | Verify viewer-to-user mapping. Assign appropriate `servant_stage_assignments`. |
| R8 | Pipeline stage data lost without PO approval | Low | Medium | 🟡 Medium | Confirm with PO before migration. |

---

## 7. Deployment Order

```
 1. FREEZE: No database changes 24h before migration
 2. BACKUP: Full database dump
 3. BACKUP: Export current permissions + role data to JSON
 4. CODE: Deploy updated app code (with backward-compat for old schema)
 5. VERIFY: Smoke test app with old schema + new code
 6. MIGRATE: Run database migration scripts sequentially
 7. VERIFY: Run post-migration validation queries
 8. VERIFY: Smoke test app with new schema
 9. CODE: Deploy cleanup release (remove backward-compat code)
10. MONITOR: Watch error logs for 24 hours
11. UNFREEZE: Database changes allowed again
12. CLEANUP: Drop backup tables after 30 days
```
