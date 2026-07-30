# Phase 1B Execution Checklist

**Date:** 2026-07-30
**Documents:** DATABASE_MIGRATION_PLAN.md, CLASS_ACCESS_ARCHITECTURE.md, RLS_IMPLEMENTATION_PLAN.md, DATA_MIGRATION_RISKS.md

---

## 1. Pre-Execution Gates

### 1.1 Go / No-Go Gate

| # | Condition | Status | Notes |
|---|-----------|--------|-------|
| 1 | All 5 planning documents approved by stakeholders | ☐ | |
| 2 | All source documents re-read and understood (PRD_V3, DATABASE_REQUIREMENTS, RBAC_ARCHITECTURE, SYSTEM_ARCHITECTURE) | ☐ | |
| 3 | No ongoing production incidents | ☐ | |
| 4 | Database backup procedure tested and verified | ☐ | |
| 5 | Rollback scripts written and tested on staging | ☐ | |
| 6 | Staging environment mirrors production schema | ☐ | |
| 7 | Team available for 48h post-migration monitoring | ☐ | |

**Decision:** ALL items must be checked before execution begins.

### 1.2 Pre-Migration Backup

```bash
# Full database backup
pg_dump -h $SUPABASE_DB_HOST -U postgres church_ministry_crm \
  --format=custom \
  --file=./backups/pre_phase_1b_$(date +%Y%m%d_%H%M%S).dump

# Export permissions + roles as JSON for reference
psql -h $SUPABASE_DB_HOST -U postgres -d church_ministry_crm \
  -c "SELECT json_agg(t) FROM (SELECT * FROM permissions) t" \
  > ./backups/permissions_pre_migration.json

psql -h $SUPABASE_DB_HOST -U postgres -d church_ministry_crm \
  -c "SELECT json_agg(t) FROM (SELECT r.role_type, p.code FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id JOIN roles r ON r.id = rp.role_id) t" \
  > ./backups/role_permissions_pre_migration.json
```

---

## 2. Migration Order

Each migration is a separate `.sql` file. They must run in sequence — each one depends on the previous.

```
supabase/migrations/
├── 007_rename_ministries_to_services.sql
├── 008_create_classes.sql
├── 009_add_churches_columns.sql
├── 010_add_profiles_columns.sql
├── 011_create_servants.sql
├── 012_create_servant_stage_assignments.sql
├── 013_rename_children_to_beneficiaries.sql
├── 014_create_beneficiary_assignments.sql
├── 015_restructure_attendance.sql
├── 016_update_followups.sql
├── 017_create_spiritual_journal.sql
├── 018_update_notifications.sql
├── 019_update_rbac_enums_and_permissions.sql
├── 020_rls_policies.sql
└── 021_seed_data.sql
```

---

## 3. Detailed Execution Steps

### Step 1: `007_rename_ministries_to_services.sql`

**Tables affected:** `ministries` → `services`, `stages` (FK rename)

**Actions:**
- [ ] Create `services` table
- [ ] Copy data from `ministries` to `services`
- [ ] Add `stages.service_id` column
- [ ] Migrate `stages.ministry_id` → `stages.service_id`
- [ ] Drop `stages.ministry_id_fkey` constraint
- [ ] Add `stages.service_id_fkey` constraint
- [ ] Drop old `ministries` table (or rename to `ministries_backup`)
- [ ] Update indexes

**Verification:**
- [ ] `SELECT COUNT(*) FROM services` = `SELECT COUNT(*) FROM ministries_backup`
- [ ] `SELECT COUNT(*) FROM stages WHERE service_id IS NULL` = 0
- [ ] `SELECT COUNT(*) FROM stages s LEFT JOIN services sv ON s.service_id = sv.id WHERE sv.id IS NULL` = 0

**Rollback:**
```sql
DROP TABLE services CASCADE;
ALTER TABLE stages RENAME COLUMN service_id TO ministry_id;
ALTER TABLE ministries_backup RENAME TO ministries;
```

---

### Step 2: `008_create_classes.sql`

**Tables affected:** `classes` (new)

**Actions:**
- [ ] Create `classes` table with FKs to `churches`, `stages`
- [ ] Create indexes
- [ ] Add update trigger

**Verification:**
- [ ] `SELECT count(*) FROM classes` returns 0 (no data yet)
- [ ] FK constraint test: `INSERT INTO classes (church_id, stage_id, name_ar) VALUES (..., 'nonexistent', 'test')` fails

