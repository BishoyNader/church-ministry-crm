# Execution Plan — Phase 2A Database Schema Implementation

**Date:** 2026-07-30  
**Status:** REVISED — blocking issues resolved, pending re-audit  

---

## Overview

Implement all 16 migrations (007-022) to transform the current schema into the canonical schema defined in `CANONICAL_DATABASE_SPEC.md`, then apply the RLS policy suite from `CANONICAL_RLS_SPEC.md`, the permission catalog from `CANONICAL_PERMISSION_CATALOG.md`, and the role model from `CANONICAL_ROLE_MODEL.md`.

**Revision audit:** 8 blocking issues resolved (see EXECUTION_PLAN_AUDIT_REPORT.md §10).

---

## Execution Phases

### Phase 1: Schema Migrations (16 files, sequential)

| # | File | Action |
|---|------|--------|
| 1 | `007_services_table.sql` | Rename `ministries` → `services`, update FK in `stages` and `events`, add events FK/NOT NULL, add stages canonical index |
| 2 | `008_classes_table.sql` | Create `classes` table |
| 3 | `009_churches_add_columns.sql` | Add 8 columns to `churches` |
| 4 | `010_profiles_add_columns.sql` | Add 4 columns to `profiles`, fix index collision |
| 5 | `011_servants_table.sql` | Create `servants`, migrate data (exclude platform owner) |
| 6 | `012_servant_stage_assignments.sql` | Create `servant_stage_assignments` with UNIQUE constraint, migrate from `user_stage_assignments`, drop old |
| 7 | `013_beneficiaries_table.sql` | Rename `children` → `beneficiaries`, restructure columns, archive parent data before drop, keep `stage_id` for 014 |
| 8 | `014_beneficiary_assignments.sql` | Create `beneficiary_assignments`, migrate data (single-step service_id resolution), drop `stage_id` from beneficiaries |
| 9 | `015_attendance_restructure.sql` | Create `attendance_sessions` + `attendance_records`, migrate from `attendance`, drop old |
| 10 | `016_followups_update.sql` | Update followups FKs, status enum, columns |
| 11 | `017_spiritual_journal_entries.sql` | Create `spiritual_journal_entries` |
| 12 | `018_notifications_update.sql` | Update notifications schema |
| 13 | `019_audit_logs_update.sql` | Rename `user_id→actor_id`, `action→TEXT`, drop `ip_address`/`user_agent`, add indexes |
| 14 | `020_user_roles_update.sql` | Add `assigned_by` NOT NULL, `start_date`, `end_date`, canonical index |
| 15 | `021_role_and_permissions.sql` | Update `user_role_type` enum, fix permission catalog (52 codes), add 10 missing PO codes, drop old RLS functions before CASCADE, re-seed roles |
| 16 | `022_rls_implementation.sql` | Drop old functions, create 8 canonical helper functions, 89 table-by-table RLS policies in single transaction |

### Phase 2: Verification

Run verification queries and generate `VERIFICATION_REPORT.md`.

---

## Migration File Contents

### 007_services_table.sql

```sql
-- Create services table (replaces ministries)
CREATE TABLE services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  name_ar     text NOT NULL,
  name_en     text,
  description_ar text,
  description_en text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_services_church_active ON services (church_id) WHERE deleted_at IS NULL;

-- Data migration
INSERT INTO services (id, church_id, name_ar, name_en, description_ar, description_en, sort_order, is_active, created_at, updated_at, deleted_at)
SELECT id, church_id, name_ar, name_en, description_ar, description_en, sort_order, is_active, created_at, updated_at, deleted_at FROM ministries;

-- Update stages FK
ALTER TABLE stages RENAME COLUMN ministry_id TO service_id;

-- Update events FK
ALTER TABLE events RENAME COLUMN ministry_id TO service_id;

-- Add events FK constraint and NOT NULL (BLOCKING ISSUE 3)
ALTER TABLE events ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE events ADD FOREIGN KEY (service_id) REFERENCES services(id);

-- Drop old stages indexes, create canonical index (IMPROVEMENT 3)
DROP INDEX IF EXISTS idx_stages_church;
DROP INDEX IF EXISTS idx_stages_church_ministry;
DROP INDEX IF EXISTS idx_stages_church_active;
CREATE INDEX idx_stages_service_sort ON stages (service_id, sort_order) WHERE deleted_at IS NULL;

-- Backup and drop ministries
ALTER TABLE ministries RENAME TO ministries_backup_20260730;
```

### 008_classes_table.sql

```sql
CREATE TABLE classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  stage_id    uuid NOT NULL REFERENCES stages (id) ON DELETE CASCADE,
  name_ar     text NOT NULL,
  name_en     text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_church_stage ON classes (church_id, stage_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### 009_churches_add_columns.sql

```sql
ALTER TABLE churches ADD COLUMN contact_email text;
ALTER TABLE churches ADD COLUMN contact_phone text;
ALTER TABLE churches ADD COLUMN address_ar text;
ALTER TABLE churches ADD COLUMN address_en text;
ALTER TABLE churches ADD COLUMN subscription_tier text NOT NULL DEFAULT 'trial';
ALTER TABLE churches ADD COLUMN subscription_status text NOT NULL DEFAULT 'active';
ALTER TABLE churches ADD COLUMN trial_ends_at timestamptz;
ALTER TABLE churches ADD COLUMN feature_flags jsonb NOT NULL DEFAULT '{}';
ALTER TABLE churches ADD COLUMN locale text NOT NULL DEFAULT 'ar';

CREATE INDEX idx_churches_subscription_status ON churches (subscription_status) WHERE deleted_at IS NULL;

