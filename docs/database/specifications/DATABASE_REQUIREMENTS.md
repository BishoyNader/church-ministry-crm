# Database Requirements — Church Ministry Platform

**Version:** 1.0  
**Scope:** All entities required for MVP + Phase 2 + Phase 3  
**Key constraint:** Every tenant-isolated table MUST include `church_id` for RLS enforcement.

---

## 1. Core Entities

### 1.1 churches

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default gen_random_uuid() | |
| name_ar | TEXT | NOT NULL | Primary name |
| name_en | TEXT | | |
| slug | TEXT | UNIQUE, NOT NULL | Used for subdomain/path routing |
| logo_url | TEXT | | |
| contact_email | TEXT | | |
| contact_phone | TEXT | | |
| address | TEXT | | |
| subscription_tier | TEXT | NOT NULL, DEFAULT 'trial' | starter, growth, enterprise |
| subscription_status | TEXT | NOT NULL, DEFAULT 'active' | active, trialing, past_due, cancelled |
| trial_ends_at | TIMESTAMPTZ | | |
| feature_flags | JSONB | DEFAULT '{}' | Per-tenant feature toggles |
| locale | TEXT | NOT NULL, DEFAULT 'ar' | ar, en |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Ownership:** Platform Owner. Church admins can read/update their own church config.  
**Soft delete:** `deleted_at` set; 30-day grace period then hard delete via cron.

---

### 1.2 profiles (unified user account)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, references auth.users(id) ON DELETE CASCADE | |
| church_id | UUID | NOT NULL, FK → churches(id) | Tenant isolation |
| email | TEXT | NOT NULL | |
| full_name_ar | TEXT | NOT NULL | |
| full_name_en | TEXT | | |
| phone | TEXT | | |
| avatar_url | TEXT | | |
| preferred_locale | TEXT | NOT NULL, DEFAULT 'ar' | |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | |
| last_login_at | TIMESTAMPTZ | | |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Ownership:** The profile owner. Priest can view all. Ministry Leader can view assigned servants.  
**Soft delete:** `deleted_at` set; user cannot log in.

---

### 1.3 services

Renamed from "ministries" per V3. A service is a major ministry area (e.g., "Youth Service", "Children's Service").

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | Tenant isolation |
| name_ar | TEXT | NOT NULL | |
| name_en | TEXT | | |
| description_ar | TEXT | | |
| description_en | TEXT | | |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Ownership:** Church. Priest manages. Ministry Leader can see assigned.  
**Soft delete:** `deleted_at` set; cascades to stages, assignments (blocked if active children exist).

---

### 1.4 stages

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | Tenant isolation |
| service_id | UUID | NOT NULL, FK → services(id) | Parent service |
| name_ar | TEXT | NOT NULL | |
| name_en | TEXT | | |
| description_ar | TEXT | | |
| description_en | TEXT | | |
| age_min | INTEGER | | Minimum age |
| age_max | INTEGER | | Maximum age |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Ownership:** Church → Service.  
**Soft delete:** Blocked if active beneficiaries assigned.

---

### 1.5 classes (optional subdivision of a stage)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | Tenant isolation |
| stage_id | UUID | NOT NULL, FK → stages(id) | Parent stage |
| name_ar | TEXT | NOT NULL | |
| name_en | TEXT | | |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | |
| deleted_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Ownership:** Church → Service → Stage.  
**Optional:** Churches that do not use classes leave stage_id directly on assignments.

---

### 1.6 servants

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, FK → profiles(id) | One-to-one with profile |
| church_id | UUID | NOT NULL, FK → churches(id) | Tenant isolation |
| confession_father_name | TEXT | | |
| join_date | DATE | | |
| service_history | JSONB | DEFAULT '[]' | Array of {service_id, stage_id, role, start_date, end_date} |
| notes | TEXT | | |
| approval_status | TEXT | NOT NULL, DEFAULT 'pending' | pending, approved, rejected |
| approved_by | UUID | FK → profiles(id) | Priest who approved |
| approved_at | TIMESTAMPTZ | | |
| deleted_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Ownership:** Church. Priest can see all. Ministry Leader sees assigned.  
**Approval workflow:** `approval_status = 'pending'` until Priest approves.

---

### 1.7 servant_stage_assignments

Tracks which servant is assigned to which stage/service, with temporal history.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | |
| servant_id | UUID | NOT NULL, FK → servants(id) | |
| service_id | UUID | NOT NULL, FK → services(id) | Denormalized for RLS |
| stage_id | UUID | FK → stages(id) | Nullable — servant may serve at service level |
| class_id | UUID | FK → classes(id) | Nullable |
| role | TEXT | NOT NULL | 'ministry_leader', 'servant' |
| assigned_by | UUID | NOT NULL, FK → profiles(id) | |
| start_date | DATE | NOT NULL | |
| end_date | DATE | | Null = current assignment |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Temporal tracking:** `end_date` set on reassignment or annual change. Historical rows are preserved.

