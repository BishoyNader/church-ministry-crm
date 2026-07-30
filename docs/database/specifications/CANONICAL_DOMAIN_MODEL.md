# Canonical Domain Model

**Date:** 2026-07-30  
**Status:** Final — single source of truth  
**Supersedes:** All prior DATABASE_REQUIREMENTS.md, RBAC_ARCHITECTURE.md entity definitions  

---

## Entity: Church

| Attribute | Value |
|-----------|-------|
| **Purpose** | Root tenant entity. Isolates all data for one church organization. All other entities are transitively owned by a church. |
| **Owner** | Platform Owner (system-level). Church members read/update their own church row. |
| **Relationships** | Parent of: services, profiles, roles, beneficiaries, servants, attendance sessions, follow-ups, notifications, audit_logs |
| **Lifecycle** | Created during church registration. Soft-deleted (30-day grace period). Hard-deleted by cron after grace. |
| **Soft delete** | `deleted_at` set. All tenant data cascade-soft-deleted. |
| **Visibility** | Church members see only their own church row. Platform Owner sees all church rows (aggregate views). |

---

## Entity: Service

| Attribute | Value |
|-----------|-------|
| **Purpose** | A major ministry area within a church (e.g., "Youth Service", "Children's Service"). Renamed from "ministry" per PRD V3. |
| **Owner** | Church → Super Admin creates/manages. Admin can see assigned services. |
| **Relationships** | Belongs to Church. Parent of Stages. Referenced by: stages, servant_stage_assignments, beneficiary_assignments, attendance_sessions, events |
| **Lifecycle** | Created by super_admin. Soft-deleted (blocked if active stages exist). |
| **Soft delete** | `deleted_at` set. Cascade blocked if active stages exist under it. |
| **Visibility** | All church members see the service list. Admin sees full detail for assigned services. |

---

## Entity: Stage

| Attribute | Value |
|-----------|-------|
| **Purpose** | An age/level group within a service (e.g., "Intermediate Stage", "Advanced Stage"). |
| **Owner** | Church → Service. Super Admin or Admin creates within their service. |
| **Relationships** | Belongs to Service. Parent of Classes. Referenced by: classes, servant_stage_assignments, beneficiary_assignments, attendance_sessions |
| **Lifecycle** | Created by super_admin or admin. Soft-deleted (blocked if active beneficiaries assigned). |
| **Soft delete** | `deleted_at` set. Beneficiaries must be reassigned before stage can be deleted. |
| **Visibility** | All church members see stages in their service. Servants see only assigned stages. |

---

## Entity: Class

| Attribute | Value |
|-----------|-------|
| **Purpose** | Optional subdivision of a stage (e.g., "First Year", "Second Year"). Churches that don't use classes leave this out entirely. |
| **Owner** | Church → Service → Stage. |
| **Relationships** | Belongs to Stage. Referenced by: servant_stage_assignments, beneficiary_assignments, attendance_sessions |
| **Lifecycle** | Created by super_admin or admin. Soft-deleted (beneficiaries reassigned to stage before delete). |
| **Soft delete** | `deleted_at` set. Beneficiaries reassigned to parent stage before deletion. |
| **Visibility** | Users see only classes they are assigned to (via servant_stage_assignments.class_id). Super Admin/Admin see all classes in their scope. |

---

## Entity: User (Profile)

| Attribute | Value |
|-----------|-------|
| **Purpose** | A person who can log into the system. One-to-one with `auth.users`. Every church member is a profile, but not every profile is a servant (e.g., platform owner has a profile outside any church). |
| **Owner** | Self. Super Admin can view all profiles in church. Admin can view profiles of servants in assigned services. |
| **Relationships** | One-to-one with auth.users(id). One-to-zero-or-one with servants. Belongs to Church (platform owner has NULL church_id). |
| **Lifecycle** | Created during signup or by super_admin/admin. Soft-deleted (user cannot log in). |
| **Soft delete** | `deleted_at` set. Cannot log in. Servant journal anonymized on hard delete. |
| **Visibility** | Self: full. Super Admin: all profiles in church. Admin: profiles of servants in assigned services. Servant: own profile only. |

