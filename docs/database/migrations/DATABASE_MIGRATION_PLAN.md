# Database Migration Plan — Phase 1B

**Date:** 2026-07-30
**Source Documents:** DATABASE_REQUIREMENTS.md, PRD_V3.md, ARCHITECTURE_ALIGNMENT_REPORT.md

---

## 1. Current Schema Status

### 1.1 Existing Tables (21 total)

| # | Table | Status | Action |
|---|-------|--------|--------|
| 1 | `churches` | Under-built | Add columns |
| 2 | `ministries` | Exists | **Rename to `services`** |
| 3 | `stages` | Exists — needs FK change | Change `ministry_id` → `service_id` |
| 4 | `classes` | ❌ Missing | **Create** |
| 5 | `profiles` | Under-built | Add columns |
| 6 | `servants` | ❌ Missing | **Create** |
| 7 | `servant_stage_assignments` | Exists | Rename → `servant_stage_assignments` |
| 8 | `user_stage_assignments` | Exists | Superseded by `servant_stage_assignments` — migrate & drop |
| 9 | `children` | Exists — name mismatch | **Rename to `beneficiaries`** |
| 10 | `beneficiary_assignments` | ❌ Missing | **Create** (current assignment embedded on `children` table) |
| 11 | `attendance` | Exists | **Restructure**: create `attendance_sessions` + `attendance_records` |
| 12 | `attendance_sessions` | ❌ Missing | **Create** |
| 13 | `attendance_records` | ❌ Missing | **Create** (migrate from `attendance`) |
| 14 | `followups` | Exists — needs FK changes | Update FKs |
| 15 | `spiritual_records` | Exists — repurpose | Migrate → `spiritual_journal_entries` |
| 16 | `spiritual_journal_entries` | ❌ Missing | **Create** (replace `spiritual_records`) |
| 17 | `events` | Exists — no change | ✅ Keep |
| 18 | `event_registrations` | Exists — no change | ✅ Keep |
| 19 | `notifications` | Exists — needs schema update | Update columns |
| 20 | `audit_logs` | Exists — no change | ✅ Keep |
| 21 | `roles` | Exists — needs role_type | Add `platform_owner` to enum |
| 22 | `permissions` | Exists | Add/rename permission codes |
| 23 | `role_permissions` | Exists | ✅ Keep |
| 24 | `user_roles` | Exists | Update enum references |
| 25 | `documents` | Exists | ✅ Keep |
| 26 | `ai_conversations` | Exists | ✅ Keep |
| 27 | `ai_messages` | Exists | ✅ Keep |
| 28 | `document_embeddings` | Exists | ✅ Keep |
| 29 | `subscription_plans` | ❌ Missing | **Create** (Phase 2, skip for now) |

---

## 2. Target Schema (per DATABASE_REQUIREMENTS.md)

### 2.1 Table-by-Table Changes

#### 2.1.1 `churches` — Add Columns

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
```

**Indexes:**
```sql
CREATE INDEX idx_churches_subscription_status ON churches (subscription_status) WHERE deleted_at IS NULL;
```

---

#### 2.1.2 `ministries` → Rename to `services`

**Step 1:** Create new `services` table
**Step 2:** Copy data from `ministries` → `services`
**Step 3:** Update FK references (stages, events, children)
**Step 4:** Drop `ministries` table

```sql
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

CREATE INDEX idx_services_church ON services (church_id) WHERE deleted_at IS NULL;

INSERT INTO services (id, church_id, name_ar, name_en, description_ar, description_en, sort_order, is_active, created_at, updated_at, deleted_at)
SELECT id, church_id, name_ar, name_en, description_ar, description_en, sort_order, is_active, created_at, updated_at, deleted_at FROM ministries;
```

**Data migration:** All rows copied. If `ministries` has rows with text descriptions exceeding limits, they must be truncated or allowed.

**Foreign key updates needed:**
- `stages.ministry_id` → `stages.service_id`
- `events.ministry_id` → `events.service_id` (set null if not migrating)
- `children.ministry_id` → `beneficiary_assignments.service_id`

---

#### 2.1.3 `stages` — Change FK from `ministry_id` to `service_id`

```sql
ALTER TABLE stages RENAME COLUMN ministry_id TO service_id;
ALTER TABLE stages DROP CONSTRAINT stages_ministry_id_fkey;
ALTER TABLE stages ADD FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE;
```

---

#### 2.1.4 `classes` — Create New Table

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

---

#### 2.1.5 `profiles` — Add Columns

```sql
ALTER TABLE profiles ADD COLUMN date_of_birth date;
ALTER TABLE profiles ADD COLUMN gender gender_type;
ALTER TABLE profiles ADD COLUMN spiritual_title text;
ALTER TABLE profiles ADD COLUMN service_started_at date;