**Rollback:**
```sql
DROP TABLE classes CASCADE;
```

---

### Step 3: `009_add_churches_columns.sql`

**Actions:**
- [ ] Add `contact_email`, `contact_phone`, `address_ar`, `address_en`
- [ ] Add `subscription_tier` text NOT NULL DEFAULT 'trial'
- [ ] Add `subscription_status` text NOT NULL DEFAULT 'active'
- [ ] Add `trial_ends_at` timestamptz
- [ ] Add `feature_flags` jsonb NOT NULL DEFAULT '{}'
- [ ] Add `locale` text NOT NULL DEFAULT 'ar'
- [ ] Create index `idx_churches_subscription_status`

**Verification:**
- [ ] `SELECT contact_email, subscription_tier, locale FROM churches LIMIT 1` returns expected defaults
- [ ] Existing churches have `locale = 'ar'` and `subscription_tier = 'trial'`

**Rollback:**
```sql
ALTER TABLE churches DROP COLUMN contact_email, DROP COLUMN contact_phone, DROP COLUMN address_ar, DROP COLUMN address_en, DROP COLUMN subscription_tier, DROP COLUMN subscription_status, DROP COLUMN trial_ends_at, DROP COLUMN feature_flags, DROP COLUMN locale;
```

---

### Step 4: `010_add_profiles_columns.sql`

**Actions:**
- [ ] Add `date_of_birth` date
- [ ] Add `gender` gender_type
- [ ] Add `spiritual_title` text
- [ ] Add `service_started_at` date
- [ ] Create index

**Verification:**
- [ ] `SELECT date_of_birth, gender, spiritual_title, service_started_at FROM profiles LIMIT 1` returns NULL values
- [ ] All existing profiles remain accessible

**Rollback:**
```sql
ALTER TABLE profiles DROP COLUMN date_of_birth, DROP COLUMN gender, DROP COLUMN spiritual_title, DROP COLUMN service_started_at;
```

---

### Step 5: `011_create_servants.sql`

**Actions:**
- [ ] Create `servants` table (PK = profiles.id)
- [ ] Create indexes
- [ ] Create update trigger
- [ ] Migrate data: INSERT INTO servants SELECT ... FROM profiles
- [ ] Update all profiles: set approval_status = 'approved' for existing users

**Verification:**
- [ ] `SELECT COUNT(*) FROM servants` = `SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL`
- [ ] Every profile has exactly one servant record:
  `SELECT COUNT(*) FROM profiles p LEFT JOIN servants s ON s.id = p.id WHERE s.id IS NULL AND p.deleted_at IS NULL` = 0
- [ ] FK constraint: `INSERT INTO servants (id, church_id) VALUES ('nonexistent', '...')` fails

**Rollback:**
```sql
DROP TABLE servants CASCADE;
```

---

### Step 6: `012_create_servant_stage_assignments.sql`

**Actions:**
- [ ] Create `servant_stage_assignments` table (new)
- [ ] Migrate data from `user_stage_assignments`, joining through `servants` and `stages`
- [ ] Default `role = 'servant'` for all migrated assignments
- [ ] Rename `user_stage_assignments` to `user_stage_assignments_backup`

**Verification:**
- [ ] `SELECT COUNT(*) FROM servant_stage_assignments` > 0
- [ ] No NULL servant_ids: `SELECT COUNT(*) FROM servant_stage_assignments WHERE servant_id IS NULL` = 0
- [ ] All service_ids resolve: `SELECT COUNT(*) FROM servant_stage_assignments ssa LEFT JOIN services sv ON ssa.service_id = sv.id WHERE sv.id IS NULL` = 0

**Rollback:**
```sql
DROP TABLE servant_stage_assignments CASCADE;
ALTER TABLE user_stage_assignments_backup RENAME TO user_stage_assignments;
```

---

### Step 7: `013_rename_children_to_beneficiaries.sql`

**Actions:**
- [ ] Rename `children` → `beneficiaries`
- [ ] Merge `first_name_ar` + `' '` + `last_name_ar` → `full_name_ar`
- [ ] Merge `first_name_en` + `' '` + `last_name_en` → `full_name_en`
- [ ] Add new columns: `address`, `school`, `father_mobile`, `mother_mobile`, `whatsapp`, `confession_father`
- [ ] Remove old columns: `ministry_id`, `stage_id`, `pipeline_stage`, `enrolled_at`, `emergency_contact_name`, `emergency_contact_phone`, `allergies`, `medical_conditions`, `medications`, `confession_frequency`, `spiritual_notes`, `school_name_ar`, `grade_level`, `parent_address_ar`, `father_name_ar`, `mother_name_ar`, `parent_phone`, `parent_email`, `created_by`
- [ ] Rename `children_backup` for safety