---

## Entity: Servant

| Attribute | Value |
|-----------|-------|
| **Purpose** | A church member with an active service role. One-to-one extension of Profile. Represents someone who serves in ministry. |
| **Owner** | Church. Approved by Super Admin. |
| **Relationships** | One-to-one with profiles(id). Parent of servant_stage_assignments and spiritual_journal_entries. Referenced by: beneficiary_assignments, followups, attendance_records |
| **Lifecycle** | Created when a profile is granted a church role and approved. Approval status: pending → approved/rejected. Assignments tracked historically. |
| **Soft delete** | `deleted_at` set. Active assignments ended (end_date set). Beneficiaries reassigned. |
| **Visibility** | Super Admin: all servants. Admin: servants in assigned services. Servant: own profile only. |

---

## Entity: ServantStageAssignment

| Attribute | Value |
|-----------|-------|
| **Purpose** | Links a servant to a service/stage/class with a specific role and time period. Enables temporal tracking (annual reassignments). |
| **Owner** | Church. Created by super_admin or admin. |
| **Relationships** | Belongs to Servant. References Service (required), Stage (optional), Class (optional). |
| **Lifecycle** | Created at assignment. End date set on reassignment or departure. Historical rows preserved forever. |
| **Soft delete** | Not soft-deleted. End date = historical. |
| **Visibility** | Servant: own assignments. Super Admin: all. Admin: assignments within assigned services. |
| **Assignment Roles** | `service_admin`, `stage_leader`, `class_leader`, `servant` |

---

## Entity: Beneficiary

| Attribute | Value |
|-----------|-------|
| **Purpose** | A person receiving ministry services (typically a child/student). Always assigned to exactly one active class (or stage directly) via beneficiary_assignments. |
| **Owner** | Church. Created by super_admin or admin. |
| **Relationships** | Belongs to Church. Parent of beneficiary_assignments (N). Referenced by: attendance_records (N), followups (N) |
| **Lifecycle** | Created by super_admin or admin (or bulk import). Transferred between stages/classes with immutable history. Soft-deleted (90-day grace). |
| **Soft delete** | `deleted_at` set. Attendance and follow-up records kept (anonymized). |
| **Visibility** | Super Admin: all in church. Admin: all in assigned services. Stage Leader: all in assigned stages. Class Leader: all in assigned classes. Servant: individually assigned only. |

---

## Entity: BeneficiaryAssignment

| Attribute | Value |
|-----------|-------|
| **Purpose** | Immutable record of a beneficiary's placement in a service/stage/class under a specific servant. Only one "current" assignment per beneficiary. |
| **Owner** | Church. Created by super_admin or admin. |
| **Relationships** | Belongs to Beneficiary. References: Service, Stage, Class (nullable), Servant, AssignedBy (profile). |
| **Lifecycle** | Created on assignment. On transfer: old row marked `is_current = false`, new row created. Never updated or deleted. |
| **Soft delete** | Not applicable. Rows are immutable. |
| **Visibility** | Same as Beneficiary visibility (access is determined through the assignment). |
| **Transfer trigger** | Only Super Admin or Admin can create new assignments (transfers). Servant cannot self-assign. |

---

## Entity: AttendanceSession

| Attribute | Value |
|-----------|-------|
| **Purpose** | A single session/meeting where attendance was taken. One session per stage per day. |
| **Owner** | Church → Stage. Servant with stage access creates sessions. |
| **Relationships** | Belongs to Stage. References Service, Stage, Class (nullable). Parent of AttendanceRecords. |
| **Lifecycle** | Created when a servant starts recording attendance for a day. Only one session per stage per day (UNIQUE constraint). |
| **Soft delete** | Not applicable. Sessions are immutable once records are created (Phase 2: allow correction by super_admin). |
| **Visibility** | Super Admin: all. Admin: sessions in assigned services. Servant: sessions in assigned stages/classes. |
| **Unique constraint** | `(stage_id, session_date)` — prevents duplicate session for same stage on same day. |