-- Drop old index that's being replaced
DROP INDEX IF EXISTS idx_churches_active;
```

### 010_profiles_add_columns.sql

```sql
ALTER TABLE profiles ADD COLUMN date_of_birth date;
ALTER TABLE profiles ADD COLUMN gender gender_type;
ALTER TABLE profiles ADD COLUMN spiritual_title text;
ALTER TABLE profiles ADD COLUMN service_started_at date;

ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;

-- Replace email + phone indexes with canonical indexes
DROP INDEX IF EXISTS idx_profiles_church_email;
DROP INDEX IF EXISTS idx_profiles_church_phone;

-- Fix index collision: drop old idx_profiles_church_active before recreating (BLOCKING ISSUE 8)
DROP INDEX IF EXISTS idx_profiles_church_active;

CREATE UNIQUE INDEX idx_profiles_email ON profiles (email);
CREATE INDEX idx_profiles_church_active ON profiles (church_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_spiritual_title ON profiles (church_id, spiritual_title) WHERE deleted_at IS NULL AND spiritual_title IS NOT NULL;
```

### 011_servants_table.sql

```sql
CREATE TABLE servants (
  id                    uuid PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  church_id             uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  confession_father_name text,
  join_date             date,
  service_history       jsonb NOT NULL DEFAULT '[]',
  notes                 text,
  approval_status       text NOT NULL DEFAULT 'pending',
  approved_by           uuid REFERENCES profiles (id),
  approved_at           timestamptz,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_servants_church_approval ON servants (church_id, approval_status) WHERE deleted_at IS NULL;

-- Migrate existing profiles to servants, EXCLUDING platform owner (church_id IS NULL)
-- (IMPROVEMENT 1 — platform owner has no servant record per CANONICAL_ROLE_MODEL.md)
INSERT INTO servants (id, church_id, notes, approval_status, created_at, updated_at)
SELECT id, church_id, NULL, 'approved', now(), now()
FROM profiles
WHERE deleted_at IS NULL AND church_id IS NOT NULL;

CREATE TRIGGER trg_servants_updated_at
  BEFORE UPDATE ON servants
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Verify platform owner was excluded
-- SELECT COUNT(*) FROM servants WHERE church_id IS NULL;
```

### 012_servant_stage_assignments.sql

```sql
CREATE TABLE servant_stage_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  servant_id  uuid NOT NULL REFERENCES servants (id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES services (id),
  stage_id    uuid REFERENCES stages (id),
  class_id    uuid REFERENCES classes (id),
  role        text NOT NULL DEFAULT 'servant',
  assigned_by uuid NOT NULL REFERENCES profiles (id),
  start_date  date NOT NULL DEFAULT CURRENT_DATE,
  end_date    date,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ssa_servant_active ON servant_stage_assignments (servant_id, is_active);
CREATE INDEX idx_ssa_stage_active ON servant_stage_assignments (church_id, stage_id, is_active);
CREATE INDEX idx_ssa_service_active ON servant_stage_assignments (church_id, service_id, is_active);

-- Add unique constraint per CANONICAL_ASSIGNMENT_MODEL.md §1.1 (BLOCKING ISSUE 5)
ALTER TABLE servant_stage_assignments ADD UNIQUE (servant_id, stage_id, class_id, end_date);

-- Migrate from user_stage_assignments
INSERT INTO servant_stage_assignments (church_id, servant_id, service_id, stage_id, class_id, role, assigned_by, start_date, is_active, created_at)
SELECT
  usa.church_id,
  usa.user_id,
  st.service_id,
  usa.stage_id,
  NULL,
  'servant',
  COALESCE(usa.assigned_by, usa.user_id),
  CURRENT_DATE,
  true,
  usa.created_at
FROM user_stage_assignments usa
JOIN stages st ON st.id = usa.stage_id;

-- Backup and drop
ALTER TABLE user_stage_assignments RENAME TO user_stage_assignments_backup_20260730;
```

### 013_beneficiaries_table.sql

```sql
-- Rename children → beneficiaries
ALTER TABLE children RENAME TO beneficiaries;

-- Restructure columns
ALTER TABLE beneficiaries ADD COLUMN full_name_ar text;
ALTER TABLE beneficiaries ADD COLUMN full_name_en text;

-- Merge name columns
UPDATE beneficiaries SET full_name_ar = CONCAT(COALESCE(first_name_ar, ''), ' ', COALESCE(last_name_ar, ''));
UPDATE beneficiaries SET full_name_en = CONCAT(COALESCE(first_name_en, ''), ' ', COALESCE(last_name_en, ''));

ALTER TABLE beneficiaries ALTER COLUMN full_name_ar SET NOT NULL;

-- Update event_registrations FK
ALTER TABLE event_registrations RENAME COLUMN child_id TO beneficiary_id;

-- Archive parent data to notes before dropping (BLOCKING ISSUE 6)
UPDATE beneficiaries SET notes = CONCAT(
  COALESCE(notes, ''),
  CASE WHEN father_name_ar IS NOT NULL THEN E'\nالأب: ' || father_name_ar ELSE '' END,
  CASE WHEN mother_name_ar IS NOT NULL THEN E'\nالأم: ' || mother_name_ar ELSE '' END,
  CASE WHEN parent_phone IS NOT NULL THEN E'\nهاتف ولي الأمر: ' || parent_phone ELSE '' END
);

-- Drop old columns that map to new schema (NOT dropping stage_id — kept for 014)
ALTER TABLE beneficiaries DROP COLUMN first_name_ar;
ALTER TABLE beneficiaries DROP COLUMN last_name_ar;
ALTER TABLE beneficiaries DROP COLUMN first_name_en;
ALTER TABLE beneficiaries DROP COLUMN last_name_en;
ALTER TABLE beneficiaries DROP COLUMN emergency_contact_name;
ALTER TABLE beneficiaries DROP COLUMN emergency_contact_phone;
ALTER TABLE beneficiaries DROP COLUMN allergies;
ALTER TABLE beneficiaries DROP COLUMN medical_conditions;
ALTER TABLE beneficiaries DROP COLUMN medications;
ALTER TABLE beneficiaries DROP COLUMN confession_frequency;
ALTER TABLE beneficiaries DROP COLUMN spiritual_notes;
ALTER TABLE beneficiaries DROP COLUMN school_name_ar;
ALTER TABLE beneficiaries DROP COLUMN grade_level;
ALTER TABLE beneficiaries DROP COLUMN ministry_id;
ALTER TABLE beneficiaries DROP COLUMN pipeline_stage;
ALTER TABLE beneficiaries DROP COLUMN enrolled_at;
ALTER TABLE beneficiaries DROP COLUMN created_by;
ALTER TABLE beneficiaries DROP COLUMN parent_address_ar;
ALTER TABLE beneficiaries DROP COLUMN father_name_ar;
ALTER TABLE beneficiaries DROP COLUMN mother_name_ar;
ALTER TABLE beneficiaries DROP COLUMN parent_phone;
ALTER TABLE beneficiaries DROP COLUMN parent_email;
ALTER TABLE beneficiaries DROP COLUMN baptism_date;

-- Add new columns
ALTER TABLE beneficiaries ADD COLUMN address text;
ALTER TABLE beneficiaries ADD COLUMN school text;
ALTER TABLE beneficiaries ADD COLUMN father_mobile text;
ALTER TABLE beneficiaries ADD COLUMN mother_mobile text;
ALTER TABLE beneficiaries ADD COLUMN whatsapp text;
ALTER TABLE beneficiaries ADD COLUMN confession_father text;

-- Change status from enum to TEXT
ALTER TABLE beneficiaries ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE beneficiaries ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE beneficiaries ALTER COLUMN status SET NOT NULL;

-- Guard NOT NULL on date_of_birth/gender — handle existing NULLs (IMPROVEMENT 2)
UPDATE beneficiaries SET date_of_birth = '2000-01-01' WHERE date_of_birth IS NULL;
ALTER TABLE beneficiaries ALTER COLUMN date_of_birth SET NOT NULL;
UPDATE beneficiaries SET gender = 'male' WHERE gender IS NULL;
ALTER TABLE beneficiaries ALTER COLUMN gender SET NOT NULL;

-- Add canonical index (no stage_id — beneficiaries table doesn't have it per spec) (BLOCKING ISSUE 7)
CREATE INDEX idx_beneficiaries_church_status ON beneficiaries (church_id, status) WHERE deleted_at IS NULL;

-- Drop old children indexes
DROP INDEX IF EXISTS idx_children_church;
DROP INDEX IF EXISTS idx_children_church_stage;
DROP INDEX IF EXISTS idx_children_church_ministry;
DROP INDEX IF EXISTS idx_children_church_status;
DROP INDEX IF EXISTS idx_children_name;
DROP INDEX IF EXISTS idx_children_mobile;
DROP INDEX IF EXISTS idx_children_parent_phone;
DROP INDEX IF EXISTS idx_children_pipeline;

-- Update followups FK
ALTER TABLE followups RENAME COLUMN child_id TO beneficiary_id;

-- Update spiritual_records FK
ALTER TABLE spiritual_records RENAME COLUMN child_id TO beneficiary_id;

-- Drop enums no longer needed
DROP TYPE IF EXISTS child_status;
DROP TYPE IF EXISTS pipeline_stage_type;
```

### 014_beneficiary_assignments.sql

```sql
CREATE TABLE beneficiary_assignments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  beneficiary_id    uuid NOT NULL REFERENCES beneficiaries (id) ON DELETE CASCADE,
  service_id        uuid NOT NULL REFERENCES services (id),
  stage_id          uuid NOT NULL REFERENCES stages (id),
  class_id          uuid REFERENCES classes (id),
  servant_id        uuid NOT NULL REFERENCES servants (id),
  assigned_by       uuid NOT NULL REFERENCES profiles (id),
  is_current        boolean NOT NULL DEFAULT true,
  start_date        date NOT NULL DEFAULT CURRENT_DATE,
  end_date          date,
  transfer_reason   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ba_current ON beneficiary_assignments (beneficiary_id) WHERE is_current = true;
CREATE INDEX idx_ba_stage_current ON beneficiary_assignments (church_id, stage_id, is_current);
CREATE INDEX idx_ba_servant_current ON beneficiary_assignments (church_id, servant_id, is_current);

-- Migrate current assignments from beneficiaries data
-- Resolve service_id from stage_id in a single step via JOIN (IMPROVEMENT 5)
INSERT INTO beneficiary_assignments (church_id, beneficiary_id, service_id, stage_id, class_id, servant_id, assigned_by, is_current, start_date)
SELECT
  b.church_id,
  b.id,
  st.service_id,
  b.stage_id,
  NULL,
  COALESCE(
    (SELECT s.id FROM servants s
     JOIN user_stage_assignments_backup_20260730 usa ON usa.user_id = s.id
     WHERE usa.stage_id = b.stage_id AND usa.church_id = b.church_id
     LIMIT 1),
    (SELECT id FROM servants WHERE church_id = b.church_id LIMIT 1)
  ),
  (SELECT id FROM profiles WHERE church_id = b.church_id LIMIT 1),
  true,
  CURRENT_DATE
FROM beneficiaries b
JOIN stages st ON st.id = b.stage_id
WHERE b.deleted_at IS NULL AND b.status = 'active';

-- Drop stage_id from beneficiaries now that it's preserved in beneficiary_assignments
ALTER TABLE beneficiaries DROP COLUMN stage_id;
```

### 015_attendance_restructure.sql

```sql
CREATE TABLE attendance_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  service_id    uuid NOT NULL REFERENCES services (id),
  stage_id      uuid NOT NULL REFERENCES stages (id),
  class_id      uuid REFERENCES classes (id),
  session_date  date NOT NULL,
  notes         text,
  created_by    uuid NOT NULL REFERENCES profiles (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_id, session_date)
);

CREATE INDEX idx_attendance_sessions_stage_date ON attendance_sessions (church_id, stage_id, session_date);

CREATE TABLE attendance_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  session_id      uuid NOT NULL REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  beneficiary_id  uuid REFERENCES beneficiaries (id),
  servant_id      uuid REFERENCES servants (id),
  status          attendance_status NOT NULL,
  recorded_by     uuid NOT NULL REFERENCES profiles (id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exactly_one_attendee CHECK (
    (beneficiary_id IS NOT NULL AND servant_id IS NULL) OR
    (beneficiary_id IS NULL AND servant_id IS NOT NULL)
  )
);

CREATE INDEX idx_attendance_records_session ON attendance_records (session_id);
CREATE INDEX idx_attendance_records_beneficiary_status ON attendance_records (beneficiary_id, status);

-- Migrate data from attendance table
INSERT INTO attendance_sessions (church_id, service_id, stage_id, session_date, created_by, created_at)
SELECT DISTINCT
  a.church_id,
  st.service_id,
  a.stage_id,
  a.attendance_date,
  a.recorded_by,
  a.created_at
FROM attendance a
JOIN stages st ON st.id = a.stage_id;

INSERT INTO attendance_records (church_id, session_id, beneficiary_id, servant_id, status, recorded_by, notes, created_at)
SELECT
  a.church_id,
  asess.id,
  a.child_id,
  NULL,
  a.status,
  a.recorded_by,
  a.notes,
  a.created_at
FROM attendance a
JOIN attendance_sessions asess ON asess.stage_id = a.stage_id AND asess.session_date = a.attendance_date;

-- Backup and drop old table
ALTER TABLE attendance RENAME TO attendance_backup_20260730;
```

### 016_followups_update.sql

```sql
-- Follow-ups: beneficiary_id already renamed in migration 013
-- Add assigned_to FK to servants
ALTER TABLE followups RENAME COLUMN created_by TO servant_id;
ALTER TABLE followups DROP CONSTRAINT IF EXISTS followups_child_id_fkey;
ALTER TABLE followups ADD FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id) ON DELETE CASCADE;
ALTER TABLE followups DROP CONSTRAINT IF EXISTS followups_created_by_fkey;
ALTER TABLE followups ADD FOREIGN KEY (servant_id) REFERENCES servants (id) ON DELETE CASCADE;
ALTER TABLE followups DROP CONSTRAINT IF EXISTS followups_assigned_to_fkey;
ALTER TABLE followups ADD FOREIGN KEY (assigned_to) REFERENCES servants (id);
ALTER TABLE followups ADD COLUMN next_action text;
ALTER TABLE followups DROP COLUMN stage_id;

-- Change type from followup_type enum to TEXT
ALTER TABLE followups ALTER COLUMN type TYPE text USING type::text;

-- Update type values
UPDATE followups SET type = 'phone' WHERE type = 'phone_call';
UPDATE followups SET type = 'visit' WHERE type = 'home_visit';
UPDATE followups SET type = 'meeting' WHERE type = 'church_meeting';

-- Rebuild indexes
DROP INDEX IF EXISTS idx_followups_church_child;
DROP INDEX IF EXISTS idx_followups_church_assigned;
DROP INDEX IF EXISTS idx_followups_church_scheduled;
DROP INDEX IF EXISTS idx_followups_church_status;

CREATE INDEX idx_followups_servant_status ON followups (servant_id, status, scheduled_at) WHERE deleted_at IS NULL;

-- Update followup_status enum
ALTER TYPE followup_status RENAME TO followup_status_old;
CREATE TYPE followup_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
ALTER TABLE followups ALTER COLUMN status TYPE text;
UPDATE followups SET status = 'open' WHERE status = 'scheduled';
ALTER TABLE followups ALTER COLUMN status TYPE followup_status USING status::followup_status;
DROP TYPE IF EXISTS followup_status_old;

-- Drop followup_type enum
DROP TYPE IF EXISTS followup_type;
```

### 017_spiritual_journal_entries.sql

```sql
CREATE TABLE spiritual_journal_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  servant_id        uuid NOT NULL REFERENCES servants (id) ON DELETE CASCADE,
  entry_date        date NOT NULL,
  morning_prayer    boolean NOT NULL DEFAULT false,
  third_hour_prayer boolean NOT NULL DEFAULT false,
  sixth_hour_prayer boolean NOT NULL DEFAULT false,
  ninth_hour_prayer boolean NOT NULL DEFAULT false,
  sunset_prayer     boolean NOT NULL DEFAULT false,
  sleep_prayer      boolean NOT NULL DEFAULT false,
  bible_reading     boolean NOT NULL DEFAULT false,
  confession        boolean NOT NULL DEFAULT false,
  communion         boolean NOT NULL DEFAULT false,
  spiritual_notes   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (servant_id, entry_date)
);

CREATE UNIQUE INDEX idx_spiritual_servant_date ON spiritual_journal_entries (servant_id, entry_date);

CREATE TRIGGER trg_spiritual_journal_updated_at
  BEFORE UPDATE ON spiritual_journal_entries
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### 018_notifications_update.sql

```sql
-- Rename user_id → recipient_id
ALTER TABLE notifications RENAME COLUMN user_id TO recipient_id;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD FOREIGN KEY (recipient_id) REFERENCES profiles (id) ON DELETE CASCADE;

-- Rename type → channel (type is a reserved keyword, rename to channel)
ALTER TABLE notifications RENAME COLUMN type TO old_type;
ALTER TABLE notifications RENAME COLUMN channel TO channel_value;
ALTER TABLE notifications RENAME COLUMN old_type TO channel;

-- Change channel from enum to TEXT
ALTER TABLE notifications ALTER COLUMN channel TYPE text USING channel::text;
DROP TYPE IF EXISTS notification_channel;
DROP TYPE IF EXISTS notification_type;

-- Add columns
ALTER TABLE notifications ADD COLUMN notification_type text NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN is_read boolean NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN data jsonb;
ALTER TABLE notifications DROP COLUMN channel_value;
ALTER TABLE notifications RENAME COLUMN metadata TO old_metadata;
ALTER TABLE notifications ALTER COLUMN read_at DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN sent_at SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN sent_at SET DEFAULT now();

-- Rebuild indexes
DROP INDEX IF EXISTS idx_notifications_church_user_read;
DROP INDEX IF EXISTS idx_notifications_user_created;

CREATE INDEX idx_notifications_recipient_read ON notifications (recipient_id, is_read, sent_at DESC);
```

### 019_audit_logs_update.sql

```sql
-- ==========================================
-- Fix audit_logs per CANONICAL_DATABASE_SPEC (BLOCKING ISSUE 2)
-- ==========================================

-- Rename user_id → actor_id (nullable)
ALTER TABLE audit_logs RENAME COLUMN user_id TO actor_id;

-- Change action from audit_action enum to TEXT
ALTER TABLE audit_logs ALTER COLUMN action TYPE text USING action::text;

-- Drop columns not in canonical spec
ALTER TABLE audit_logs DROP COLUMN ip_address;
ALTER TABLE audit_logs DROP COLUMN user_agent;

-- Drop old indexes
DROP INDEX IF EXISTS idx_audit_logs_church_created;
DROP INDEX IF EXISTS idx_audit_logs_church_entity;
DROP INDEX IF EXISTS idx_audit_logs_user_created;

-- Create canonical indexes
CREATE INDEX idx_audit_logs_church_time ON audit_logs (church_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

-- Drop enum no longer needed
DROP TYPE IF EXISTS audit_action;
```

### 020_user_roles_update.sql

```sql
-- ==========================================
-- Fix user_roles per CANONICAL_DATABASE_SPEC (BLOCKING ISSUE 1)
-- ==========================================

-- assigned_by already exists as nullable — make NOT NULL
UPDATE user_roles SET assigned_by = (SELECT id FROM profiles WHERE church_id = user_roles.church_id LIMIT 1) WHERE assigned_by IS NULL;
ALTER TABLE user_roles ALTER COLUMN assigned_by SET NOT NULL;

-- Add start_date column
ALTER TABLE user_roles ADD COLUMN start_date date;
UPDATE user_roles SET start_date = created_at::date;
ALTER TABLE user_roles ALTER COLUMN start_date SET NOT NULL;

-- Add end_date column (nullable)
ALTER TABLE user_roles ADD COLUMN end_date date;

-- Drop old constraints and indexes
DROP INDEX IF EXISTS idx_user_roles_church_user;
DROP INDEX IF EXISTS idx_user_roles_user;

-- Create canonical index
CREATE INDEX idx_user_roles_user_active ON user_roles (user_id, role_id) WHERE end_date IS NULL;
```

### 021_role_and_permissions.sql

```sql
-- ==========================================
-- Part 1: Update user_role_type enum
-- ==========================================

-- Pre-drop old RLS helper functions that depend on user_role_type enum
-- to prevent CASCADE from dropping them unexpectedly (IMPROVEMENT 6)
DROP FUNCTION IF EXISTS get_user_role_types();
DROP FUNCTION IF EXISTS user_has_role(user_role_type);
DROP FUNCTION IF EXISTS user_has_any_role(user_role_type[]);
DROP FUNCTION IF EXISTS user_has_stage_access(uuid);
DROP FUNCTION IF EXISTS user_is_church_admin_or_above();

-- Create new enum
CREATE TYPE user_role_type_new AS ENUM ('platform_owner', 'super_admin', 'admin', 'servant');

-- Update roles table
ALTER TABLE roles ALTER COLUMN role_type TYPE text;
DROP TYPE user_role_type CASCADE;

-- Map values
UPDATE roles SET role_type = 'admin' WHERE role_type = 'church_admin';
UPDATE roles SET role_type = 'servant' WHERE role_type IN ('stage_leader', 'servant', 'viewer');

ALTER TYPE user_role_type_new RENAME TO user_role_type;
ALTER TABLE roles ALTER COLUMN role_type TYPE user_role_type USING role_type::user_role_type;

-- ==========================================
-- Part 2: Fix permission catalog — exactly 52 codes (BLOCKING ISSUE 4)
-- ==========================================

-- Remove 7 extra codes not in canonical catalog
DELETE FROM permissions WHERE code IN (
  'users.create',
  'users.delete',
  'users.manage',
  'attendance.update',
  'attendance.delete',
  'notifications.create',
  'churches.manage'
);

-- Add 10 missing codes (including 9 platform_owner codes)
INSERT INTO permissions (code, name_ar, name_en, module) VALUES
  ('beneficiaries.transfer', 'نقل مخدوم', 'Transfer Beneficiary', 'beneficiaries'),
  ('tenants.create', 'إنشاء كنيسة', 'Create Tenant', 'tenants'),
  ('tenants.read', 'عرض الكنائس', 'Read Tenants', 'tenants'),
  ('tenants.update', 'تعديل كنيسة', 'Update Tenant', 'tenants'),
  ('tenants.delete', 'حذف كنيسة', 'Delete Tenant', 'tenants'),
  ('subscriptions.manage', 'إدارة الاشتراكات', 'Manage Subscriptions', 'system'),
  ('billing.read', 'عرض الفواتير', 'Read Billing', 'system'),
  ('system.metrics', 'مقاييس النظام', 'System Metrics', 'system'),
  ('system.audit', 'سجل النظام', 'System Audit', 'system'),
  ('support.manage', 'إدارة الدعم', 'Manage Support', 'system')
ON CONFLICT (code) DO NOTHING;

-- Add new service-level codes from canonical
INSERT INTO permissions (code, name_ar, name_en, module) VALUES
  ('services.create', 'إنشاء خدمة', 'Create Service', 'services'),
  ('services.read', 'عرض الخدمات', 'Read Services', 'services'),
  ('services.update', 'تعديل خدمة', 'Update Service', 'services'),
  ('services.delete', 'حذف خدمة', 'Delete Service', 'services'),
  ('classes.create', 'إنشاء فصل', 'Create Class', 'classes'),
  ('classes.read', 'عرض الفصول', 'Read Classes', 'classes'),
  ('classes.update', 'تعديل فصل', 'Update Class', 'classes'),
  ('classes.delete', 'حذف فصل', 'Delete Class', 'classes'),
  ('servants.create', 'إنشاء خادم', 'Create Servant', 'servants'),
  ('servants.read', 'عرض الخدام', 'Read Servants', 'servants'),
  ('servants.update', 'تعديل خادم', 'Update Servant', 'servants'),
  ('servants.delete', 'حذف خادم', 'Delete Servant', 'servants'),
  ('servants.approve', 'الموافقة على الخدام', 'Approve Servants', 'servants'),
  ('servants.assign', 'تعيين الخدام', 'Assign Servants', 'servants'),
  ('spiritual.create', 'تسجيل يوميات روحية', 'Create Spiritual Entry', 'spiritual'),
  ('spiritual.read', 'عرض اليوميات الروحية', 'Read Spiritual Entries', 'spiritual'),
  ('import.execute', 'استيراد بيانات', 'Import Data', 'import_export'),
  ('export.execute', 'تصدير بيانات', 'Export Data', 'import_export')
ON CONFLICT (code) DO NOTHING;

-- Rename children → beneficiaries codes
UPDATE permissions SET code = 'beneficiaries.read', name_ar = 'عرض المخدومين', name_en = 'Read Beneficiaries' WHERE code = 'children.read';
UPDATE permissions SET code = 'beneficiaries.create', name_ar = 'إضافة مخدوم', name_en = 'Create Beneficiary' WHERE code = 'children.create';
UPDATE permissions SET code = 'beneficiaries.update', name_ar = 'تعديل مخدوم', name_en = 'Update Beneficiary' WHERE code = 'children.update';
UPDATE permissions SET code = 'beneficiaries.delete', name_ar = 'حذف مخدوم', name_en = 'Delete Beneficiary' WHERE code = 'children.delete';

-- Remove deprecated codes
DELETE FROM permissions WHERE code IN (
  'children.export',
  'events.read', 'events.create', 'events.update', 'events.delete',
  'documents.read', 'documents.create', 'documents.delete',
  'ai.use', 'ai.manage'
);

-- ==========================================
-- Part 3: Update seed_church_roles function
-- ==========================================

CREATE OR REPLACE FUNCTION seed_church_roles(p_church_id uuid)
RETURNS void AS $$
DECLARE
  v_role_id uuid;
  v_code text;
BEGIN
  -- Super Admin role (all permissions)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'super_admin', 'مدير النظام', 'Super Admin', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions;

  -- Admin role
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'admin', 'مدير الخدمة', 'Admin', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code IN (
    'users.read', 'users.update',
    'beneficiaries.read', 'beneficiaries.create', 'beneficiaries.update', 'beneficiaries.transfer',
    'services.read', 'stages.read', 'stages.create', 'stages.update',
    'classes.read', 'classes.create', 'classes.update',
    'servants.read', 'servants.update', 'servants.assign',
    'attendance.read', 'attendance.export',
    'followups.read',
    'reports.read', 'reports.export',
    'import.execute', 'export.execute'
  );

  -- Servant role
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'servant', 'خادم', 'Servant', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code IN (
    'beneficiaries.read', 'beneficiaries.update',
    'services.read', 'stages.read', 'classes.read',
    'attendance.create', 'attendance.read',
    'followups.create', 'followups.read', 'followups.update', 'followups.delete',
    'spiritual.create', 'spiritual.read',
    'notifications.read',
    'reports.read'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 022_rls_implementation.sql

```sql
-- ==========================================
-- Phase 2: Helper Functions per CANONICAL_RLS_SPEC.md §1
-- ==========================================

-- Auth context
CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS uuid AS $$
  SELECT church_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_servant_id()
RETURNS uuid AS $$
  SELECT id FROM servants WHERE id = auth.uid() AND deleted_at IS NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Role checks
CREATE OR REPLACE FUNCTION user_is_platform_owner()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type = 'platform_owner'
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_is_super_admin(p_church_id uuid DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := COALESCE(p_church_id, get_user_church_id());
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type = 'super_admin'
      AND ur.church_id = v_church_id
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_is_admin(p_church_id uuid DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := COALESCE(p_church_id, get_user_church_id());
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type IN ('super_admin', 'admin')
      AND ur.church_id = v_church_id
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Scope resolution
CREATE OR REPLACE FUNCTION get_user_service_ids()
RETURNS uuid[] AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_super_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM services WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.service_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND ssa.end_date IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_stage_ids()
RETURNS uuid[] AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_super_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM stages WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.stage_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND ssa.end_date IS NULL
      AND ssa.stage_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_class_ids()
RETURNS uuid[] AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_super_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM classes WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.class_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND ssa.end_date IS NULL
      AND ssa.class_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_assigned_beneficiary_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY(
    SELECT ba.beneficiary_id
    FROM beneficiary_assignments ba
    WHERE ba.servant_id = auth.uid()
      AND ba.is_current = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==========================================
-- Phase 3: RLS Policies per CANONICAL_RLS_SPEC.md §2
-- Table-by-table in single transaction (IMPROVEMENT 4)
-- ==========================================

BEGIN;

-- Drop all existing policies first
-- (Using DO block to dynamically drop all policies)
DO $$ DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT schemaname, tablename, policyname
    FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END $$;

-- Enable RLS on all tables (idempotent)
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE servants ENABLE ROW LEVEL SECURITY;
ALTER TABLE servant_stage_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiary_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE spiritual_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- churches
CREATE POLICY tenant_read ON churches FOR SELECT USING (id = get_user_church_id());
CREATE POLICY platform_owner_all ON churches FOR ALL USING (user_is_platform_owner());
CREATE POLICY super_admin_update ON churches FOR UPDATE USING (id = get_user_church_id() AND user_is_super_admin(id));

-- services
CREATE POLICY tenant_isolation ON services FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON services FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON services FOR SELECT USING (id = ANY(get_user_service_ids()));
CREATE POLICY admin_write ON services FOR INSERT/UPDATE USING (church_id = get_user_church_id() AND user_is_admin(church_id));

-- stages
CREATE POLICY tenant_isolation ON stages FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON stages FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON stages FOR SELECT USING (service_id = ANY(get_user_service_ids()));
CREATE POLICY admin_write ON stages FOR INSERT/UPDATE/DELETE USING (church_id = get_user_church_id() AND user_is_admin(church_id));

-- classes
CREATE POLICY tenant_isolation ON classes FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON classes FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON classes FOR SELECT USING (stage_id = ANY(get_user_stage_ids()));
CREATE POLICY admin_write ON classes FOR INSERT/UPDATE/DELETE USING (church_id = get_user_church_id() AND user_is_admin(church_id));

-- profiles
CREATE POLICY tenant_isolation ON profiles FOR SELECT USING (church_id = get_user_church_id());
CREATE POLICY own_profile ON profiles FOR INSERT/UPDATE USING (id = auth.uid());
CREATE POLICY super_admin_all ON profiles FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_scoped ON profiles FOR SELECT USING (user_is_admin(church_id) AND church_id = get_user_church_id());

-- servants
CREATE POLICY tenant_isolation ON servants FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON servants FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON servants FOR SELECT USING (
  church_id = get_user_church_id()
  AND (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM servant_stage_assignments ssa
      WHERE ssa.servant_id = servants.id
        AND ssa.service_id = ANY(get_user_service_ids())
        AND ssa.is_active = true
        AND ssa.end_date IS NULL
    )
  )
);

-- servant_stage_assignments
CREATE POLICY tenant_isolation ON servant_stage_assignments FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON servant_stage_assignments FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON servant_stage_assignments FOR SELECT USING (user_is_admin(church_id) OR service_id = ANY(get_user_service_ids()));
CREATE POLICY admin_write ON servant_stage_assignments FOR INSERT/UPDATE USING (user_is_admin(church_id));
CREATE POLICY own_read ON servant_stage_assignments FOR SELECT USING (servant_id = auth.uid());

-- beneficiaries
CREATE POLICY tenant_isolation ON beneficiaries FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON beneficiaries FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON beneficiaries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM beneficiary_assignments ba
    WHERE ba.beneficiary_id = beneficiaries.id
      AND ba.service_id = ANY(get_user_service_ids())
      AND ba.is_current = true
  )
);
CREATE POLICY servant_read ON beneficiaries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM beneficiary_assignments ba
    WHERE ba.beneficiary_id = beneficiaries.id
      AND ba.is_current = true
      AND (
        ba.servant_id = auth.uid()
        OR (
          ba.stage_id = ANY(get_user_stage_ids())
          AND EXISTS (
            SELECT 1 FROM servant_stage_assignments ssa
            WHERE ssa.servant_id = auth.uid()
              AND ssa.stage_id = ba.stage_id
              AND ssa.role IN ('stage_leader', 'class_leader')
              AND ssa.is_active = true
              AND ssa.end_date IS NULL
          )
        )
        OR (
          ba.class_id = ANY(get_user_class_ids())
          AND EXISTS (
            SELECT 1 FROM servant_stage_assignments ssa
            WHERE ssa.servant_id = auth.uid()
              AND ssa.class_id = ba.class_id
              AND ssa.is_active = true
              AND ssa.end_date IS NULL
          )
        )
      )
  )
);
CREATE POLICY admin_write ON beneficiaries FOR INSERT/UPDATE USING (user_is_admin(church_id));

