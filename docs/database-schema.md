# Church Ministry CRM — Database Schema

## Conventions

| Rule | Detail |
|------|--------|
| Primary keys | UUID v4 (`gen_random_uuid()`) |
| Timestamps | `created_at`, `updated_at` on all tables (auto-managed) |
| Soft delete | `deleted_at` on user-facing entities |
| Multi-tenancy | `church_id` on every tenant-scoped table |
| Bilingual fields | `*_ar` (required), `*_en` (optional) for display names |
| Naming | snake_case tables and columns |
| Enums | PostgreSQL native ENUM types |

---

## Enum Types

```sql
user_role_type        → super_admin | church_admin | stage_leader | servant | viewer
gender_type           → male | female
attendance_status     → present | absent | excused
followup_type         → phone_call | home_visit | whatsapp | church_meeting | other
followup_status       → scheduled | in_progress | completed | cancelled
child_status          → active | inactive | transferred | graduated
event_type            → meeting | camp | conference | trip | other
event_registration_status → registered | confirmed | cancelled | attended
notification_type     → in_app | email
notification_channel  → absence_alert | followup_reminder | birthday | event_reminder | system
pipeline_stage_type   → new_visitor | first_followup | regular_attendee | active_member | leader_candidate
audit_action          → create | update | delete | login | logout | export | ai_action
document_entity_type  → child | event | church | user
spiritual_record_type → baptism | confession | communion | prayer | other
ai_message_role       → user | assistant | system | tool
```

---

## Global Tables (No church_id)

### permissions

System-wide permission catalog.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| code | text | UNIQUE, NOT NULL | e.g. `children.read` |
| name_ar | text | NOT NULL | Arabic label |
| name_en | text | | English label |
| module | text | NOT NULL | Feature module grouping |
| description_ar | text | | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

---

## Tenant Root

### churches

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| name_ar | text | NOT NULL | Church name (Arabic) |
| name_en | text | | Church name (English) |
| slug | text | UNIQUE, NOT NULL | URL-safe identifier |
| logo_url | text | | Storage path |
| settings | jsonb | DEFAULT '{}' | Tenant config |
| is_active | boolean | DEFAULT true | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |
| deleted_at | timestamptz | | Soft delete |

**Indexes:** `slug`, `is_active`

---

## Organization Structure

### ministries

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| name_ar | text | NOT NULL | |
| name_en | text | | |
| description_ar | text | | |
| description_en | text | | |
| is_active | boolean | DEFAULT true | |
| sort_order | integer | DEFAULT 0 | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |
| deleted_at | timestamptz | | |

**Indexes:** `(church_id)`, `(church_id, is_active)`

### stages

Ministry subdivisions (age groups, service units).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| ministry_id | uuid | FK → ministries, NOT NULL | |
| name_ar | text | NOT NULL | |
| name_en | text | | |
| description_ar | text | | |
| description_en | text | | |
| age_min | integer | | Minimum age |
| age_max | integer | | Maximum age |
| is_active | boolean | DEFAULT true | |
| sort_order | integer | DEFAULT 0 | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |
| deleted_at | timestamptz | | |

**Indexes:** `(church_id)`, `(church_id, ministry_id)`, `(church_id, is_active)`

---

## Users & Authorization

### profiles

Extends Supabase `auth.users`. One profile per auth user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, FK → auth.users | Same as auth.users.id |
| church_id | uuid | FK → churches, NOT NULL | |
| email | text | | Denormalized from auth |
| phone | text | | |
| full_name_ar | text | NOT NULL | |
| full_name_en | text | | |
| avatar_url | text | | |
| preferred_locale | text | DEFAULT 'ar' | `ar` or `en` |
| is_active | boolean | DEFAULT true | |
| last_login_at | timestamptz | | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |
| deleted_at | timestamptz | | |

**Indexes:** `(church_id)`, `(church_id, email)`, `(church_id, phone)`, `(church_id, is_active)`

### roles

Church-scoped role definitions. System roles seeded per church on creation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| role_type | user_role_type | NOT NULL | |
| name_ar | text | NOT NULL | |
| name_en | text | | |
| description_ar | text | | |
| is_system | boolean | DEFAULT false | Cannot be deleted |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Unique:** `(church_id, role_type)`

### role_permissions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| role_id | uuid | FK → roles, NOT NULL | |
| permission_id | uuid | FK → permissions, NOT NULL | |
| created_at | timestamptz | NOT NULL | |

**Unique:** `(role_id, permission_id)`

### user_roles

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| user_id | uuid | FK → profiles, NOT NULL | |
| role_id | uuid | FK → roles, NOT NULL | |
| assigned_by | uuid | FK → profiles | |
| created_at | timestamptz | NOT NULL | |