---

## Entity: AttendanceRecord

| Attribute | Value |
|-----------|-------|
| **Purpose** | A single attendance mark (present/absent/excused) for one beneficiary or one servant in a session. |
| **Owner** | Church. Created by any servant with stage/class access. |
| **Relationships** | Belongs to AttendanceSession. References Beneficiary (nullable) or Servant (nullable). Exactly one of the two must be set. |
| **Lifecycle** | Created during session recording. Never modified (correction = new session with corrected data, or Phase 2: super_admin can override). |
| **Soft delete** | Not applicable. |
| **Visibility** | Super Admin: all. Admin: records in assigned services. Servant: records they created + records for their beneficiaries. |
| **Constraint** | Exactly one of `beneficiary_id` or `servant_id` must be non-NULL. |

---

## Entity: FollowUp

| Attribute | Value |
|-----------|-------|
| **Purpose** | A pastoral follow-up record for a beneficiary. Tracks type, status, outcome, next action. |
| **Owner** | Church → Servant (creator). Transferable to another servant via `assigned_to`. |
| **Relationships** | Belongs to Beneficiary. References: Beneficiary, Servant (creator/assignee), optional AssignedTo (servant). |
| **Lifecycle** | Created by any servant with beneficiary access. Status: open → in_progress → completed/cancelled. Soft-deleted. |
| **Soft delete** | `deleted_at` set. |
| **Visibility** | Super Admin: all follow-ups in church. Admin: follow-ups for beneficiaries in assigned services. Servant: own follow-ups. |

---

## Entity: SpiritualJournalEntry

| Attribute | Value |
|-----------|-------|
| **Purpose** | A private daily journal entry recording a servant's spiritual practices (prayer times, bible reading, confession, communion). |
| **Owner** | Servant (owner) + Super Admin (read-only). Admin has NO access. Platform Owner has NO access. |
| **Relationships** | Belongs to Servant. |
| **Lifecycle** | Created by servant daily (one entry per day per servant via UNIQUE constraint). Updated by servant. |
| **Soft delete** | Not applicable. Entries are immutable after 7 days (Phase 2). |
| **Visibility** | Servant: own entries only (full CRUD). Super Admin: all entries in church (read-only, audit-logged). Admin: NEVER. Platform Owner: NEVER. |
| **Privacy invariant** | NO export. NO admin access. Every Super Admin read is audit-logged. Church config can further restrict Super Admin. |

---

## Entity: Notification

| Attribute | Value |
|-----------|-------|
| **Purpose** | A notification sent to a user about an event (absence, follow-up due, approval required, etc.). |
| **Owner** | System (created by notification service). Recipient can mark as read. |
| **Relationships** | Belongs to Church. References Profile (recipient). |
| **Lifecycle** | Created by notification service (triggered by events). Auto-deleted after 90 days (cron). |
| **Soft delete** | Not applicable. Hard-deleted by cron after 90 days. |
| **Visibility** | Recipient: own notifications only. Super Admin: all notifications in church. Admin: notifications for users in assigned services. |

---

## Entity: AuditLog

| Attribute | Value |
|-----------|-------|
| **Purpose** | Immutable record of all mutations (create, update, delete, access) for compliance and debugging. |
| **Owner** | Church. Inserted by application code (MVP) or DB triggers (Phase 2). |
| **Relationships** | Belongs to Church. References Profile (actor). |
| **Lifecycle** | Appended only. Never updated or deleted (trigger-enforced in Phase 2, app-enforced in MVP). |
| **Soft delete** | Not applicable. Immutable by design. |
| **Visibility** | Super Admin: all logs in church. Platform Owner: all logs system-wide (aggregate). Admin: NO access. User: NO access. |
| **Immutability** | INSERT-only. No UPDATE or DELETE allowed. |