CREATE INDEX idx_profiles_spiritual_title ON profiles (church_id, spiritual_title) WHERE deleted_at IS NULL AND spiritual_title IS NOT NULL;
```

---

#### 2.1.6 `servants` — Create New Table

`servants` is a one-to-one extension of `profiles` with church-specific servant metadata.

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
CREATE INDEX idx_servants_church ON servants (church_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_servants_updated_at
  BEFORE UPDATE ON servants
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

**Data migration:** For every `profile` with a role of `stage_leader`, `servant`, or `viewer`, create a corresponding `servants` row with `approval_status = 'approved'` (already in system). Super admins and church admins get a servant record as well since they can also be servants.

```sql
INSERT INTO servants (id, church_id, notes, approval_status, created_at, updated_at)
SELECT p.id, p.church_id, p.notes, 'approved', now(), now()
FROM profiles p
WHERE p.deleted_at IS NULL;
```

---

#### 2.1.7 `user_stage_assignments` → Superseded by `servant_stage_assignments`

Current `user_stage_assignments`: `id, church_id, user_id, stage_id, assigned_by, created_at`

Target `servant_stage_assignments` (new table, existing name in codebase — create new version):

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

CREATE INDEX idx_servant_stage_assignments_servant ON servant_stage_assignments (servant_id, is_active);
CREATE INDEX idx_servant_stage_assignments_stage ON servant_stage_assignments (church_id, stage_id, is_active);
CREATE INDEX idx_servant_stage_assignments_service ON servant_stage_assignments (church_id, service_id, is_active);
```

**Data migration:** Migrate from `user_stage_assignments`. Join through `profiles` to `servants`.

```sql
INSERT INTO servant_stage_assignments (church_id, servant_id, service_id, stage_id, class_id, role, assigned_by, start_date, is_active, created_at)
SELECT
  usa.church_id,
  s.id,
  st.service_id,  -- resolve from stage
  usa.stage_id,
  NULL,  -- no class_id in current data
  'servant',  -- default role
  usa.assigned_by,
  CURRENT_DATE,
  true,
  usa.created_at
FROM user_stage_assignments usa
JOIN servants s ON s.id = usa.user_id
JOIN stages st ON st.id = usa.stage_id;
```

**After migration:**
```sql
DROP TABLE user_stage_assignments;
```

**Note:** The current codebase already has a table called `user_stage_assignments`. The target spec renames this concept to `servant_stage_assignments` with added temporal tracking (`start_date`, `end_date`, `is_active`) and expanded columns (`service_id`, `class_id`, `role`).

---

#### 2.1.8 `children` → Rename to `beneficiaries` + Create `beneficiary_assignments`

**Step 1:** Rename `children` → `beneficiaries`

```sql
ALTER TABLE children RENAME TO beneficiaries;
ALTER TABLE beneficiaries RENAME COLUMN first_name_ar TO full_name_ar;
ALTER TABLE beneficiaries RENAME COLUMN last_name_ar TO dummy_col; -- merge into full_name_ar
ALTER TABLE beneficiaries RENAME COLUMN first_name_en TO full_name_en;
ALTER TABLE beneficiaries RENAME COLUMN last_name_en TO dummy_col_en; -- merge into full_name_en
ALTER TABLE beneficiaries DROP COLUMN dummy_col;
ALTER TABLE beneficiaries DROP COLUMN dummy_col_en;
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
ALTER TABLE beneficiaries DROP COLUMN stage_id;
ALTER TABLE beneficiaries DROP COLUMN pipeline_stage;
ALTER TABLE beneficiaries DROP COLUMN enrolled_at;
ALTER TABLE beneficiaries DROP COLUMN created_by;
ALTER TABLE beneficiaries DROP COLUMN parent_address_ar;
ALTER TABLE beneficiaries DROP COLUMN father_name_ar;
ALTER TABLE beneficiaries DROP COLUMN mother_name_ar;
ALTER TABLE beneficiaries DROP COLUMN parent_phone;
ALTER TABLE beneficiaries DROP COLUMN parent_email;
ALTER TABLE beneficiaries RENAME COLUMN mobile TO mobile; -- keep
ALTER TABLE beneficiaries ADD COLUMN address text;
ALTER TABLE beneficiaries ADD COLUMN school text;
ALTER TABLE beneficiaries ADD COLUMN father_mobile text;
ALTER TABLE beneficiaries ADD COLUMN mother_mobile text;
ALTER TABLE beneficiaries ADD COLUMN whatsapp text;
ALTER TABLE beneficiaries ADD COLUMN confession_father text;
-- Keep: id, church_id, date_of_birth, gender, photo_url, notes, status, deleted_at, created_at, updated_at
```