---

### 1.8 beneficiaries

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | Tenant isolation |
| full_name_ar | TEXT | NOT NULL | |
| full_name_en | TEXT | | |
| date_of_birth | DATE | NOT NULL | |
| gender | TEXT | NOT NULL | 'male', 'female' |
| address | TEXT | | |
| school | TEXT | | |
| mobile | TEXT | | |
| father_mobile | TEXT | | |
| mother_mobile | TEXT | | |
| whatsapp | TEXT | | |
| confession_father | TEXT | | |
| photo_url | TEXT | | |
| notes | TEXT | | |
| status | TEXT | NOT NULL, DEFAULT 'active' | active, inactive, transferred, graduated |
| deleted_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Ownership:** Church. Always assigned to exactly one active stage + servant.

---

### 1.9 beneficiary_assignments

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | |
| beneficiary_id | UUID | NOT NULL, FK → beneficiaries(id) | |
| service_id | UUID | NOT NULL, FK → services(id) | |
| stage_id | UUID | NOT NULL, FK → stages(id) | |
| class_id | UUID | FK → classes(id) | Nullable |
| servant_id | UUID | NOT NULL, FK → servants(id) | Responsible servant |
| assigned_by | UUID | NOT NULL, FK → profiles(id) | |
| is_current | BOOLEAN | NOT NULL, DEFAULT true | Only one current per beneficiary |
| start_date | DATE | NOT NULL | |
| end_date | DATE | | Null = current |
| transfer_reason | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Immutable:** Once written, never modified. New assignment = new row with `is_current = false` on old.

---

### 1.10 attendance_sessions

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | |
| service_id | UUID | NOT NULL, FK → services(id) | |
| stage_id | UUID | NOT NULL, FK → stages(id) | |
| class_id | UUID | FK → classes(id) | |
| session_date | DATE | NOT NULL | |
| notes | TEXT | | |
| created_by | UUID | NOT NULL, FK → profiles(id) | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique constraint:** `(stage_id, session_date)` — one session per stage per day.

---

### 1.11 attendance_records

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | |
| session_id | UUID | NOT NULL, FK → attendance_sessions(id) | |
| beneficiary_id | UUID | FK → beneficiaries(id) | Nullable — servant attendance |
| servant_id | UUID | FK → servants(id) | Nullable — beneficiary attendance |
| status | TEXT | NOT NULL | 'present', 'absent', 'excused' |
| recorded_by | UUID | NOT NULL, FK → profiles(id) | |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Constraint:** Exactly one of `beneficiary_id` or `servant_id` must be set.  
**Index:** `(beneficiary_id, status, session_date)` for absence alerts.

---

### 1.12 followups

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | |
| beneficiary_id | UUID | NOT NULL, FK → beneficiaries(id) | |
| servant_id | UUID | NOT NULL, FK → servants(id) | Creator / assignee |
| assigned_to | UUID | FK → servants(id) | Can be reassigned |
| type | TEXT | NOT NULL | 'phone', 'visit', 'meeting', 'other' |
| notes | TEXT | | |
| outcome | TEXT | | |
| next_action | TEXT | | |
| status | TEXT | NOT NULL, DEFAULT 'open' | 'open', 'in_progress', 'completed', 'cancelled' |
| scheduled_at | TIMESTAMPTZ | | For reminders |
| completed_at | TIMESTAMPTZ | | |
| deleted_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

---

### 1.13 spiritual_journal_entries

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | |
| servant_id | UUID | NOT NULL, FK → servants(id) | Owner |
| entry_date | DATE | NOT NULL | |
| morning_prayer | BOOLEAN | DEFAULT false | |
| third_hour_prayer | BOOLEAN | DEFAULT false | |
| sixth_hour_prayer | BOOLEAN | DEFAULT false | |
| ninth_hour_prayer | BOOLEAN | DEFAULT false | |
| sunset_prayer | BOOLEAN | DEFAULT false | |
| sleep_prayer | BOOLEAN | DEFAULT false | |
| bible_reading | BOOLEAN | DEFAULT false | |
| confession | BOOLEAN | DEFAULT false | |
| communion | BOOLEAN | DEFAULT false | |
| spiritual_notes | TEXT | | Free text |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique constraint:** `(servant_id, entry_date)` — one entry per servant per day.  
**Access:** Servant (owner), Priest (full church). Audit-logged on every read by Priest.

