# Staging Execution Order

**Status:** NOT READY — 3 blocking issues must be patched first  
**Target environment:** Staging (exact production replica)  

---

## Patch Blocking Issues First

Before any execution, apply these 3 patches to migration files:

### Patch 1: `007_services_table.sql` — Drop stale FKs

Insert after line 48 (after `ALTER TABLE events RENAME COLUMN ministry_id TO service_id;`):

```sql
-- DROP STALE FKs THAT STILL REFERENCE ministries (now renamed to backup)
ALTER TABLE stages DROP CONSTRAINT IF EXISTS stages_ministry_id_fkey;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_ministry_id_fkey;
ALTER TABLE events ADD FOREIGN KEY (service_id) REFERENCES services(id);
```

Then **remove** the duplicate FK addition on the original line 52:
```sql
-- ORIGINAL LINE 52 — DELETE this line (replaced above):
ALTER TABLE events ADD FOREIGN KEY (service_id) REFERENCES services(id);
```

Also add FK for stages since the canonical requires it:
```sql
ALTER TABLE stages ADD FOREIGN KEY (service_id) REFERENCES services(id);
```

### Patch 2: `021_role_and_permissions.sql` — Remove orphan codes

Add to the DELETE block at lines 94-99 (or as a new block after line 99):

```sql
-- Remove orphan codes not in canonical 52-code catalog
DELETE FROM permissions WHERE code IN ('auth.login', 'auth.manage', 'churches.read', 'churches.update');
```

---

## Execution Order (after patches applied)

```
Pre-flight: Verify PRODUCTION_READINESS_CHECKLIST.md items
Pre-flight: SET statement_timeout = '300000' (5 min)
Pre-flight: BEGIN on each migration (except 022 which has its own BEGIN/COMMIT)
```

### Step 1: 007_services_table.sql

**Action:** Create services, migrate data, rename FKs, backup ministries  
**Validation checkpoint:**
```sql
-- 1a. Verify services row count matches ministries_backup
SELECT count(*) FROM services;
SELECT count(*) FROM ministries_backup_20260730;

-- 1b. Verify stages have correct FK to services
SELECT count(*) FROM stages WHERE service_id NOT IN (SELECT id FROM services);
-- Must return 0

-- 1c. Verify events have correct FK to services
SELECT count(*) FROM events WHERE service_id NOT IN (SELECT id FROM services);
-- Must return 0 (service_id was nullable before, now NOT NULL)

-- 1d. Verify stages canonical index exists
SELECT indexname FROM pg_indexes WHERE tablename = 'stages' AND indexname = 'idx_stages_service_sort';
```
**Rollback checkpoint:** `INSERT INTO ministries SELECT * FROM ministries_backup_20260730` then DROP services, DROP services indexes, rename ministries_backup back, restore old stages indexes and events ministry_id.

---

### Step 2: 008_classes_table.sql

**Action:** Create classes table  
**Validation checkpoint:**
```sql
SELECT count(*) FROM classes;
SELECT indexname FROM pg_indexes WHERE tablename = 'classes' AND indexname = 'idx_classes_church_stage';
```
**Rollback checkpoint:** `DROP TABLE classes CASCADE`

---

### Step 3: 009_churches_add_columns.sql

**Action:** Add 9 columns, create subscription index  
**Validation checkpoint:**
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'churches' AND column_name = 'locale';
SELECT indexname FROM pg_indexes WHERE tablename = 'churches' AND indexname = 'idx_churches_subscription_status';
```
**Rollback checkpoint:** DROP 9 added columns, DROP idx_churches_subscription_status, recreate idx_churches_active

---

### Step 4: 010_profiles_add_columns.sql

**Action:** Add 4 columns, enforce email NOT NULL, replace indexes  
**Validation checkpoint:**
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'spiritual_title';
SELECT indexname FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_email';
```
**Rollback checkpoint:** DROP 4 columns, revert email to nullable, recreate old indexes, drop new indexes

---

### Step 5: 011_servants_table.sql

**Action:** Create servants table, migrate profiles  
**Validation checkpoint:**
```sql
-- 5a. Servant count = active profiles - platform owners
SELECT count(*) FROM servants;
SELECT count(*) FROM profiles WHERE deleted_at IS NULL AND church_id IS NOT NULL;
-- Must match

-- 5b. No platform owner in servants
SELECT count(*) FROM servants s JOIN profiles p ON p.id = s.id WHERE p.church_id IS NULL;
-- Must return 0

-- 5c. FK to profiles exists
SELECT count(*) FROM information_schema.table_constraints WHERE table_name = 'servants' AND constraint_type = 'FOREIGN KEY';
```
**Rollback checkpoint:** `DROP TABLE servants CASCADE`

---

### Step 6: 012_servant_stage_assignments.sql

