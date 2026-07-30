# Canonical Database Specification

**Date:** 2026-07-30  
**Status:** Final — single source of truth  
**Supersedes:** All prior DATABASE_REQUIREMENTS.md, DATABASE_MIGRATION_PLAN.md schema definitions  

**Total tables:** 26 (21 Core + 2 AI + 1 Archive + 2 Phase 2)  
**MVP tables:** 19  
**Phase 2 tables:** 2 (subscription_plans, ai_conversations + ai_messages + document_embeddings)  
**Retained (no change):** 5 (events, event_registrations, documents, spiritual_records archival)  

---

## Enum Definitions

```sql
-- Gender
CREATE TYPE gender_type AS ENUM ('male', 'female');

-- Attendance status
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused');

-- Follow-up status
CREATE TYPE followup_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');

-- User role type (system-level)
CREATE TYPE user_role_type AS ENUM ('platform_owner', 'super_admin', 'admin', 'servant');

-- Notification type
-- TEXT domain values: 'consecutive_absence', 'followup_due', 'followup_overdue',
-- 'approval_required', 'approval_result', 'birthday', 'attendance_reminder',
-- 'missing_attendance', 'spiritual_reminder', 'system'

-- Notification channel
-- TEXT domain values: 'in_app', 'email', 'whatsapp'

-- Servant approval status
-- TEXT domain values: 'pending', 'approved', 'rejected'

-- Servant assignment role
-- TEXT domain values: 'service_admin', 'stage_leader', 'class_leader', 'servant'

-- Beneficiary status
-- TEXT domain values: 'active', 'inactive', 'transferred', 'graduated'

-- Subscription tier
-- TEXT domain values: 'trial', 'starter', 'growth', 'enterprise'

-- Subscription status
-- TEXT domain values: 'active', 'trialing', 'past_due', 'cancelled'
```

---

## Table: `churches` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| name_ar | TEXT | NOT NULL |
| name_en | TEXT | |
| slug | TEXT | UNIQUE NOT NULL |
| logo_url | TEXT | |
| contact_email | TEXT | |
| contact_phone | TEXT | |
| address_ar | TEXT | |
| address_en | TEXT | |
| subscription_tier | TEXT | NOT NULL DEFAULT 'trial' |
| subscription_status | TEXT | NOT NULL DEFAULT 'active' |
| trial_ends_at | TIMESTAMPTZ | |
| feature_flags | JSONB | NOT NULL DEFAULT '{}' |
| locale | TEXT | NOT NULL DEFAULT 'ar' |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| deleted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_churches_slug` UNIQUE on `slug`
- `idx_churches_subscription_status` on `(subscription_status) WHERE deleted_at IS NULL`

---

## Table: `profiles` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK REFERENCES auth.users(id) ON DELETE CASCADE |
| church_id | UUID | NOT NULL REFERENCES churches(id) |
| email | TEXT | NOT NULL |
| full_name_ar | TEXT | NOT NULL |
| full_name_en | TEXT | |
| phone | TEXT | |
| avatar_url | TEXT | |
| date_of_birth | DATE | |
| gender | gender_type | |
| spiritual_title | TEXT | |
| service_started_at | DATE | |
| preferred_locale | TEXT | NOT NULL DEFAULT 'ar' |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| last_login_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_profiles_church_active` on `(church_id) WHERE deleted_at IS NULL`
- `idx_profiles_email` UNIQUE on `(email)`
- `idx_profiles_spiritual_title` on `(church_id, spiritual_title) WHERE deleted_at IS NULL AND spiritual_title IS NOT NULL`

**Platform owner exception:** Platform owner profile has `church_id = NULL`.

---

## Table: `services` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| name_ar | TEXT | NOT NULL |
| name_en | TEXT | |
| description_ar | TEXT | |
| description_en | TEXT | |
| sort_order | INTEGER | NOT NULL DEFAULT 0 |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| deleted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_services_church_active` on `(church_id) WHERE deleted_at IS NULL`

---

## Table: `stages` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| service_id | UUID | NOT NULL REFERENCES services(id) |
| name_ar | TEXT | NOT NULL |
| name_en | TEXT | |
| description_ar | TEXT | |
| description_en | TEXT | |
| age_min | INTEGER | |
| age_max | INTEGER | |
| sort_order | INTEGER | NOT NULL DEFAULT 0 |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| deleted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_stages_service_sort` on `(service_id, sort_order) WHERE deleted_at IS NULL`

---