-- beneficiary_assignments
CREATE POLICY tenant_isolation ON beneficiary_assignments FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON beneficiary_assignments FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON beneficiary_assignments FOR SELECT USING (service_id = ANY(get_user_service_ids()));
CREATE POLICY admin_write ON beneficiary_assignments FOR INSERT USING (user_is_admin(church_id));
CREATE POLICY own_read ON beneficiary_assignments FOR SELECT USING (servant_id = auth.uid() AND is_current = true);
CREATE POLICY immutable ON beneficiary_assignments FOR UPDATE/DELETE USING (false);

-- attendance_sessions
CREATE POLICY tenant_isolation ON attendance_sessions FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON attendance_sessions FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON attendance_sessions FOR SELECT USING (service_id = ANY(get_user_service_ids()));
CREATE POLICY stage_scope ON attendance_sessions FOR INSERT/SELECT USING (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()));

-- attendance_records
CREATE POLICY tenant_isolation ON attendance_records FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON attendance_records FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY session_scope ON attendance_records FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM attendance_sessions WHERE id = session_id
    AND (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()))
  )
);
CREATE POLICY record_attendance ON attendance_records FOR INSERT USING (church_id = get_user_church_id() AND recorded_by = auth.uid());

-- followups
CREATE POLICY tenant_isolation ON followups FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON followups FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON followups FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM beneficiary_assignments ba
    WHERE ba.beneficiary_id = followups.beneficiary_id
      AND ba.service_id = ANY(get_user_service_ids())
      AND ba.is_current = true
  )
);
CREATE POLICY own_all ON followups FOR ALL USING (servant_id = auth.uid());

