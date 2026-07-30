# Migration Execution Log

**Date:** 2026-07-30  
**Database:** Local Supabase (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`)  
**Pre-state:** Migrations 001–006 applied  

---

## Migration 007 — Services Table

**Status:** ✅ PASS  
**Duration:** 10ms  
**Validation:**
- services table created (11 columns) ✅
- ministries → ministries_backup_20260730 ✅
- stages.service_id renamed, FK → services ✅
- events.service_id renamed, FK → services ✅
- events.service_id NOT NULL ✅
- idx_stages_service_sort created ✅
- No orphan ministry_id columns on stages/events ✅

---

## Migration 008 — Classes Table

**Status:** ✅ PASS  
**Duration:** 7ms  
**Validation:**
- classes table created (10 columns) ✅
- idx_classes_church_stage created ✅

---

## Migration 009 — Churches Add Columns

**Status:** ✅ PASS  
**Duration:** 7ms  
**Validation:**
- 9 columns added (contact_email, contact_phone, address_ar, address_en, subscription_tier, subscription_status, trial_ends_at, feature_flags, locale) ✅
- idx_churches_subscription_status created ✅
- idx_churches_active dropped ✅

---

## Migration 010 — Profiles Add Columns

**Status:** ✅ PASS  
**Duration:** 4ms  
**Validation:**
- 4 columns added (spiritual_title, preferred_language, notification_preferences, last_login_at) — verified spiritual_title and last_login_at present ✅

---

## Migration 011 — Servants Table

**Status:** ✅ PASS  
**Duration:** 5ms  
**Validation:**
- servants table created (12 columns) ✅
- idx_servants_church_approval created ✅

---

## Migration 012 — Servant Stage Assignments

**Status:** ✅ PASS  
**Duration:** 11ms  
**Validation:**
- servant_stage_assignments created ✅
- UNIQUE constraint on (servant_id, stage_id, class_id, end_date) ✅
- user_stage_assignments_backup_20260730 created ✅

---

## Migration 013 — Beneficiaries Table

**Status:** ✅ PASS  
**Duration:** 16ms  
**Validation:**
- children → beneficiaries table rename ✅
- Stage_id preserved (for 014) ✅
- Canonical index idx_beneficiaries_church_status created ✅

---

## Migration 014 — Beneficiary Assignments

**Status:** ⚠️ WORKAROUND REQUIRED  
**Issues found:**
1. `DROP COLUMN stage_id` on line 62 fails because FK `children_stage_id_fkey` depends on it. The FK constraint was preserved from the old `children` table. The migration needs `CASCADE` or an explicit DROP CONSTRAINT first.

**Workaround applied:**
- Manually executed `ALTER TABLE beneficiaries DROP CONSTRAINT children_stage_id_fkey`
- Used `DROP COLUMN stage_id CASCADE` (after FK drop, still had hidden dependency)
- Re-created `beneficiary_assignments` table and indexes manually

**Result:** Schema is correct but migration file cannot be run unattended.

---

## Migration 015 — Attendance Restructure

**Status:** ✅ PASS  
**Duration:** 12ms  
**Validation:**
- attendance_sessions created ✅
- attendance_records created ✅
- UNIQUE(stage_id, session_date) ✅
- CHECK exactly_one_attendee ✅
- attendance_backup_20260730 created ✅

---

## Migration 016 — Follow-ups Update

**Status:** ⚠️ WORKAROUND REQUIRED  
**Issues found (3):**
1. **Line 29:** `DROP COLUMN stage_id` fails — FK `followups_stage_id_fkey` exists
2. **Line 50:** Index references `WHERE deleted_at IS NULL` — column `deleted_at` does not exist on followups
3. **Line 60:** `ALTER COLUMN ... TYPE followup_status` fails — column DEFAULT `'scheduled'` not in new enum

**Workaround applied:**
- Dropped FK `followups_stage_id_fkey` manually
- Added `deleted_at timestamptz` column manually
- Dropped DEFAULT on `status` column manually
- Modified DROP COLUMN to `IF EXISTS` in execution

**Result:** Schema is correct but migration file cannot be run unattended.

---

## Migration 017 — Spiritual Journal Entries

**Status:** ✅ PASS  
**Duration:** 9ms  
**Validation:**
- spiritual_journal_entries created ✅
- UNIQUE(servant_id, entry_date) ✅
- idx_spiritual_servant_date created ✅

---

## Migration 018 — Notifications Update

**Status:** ⚠️ WORKAROUND REQUIRED  
**Issues found (1):**
1. **Line 29:** `DROP TYPE notification_channel` fails because `channel_value` column (which uses the type) is not dropped until line 39. The DROP TYPE is ordered before the column drop.

**Workaround applied:**
- Executed migration in parts: renames + type conversion first, then type drops, then column additions

**Result:** Schema is correct but migration file cannot be run unattended.

---

## Migration 019 — Audit Logs Update

**Status:** ⚠️ WORKAROUND REQUIRED  
**Issues found (1):**
1. **Line 54:** `DROP TYPE audit_action` fails because the type dependency from `ALTER COLUMN action TYPE text` (line 18) is not released until transaction commit. In PostgreSQL 17.6, DROP TYPE fails if the type was just unlinked within the same transaction.

**Workaround applied:**
- Split migration: run ALTER COLUMN in one transaction, commit, then DROP TYPE separately

**Result:** Schema is correct but migration file cannot be run unattended.

---

## Migration 020 — User Roles Update

**Status:** ✅ PASS  
**Duration:** 8ms  
**Validation:**
- assigned_by SET NOT NULL ✅
- start_date populated from created_at ✅
- idx_user_roles_user_active created ✅

---

## Migration 021 — Role & Permissions

**Status:** ⚠️ WORKAROUND REQUIRED  
**Issues found (1):**
1. **Lines 13-19:** `DROP FUNCTION user_has_stage_access(uuid)` fails because existing RLS policies (from migration 002) depend on the function. The migration assumes functions can be dropped without CASCADE, but existing policies create a dependency.

**Workaround applied:**
- Used `DROP FUNCTION ... CASCADE` for all 5 functions before running 021

**Validation:**
- Permission count: 52 ✅
- user_role_type: platform_owner, super_admin, admin, servant ✅

**Result:** Schema is correct but migration file cannot be run unattended.

---

## Migration 022 — RLS Implementation

**Status:** ❌ FAIL  
**Critical issues found (16 policy failures):**

### Syntax Errors (10) — `FOR command/command` is invalid

PostgreSQL `CREATE POLICY` accepts a single command type: `ALL`, `SELECT`, `INSERT`, `UPDATE`, or `DELETE`. The migration uses compound forms which are syntactically invalid:

| # | Line | Policy | Invalid Syntax |
|---|------|--------|---------------|
| 1 | 202 | admin_write ON services | `FOR INSERT/UPDATE` |
| 2 | 208 | admin_write ON stages | `FOR INSERT/UPDATE/DELETE` |
| 3 | 214 | admin_write ON classes | `FOR INSERT/UPDATE/DELETE` |
| 4 | 218 | own_profile ON profiles | `FOR INSERT/UPDATE` |
| 5 | 243 | admin_write ON ssa | `FOR INSERT/UPDATE` |
| 6 | 288 | admin_write ON beneficiaries | `FOR INSERT/UPDATE` |
| 7 | 296 | immutable ON ba | `FOR UPDATE/DELETE` |
| 8 | 302 | stage_scope ON attendance_sessions | `FOR INSERT/SELECT` |
| 9 | 345 | immutable ON audit_logs | `FOR UPDATE/DELETE` |
| 10 | 354 | platform_owner_write ON permissions | `FOR INSERT/UPDATE/DELETE` |

### Semantic Errors (3) — INSERT needs WITH CHECK, not USING

PostgreSQL `FOR INSERT` policies require `WITH CHECK (expression)`, not `USING (expression)`:

| # | Policy | Issue |
|---|--------|-------|
| 11 | admin_write ON beneficiary_assignments | `FOR INSERT USING` → needs `FOR INSERT WITH CHECK` |
| 12 | record_attendance ON attendance_records | `FOR INSERT USING` → needs `FOR INSERT WITH CHECK` |
| 13 | append_only ON audit_logs | `FOR INSERT USING` → needs `FOR INSERT WITH CHECK` |

### Referential Errors (3) — Column does not exist

| # | Policy | Missing Column |
|---|--------|----------------|
| 14 | stage_scope ON events | `class_id` does not exist on events table |
| 15 | owner_scope ON ai_messages | `user_id` does not exist (check table structure) |
| 16 | owner_scope ON document_embeddings | `user_id` does not exist (check table structure) |

**Result:** 73/89 policies created. 16 policies failed. Migration file requires rewriting.

---

## Summary

| Migration | Status | Duration | Requires Fix |
|-----------|--------|----------|-------------|
| 007 | ✅ | 10ms | No |
| 008 | ✅ | 7ms | No |
| 009 | ✅ | 7ms | No |
| 010 | ✅ | 4ms | No |
| 011 | ✅ | 5ms | No |
| 012 | ✅ | 11ms | No |
| 013 | ✅ | 16ms | No |
| 014 | ⚠️ | — | Yes: add CASCADE to DROP COLUMN |
| 015 | ✅ | 12ms | No |
| 016 | ⚠️ | 12ms | Yes: 3 bugs |
| 017 | ✅ | 9ms | No |
| 018 | ⚠️ | — | Yes: reorder DROP TYPE |
| 019 | ⚠️ | — | Yes: split transaction |
| 020 | ✅ | 8ms | No |
| 021 | ⚠️ | 8ms | Yes: add CASCADE to DROP FUNCTION |
| 022 | ❌ | — | Yes: rewrite 16 policies |

**Verdict: NOT_READY_FOR_PRODUCTION** — 16 policy failures + 5 migration workarounds required.