**Verification:**
- [ ] `SELECT COUNT(*) FROM beneficiaries` = `SELECT COUNT(*) FROM children_backup`
- [ ] No NULL full_name_ar: `SELECT COUNT(*) FROM beneficiaries WHERE full_name_ar IS NULL` = 0
- [ ] Names merged correctly: spot check a few records
- [ ] `SELECT * FROM beneficiaries WHERE status = 'active'` returns reasonable results

**Rollback:**
```sql
-- Rename backup back
ALTER TABLE children_backup RENAME TO children;
DROP TABLE beneficiaries CASCADE;
```

---

### Step 8: `014_create_beneficiary_assignments.sql`

**Actions:**
- [ ] Create `beneficiary_assignments` table
- [ ] Create indexes
- [ ] Migrate active beneficiary assignments from existing data
- [ ] Set `is_current = true` for active beneficiaries

**Verification:**
- [ ] `SELECT COUNT(*) FROM beneficiary_assignments ba JOIN beneficiaries b ON b.id = ba.beneficiary_id WHERE b.status = 'active' AND ba.is_current = true` matches active beneficiary count
- [ ] No NULL servant_id in current assignments:
  `SELECT COUNT(*) FROM beneficiary_assignments WHERE servant_id IS NULL AND is_current = true` = 0
- [ ] Each beneficiary has at most one current assignment:
  `SELECT beneficiary_id, COUNT(*) FROM beneficiary_assignments WHERE is_current = true GROUP BY beneficiary_id HAVING COUNT(*) > 1` = 0

**Rollback:**
```sql
DROP TABLE beneficiary_assignments CASCADE;
```

---

### Step 9: `015_restructure_attendance.sql`

**Actions:**
- [ ] Create `attendance_sessions` table
- [ ] Create `attendance_records` table
- [ ] Migrate distinct `(stage_id, attendance_date)` → `attendance_sessions`
- [ ] Migrate each `attendance` row → `attendance_records` with resolved `session_id`
- [ ] Rename old `attendance` → `attendance_backup`

**Verification:**
- [ ] `SELECT COUNT(*) FROM attendance_sessions` = distinct `(stage_id, attendance_date)` count from backup
- [ ] `SELECT COUNT(*) FROM attendance_records` = `SELECT COUNT(*) FROM attendance_backup WHERE child_id IS NOT NULL`
- [ ] `SELECT COUNT(*) FROM attendance_records ar LEFT JOIN attendance_sessions s ON s.id = ar.session_id WHERE s.id IS NULL` = 0
- [ ] `SELECT COUNT(*) FROM attendance_records ar LEFT JOIN beneficiaries b ON b.id = ar.beneficiary_id WHERE b.id IS NULL` = 0

**Rollback:**
```sql
ALTER TABLE attendance_backup RENAME TO attendance;
DROP TABLE attendance_records CASCADE;
DROP TABLE attendance_sessions CASCADE;
```

---

### Step 10: `016_update_followups.sql`

**Actions:**
- [ ] Rename `child_id` → `beneficiary_id`
- [ ] Rename `created_by` → `servant_id`
- [ ] Update FK constraints
- [ ] Add `next_action` column
- [ ] Drop `stage_id` column
- [ ] Update `followup_status` enum: add `'open'`, map `'scheduled'` → `'open'`, remove old enum

**Verification:**
- [ ] `SELECT COUNT(*) FROM followups WHERE status::text = 'open'` > 0
- [ ] `SELECT COUNT(*) FROM followups WHERE status::text = 'scheduled'` = 0
- [ ] `SELECT COUNT(*) FROM followups f LEFT JOIN beneficiaries b ON b.id = f.beneficiary_id WHERE b.id IS NULL` = 0

**Rollback:**
```sql
-- Reverse enum changes (complex — restore from backup)
-- Restore stage_id column
ALTER TABLE followups ADD COLUMN stage_id uuid REFERENCES stages(id);
```

---

### Step 11: `017_create_spiritual_journal.sql`

**Actions:**
- [ ] Create `spiritual_journal_entries` table
- [ ] Create UNIQUE index on `(servant_id, entry_date)`
- [ ] `spiritual_records` kept as-is (deprecated, not dropped)