-- spiritual_journal_entries
CREATE POLICY tenant_isolation ON spiritual_journal_entries FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY servant_owner ON spiritual_journal_entries FOR ALL USING (servant_id = auth.uid());
CREATE POLICY priest_read ON spiritual_journal_entries FOR SELECT USING (user_is_super_admin(church_id));
CREATE POLICY deny_admin_spiritual ON spiritual_journal_entries AS RESTRICTIVE FOR ALL
  USING (NOT (user_is_admin(church_id) AND NOT user_is_super_admin(church_id)));

-- notifications
CREATE POLICY tenant_isolation ON notifications FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY recipient_scope ON notifications FOR ALL USING (recipient_id = auth.uid());
CREATE POLICY super_admin_read ON notifications FOR SELECT USING (user_is_super_admin(church_id));

-- audit_logs
CREATE POLICY tenant_isolation ON audit_logs FOR SELECT USING (church_id = get_user_church_id());
CREATE POLICY super_admin_read ON audit_logs FOR SELECT USING (user_is_super_admin(church_id));
CREATE POLICY platform_owner_read ON audit_logs FOR SELECT USING (user_is_platform_owner());
CREATE POLICY append_only ON audit_logs FOR INSERT USING (true);
CREATE POLICY immutable ON audit_logs FOR UPDATE/DELETE USING (false);