> **Important:** The `full_name_ar` merge requires combining `first_name_ar + ' ' + last_name_ar` into a single `full_name_ar` column. This is a breaking change for any code referencing `first_name_ar`/`last_name_ar` fields.

**Step 2:** Create `beneficiary_assignments`

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

CREATE INDEX idx_beneficiary_assignments_current ON beneficiary_assignments (beneficiary_id) WHERE is_current = true;
CREATE INDEX idx_beneficiary_assignments_stage ON beneficiary_assignments (church_id, stage_id, is_current);
CREATE INDEX idx_beneficiary_assignments_servant ON beneficiary_assignments (church_id, servant_id, is_current);
```

**Data migration:** Create current assignment rows from existing `beneficiaries` (formerly `children`) data:

```sql
INSERT INTO beneficiary_assignments (church_id, beneficiary_id, service_id, stage_id, class_id, servant_id, assigned_by, is_current, start_date)
SELECT
  b.church_id,
  b.id,
  b.ministry_id,
  b.stage_id,
  NULL,
  -- find first servant assigned to this stage
  (SELECT s.id FROM servants s
   JOIN user_stage_assignments usa ON usa.user_id = s.id
   WHERE usa.stage_id = b.stage_id AND usa.church_id = b.church_id
   LIMIT 1),
  b.created_by,
  true,
  b.enrolled_at
FROM beneficiaries b
WHERE b.deleted_at IS NULL AND b.status = 'active';
```

> **Risk:** If no servant is assigned to the beneficiary's stage, `servant_id` will be NULL. The migration must handle this — either skip those records or assign to a default.

---

#### 2.1.9 `attendance` → Restructure into `attendance_sessions` + `attendance_records`

**Step 1:** Create `attendance_sessions`

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
```

**Step 2:** Create `attendance_records`

```sql
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
```

**Data migration:** Migrate from flat `attendance` table.

```sql
-- Create sessions from distinct (stage_id, attendance_date) pairs
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

-- Create records
INSERT INTO attendance_records (church_id, session_id, beneficiary_id, servant_id, status, recorded_by, notes, created_at)
SELECT
  a.church_id,
  asess.id,
  a.child_id,
  NULL,  -- no servant attendance in current data
  a.status,
  a.recorded_by,
  a.notes,
  a.created_at
FROM attendance a
JOIN attendance_sessions asess ON asess.stage_id = a.stage_id AND asess.session_date = a.attendance_date;
```

**Drop old table:**
```sql
DROP TABLE attendance;
```

---

#### 2.1.10 `followups` — Update FKs

```sql
ALTER TABLE followups RENAME COLUMN child_id TO beneficiary_id;
ALTER TABLE followups RENAME COLUMN created_by TO servant_id;
ALTER TABLE followups DROP CONSTRAINT followups_child_id_fkey;
ALTER TABLE followups ADD FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id) ON DELETE CASCADE;
ALTER TABLE followups DROP CONSTRAINT followups_created_by_fkey;
ALTER TABLE followups ADD FOREIGN KEY (servant_id) REFERENCES servants (id) ON DELETE CASCADE;
ALTER TABLE followups ADD COLUMN next_action text;
ALTER TABLE followups DROP COLUMN stage_id;  -- resolved via beneficiary_assignments
```

**Status enum update:**
```sql
ALTER TYPE followup_status RENAME TO followup_status_old;
CREATE TYPE followup_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
ALTER TABLE followups ALTER COLUMN status TYPE followup_status USING status::text::followup_status;
-- Map 'scheduled' → 'open'
UPDATE followups SET status = 'open' WHERE status::text = 'scheduled';
DROP TYPE followup_status_old;
```

---

#### 2.1.11 `spiritual_records` → Replace with `spiritual_journal_entries`

Current `spiritual_records`: tied to `child_id`, has `record_type`, `record_date`, `notes`.

Target `spiritual_journal_entries`: tied to `servant_id`, has daily booleans for prayer times, `entry_date`.

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