**Unique:** `(church_id, user_id, role_id)`

**Indexes:** `(church_id, user_id)`, `(user_id)`

### user_stage_assignments

Scopes Stage Leader and Servant access to specific stages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| user_id | uuid | FK → profiles, NOT NULL | |
| stage_id | uuid | FK → stages, NOT NULL | |
| assigned_by | uuid | FK → profiles | |
| created_at | timestamptz | NOT NULL | |

**Unique:** `(church_id, user_id, stage_id)`

**Indexes:** `(church_id, user_id)`, `(church_id, stage_id)`

---

## Children

### children

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| ministry_id | uuid | FK → ministries, NOT NULL | |
| stage_id | uuid | FK → stages, NOT NULL | |
| pipeline_stage | pipeline_stage_type | DEFAULT 'new_visitor' | CRM pipeline position |
| **Personal** | | | |
| first_name_ar | text | NOT NULL | |
| last_name_ar | text | NOT NULL | |
| first_name_en | text | | |
| last_name_en | text | | |
| date_of_birth | date | | |
| gender | gender_type | | |
| photo_url | text | | |
| **Parent** | | | |
| father_name_ar | text | | |
| mother_name_ar | text | | |
| parent_phone | text | | |
| parent_email | text | | |
| parent_address_ar | text | | |
| **Contact** | | | |
| mobile | text | | Child's own mobile |
| emergency_contact_name | text | | |
| emergency_contact_phone | text | | |
| **Spiritual** | | | |
| baptism_date | date | | |
| confession_frequency | text | | |
| spiritual_notes | text | | |
| **Medical** | | | |
| medical_conditions | text | | |
| allergies | text | | |
| medications | text | | |
| **Educational** | | | |
| school_name_ar | text | | |
| grade_level | text | | |
| **Meta** | | | |
| status | child_status | DEFAULT 'active' | |
| enrolled_at | date | DEFAULT CURRENT_DATE | |
| notes | text | | General notes |
| created_by | uuid | FK → profiles | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |
| deleted_at | timestamptz | | |

**Indexes:** `(church_id)`, `(church_id, stage_id)`, `(church_id, ministry_id)`, `(church_id, status)`, `(church_id, last_name_ar, first_name_ar)`, `(church_id, mobile)`, `(church_id, parent_phone)`, `(church_id, pipeline_stage)`

---

## Attendance (Phase 1)

### attendance

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| child_id | uuid | FK → children, NOT NULL | |
| stage_id | uuid | FK → stages, NOT NULL | Denormalized for queries |
| attendance_date | date | NOT NULL | |
| status | attendance_status | NOT NULL | |
| notes | text | | |
| recorded_by | uuid | FK → profiles, NOT NULL | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Unique:** `(church_id, child_id, attendance_date)`

**Indexes:** `(church_id, attendance_date)`, `(church_id, stage_id, attendance_date)`, `(child_id, attendance_date DESC)`

---

## Follow-Ups (Phase 2 — schema defined)

### followups

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| child_id | uuid | FK → children, NOT NULL | |
| stage_id | uuid | FK → stages, NOT NULL | |
| type | followup_type | NOT NULL | |
| status | followup_status | DEFAULT 'scheduled' | |
| scheduled_at | timestamptz | | |
| completed_at | timestamptz | | |
| assigned_to | uuid | FK → profiles | |
| notes | text | | |
| outcome | text | | |
| created_by | uuid | FK → profiles, NOT NULL | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Indexes:** `(church_id, child_id)`, `(church_id, assigned_to, status)`, `(church_id, scheduled_at)`

---

## Spiritual Records

### spiritual_records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| child_id | uuid | FK → children, NOT NULL | |
| record_type | spiritual_record_type | NOT NULL | |
| record_date | date | NOT NULL | |
| notes | text | | |
| recorded_by | uuid | FK → profiles, NOT NULL | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Indexes:** `(church_id, child_id)`, `(child_id, record_date DESC)`

---

## Events (Phase 2 — schema defined)

### events

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| ministry_id | uuid | FK → ministries | |
| stage_id | uuid | FK → stages | Optional scope |
| title_ar | text | NOT NULL | |
| title_en | text | | |
| description_ar | text | | |
| description_en | text | | |
| event_type | event_type | NOT NULL | |
| location_ar | text | | |
| start_at | timestamptz | NOT NULL | |
| end_at | timestamptz | | |
| capacity | integer | | |
| is_active | boolean | DEFAULT true | |
| created_by | uuid | FK → profiles, NOT NULL | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |
| deleted_at | timestamptz | | |

**Indexes:** `(church_id, start_at)`, `(church_id, event_type)`

