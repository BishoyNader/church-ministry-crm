# Production Readiness Checklist

**Use before any staging or production execution.** Each item must be ticked before proceed.

---

## Pre-Flight — Blocking Issues (must fix)

- [ ] **B1: 007 — Drop stale FK on `stages`**
  ```sql
  ALTER TABLE stages DROP CONSTRAINT IF EXISTS stages_ministry_id_fkey;
  ALTER TABLE stages ADD FOREIGN KEY (service_id) REFERENCES services(id);
  ```
  Insert these between 007 line 43 and line 45.

- [ ] **B2: 007 — Drop stale FK on `events`**
  ```sql
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_ministry_id_fkey;
  ```
  Insert this on 007 line 48 (before the new FK is added on line 52).

- [ ] **B3: 021 — Remove 4 orphan permission codes**
  ```sql
  DELETE FROM permissions WHERE code IN ('auth.login', 'auth.manage', 'churches.read', 'churches.update');
  ```
  Add these DELETE statements to 021 after line 99, or add them to the existing
  DELETE block (lines 94-99).

---

## Pre-Flight — High-Risk (mitigate)

- [ ] **H1: 014 — Guard against empty-church NULL servant_id**
  Verify that every church in the database has at least one servant record
  before running 014. If any church has beneficiaries but no servants, the
  migration WILL fail with a NOT NULL violation.
  ```sql
  -- Pre-check query
  SELECT b.church_id, count(*) as orphan_beneficiaries
  FROM beneficiaries b
  WHERE b.deleted_at IS NULL AND b.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM servants s WHERE s.church_id = b.church_id)
  GROUP BY b.church_id;
  ```

- [ ] **H1: 014 — Alternative approach if orphans exist**
  Create a placeholder servant per church before running the migration, or
  change the migration to handle NULL servant_id (requires schema change).

---

## Pre-Flight — Database State

- [ ] Full pg_dump taken (pre-migration)
  ```bash
  pg_dump --clean --if-exists --format=custom -f pre_migration_backup_20260730.dump
  ```

- [ ] `auth.users` table has profiles for all users (run this check)
  ```sql
  SELECT id FROM auth.users WHERE id NOT IN (SELECT id FROM profiles);
  ```

- [ ] No orphan FK references exist on any table
  ```sql
  -- Check for FK constraints referencing non-existent tables
  SELECT conname, conrelid::regclass, confrelid::regclass
  FROM pg_constraint WHERE confrelid::regclass::text NOT IN (
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  );
  ```

- [ ] All enum values are known and mapped in migration 021
  ```sql
  SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role_type'::regtype;
  ```

- [ ] Permissions table has exactly 45 codes (pre-migration 021 baseline)
  ```sql
  SELECT count(*) FROM permissions;
  ```

---

## Pre-Flight — Environment

- [ ] STAGING environment is an exact replica of production (schema + data)
- [ ] Production DB connection string is NOT accessible from staging machine
- [ ] Supabase project has migration tracking enabled (`supabase_migrations` schema)
- [ ] Read-only replica exists for verification queries during migration
- [ ] Rollback script prepared and tested:
  ```bash
  pg_restore --clean --dbname=$STAGING_DB pre_migration_backup_20260730.dump
  ```

---

## Execution Safeguards

- [ ] All 16 migration files are read-only and checked into git
- [ ] Git tag created at current HEAD before execution:
  ```bash
  git tag pre_phase2b_$(date +%Y%m%d_%H%M%S)
  ```
- [ ] Each migration wrapped in explicit BEGIN/COMMIT (022 already has it)
- [ ] `statement_timeout` set to 5 minutes per migration
  ```sql
  SET statement_timeout = '300000';
  ```

---

## Post-Execution Verification

- [ ] Run VERIFICATION_SCRIPT.md — all 9 sections
- [ ] Verify row counts match between old and new tables:
  - `ministries` vs `services` (via backup table)
  - `children` vs `beneficiaries`
  - `attendance` vs `attendance_sessions + attendance_records`
  - `user_stage_assignments` vs `servant_stage_assignments`
- [ ] Verify FK constraints exist on all canonical relationships (see checklist below)
- [ ] Verify 52 permission codes:
  ```sql
  SELECT count(*) FROM permissions;
  ```
- [ ] Verify 89 RLS policies:
  ```sql
  SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
  ```
- [ ] Verify seed_church_roles function compiles:
  ```sql
  SELECT seed_church_roles((SELECT id FROM churches LIMIT 1));
  ```

---

## FK Constraint Verification (post-migration)

After all 16 migrations, these FK constraints must exist:

| Table | FK Column | References |
|-------|-----------|------------|
| services | church_id | churches(id) |
| stages | church_id | churches(id) |
| stages | service_id | services(id) |
| classes | church_id | churches(id) |
| classes | stage_id | stages(id) |
| profiles | church_id | churches(id) |
| servants | id | profiles(id) |
| servants | church_id | churches(id) |
| ssa | church_id | churches(id) |
| ssa | servant_id | servants(id) |
| ssa | service_id | services(id) |
| ssa | stage_id | stages(id) |
| ssa | class_id | classes(id) |
| ssa | assigned_by | profiles(id) |
| beneficiaries | church_id | churches(id) |
| ba | church_id | churches(id) |
| ba | beneficiary_id | beneficiaries(id) |
| ba | service_id | services(id) |
| ba | stage_id | stages(id) |
| ba | class_id | classes(id) |
| ba | servant_id | servants(id) |
| ba | assigned_by | profiles(id) |
| attendance_sessions | church_id | churches(id) |
| attendance_sessions | service_id | services(id) |
| attendance_sessions | stage_id | stages(id) |
| attendance_sessions | class_id | classes(id) |
| attendance_sessions | created_by | profiles(id) |
| attendance_records | church_id | churches(id) |
| attendance_records | session_id | attendance_sessions(id) |
| attendance_records | beneficiary_id | beneficiaries(id) |
| attendance_records | servant_id | servants(id) |
| attendance_records | recorded_by | profiles(id) |
| events | service_id | services(id) |

---

## Rollback Triggers

If any of these conditions are met, ABORT and rollback immediately:

| Condition | Check |
|-----------|-------|
| Row count mismatch > 5% between old/new tables | Compare backup vs new table row counts |
| Any migration fails after partial execution | The failing migration must be rolled back |
| Permission count ≠ 52 after migration 021 | `SELECT count(*) FROM permissions;` |
| RLS policy count ≠ 89 after migration 022 | `SELECT count(*) FROM pg_policies WHERE schemaname = 'public';` |
| Login test fails for any user role | Test login + basic SELECT for each role |
| `stages.service_id` has no FK to `services` | See FK check above |