CREATE INDEX idx_spiritual_journal_servant_date ON spiritual_journal_entries (servant_id, entry_date);

CREATE TRIGGER trg_spiritual_journal_updated_at
  BEFORE UPDATE ON spiritual_journal_entries
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

**No data migration from `spiritual_records`** — the old records are child-focused with a different schema. Keep `spiritual_records` as-is for historical data. The new table is for servant journaling. `spiritual_records` will be deprecated in a later cleanup.

---

#### 2.1.12 `notifications` — Schema Update

```sql
ALTER TABLE notifications RENAME COLUMN user_id TO recipient_id;
ALTER TABLE notifications DROP COLUMN channel;
ALTER TABLE notifications RENAME COLUMN type TO channel;
ALTER TABLE notifications ADD COLUMN notification_type text NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN is_read boolean NOT NULL DEFAULT false;
ALTER TABLE notifications DROP COLUMN sent_at CASCADE;
ALTER TABLE notifications ALTER COLUMN read_at DROP NOT NULL;
ALTER TABLE notifications ADD COLUMN data jsonb;
ALTER TABLE notifications RENAME COLUMN metadata TO old_metadata;

CREATE INDEX idx_notifications_recipient_read ON notifications (recipient_id, is_read, created_at DESC);
```

---

#### 2.1.13 `user_role_type` Enum — Add `platform_owner`, Rename Roles

```sql
ALTER TYPE user_role_type ADD VALUE 'platform_owner' BEFORE 'super_admin';
-- 'super_admin' stays
-- 'church_admin' → 'admin' (rename is complex with enum)
-- 'stage_leader' → merged into 'admin' or 'servant'
-- 'servant' → 'user'
-- 'viewer' → 'user'
```

**Enum rename strategy (PostgreSQL):**
```sql
-- Create new enum
CREATE TYPE user_role_type_new AS ENUM ('platform_owner', 'super_admin', 'admin', 'user');

-- Update columns to use text temporarily
ALTER TABLE roles ALTER COLUMN role_type TYPE text;

-- Drop old enum
DROP TYPE user_role_type CASCADE;

-- Map values
UPDATE roles SET role_type = 'admin' WHERE role_type = 'church_admin';
UPDATE roles SET role_type = 'user' WHERE role_type IN ('stage_leader', 'servant', 'viewer');

-- Rename new enum
ALTER TYPE user_role_type_new RENAME TO user_role_type;

-- Update columns
ALTER TABLE roles ALTER COLUMN role_type TYPE user_role_type USING role_type::user_role_type;
```

**Update `user_roles` and related functions** similarly.

---

#### 2.1.14 `subscription_plans` — Create (Phase 2, document only)

```sql
CREATE TABLE subscription_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  code              text NOT NULL UNIQUE,
  price_monthly     integer NOT NULL,
  price_yearly      integer,
  max_servants      integer,
  max_beneficiaries integer,
  max_storage_mb    integer,
  features          jsonb NOT NULL DEFAULT '{}',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

---

## 3. Permission Code Changes

### 3.1 Rename existing codes

| Current Code | New Code |
|-------------|----------|
| `children.read` | `beneficiaries.read` |
| `children.create` | `beneficiaries.create` |
| `children.update` | `beneficiaries.update` |
| `children.delete` | `beneficiaries.delete` |
| `children.export` | (remove — not in PRD spec) |

### 3.2 Add new codes

```sql
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
  ('spiritual.read', 'عرض اليوميات الروحية', 'Read Spiritual Entries', 'spiritual');