**Verification:**
- [ ] `SELECT count(*) FROM spiritual_journal_entries` = 0 (new table, no migration)
- [ ] UNIQUE constraint: `INSERT INTO spiritual_journal_entries ... same servant_id + entry_date` fails
- [ ] `spiritual_records` still exists and is queryable

**Rollback:**
```sql
DROP TABLE spiritual_journal_entries CASCADE;
```

---

### Step 12: `018_update_notifications.sql`

**Actions:**
- [ ] Rename `user_id` → `recipient_id`
- [ ] Rename `type` → `channel`
- [ ] Add `is_read` boolean NOT NULL DEFAULT false
- [ ] Add `data` jsonb
- [ ] Drop old `channel` column
- [ ] Set existing `read_at` → `is_read = true` if read_at is not null
- [ ] Update indexes

**Verification:**
- [ ] `SELECT COUNT(*) FROM notifications WHERE is_read = false` matches expectations
- [ ] `SELECT recipient_id FROM notifications LIMIT 1` returns a valid profile UUID

**Rollback:**
```sql
-- Complex — restore from backup or reverse column changes manually
```

---

### Step 13: `019_update_rbac_enums_and_permissions.sql`

**Actions:**
- [ ] Create new `user_role_type_new` enum with values `['platform_owner', 'super_admin', 'admin', 'user']`
- [ ] Map `'church_admin'` → `'admin'`
- [ ] Map `'stage_leader'`, `'servant'`, `'viewer'` → `'user'`
- [ ] Update `roles.role_type` column type
- [ ] Update functions that reference `user_role_type`
- [ ] Rename permission codes: `children.*` → `beneficiaries.*`
- [ ] Add new permission codes: `services.*`, `classes.*`, `servants.*`, `spiritual.*`
- [ ] Remove deprecated codes
- [ ] Update `seed_church_roles` function with new mappings

**Verification:**
- [ ] `SELECT DISTINCT role_type FROM roles` returns `['super_admin', 'admin', 'user']`
- [ ] Super admins retain all permissions: spot check
- [ ] Admins retain scoped permissions: spot check
- [ ] Users have base permissions only: spot check
- [ ] `SELECT code FROM permissions WHERE code LIKE 'beneficiaries.%'` returns expected codes

**Rollback:**
```sql
-- Restore old enum from backup
-- Restore old permission codes
-- Restore old role mappings
```

---

### Step 14: `020_rls_policies.sql`

**Actions:**
- [ ] Drop all old RLS policies
- [ ] Enable RLS on all tables (verify already enabled)
- [ ] Create helper functions (if not already updated)
- [ ] Create tenant isolation policy for each table
- [ ] Create role-specific policies per RLS_IMPLEMENTATION_PLAN.md
- [ ] Create restrictive policy for spiritual_journal_entries (deny admin)

**Verification:**
- [ ] All tables have RLS enabled: `SELECT relname FROM pg_class JOIN pg_policy ON ...`
- [ ] Super admin can read all data in their church
- [ ] Admin sees only service-scoped data
- [ ] Servant sees only assigned beneficiaries
- [ ] Unauthenticated user sees nothing

**Rollback:**
```sql
-- Drop all new policies, restore old policies from backup
```

---

### Step 15: `021_seed_data.sql`

**Actions:**
- [ ] Update seed permissions for new codes
- [ ] Update role-permission mappings
- [ ] Update `seed_church_roles` function
- [ ] Ensure `seed_church_roles` creates correct role set per new schema
- [ ] Run `seed_church_roles` for existing churches (if needed)

**Verification:**
- [ ] All existing churches have all 3 roles: `super_admin`, `admin`, `user`
- [ ] Role-permission mapping coverage validated against RBAC_ARCHITECTURE.md

**Rollback:**
```sql
-- Re-seed with old permissions from backup file
```

---

## 4. Post-Migration Verification

### 4.1 Data Integrity Checks

- [ ] Row counts match pre-migration exports for all renamed tables
- [ ] No orphaned FK references in any table
- [ ] No NULL values in NOT NULL columns
- [ ] All enums have expected values
- [ ] All indexes exist and are valid

### 4.2 Application Smoke Tests

- [ ] Login flow works for all 3 role types
- [ ] Dashboard loads for super_admin
- [ ] Dashboard loads for admin (scoped)
- [ ] Dashboard loads for user (scoped)
- [ ] Beneficiary list loads for each role with correct scope
- [ ] Create beneficiary works as admin
- [ ] Create beneficiary is denied as user
- [ ] Record attendance creates session + records
- [ ] Follow-up creation works
- [ ] Spiritual journal is isolated from admin
- [ ] Super admin can view spiritual journals
- [ ] Notifications are delivered to correct recipients