**Action:** Create ssa table, migrate from user_stage_assignments  
**Validation checkpoint:**
```sql
-- 6a. Row count matches (or exceeds, if migrations add rows)
SELECT count(*) FROM servant_stage_assignments;
SELECT count(*) FROM user_stage_assignments_backup_20260730;

-- 6b. UNIQUE constraint exists
SELECT conname FROM pg_constraint WHERE conrelid = 'servant_stage_assignments'::regclass AND convalidated;
```
**Rollback checkpoint:** `DROP TABLE servant_stage_assignments CASCADE`, rename backup back to user_stage_assignments

---

### Step 7: 013_beneficiaries_table.sql

**Action:** Rename children→beneficiaries, restructure columns  
**Validation checkpoint:**
```sql
-- 7a. Key columns exist
SELECT column_name FROM information_schema.columns WHERE table_name = 'beneficiaries' AND column_name = 'full_name_ar';

-- 7b. Parent data archived
SELECT id, notes FROM beneficiaries WHERE notes LIKE '%الأب%' LIMIT 5;

-- 7c. Old columns dropped (should error)
SELECT column_name FROM information_schema.columns WHERE table_name = 'beneficiaries' AND column_name = 'father_name_ar';
-- Must return 0 rows

-- 7d. New columns exist
SELECT column_name FROM information_schema.columns WHERE table_name = 'beneficiaries' AND column_name IN ('father_mobile', 'mother_mobile', 'whatsapp');

-- 7e. Canonical index
SELECT indexname FROM pg_indexes WHERE tablename = 'beneficiaries' AND indexname = 'idx_beneficiaries_church_status';

-- 7f. Row count preserved
SELECT count(*) FROM beneficiaries;
```
**Rollback checkpoint:** Complex — requires table-level restore from backup. Prefer full-db pg_restore.

---

### Step 8: 014_beneficiary_assignments.sql

**Action:** Create ba table, migrate from beneficiaries.stage_id, drop stage_id  
**Pre-flight check (CRITICAL):**
```sql
-- Must return 0 rows before running
SELECT b.church_id, count(*) as orphans
FROM beneficiaries b
WHERE b.deleted_at IS NULL AND b.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM servants s WHERE s.church_id = b.church_id)
GROUP BY b.church_id;
```
**Validation checkpoint:**
```sql
-- 8a. ba has rows
SELECT count(*) FROM beneficiary_assignments;

-- 8b. stage_id dropped from beneficiaries (should error)
SELECT column_name FROM information_schema.columns WHERE table_name = 'beneficiaries' AND column_name = 'stage_id';
-- Must return 0 rows

-- 8c. Canonical indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'beneficiary_assignments' AND indexname = 'idx_ba_current';
```
**Rollback checkpoint:** `DROP TABLE beneficiary_assignments`, add stage_id back to beneficiaries, restore from pre-migration data via backup

---

### Step 9: 015_attendance_restructure.sql

**Action:** Create attendance_sessions + attendance_records, migrate  
**Validation checkpoint:**
```sql
-- 9a. Session count = distinct (stage, date) pairs from old table
SELECT count(*) FROM attendance_sessions;
SELECT count(DISTINCT (stage_id, attendance_date)) FROM attendance_backup_20260730;

-- 9b. Record count matches old table
SELECT count(*) FROM attendance_records;
SELECT count(*) FROM attendance_backup_20260730;

-- 9c. UNIQUE constraint
SELECT conname FROM pg_constraint WHERE conrelid = 'attendance_sessions'::regclass AND contype = 'u';

-- 9d. CHECK constraint
SELECT conname FROM pg_constraint WHERE conrelid = 'attendance_records'::regclass AND contype = 'c';
```
**Rollback checkpoint:** `DROP TABLE attendance_sessions CASCADE`, rename backup back to attendance

---

### Step 10: 016_followups_update.sql

**Action:** Update followups FKs, columns, type, status enum  
**Validation checkpoint:**
```sql
-- 10a. servant_id column exists
SELECT column_name FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'servant_id';

-- 10b. FK to servants exists
SELECT count(*) FROM information_schema.table_constraints WHERE table_name = 'followups' AND constraint_type = 'FOREIGN KEY';

-- 10c. Canonical index
SELECT indexname FROM pg_indexes WHERE tablename = 'followups' AND indexname = 'idx_followups_servant_status';

-- 10d. followup_status enum has correct values
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'followup_status'::regtype;
-- Expected: open, in_progress, completed, cancelled
```
**Rollback checkpoint:** Recreate old followups schema from backup. Complex — prefer pg_restore.

---

### Step 11: 017_spiritual_journal_entries.sql

**Action:** Create spiritual_journal_entries table  
**Validation checkpoint:**
```sql
SELECT count(*) FROM spiritual_journal_entries;
SELECT indexname FROM pg_indexes WHERE tablename = 'spiritual_journal_entries' AND indexname = 'idx_spiritual_servant_date';
```
**Rollback checkpoint:** `DROP TABLE spiritual_journal_entries CASCADE`

---

### Step 12: 018_notifications_update.sql

