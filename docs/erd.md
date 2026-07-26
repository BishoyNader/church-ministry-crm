# Church Ministry CRM — Entity Relationship Diagram

## Full ERD

```mermaid
erDiagram
    churches ||--o{ ministries : "has"
    churches ||--o{ stages : "has"
    churches ||--o{ profiles : "has"
    churches ||--o{ roles : "has"
    churches ||--o{ children : "has"
    churches ||--o{ attendance : "has"
    churches ||--o{ followups : "has"
    churches ||--o{ spiritual_records : "has"
    churches ||--o{ events : "has"
    churches ||--o{ notifications : "has"
    churches ||--o{ audit_logs : "has"
    churches ||--o{ documents : "has"
    churches ||--o{ ai_conversations : "has"

    ministries ||--o{ stages : "contains"
    ministries ||--o{ children : "groups"
    ministries ||--o{ events : "hosts"

    stages ||--o{ children : "assigned"
    stages ||--o{ attendance : "records"
    stages ||--o{ followups : "tracks"
    stages ||--o{ user_stage_assignments : "scoped"

    auth_users ||--|| profiles : "extends"
    profiles ||--o{ user_roles : "assigned"
    profiles ||--o{ user_stage_assignments : "works_in"
    profiles ||--o{ attendance : "recorded_by"
    profiles ||--o{ followups : "assigned_to"
    profiles ||--o{ spiritual_records : "recorded_by"
    profiles ||--o{ events : "created_by"
    profiles ||--o{ documents : "uploaded_by"
    profiles ||--o{ ai_conversations : "owns"
    profiles ||--o{ notifications : "receives"
    profiles ||--o{ audit_logs : "performed_by"

    roles ||--o{ role_permissions : "grants"
    roles ||--o{ user_roles : "assigned_to"
    permissions ||--o{ role_permissions : "included_in"

    children ||--o{ attendance : "has"
    children ||--o{ followups : "has"
    children ||--o{ spiritual_records : "has"
    children ||--o{ event_registrations : "registers"
    children ||--o{ documents : "attached"

    events ||--o{ event_registrations : "has"

    ai_conversations ||--o{ ai_messages : "contains"
    documents ||--o{ document_embeddings : "chunked"

    churches {
        uuid id PK
        text name_ar
        text name_en
        text slug UK
        text logo_url
        jsonb settings
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    ministries {
        uuid id PK
        uuid church_id FK
        text name_ar
        text name_en
        boolean is_active
        int sort_order
    }

    stages {
        uuid id PK
        uuid church_id FK
        uuid ministry_id FK
        text name_ar
        text name_en
        int age_min
        int age_max
        boolean is_active
        int sort_order
    }

    profiles {
        uuid id PK
        uuid church_id FK
        text email
        text phone
        text full_name_ar
        text full_name_en
        text preferred_locale
        boolean is_active
        timestamptz last_login_at
    }

    roles {
        uuid id PK
        uuid church_id FK
        user_role_type role_type
        text name_ar
        boolean is_system
    }

    permissions {
        uuid id PK
        text code UK
        text name_ar
        text module
    }

    role_permissions {
        uuid id PK
        uuid role_id FK
        uuid permission_id FK
    }

    user_roles {
        uuid id PK
        uuid church_id FK
        uuid user_id FK
        uuid role_id FK
        uuid assigned_by FK
    }

    user_stage_assignments {
        uuid id PK
        uuid church_id FK
        uuid user_id FK
        uuid stage_id FK
        uuid assigned_by FK
    }

    children {
        uuid id PK
        uuid church_id FK
        uuid ministry_id FK
        uuid stage_id FK
        pipeline_stage_type pipeline_stage
        text first_name_ar
        text last_name_ar
        date date_of_birth
        gender_type gender
        text parent_phone
        text mobile
        child_status status
        date enrolled_at
    }

    attendance {
        uuid id PK
        uuid church_id FK
        uuid child_id FK
        uuid stage_id FK
        date attendance_date
        attendance_status status
        uuid recorded_by FK
    }

    followups {
        uuid id PK
        uuid church_id FK
        uuid child_id FK
        uuid stage_id FK
        followup_type type
        followup_status status
        timestamptz scheduled_at
        uuid assigned_to FK
    }

    spiritual_records {
        uuid id PK
        uuid church_id FK
        uuid child_id FK
        spiritual_record_type record_type
        date record_date
        uuid recorded_by FK
    }

    events {
        uuid id PK
        uuid church_id FK
        uuid ministry_id FK
        uuid stage_id FK
        text title_ar
        event_type event_type
        timestamptz start_at
        timestamptz end_at
        int capacity
    }

    event_registrations {
        uuid id PK
        uuid church_id FK
        uuid event_id FK
        uuid child_id FK
        event_registration_status status
    }

    notifications {
        uuid id PK
        uuid church_id FK
        uuid user_id FK
        notification_type type
        notification_channel channel
        text title_ar
        text body_ar
        timestamptz read_at
    }

    audit_logs {
        uuid id PK
        uuid church_id FK
        uuid user_id FK
        audit_action action
        text entity_type
        uuid entity_id
        jsonb old_values
        jsonb new_values
    }

    documents {
        uuid id PK
        uuid church_id FK
        document_entity_type entity_type
        uuid entity_id
        text file_name
        text file_path
        text mime_type
        bigint file_size
        uuid uploaded_by FK
    }

    ai_conversations {
        uuid id PK
        uuid church_id FK
        uuid user_id FK
        text title
    }

    ai_messages {
        uuid id PK
        uuid conversation_id FK
        uuid church_id FK
        ai_message_role role
        text content
        jsonb citations
        jsonb tool_calls
    }

    document_embeddings {
        uuid id PK
        uuid church_id FK
        uuid document_id FK
        text entity_type
        uuid entity_id
        int chunk_index
        text content
        vector embedding
    }
```

