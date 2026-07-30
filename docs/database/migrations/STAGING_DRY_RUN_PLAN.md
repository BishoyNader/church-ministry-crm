# Staging Dry-Run Plan — Phase 2A Migration

**Date:** 2026-07-30  
**Target:** Staging environment (production clone without live traffic)  
**Duration estimate:** 2–4 hours (including verification)

---

## Prerequisites

1. **Staging database** — Production clone (`pg_dump` + `pg_restore`) with:
   - All existing tables, data, indexes, enums, functions, triggers, RLS policies
   - At least 1 church with realistic data (services, stages, children, attendance, etc.)
   - At least 1 platform owner profile (church_id IS NULL)
   - Auth schema (auth.users, auth.identities) for RLS testing
2. **Connection** — `psql` or `supabase db push` pointing at staging only
3. **Backup** — `pg_dump --clean` taken before any migration
4. **Rollback script** — `pg_restore --clean` ready if verification fails

---

## Pre-Run Validation

```bash
# 1. Verify staging is not production
echo "DB_URL: $DATABASE_URL" | grep -i staging || echo "⚠️  NOT staging — abort"

# 2. Verify we're starting from known state
psql $DATABASE_URL -c "SELECT COUNT(*) FROM ministries;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM children;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM attendance;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM user_stage_assignments;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM user_roles;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM permissions;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM profiles WHERE church_id IS NULL;"  # platform owner

# 3. Take full backup
pg_dump --clean --no-owner --no-acl -f pre_migration_backup_20260730.dump $DATABASE_URL
```

---

## Execution Order

Apply migrations sequentially. **Do NOT skip or reorder.**

```bash
# Use supabase migrations or psql -f
for f in \
  supabase/migrations/007_services_table.sql \
  supabase/migrations/008_classes_table.sql \
  supabase/migrations/009_churches_add_columns.sql \
  supabase/migrations/010_profiles_add_columns.sql \
  supabase/migrations/011_servants_table.sql \
  supabase/migrations/012_servant_stage_assignments.sql \
  supabase/migrations/013_beneficiaries_table.sql \
  supabase/migrations/014_beneficiary_assignments.sql \
  supabase/migrations/015_attendance_restructure.sql \
  supabase/migrations/016_followups_update.sql \
  supabase/migrations/017_spiritual_journal_entries.sql \
  supabase/migrations/018_notifications_update.sql \
  supabase/migrations/019_audit_logs_update.sql \
  supabase/migrations/020_user_roles_update.sql \
  supabase/migrations/021_role_and_permissions.sql \
  supabase/migrations/022_rls_implementation.sql; do
  echo "=== Applying $f ==="
  psql $DATABASE_URL -f "$f" -1
  if [ $? -ne 0 ]; then
    echo "FAILED at $f — rolling back"
    pg_restore --clean --no-owner --no-acl -d $DATABASE_URL pre_migration_backup_20260730.dump
    exit 1
  fi
done
```

**Use `-1` flag** to run each migration in a single transaction.

---

## Per-Migration Verification Gates

After each migration, run the corresponding check before proceeding to the next:

| # | Migration | Quick Check |
|---|-----------|-------------|
| 007 | `services_table` | `SELECT COUNT(*) FROM services; SELECT COUNT(*) FROM ministries_backup_20260730;` |
| 008 | `classes_table` | `SELECT table_name FROM information_schema.tables WHERE table_name='classes';` |
| 009 | `churches_add_columns` | `SELECT contact_email, subscription_tier FROM churches LIMIT 1;` |
| 010 | `profiles_add_columns` | `SELECT date_of_birth, gender FROM profiles LIMIT 1;` |
| 011 | `servants_table` | `SELECT COUNT(*) FROM servants;` — should match profiles with church_id |
| 012 | `ssa` | `SELECT COUNT(*) FROM servant_stage_assignments;` — should match backup |
| 013 | `beneficiaries` | `SELECT COUNT(*) FROM beneficiaries; SELECT full_name_ar FROM beneficiaries LIMIT 1;` |
| 014 | `ba` | `SELECT COUNT(*) FROM beneficiary_assignments; SELECT stage_id FROM beneficiaries LIMIT 1;` (should error) |
| 015 | `attendance` | `SELECT COUNT(*) FROM attendance_sessions; SELECT COUNT(*) FROM attendance_records;` |
| 016 | `followups` | `SELECT servant_id, next_action FROM followups LIMIT 1;` |
| 018 | `notifications` | `SELECT recipient_id, is_read FROM notifications LIMIT 1;` |
| 019 | `audit_logs` | `SELECT actor_id FROM audit_logs LIMIT 1;` |
| 020 | `user_roles` | `SELECT start_date, end_date FROM user_roles LIMIT 1;` |
| 021 | `role_perms` | `SELECT COUNT(*) FROM permissions;` — should be 52 |
| 022 | `rls` | `SELECT COUNT(*) FROM pg_policies WHERE schemaname='public';` — should be 89 |

---

## Post-Run Verification

After all 16 migrations complete:

```bash
# Run the full verification suite
psql $DATABASE_URL -f VERIFICATION_SCRIPT.md
```

Save output to `VERIFICATION_REPORT.md` and review:
- All row counts match
- All FK integrity checks return 0
- All expected indexes exist
- All expected policies exist (89 total)
- All enums have expected values
- Permission catalog = 52 codes
- All helper functions present
- No duplicate violations on UNIQUE constraints
- CHECK constraint on attendance_records has 0 violations

---

## Rollback Procedure

### Partial rollback (single failed migration)
```bash
# 1. Abort current migration
# 2. Restore from backup
pg_restore --clean --no-owner --no-acl -d $DATABASE_URL pre_migration_backup_20260730.dump
# 3. Fix the SQL, re-run from migration 007
```

### Full rollback (all migrations)
```bash
# Restore pre-migration dump
pg_restore --clean --no-owner --no-acl -d $DATABASE_URL pre_migration_backup_20260730.dump
```

### Per-migration reverse SQL (if backup is unavailable)

**007 reverse:**
```sql
INSERT INTO ministries (id, church_id, name_ar, name_en, description_ar, description_en, is_active, sort_order, created_at, updated_at, deleted_at)
SELECT id, church_id, name_ar, name_en, description_ar, description_en, is_active, sort_order, created_at, updated_at, deleted_at FROM ministries_backup_20260730;
DROP TABLE services CASCADE;
ALTER TABLE stages RENAME COLUMN service_id TO ministry_id;
ALTER TABLE events RENAME COLUMN service_id TO ministry_id;
ALTER TABLE ministries_backup_20260730 RENAME TO ministries;
```

**013 reverse:** Reverse the rename and restore columns (complex — use backup).

---

## Acceptance Criteria

The dry run passes when:
1. All 16 migrations apply without error
2. All verification queries pass
3. The existing application (served from staging) loads without schema errors
4. Basic CRUD operations work for an authenticated user
5. RLS policies permit/deny as expected per CANONICAL_RLS_SPEC.md

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Reviewer | | | |
| Approver | | | |