## Table: `classes` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| stage_id | UUID | NOT NULL REFERENCES stages(id) ON DELETE CASCADE |
| name_ar | TEXT | NOT NULL |
| name_en | TEXT | |
| sort_order | INTEGER | NOT NULL DEFAULT 0 |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| deleted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_classes_church_stage` on `(church_id, stage_id) WHERE deleted_at IS NULL`

---

## Table: `servants` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK REFERENCES profiles(id) ON DELETE CASCADE |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| confession_father_name | TEXT | |
| join_date | DATE | |
| service_history | JSONB | NOT NULL DEFAULT '[]' |
| notes | TEXT | |
| approval_status | TEXT | NOT NULL DEFAULT 'pending' |
| approved_by | UUID | REFERENCES profiles(id) |
| approved_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_servants_church_approval` on `(church_id, approval_status) WHERE deleted_at IS NULL`

**Approval status values:** `'pending'`, `'approved'`, `'rejected'`

---

## Table: `servant_stage_assignments` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| servant_id | UUID | NOT NULL REFERENCES servants(id) ON DELETE CASCADE |
| service_id | UUID | NOT NULL REFERENCES services(id) |
| stage_id | UUID | REFERENCES stages(id), nullable |
| class_id | UUID | REFERENCES classes(id), nullable |
| role | TEXT | NOT NULL |
| assigned_by | UUID | NOT NULL REFERENCES profiles(id) |
| start_date | DATE | NOT NULL |
| end_date | DATE | nullable |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_ssa_servant_active` on `(servant_id, is_active)`
- `idx_ssa_stage_active` on `(church_id, stage_id, is_active)`
- `idx_ssa_service_active` on `(church_id, service_id, is_active)`

**Role values:** `'service_admin'`, `'stage_leader'`, `'class_leader'`, `'servant'`

---

## Table: `beneficiaries` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| full_name_ar | TEXT | NOT NULL |
| full_name_en | TEXT | |
| date_of_birth | DATE | NOT NULL |
| gender | gender_type | NOT NULL |
| address | TEXT | |
| school | TEXT | |
| mobile | TEXT | |
| father_mobile | TEXT | |
| mother_mobile | TEXT | |
| whatsapp | TEXT | |
| confession_father | TEXT | |
| photo_url | TEXT | |
| notes | TEXT | |
| status | TEXT | NOT NULL DEFAULT 'active' |
| deleted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_beneficiaries_church_stage` on `(church_id, stage_id, status) WHERE deleted_at IS NULL`

**Status values:** `'active'`, `'inactive'`, `'transferred'`, `'graduated'`

---

## Table: `beneficiary_assignments` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| beneficiary_id | UUID | NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE |
| service_id | UUID | NOT NULL REFERENCES services(id) |
| stage_id | UUID | NOT NULL REFERENCES stages(id) |
| class_id | UUID | REFERENCES classes(id), nullable |
| servant_id | UUID | NOT NULL REFERENCES servants(id) |
| assigned_by | UUID | NOT NULL REFERENCES profiles(id) |
| is_current | BOOLEAN | NOT NULL DEFAULT true |
| start_date | DATE | NOT NULL |
| end_date | DATE | nullable |
| transfer_reason | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_ba_current` on `(beneficiary_id) WHERE is_current = true`
- `idx_ba_stage_current` on `(church_id, stage_id, is_current)`
- `idx_ba_servant_current` on `(church_id, servant_id, is_current)`

**Immutability:** INSERT-only. No UPDATE or DELETE. Trigger-enforced in Phase 2.

---

## Table: `attendance_sessions` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| service_id | UUID | NOT NULL REFERENCES services(id) |
| stage_id | UUID | NOT NULL REFERENCES stages(id) |
| class_id | UUID | REFERENCES classes(id), nullable |
| session_date | DATE | NOT NULL |
| notes | TEXT | |
| created_by | UUID | NOT NULL REFERENCES profiles(id) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Unique constraint:** `UNIQUE (stage_id, session_date)` — one session per stage per day. Class-level sessions deferred to Phase 3.

**Indexes:**
- `idx_attendance_sessions_stage_date` on `(church_id, stage_id, session_date)`

---

## Table: `attendance_records` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| session_id | UUID | NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE |
| beneficiary_id | UUID | REFERENCES beneficiaries(id), nullable |
| servant_id | UUID | REFERENCES servants(id), nullable |
| status | attendance_status | NOT NULL |
| recorded_by | UUID | NOT NULL REFERENCES profiles(id) |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Check constraint:** `CHECK ((beneficiary_id IS NOT NULL AND servant_id IS NULL) OR (beneficiary_id IS NULL AND servant_id IS NOT NULL))`

**Indexes:**
- `idx_attendance_records_session` on `(session_id)`
- `idx_attendance_records_beneficiary_status` on `(beneficiary_id, status, session_date)` — for absence alerts

---

## Table: `followups` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| beneficiary_id | UUID | NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE |
| servant_id | UUID | NOT NULL REFERENCES servants(id) ON DELETE CASCADE |
| assigned_to | UUID | REFERENCES servants(id), nullable |
| type | TEXT | NOT NULL |
| notes | TEXT | |
| outcome | TEXT | |
| next_action | TEXT | |
| status | followup_status | NOT NULL DEFAULT 'open' |
| scheduled_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_followups_servant_status` on `(servant_id, status, scheduled_at) WHERE deleted_at IS NULL`