**Action:** Update notifications schema  
**Validation checkpoint:**
```sql
-- 12a. recipient_id exists
SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'recipient_id';

-- 12b. Canonical columns exist
SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications' AND column_name IN ('notification_type', 'is_read', 'data');

-- 12c. Canonical index
SELECT indexname FROM pg_indexes WHERE tablename = 'notifications' AND indexname = 'idx_notifications_recipient_read';
```
**Rollback checkpoint:** Complex column renames — prefer pg_restore.

---

### Step 13: 019_audit_logs_update.sql

**Action:** Update audit_logs schema  
**Validation checkpoint:**
```sql
-- 13a. actor_id exists
SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_id';

-- 13b. entity_id is NOT NULL
SELECT is_nullable FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity_id';
-- Must return NO

-- 13c. metadata exists
SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'metadata';

-- 13d. ip_address dropped (should error)
SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'ip_address';
-- Must return 0 rows
```
**Rollback checkpoint:** Re-add ip_address, user_agent, rename actor_id back to user_id, change action back to enum — complex. Prefer pg_restore.

---

### Step 14: 020_user_roles_update.sql

**Action:** Add columns, canonical index  
**Validation checkpoint:**
```sql
-- 14a. start_date and end_date exist
SELECT column_name FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'start_date';

-- 14b. assigned_by is NOT NULL
SELECT is_nullable FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'assigned_by';
-- Must return NO

-- 14c. Canonical index
SELECT indexname FROM pg_indexes WHERE tablename = 'user_roles' AND indexname = 'idx_user_roles_user_active';
```
**Rollback checkpoint:** DROP start_date, end_date, revert assigned_by to nullable, recreate old indexes, drop new index

---

### Step 15: 021_role_and_permissions.sql

**Action:** Update enum, fix permission catalog, re-seed function  
**Post-migration verification (CRITICAL):**
```sql
-- 15a. Exact permission count = 52
SELECT count(*) FROM permissions;
-- Must return 52

-- 15b. Check no orphan codes exist
SELECT code FROM permissions WHERE code IN ('users.create', 'users.delete', 'users.manage', 'auth.login', 'auth.manage', 'churches.read', 'churches.update', 'churches.manage');
-- Must return 0 rows

-- 15c. Verify enum values
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role_type'::regtype;
-- Expected: platform_owner, super_admin, admin, servant

-- 15d. Verify seed function exists
SELECT proname FROM pg_proc WHERE proname = 'seed_church_roles';

-- 15e. Verify old RLS functions were pre-dropped (should NOT exist)
SELECT proname FROM pg_proc WHERE proname IN ('get_user_role_types', 'user_has_role', 'user_has_any_role');
-- Must return 0 rows
```
**Rollback checkpoint:** Complex — requires full re-seed of old permissions and enum recreation. Prefer pg_restore.

---

### Step 16: 022_rls_implementation.sql

**Action:** Create 8 helper functions, 89 RLS policies  
**Validation checkpoint:**
```sql
-- 16a. Helper functions exist (count = 8)
SELECT proname FROM pg_proc WHERE proname LIKE 'get_user_%' OR proname LIKE 'user_is_%';
-- Expected: get_user_church_id, get_user_servant_id, user_is_platform_owner, user_is_super_admin, user_is_admin, get_user_service_ids, get_user_stage_ids, get_user_class_ids, get_user_assigned_beneficiary_ids

-- 16b. RLS enabled on all 25 tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
-- Must return 0 rows

-- 16c. Policy count = 89
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';

-- 16d. Check specific critical policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'beneficiaries' AND policyname = 'servant_read';
SELECT policyname FROM pg_policies WHERE tablename = 'spiritual_journal_entries' AND policyname = 'deny_admin_spiritual';
SELECT policyname FROM pg_policies WHERE tablename = 'beneficiary_assignments' AND policyname = 'immutable';
```
**Rollback checkpoint:** `DROP POLICY IF EXISTS` on all 25 tables — safe to re-run (idempotent). Old state loss is non-issue since all old policies were already explicitly dropped.

---

## Post-Execution Validation (all steps complete)

```sql
-- Full schema verification
SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Verify no old-name references remain
SELECT table_name, column_name FROM information_schema.columns
WHERE column_name LIKE '%ministry%' OR column_name LIKE '%child_id%'
  OR column_name LIKE '%user_stage%' OR column_name LIKE '%old_metadata%'
  OR column_name LIKE '%user_id%' AND table_name IN ('notifications', 'audit_logs');
-- Expected: 0 rows (all old names converted)

-- Verify enum cleanup
SELECT typname FROM pg_type WHERE typname IN (
  'child_status', 'pipeline_stage_type', 'followup_type',
  'notification_channel', 'notification_type', 'audit_action',
  'followup_status_old', 'user_role_type_old'
);
-- Expected: 0 rows (all old enums dropped)
```

---

## Execution Flow Diagram

```
007 → 008 → 009 → 010 → 011 → 012
                                  ↓
                           013 → 014 → 015
                                        ↓
                           016 → 017 → 018 → 019 → 020 → 021 → 022
```

All migrations must be executed in strict numerical order (007 → 022).  
No migration can be skipped.  
No parallel execution is safe due to FK dependencies.