-- roles
CREATE POLICY tenant_isolation ON roles FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON roles FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY read_all ON roles FOR SELECT USING (church_id = get_user_church_id());

-- permissions
CREATE POLICY read_all ON permissions FOR SELECT USING (true);
CREATE POLICY platform_owner_write ON permissions FOR INSERT/UPDATE/DELETE USING (user_is_platform_owner());

-- role_permissions
CREATE POLICY tenant_isolation ON role_permissions FOR ALL USING (
  role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())
);
CREATE POLICY super_admin_all ON role_permissions FOR ALL USING (user_is_super_admin(get_user_church_id()));
CREATE POLICY read_all ON role_permissions FOR SELECT USING (
  role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())
);

-- user_roles
CREATE POLICY tenant_isolation ON user_roles FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON user_roles FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY own_read ON user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY admin_read ON user_roles FOR SELECT USING (user_is_admin(church_id));

-- events
CREATE POLICY tenant_isolation ON events FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON events FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY stage_scope ON events FOR SELECT USING (
  stage_id = ANY(get_user_stage_ids())
  OR class_id = ANY(get_user_class_ids())
  OR service_id = ANY(get_user_service_ids())
);

-- event_registrations
CREATE POLICY tenant_isolation ON event_registrations FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON event_registrations FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY servant_scope ON event_registrations FOR SELECT USING (
  beneficiary_id IN (
    SELECT beneficiary_id FROM beneficiary_assignments
    WHERE servant_id = auth.uid() AND is_current = true
  )
);