**Type values:** `'phone'`, `'visit'`, `'meeting'`, `'other'`

---

## Table: `spiritual_journal_entries` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| servant_id | UUID | NOT NULL REFERENCES servants(id) ON DELETE CASCADE |
| entry_date | DATE | NOT NULL |
| morning_prayer | BOOLEAN | NOT NULL DEFAULT false |
| third_hour_prayer | BOOLEAN | NOT NULL DEFAULT false |
| sixth_hour_prayer | BOOLEAN | NOT NULL DEFAULT false |
| ninth_hour_prayer | BOOLEAN | NOT NULL DEFAULT false |
| sunset_prayer | BOOLEAN | NOT NULL DEFAULT false |
| sleep_prayer | BOOLEAN | NOT NULL DEFAULT false |
| bible_reading | BOOLEAN | NOT NULL DEFAULT false |
| confession | BOOLEAN | NOT NULL DEFAULT false |
| communion | BOOLEAN | NOT NULL DEFAULT false |
| spiritual_notes | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Unique constraint:** `UNIQUE (servant_id, entry_date)` — one entry per servant per day.

**Indexes:**
- `idx_spiritual_servant_date` UNIQUE on `(servant_id, entry_date)`

---

## Table: `notifications` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| recipient_id | UUID | NOT NULL REFERENCES profiles(id) ON DELETE CASCADE |
| notification_type | TEXT | NOT NULL |
| title_ar | TEXT | NOT NULL |
| title_en | TEXT | |
| body_ar | TEXT | NOT NULL |
| body_en | TEXT | |
| data | JSONB | |
| is_read | BOOLEAN | NOT NULL DEFAULT false |
| channel | TEXT | NOT NULL |
| sent_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| read_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_notifications_recipient_read` on `(recipient_id, is_read, sent_at DESC)`

---

## Table: `audit_logs` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | REFERENCES churches(id), nullable |
| actor_id | UUID | REFERENCES profiles(id), nullable |
| action | TEXT | NOT NULL |
| entity_type | TEXT | NOT NULL |
| entity_id | UUID | NOT NULL |
| old_values | JSONB | |
| new_values | JSONB | |
| metadata | JSONB | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_audit_logs_church_time` on `(church_id, created_at DESC)`
- `idx_audit_logs_entity` on `(entity_type, entity_id)`

**Immutability:** INSERT-only. No UPDATE or DELETE. App-enforced in MVP, trigger-enforced in Phase 2.

---

## Table: `roles` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| role_type | user_role_type | NOT NULL |
| name_ar | TEXT | NOT NULL |
| name_en | TEXT | |
| description_ar | TEXT | |
| is_system | BOOLEAN | NOT NULL DEFAULT false |
| deleted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Seeded roles per church:** `super_admin`, `admin`, `servant` (3 roles). `platform_owner` is system-level only.

---

## Table: `permissions` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| code | TEXT | UNIQUE NOT NULL |
| name_ar | TEXT | NOT NULL |
| name_en | TEXT | |
| module | TEXT | NOT NULL |
| description_ar | TEXT | |

**Seeded:** All 52 codes from CANONICAL_PERMISSION_CATALOG.md.

---

## Table: `role_permissions` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| role_id | UUID | NOT NULL REFERENCES roles(id) ON DELETE CASCADE |
| permission_id | UUID | NOT NULL REFERENCES permissions(id) ON DELETE CASCADE |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Unique constraint:** `UNIQUE (role_id, permission_id)`

---