### 4.3 Permission Regression

- [ ] Super admin can: create service, create stage, create class, delete beneficiary, manage roles
- [ ] Admin can: create beneficiary, transfer beneficiary, view attendance reports, import data
- [ ] Admin cannot: delete beneficiary, manage roles, delete service
- [ ] User can: record attendance, create follow-up, update their beneficiary, view own spiritual journal
- [ ] User cannot: create beneficiary, view all beneficiaries in stage (unless stage_leader), view spiritual journals of others

---

## 5. Success Criteria

| # | Criterion | Metric | Method |
|---|-----------|--------|--------|
| 1 | All 15 migration files execute without error | 0 errors | Migration log |
| 2 | Zero data loss | Row counts match pre-migration | Count comparison |
| 3 | All FK constraints valid | 0 orphans | Integrity queries |
| 4 | All 3 role types functional | Login + basic operation per role | Manual test |
| 5 | Tenant isolation maintained | Cross-church data leak test | Pen test |
| 6 | RLS policies operational | Unauthenticated = 0 rows | Anonymous query test |
| 7 | App boots without type errors | 0 TypeScript errors | `npm run typecheck` |
| 8 | CI passes | All tests green | CI pipeline |
| 9 | Performance acceptable | Dashboard loads < 2s | Manual timing |
| 10 | Rollback scripts proven | Successful restore on staging | Dry run |

---

## 6. Success Criteria Details

### 6.1 Data Integrity

```sql
-- Master integrity check
SELECT 'services' AS tbl, COUNT(*) FROM services
UNION ALL SELECT 'stages', COUNT(*) FROM stages
UNION ALL SELECT 'classes', COUNT(*) FROM classes
UNION ALL SELECT 'beneficiaries', COUNT(*) FROM beneficiaries
UNION ALL SELECT 'beneficiary_assignments', COUNT(*) FROM beneficiary_assignments WHERE is_current = true
UNION ALL SELECT 'attendance_sessions', COUNT(*) FROM attendance_sessions
UNION ALL SELECT 'attendance_records', COUNT(*) FROM attendance_records
UNION ALL SELECT 'servants', COUNT(*) FROM servants
UNION ALL SELECT 'servant_stage_assignments', COUNT(*) FROM servant_stage_assignments WHERE is_active = true
UNION ALL SELECT 'spiritual_journal_entries', COUNT(*) FROM spiritual_journal_entries;
```

### 6.2 RLS Verification

```sql
-- Run as different roles to verify RLS
-- Should return 0 rows for anonymous
SELECT current_user, COUNT(*) FROM beneficiaries;

-- Should return rows for authenticated user
-- (run via application with different roles)
```

---

## 7. Go / No-Go Gate (Post-Verification)

| # | Condition | Required By | Signed Off |
|---|-----------|-------------|------------|
| 1 | All migration scripts executed successfully | Engineer | ☐ |
| 2 | All verification queries pass | QA | ☐ |
| 3 | Smoke tests pass for all 3 role types | QA | ☐ |
| 4 | TypeScript compiles without errors | Engineer | ☐ |
| 5 | No PII data leaked to wrong roles | Security | ☐ |
| 6 | Stakeholder sign-off on data changes | PO | ☐ |

**Final Decision:** ☐ Go / ☐ No-Go (with reasons: _______________)

---

## 8. Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| Pre-migration backup | 30 min | Production access |
| Migration 007–009 | 15 min | Step 6 → Step 7 → Step 8 |
| Migration 010–012 | 15 min | Step 9 → Step 10 → Step 11 |
| Migration 013–015 | 30 min | Step 12 (largest data changes) |
| Migration 016–018 | 15 min | Step 13–15 (schema adjustments) |
| Migration 019 (RBAC) | 15 min | Step 16 |
| Migration 020 (RLS) | 15 min | Step 17 |
| Migration 021 (Seed) | 10 min | Step 18 |
| Post-migration verification | 60 min | All migrations complete |
| Application smoke tests | 60 min | Verification complete |
| TypeScript type regeneration | 15 min | Schema stable |
| Deploy + monitor | 120 min | All checks pass |

**Total estimated execution time:** ~6 hours (non-concurrent)

**Recommendation:** Begin at 09:00, expect completion by 17:00 with buffer.