```

### 3.3 Remove deprecated codes

```sql
DELETE FROM permissions WHERE code IN (
  'events.read', 'events.create', 'events.update', 'events.delete',
  'documents.read', 'documents.create', 'documents.delete',
  'ai.use', 'ai.manage',
  'children.export'
);
```

> **Note:** These are being removed from the seed set because they're not MVP per the PRD spec. The actual DELETE should only happen after verifying no role references exist.

---

## 4. Index Changes Summary

| Table | New Index | Drop Index |
|-------|-----------|------------|
| `churches` | `(subscription_status)` | — |
| `services` | `(church_id)` (replaces ministries) | `idx_ministries_church`, `idx_ministries_church_active` |
| `classes` | `(church_id, stage_id)` | — |
| `profiles` | `(church_id, spiritual_title)` | — |
| `servants` | `(church_id, approval_status)` | — |
| `servant_stage_assignments` | `(servant_id, is_active)`, `(church_id, stage_id)`, `(church_id, service_id)` | Replaces `idx_user_stage_assignments_*` |
| `beneficiaries` | Rebuild all | `idx_children_*` (all 7) |
| `beneficiary_assignments` | `(beneficiary_id) WHERE is_current`, `(church_id, stage_id)`, `(church_id, servant_id)` | — |
| `attendance_sessions` | `(church_id, stage_id, session_date)` | — |
| `attendance_records` | `(session_id)`, `(beneficiary_id, status)` | `idx_attendance_*` (3 indexes on old `attendance`) |
| `followups` | Rebuild with new FKs | Existing |
| `spiritual_journal_entries` | `(servant_id, entry_date)` UNIQUE | — |
| `notifications` | `(recipient_id, is_read, created_at)` | `idx_notifications_church_user_read`, `idx_notifications_user_created` |

---

## 5. Migration Order (Sequential)

```
Migration 007: services rename + stages FK update
Migration 008: classes table
Migration 009: churches columns
Migration 010: profiles columns
Migration 011: servants table
Migration 012: servant_stage_assignments (new) + drop user_stage_assignments
Migration 013: beneficiaries rename + schema restructure
Migration 014: beneficiary_assignments table
Migration 015: attendance_sessions + attendance_records (migrate from attendance)
Migration 016: followups FK + status enum update
Migration 017: spiritual_journal_entries
Migration 018: notifications schema update
Migration 019: role_type enum update + permission code changes
```

---

## 6. Data Migration Strategy

### 6.1 Approach

- **All migrations use `INSERT ... SELECT` from old tables to new tables** to preserve existing data
- **Old tables are dropped only after verification** — by default we keep them with a `_backup` suffix for 30 days
- **Transactions:** Each migration that moves data is wrapped in a transaction with verification step

### 6.2 Backup Strategy

```sql
-- Before dropping any table, rename:
ALTER TABLE attendance RENAME TO attendance_backup_YYYYMMDD;
ALTER TABLE children RENAME TO children_backup_YYYYMMDD;
ALTER TABLE ministries RENAME TO ministries_backup_YYYYMMDD;
ALTER TABLE user_stage_assignments RENAME TO user_stage_assignments_backup_YYYYMMDD;
ALTER TABLE spiritual_records RENAME TO spiritual_records_backup_YYYYMMDD;
```

### 6.3 Verification Queries

After each data migration, run:

```sql
-- Verify row counts match
SELECT 'source' AS table, COUNT(*) FROM source_table
UNION ALL
SELECT 'target', COUNT(*) FROM target_table;

-- Verify no orphaned records
SELECT COUNT(*) FROM target_table t
WHERE NOT EXISTS (SELECT 1 FROM source_table s WHERE s.id = t.old_id);
```

---

## 7. Rollback Strategy

### 7.1 Per-Migration Rollback

Each migration is designed to be revertible:

| Migration | Rollback Action |
|-----------|----------------|
| Services rename | Drop `services`, restore `ministries` from backup |
| Classes | `DROP TABLE classes CASCADE` |
| Churches columns | `ALTER TABLE churches DROP COLUMN ...` |
| Profiles columns | `ALTER TABLE profiles DROP COLUMN ...` |
| Servants | `DROP TABLE servants CASCADE` |
| servant_stage_assignments | Drop new table, rename backup back |
| Beneficiaries rename | Drop `beneficiaries`, rename `children_backup` back |
| beneficiary_assignments | `DROP TABLE beneficiary_assignments CASCADE` |
| Attendance restructure | Drop new tables, rename `attendance_backup` back |
| Followups FK update | Revert FK changes, restore old status enum |
| spiritual_journal_entries | `DROP TABLE spiritual_journal_entries` |
| Notifications schema | Revert column changes from backup |

### 7.2 Full Rollback

In case of catastrophic failure, restore from database backup taken before migration start:
```bash
pg_restore -d church_ministry_crm pre_migration_backup.dump
```

---

## 8. Go/No-Go Checklist

- [ ] All source documents read and understood
- [ ] Migration scripts written and reviewed
- [ ] Backup taken of production database
- [ ] Dry run completed on staging database
- [ ] Row counts verified after dry run
- [ ] Application code updated to match new schema
- [ ] All application tests pass after schema changes
- [ ] RLS policies updated for new tables
- [ ] TypeScript types regenerated (`supabase gen types`)
- [ ] Rollback scripts ready and tested