-- documents
CREATE POLICY tenant_isolation ON documents FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON documents FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY owner_scope ON documents FOR ALL USING (uploaded_by = auth.uid());

-- ai_conversations
CREATE POLICY tenant_isolation ON ai_conversations FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY owner_scope ON ai_conversations FOR ALL USING (user_id = auth.uid());

-- ai_messages
CREATE POLICY tenant_isolation ON ai_messages FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY owner_scope ON ai_messages FOR ALL USING (user_id = auth.uid());

-- document_embeddings
CREATE POLICY tenant_isolation ON document_embeddings FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY owner_scope ON document_embeddings FOR ALL USING (user_id = auth.uid());

COMMIT;
```

---

## Risk & Rollback Summary

| Risk Level | Count | Primary Mitigation |
|------------|-------|--------------------|
| Critical | 0 | — |
| High | 2 | Backup tables + verify row counts before/after |
| Medium | 2 | Dry-run first, verify FK chains |
| Low | 5 | Default values handle existing data |

**Primary rollback:** `pg_restore --clean pre_migration_backup_20260730.dump`

---

## Approval

**Execute migrations?** [ ] Yes [ ] No

Once approved:
1. Write all 16 migration files to `supabase/migrations/`
2. Run `supabase db push` or equivalent to apply
3. Run verification queries
4. Generate `VERIFICATION_REPORT.md`