---

## Phase 1 ERD (Active Entities)

Phase 1 implements the highlighted subset:

```mermaid
erDiagram
    churches ||--o{ ministries : "has"
    churches ||--o{ stages : "has"
    churches ||--o{ profiles : "has"
    churches ||--o{ roles : "has"
    churches ||--o{ children : "has"
    churches ||--o{ attendance : "has"
    churches ||--o{ audit_logs : "has"

    ministries ||--o{ stages : "contains"
    ministries ||--o{ children : "groups"

    stages ||--o{ children : "assigned"
    stages ||--o{ attendance : "records"
    stages ||--o{ user_stage_assignments : "scoped"

    profiles ||--o{ user_roles : "assigned"
    profiles ||--o{ user_stage_assignments : "works_in"
    profiles ||--o{ attendance : "recorded_by"

    roles ||--o{ role_permissions : "grants"
    roles ||--o{ user_roles : "assigned_to"
    permissions ||--o{ role_permissions : "included_in"

    children ||--o{ attendance : "has"

    churches {
        uuid id PK
        text name_ar
        text slug UK
    }

    ministries {
        uuid id PK
        uuid church_id FK
        text name_ar
    }

    stages {
        uuid id PK
        uuid church_id FK
        uuid ministry_id FK
        text name_ar
    }

    profiles {
        uuid id PK
        uuid church_id FK
        text full_name_ar
        text email
        text phone
    }

    roles {
        uuid id PK
        uuid church_id FK
        user_role_type role_type
    }

    permissions {
        uuid id PK
        text code UK
    }

    user_roles {
        uuid church_id FK
        uuid user_id FK
        uuid role_id FK
    }

    user_stage_assignments {
        uuid church_id FK
        uuid user_id FK
        uuid stage_id FK
    }

    children {
        uuid id PK
        uuid church_id FK
        uuid stage_id FK
        text first_name_ar
        text last_name_ar
        child_status status
    }

    attendance {
        uuid id PK
        uuid church_id FK
        uuid child_id FK
        date attendance_date
        attendance_status status
    }

    audit_logs {
        uuid id PK
        uuid church_id FK
        audit_action action
        text entity_type
    }
```

---

## Relationship Summary

| From | To | Cardinality | Description |
|------|----|-------------|-------------|
| churches | ministries | 1:N | Church owns ministries |
| ministries | stages | 1:N | Ministry contains stages |
| churches | profiles | 1:N | Church has users |
| profiles | user_roles | 1:N | User can have multiple roles |
| roles | role_permissions | 1:N | Role grants permissions |
| profiles | user_stage_assignments | 1:N | User assigned to stages |
| stages | children | 1:N | Stage contains children |
| children | attendance | 1:N | Child has attendance records |
| children | followups | 1:N | Child has follow-up history |
| events | event_registrations | 1:N | Event has registrations |
| ai_conversations | ai_messages | 1:N | Conversation has messages |

---

## Key Constraints

1. **Tenant isolation**: All FK paths include `church_id` matching
2. **Unique attendance**: One record per child per date per church
3. **Unique event registration**: One registration per child per event
4. **Unique user role**: One assignment per user-role-church combination
5. **Unique stage assignment**: One assignment per user-stage-church combination
6. **Soft delete**: `deleted_at` on churches, ministries, stages, children, events, documents

---

## Index Strategy

```
Search by name:     (church_id, last_name_ar, first_name_ar)
Search by mobile:   (church_id, mobile), (church_id, parent_phone)
Stage lookups:      (church_id, stage_id), (church_id, ministry_id)
Attendance by date: (church_id, attendance_date), (church_id, stage_id, attendance_date)
Audit history:      (church_id, created_at DESC)
User lookups:       (church_id, email), (church_id, phone)
```