## Table: `user_roles` — Core MVP

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| church_id | UUID | NOT NULL REFERENCES churches(id) ON DELETE CASCADE |
| user_id | UUID | NOT NULL REFERENCES profiles(id) ON DELETE CASCADE |
| role_id | UUID | NOT NULL REFERENCES roles(id) |
| assigned_by | UUID | NOT NULL REFERENCES profiles(id) |
| start_date | DATE | NOT NULL |
| end_date | DATE | nullable |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_user_roles_user_active` on `(user_id, role_id) WHERE end_date IS NULL`

---

## Table: `events` — Retained (no MVP changes)

Existing table. FK update: `ministry_id → service_id`.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| church_id | UUID | NOT NULL REFERENCES churches(id) |
| service_id | UUID | NOT NULL REFERENCES services(id) |
| ... (existing columns) | | |

---

## Table: `event_registrations` — Retained (with rename)

Existing table. Column rename: `child_id → beneficiary_id`.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| church_id | UUID | NOT NULL REFERENCES churches(id) |
| event_id | UUID | NOT NULL REFERENCES events(id) |
| beneficiary_id | UUID | NOT NULL REFERENCES beneficiaries(id) |
| ... (existing columns) | | |

---

## Table: `documents` — Retained (no changes)

---

## Table: `ai_conversations` — Retained (no changes, Phase 2 usage)

---

## Table: `ai_messages` — Retained (no changes, Phase 2 usage)

---

## Table: `document_embeddings` — Retained (no changes, Phase 2 usage)

---

## Table: `spiritual_records` — Retained for historical archive

Old table kept as-is for backward compatibility. Not exposed in MVP UI. No data migration.

---

## Table: `subscription_plans` — Phase 2

Deferred. Documented for future reference only.

---

## Entity Relationship Diagram (Text)

```
churches
  ├── profiles (church_id FK)
  │     └── servants (id FK → profiles.id, church_id FK)
  │           ├── servant_stage_assignments (servant_id FK, service_id FK, stage_id FK nullable, class_id FK nullable)
  │           └── spiritual_journal_entries (servant_id FK, church_id FK)
  ├── services (church_id FK)
  │     └── stages (service_id FK, church_id FK)
  │           └── classes (stage_id FK, church_id FK)
  ├── beneficiaries (church_id FK)
  │     └── beneficiary_assignments (beneficiary_id FK, service_id FK, stage_id FK, class_id FK nullable, servant_id FK)
  ├── attendance_sessions (church_id FK, service_id FK, stage_id FK, class_id FK nullable)
  │     └── attendance_records (session_id FK, beneficiary_id FK nullable, servant_id FK nullable)
  ├── followups (church_id FK, beneficiary_id FK, servant_id FK, assigned_to FK nullable)
  ├── notifications (church_id FK, recipient_id FK → profiles.id)
  ├── audit_logs (church_id FK nullable, actor_id FK → profiles.id nullable)
  ├── roles (church_id FK)
  │     ├── role_permissions (role_id FK, permission_id FK)
  │     └── user_roles (role_id FK, user_id FK → profiles.id)
  ├── events (church_id FK, service_id FK)
  │     └── event_registrations (event_id FK, beneficiary_id FK)
  ├── documents (church_id FK)
  ├── spiritual_records (archival only)
  └── subscription_plans (Phase 2)
```

---

## Index Master List

| Table | Index | Purpose |
|-------|-------|---------|
| churches | `slug` UNIQUE | Routing |
| churches | `(subscription_status) WHERE deleted_at IS NULL` | Subscription management |
| profiles | `(church_id) WHERE deleted_at IS NULL` | Tenant scoping |
| profiles | `(email)` UNIQUE | Auth lookup |
| profiles | `(church_id, spiritual_title) WHERE ...` | Spiritual title filter |
| services | `(church_id) WHERE deleted_at IS NULL` | Tenant scoping |
| stages | `(service_id, sort_order) WHERE deleted_at IS NULL` | Stage ordering |
| classes | `(church_id, stage_id) WHERE deleted_at IS NULL` | Class listing |
| servants | `(church_id, approval_status) WHERE deleted_at IS NULL` | Approval queue |
| servant_stage_assignments | `(servant_id, is_active)` | Servant assignments |
| servant_stage_assignments | `(church_id, stage_id, is_active)` | Stage roster |
| servant_stage_assignments | `(church_id, service_id, is_active)` | Service roster |
| beneficiaries | `(church_id, status) WHERE deleted_at IS NULL` | Tenant + status filter (stage roster via `beneficiary_assignments`) |
| beneficiary_assignments | `(beneficiary_id) WHERE is_current = true` | Current assignment |
| beneficiary_assignments | `(church_id, stage_id, is_current)` | Stage roster |
| beneficiary_assignments | `(church_id, servant_id, is_current)` | Servant roster |
| attendance_sessions | `(church_id, stage_id, session_date)` | Session lookup |
| attendance_records | `(session_id)` | Session roster |
| attendance_records | `(beneficiary_id, status, session_date)` | Absence alerts |
| followups | `(servant_id, status, scheduled_at) WHERE deleted_at IS NULL` | Task list |
| spiritual_journal_entries | `(servant_id, entry_date)` UNIQUE | Daily entry |
| notifications | `(recipient_id, is_read, sent_at DESC)` | Notification center |
| audit_logs | `(church_id, created_at DESC)` | Audit viewer |
| audit_logs | `(entity_type, entity_id)` | Entity history |
| user_roles | `(user_id, role_id) WHERE end_date IS NULL` | Current role |