### event_registrations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| event_id | uuid | FK → events, NOT NULL | |
| child_id | uuid | FK → children, NOT NULL | |
| status | event_registration_status | DEFAULT 'registered' | |
| registered_by | uuid | FK → profiles | |
| registered_at | timestamptz | DEFAULT now() | |
| notes | text | | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Unique:** `(event_id, child_id)`

**Indexes:** `(church_id, event_id)`, `(child_id)`

---

## Notifications (Phase 2 — schema defined)

### notifications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| user_id | uuid | FK → profiles, NOT NULL | |
| type | notification_type | NOT NULL | |
| channel | notification_channel | NOT NULL | |
| title_ar | text | NOT NULL | |
| title_en | text | | |
| body_ar | text | NOT NULL | |
| body_en | text | | |
| metadata | jsonb | DEFAULT '{}' | Related entity refs |
| read_at | timestamptz | | NULL = unread |
| sent_at | timestamptz | | |
| created_at | timestamptz | NOT NULL | |

**Indexes:** `(church_id, user_id, read_at)`, `(user_id, created_at DESC)`

---

## Audit Logs

### audit_logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches | NULL for platform-level |
| user_id | uuid | FK → profiles | |
| action | audit_action | NOT NULL | |
| entity_type | text | NOT NULL | Table name |
| entity_id | uuid | | |
| old_values | jsonb | | |
| new_values | jsonb | | |
| ip_address | inet | | |
| user_agent | text | | |
| created_at | timestamptz | NOT NULL | |

**Indexes:** `(church_id, created_at DESC)`, `(church_id, entity_type, entity_id)`, `(user_id, created_at DESC)`

---

## Documents

### documents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| entity_type | document_entity_type | NOT NULL | |
| entity_id | uuid | NOT NULL | Polymorphic FK |
| file_name | text | NOT NULL | Original filename |
| file_path | text | NOT NULL | Storage path |
| mime_type | text | NOT NULL | |
| file_size | bigint | NOT NULL | Bytes |
| uploaded_by | uuid | FK → profiles, NOT NULL | |
| created_at | timestamptz | NOT NULL | |
| deleted_at | timestamptz | | |

**Indexes:** `(church_id, entity_type, entity_id)`, `(church_id, uploaded_by)`

---

## AI (Phase 3 — schema defined)

### ai_conversations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| user_id | uuid | FK → profiles, NOT NULL | |
| title | text | | Auto-generated |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Indexes:** `(church_id, user_id, updated_at DESC)`

### ai_messages

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| conversation_id | uuid | FK → ai_conversations, NOT NULL | |
| church_id | uuid | FK → churches, NOT NULL | |
| role | ai_message_role | NOT NULL | |
| content | text | NOT NULL | |
| citations | jsonb | DEFAULT '[]' | Source references |
| tool_calls | jsonb | DEFAULT '[]' | OpenAI tool call data |
| tokens_used | integer | | |
| created_at | timestamptz | NOT NULL | |

**Indexes:** `(conversation_id, created_at)`

### document_embeddings (Phase 3 — RAG)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| church_id | uuid | FK → churches, NOT NULL | |
| document_id | uuid | FK → documents | |
| entity_type | text | NOT NULL | |
| entity_id | uuid | NOT NULL | |
| chunk_index | integer | NOT NULL | |
| content | text | NOT NULL | |
| embedding | vector(1536) | NOT NULL | OpenAI ada-002 |
| metadata | jsonb | DEFAULT '{}' | |
| created_at | timestamptz | NOT NULL | |

**Indexes:** `(church_id, entity_type, entity_id)`, IVFFlat on `embedding`

---

## Database Functions

| Function | Purpose |
|----------|---------|
| `handle_updated_at()` | Trigger: set `updated_at = now()` |
| `handle_new_user()` | Trigger: create profile on auth signup |
| `get_user_church_id()` | RLS helper: returns current user's church_id |
| `get_user_role_type()` | RLS helper: returns highest role for current user |
| `user_has_permission(code)` | RLS helper: checks permission by code |
| `user_has_stage_access(stage_id)` | RLS helper: checks stage assignment |
| `seed_church_roles(church_id)` | Seeds default roles + permissions for new church |
| `write_audit_log(...)` | Inserts audit log entry |

---

## Seed Data

On migration, seed the global `permissions` catalog covering all modules:

- `auth.*`, `users.*`, `stages.*`, `children.*`, `attendance.*`
- `followups.*`, `events.*`, `notifications.*`, `reports.*`
- `ai.*`, `documents.*`, `settings.*`

Each permission follows `{module}.{action}` pattern where action is one of: `read`, `create`, `update`, `delete`, `export`, `manage`.