---

### 1.14 notifications

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | |
| recipient_id | UUID | NOT NULL, FK → profiles(id) | |
| type | TEXT | NOT NULL | See notification types |
| title_ar | TEXT | NOT NULL | |
| title_en | TEXT | | |
| body_ar | TEXT | NOT NULL | |
| body_en | TEXT | | |
| data | JSONB | | Context payload (e.g., beneficiary_id) |
| is_read | BOOLEAN | NOT NULL, DEFAULT false | |
| channel | TEXT | NOT NULL | 'in_app', 'email', 'whatsapp' |
| sent_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| read_at | TIMESTAMPTZ | | |

---

### 1.15 audit_logs

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | FK → churches(id) | Nullable — system-wide events |
| actor_id | UUID | FK → profiles(id) | |
| action | TEXT | NOT NULL | 'create', 'update', 'delete', 'access' |
| entity_type | TEXT | NOT NULL | 'servant', 'beneficiary', 'attendance', etc. |
| entity_id | UUID | NOT NULL | |
| old_values | JSONB | | |
| new_values | JSONB | | |
| metadata | JSONB | | IP, user_agent, etc. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Immutability:** Table is INSERT-only. No UPDATE or DELETE allowed. Trigger-enforced.

---

### 1.16 roles

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | System roles have church_id = system |
| role_type | TEXT | NOT NULL | 'super_admin', 'admin', 'user' |
| name_ar | TEXT | NOT NULL | |
| name_en | TEXT | | |
| description_ar | TEXT | | |
| is_system | BOOLEAN | NOT NULL, DEFAULT false | System roles cannot be deleted |
| deleted_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Seeded roles per church:** super_admin, admin, user (on church creation).

---

### 1.17 permissions

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| code | TEXT | UNIQUE, NOT NULL | e.g., 'beneficiaries.create' |
| name_ar | TEXT | NOT NULL | |
| name_en | TEXT | | |
| module | TEXT | NOT NULL | 'servants', 'beneficiaries', 'attendance', etc. |
| description_ar | TEXT | | |

**Seeded:** All permission codes defined in RBAC_ARCHITECTURE.md.

---

### 1.18 role_permissions

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| role_id | UUID | NOT NULL, FK → roles(id) | |
| permission_id | UUID | NOT NULL, FK → permissions(id) | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique:** `(role_id, permission_id)`

---

### 1.19 user_roles

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | |
| user_id | UUID | NOT NULL, FK → profiles(id) | |
| role_id | UUID | NOT NULL, FK → roles(id) | |
| assigned_by | UUID | NOT NULL, FK → profiles(id) | |
| start_date | DATE | NOT NULL | |
| end_date | DATE | | Null = current |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Temporal tracking:** Historical rows preserved. Annual role change = end_date on old + new row.

---

### 1.20 subscription_plans

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | TEXT | NOT NULL | |
| code | TEXT | UNIQUE, NOT NULL | 'starter', 'growth', 'enterprise' |
| price_monthly | INTEGER | NOT NULL | In cents (or smallest currency unit) |
| price_yearly | INTEGER | | |
| max_servants | INTEGER | | NULL = unlimited |
| max_beneficiaries | INTEGER | | NULL = unlimited |
| max_storage_mb | INTEGER | | NULL = unlimited |
| features | JSONB | NOT NULL, DEFAULT '{}' | Feature flags included |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

---

## 2. Entity Relationship Summary

```
churches (1) ──< services (N)
churches (1) ──< profiles (N)
churches (1) ──< roles (N)
churches (1) ──< subscription_plans (N) [reference]
services (1) ──< stages (N)
stages (1) ──< classes (N) [optional]

profiles (1) ──< servants (1)
servants (1) ──< servant_stage_assignments (N)
servants (1) ──< spiritual_journal_entries (N)

beneficiaries (1) ──< beneficiary_assignments (N)
beneficiaries (1) ──< attendance_records (N)
beneficiaries (1) ──< followups (N)

attendance_sessions (1) ──< attendance_records (N)
stages (1) ──< attendance_sessions (N)
```

---

## 3. Ownership Rules