---

## Entity: Role

| Attribute | Value |
|-----------|-------|
| **Purpose** | A named set of permissions assigned to users within a church. Seeded per church on creation. |
| **Owner** | Church. System roles (super_admin, admin, servant) seeded automatically. Custom roles possible (Phase 2). |
| **Relationships** | Belongs to Church. Parent of role_permissions. Referenced by user_roles. |
| **Lifecycle** | Seeded on church creation. System roles cannot be deleted. Custom roles can be created, modified, soft-deleted (Phase 2). |
| **Soft delete** | System roles: `is_system = true`, cannot be deleted. Custom roles: soft-deletable (Phase 2). |
| **Visibility** | All authenticated users can see role definitions within their church. |
| **System roles** | `platform_owner` (system-level, no church_id), `super_admin`, `admin`, `servant` |

---

## Entity: Permission

| Attribute | Value |
|-----------|-------|
| **Purpose** | An atomic permission code (e.g., `beneficiaries.create`). Assigned to roles via role_permissions. |
| **Owner** | System. Seeded once, shared across all churches. |
| **Relationships** | Referenced by role_permissions. |
| **Lifecycle** | Seeded during database setup. New permissions added via migration. Deprecated permissions removed with data migration. |
| **Soft delete** | Not applicable. Permissions are code constants. |
| **Visibility** | All authenticated users can see available permission codes. |

---

## Entity: RolePermission

| Attribute | Value |
|-----------|-------|
| **Purpose** | Junction table linking roles to permissions. Defines which permissions each role grants. |
| **Owner** | Church (through role). |
| **Relationships** | References Role and Permission. |
| **Lifecycle** | Seeded on church creation. Updated when role-permission mapping changes (Phase 2: super_admin can customize). |
| **Unique constraint** | `(role_id, permission_id)` — no duplicate mappings. |

---

## Entity: UserRole

| Attribute | Value |
|-----------|-------|
| **Purpose** | Assigns a role to a user within a church. Temporal — supports end_date for role changes. |
| **Owner** | Church. Super Admin assigns roles. |
| **Relationships** | References Profile (user), Role, Profile (assigned_by). Belongs to Church. |
| **Lifecycle** | Created on role assignment. End date set on role change. Historical rows preserved. |
| **Soft delete** | Not applicable. Temporal — history is preserved. |

---

## Entity Relationship Diagram (Text)

```
churches
  ├── services (church_id FK)
  │     └── stages (service_id FK, church_id FK)
  │           └── classes (stage_id FK, church_id FK)
  ├── profiles (church_id FK)
  │     └── servants (id FK → profiles.id, church_id FK)
  │           ├── servant_stage_assignments (servant_id FK, service_id FK, stage_id FK nullable, class_id FK nullable)
  │           └── spiritual_journal_entries (servant_id FK, church_id FK)
  ├── beneficiaries (church_id FK)
  │     ├── beneficiary_assignments (beneficiary_id FK, service_id FK, stage_id FK, class_id FK nullable, servant_id FK)
  │     ├── attendance_records (beneficiary_id FK nullable)
  │     └── followups (beneficiary_id FK, servant_id FK, assigned_to FK nullable)
  ├── attendance_sessions (church_id FK, service_id FK, stage_id FK, class_id FK nullable)
  │     └── attendance_records (session_id FK, servant_id FK nullable)
  ├── followups (church_id FK)
  ├── notifications (church_id FK, recipient_id FK → profiles.id)
  ├── audit_logs (church_id FK, actor_id FK → profiles.id nullable)
  ├── roles (church_id FK)
  │     ├── role_permissions (role_id FK, permission_id FK)
  │     └── user_roles (role_id FK, user_id FK → profiles.id)
  ├── events (church_id FK)
  │     └── event_registrations (event_id FK, beneficiary_id FK)
  ├── documents (church_id FK)
  └── subscription_plans (global, Phase 2)
```