| Entity | Owned By | Notes |
|--------|----------|-------|
| churches | Platform Owner | |
| profiles | Self + Church | User owns their profile; Priest can view all |
| services | Church | Priest manages; Ministry Leader sees assigned |
| stages | Church → Service | |
| classes | Church → Service → Stage | |
| servants | Church | Approved by Priest |
| servant_stage_assignments | Church → Stage | Temporal — history preserved |
| beneficiaries | Church → Stage → Servant | Always assigned to one servant |
| beneficiary_assignments | Church | Immutable — never updated |
| attendance_sessions | Church → Stage | |
| attendance_records | Church | |
| followups | Servant (creator) | Transferable |
| spiritual_journal_entries | Servant (owner) + Priest | Dual ownership |
| notifications | Recipient | Auto-deleted after 90 days |
| audit_logs | Church / System | Immutable |
| roles | Church | System roles seeded per church |
| user_roles | Church | Temporal |

---

## 4. Soft Delete Rules

| Entity | Grace Period | Hard Delete Trigger | Cascade |
|--------|-------------|---------------------|---------|
| churches | 30 days | Cron job after grace | All tenant data |
| profiles | 30 days | Cron after church deletion | Servant records anonymized |
| services | 90 days | Manual or cron | Blocked if active beneficiaries exist |
| stages | 90 days | Manual or cron | Blocked if active beneficiaries exist |
| classes | 90 days | Manual or cron | Reassign beneficiaries first |
| beneficiaries | 90 days | Manual or cron | Attendance/followup records kept (anonymized) |
| followups | 90 days | Manual | |
| notifications | N/A | Cron after 90 days | |

**Soft delete behavior:** `deleted_at` set. RLS filters `deleted_at IS NULL`.  
**Hard delete:** Only Platform Owner via admin tool. Not exposed to church users.

---

## 5. Audit Requirements

| Event | Audit? | Detail |
|-------|--------|--------|
| User login | ✅ | actor, timestamp, IP |
| User logout | ✅ | actor, timestamp |
| Permission change | ✅ | actor, target, old/new roles |
| Servant create/update/delete | ✅ | actor, target, old/new values |
| Beneficiary create/update/delete | ✅ | actor, target, old/new values |
| Beneficiary transfer | ✅ | actor, target, old/new stage/servant |
| Attendance record | ✅ | actor, session, status |
| Follow-up create/update/delete | ✅ | actor, target, old/new values |
| Spiritual journal access (Priest) | ✅ | actor, target, timestamp |
| Spiritual journal entry (servant) | ✅ | actor, date |
| Church settings change | ✅ | actor, old/new values |
| Tenant create/suspend/delete | ✅ | Platform Owner, target |

**Enforcement:** Database trigger on audit_logs prevents UPDATE/DELETE. Application layer never calls UPDATE/DELETE on audit_logs.

---

## 6. Indexing Requirements

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| profiles | (church_id, deleted_at) | B-tree | Tenant scoping + active filter |
| profiles | (email) | UNIQUE | Auth lookup |
| servants | (church_id, approval_status) | B-tree | Approval queue |
| beneficiaries | (church_id, stage_id, status) | Composite | Stage roster |
| beneficiary_assignments | (beneficiary_id, is_current) | Partial | Current assignment lookup |
| attendance_records | (beneficiary_id, status, session_date) | Composite | Absence alert query |
| attendance_records | (session_id) | B-tree | Session roster |
| followups | (servant_id, status, scheduled_at) | Composite | Follow-up task list |
| spiritual_journal_entries | (servant_id, entry_date) | UNIQUE | Daily entry constraint |
| audit_logs | (church_id, created_at) | B-tree | Audit viewer |
| audit_logs | (entity_type, entity_id) | B-tree | Entity history |
| notifications | (recipient_id, is_read, created_at) | Composite | Notification center |

---

## 7. RLS Policy Requirements

Every tenant-scoped table MUST have:

```sql
-- Example pattern (applies to all church_id tables)
CREATE POLICY tenant_isolation ON <table_name>
  USING (church_id = (SELECT church_id FROM profiles WHERE id = auth.uid()));
```

Additional policies per table for role-based access (e.g., Priest can see all, servant can see own).

**Exception:** `churches` table — only Platform Owner can read all rows; church users read own row.

---

## 8. Migration Strategy

1. `001_core_schema.sql` — churches, profiles, services, stages, classes
2. `002_servants.sql` — servants, servant_stage_assignments
3. `003_beneficiaries.sql` — beneficiaries, beneficiary_assignments
4. `004_attendance.sql` — attendance_sessions, attendance_records
5. `005_followups.sql` — followups
6. `006_spiritual.sql` — spiritual_journal_entries
7. `007_notifications.sql` — notifications
8. `008_audit.sql` — audit_logs (with immutability trigger)
9. `009_rbac.sql` — roles, permissions, role_permissions, user_roles
10. `010_billing.sql` — subscription_plans
11. `011_rls_policies.sql` — All RLS policies
12. `012_seed_data.sql` — Default roles, permissions, system config
