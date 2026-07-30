# Canonical Role Model

**Date:** 2026-07-30  
**Status:** Final — single source of truth  
**Supersedes:** RBAC_ARCHITECTURE.md role definitions, CLASS_ACCESS_ARCHITECTURE.md role definitions  

---

## Role Hierarchy

```
PLATFORM OWNER  (system-wide, separate hierarchy)
     │
     │  (no inheritance from/to church roles)
     │
     ▼
SUPER ADMIN  (church-wide)
     │
     │  inherits: ALL permissions within church
     │
     ▼
ADMIN  (service-scoped)
     │
     │  inherits: all SERVANT permissions + admin-scoped permissions
     │
     ▼
SERVANT  (stage/class/beneficiary-scoped)
     │
     │  inherits: base permissions (own data, assigned beneficiaries)
     │
     ▼
PENDING USER  (no role — pre-approval)
```

---

## Role: Platform Owner

| Attribute | Value |
|-----------|-------|
| **System name** | `platform_owner` |
| **Business title** | Platform Owner, System Administrator |
| **Scope** | All tenants (system-wide) |
| **Church ID** | NULL (no church affiliation) |
| **Has servant record** | No |
| **Has profile** | Yes, with `church_id = NULL` |

### Responsibilities
- Create, suspend, and delete tenant churches
- Monitor system health and usage metrics
- View subscription and billing data
- View audit logs (all tenants, aggregate)
- Manage support tickets
- No direct PII access (no beneficiary/servant names)

### Permissions
- `tenants.create`, `tenants.read`, `tenants.update`, `tenants.delete`
- `subscriptions.manage`, `billing.read`
- `system.metrics`, `system.audit`
- `support.manage`

### Visibility
- Churches: all rows (full)
- Audit logs: all rows (aggregate)
- Beneficiaries: aggregate counts only (no PII)
- Servants: aggregate counts only (no PII)
- Spiritual journals: NEVER
- Attendance: aggregate rates only

### Escalation Path
- No escalation above platform_owner (highest authority)
- Escalation from church level: super_admin cannot access platform owner tools
- Support escalation: church super_admin → platform owner ticket

### Promotion Path
- N/A — platform owner is a system role, not a church role
- Assigned by system provisioning only

### Demotion Path
- No demotion path within the system
- Account deactivation by system administrator

---

## Role: Super Admin

| Attribute | Value |
|-----------|-------|
| **System name** | `super_admin` |
| **Business title** | Priest, Senior Pastor, Church President |
| **Scope** | Full church (L1) |
| **Church ID** | Set from profile |
| **Has servant record** | Yes (for audit/logging purposes, though they typically don't serve in a specific class) |
| **Inherits from** | N/A (highest church role) |
| **Inherited by** | Admin, Servant, Pending User |

### Responsibilities
- Full oversight of all ministry activity in the church
- Manage services, stages, classes
- Approve/reject servant registrations
- Manage role assignments and permissions
- View all data including spiritual journals
- Configure church settings
- Run annual servant reassignment

### Permissions
All permissions in the catalog, including:
- `servants.create`, `servants.read`, `servants.update`, `servants.delete`, `servants.approve`, `servants.assign`
- `beneficiaries.create`, `beneficiaries.read`, `beneficiaries.update`, `beneficiaries.delete`, `beneficiaries.transfer`
- `services.create`, `services.read`, `services.update`, `services.delete`
- `stages.create`, `stages.read`, `stages.update`, `stages.delete`
- `classes.create`, `classes.read`, `classes.update`, `classes.delete`
- `attendance.create`, `attendance.read`, `attendance.export`
- `followups.create`, `followups.read`, `followups.update`, `followups.delete`
- `spiritual.read` (all servants, audit-logged)
- `notifications.read`, `notifications.manage`
- `reports.read`, `reports.export`
- `import.execute`, `export.execute`
- `roles.manage`, `settings.read`, `settings.update`, `audit.read`

### Visibility
| Entity | Scope |
|--------|-------|
| Beneficiaries | All in church |
| Servants | All in church (full profiles) |
| Attendance | All records |
| Spiritual journals | All entries (read-only, audit-logged) |
| Follow-ups | All |
| Notifications | All |
| Audit logs | All |
| Reports | Church-wide |

### Escalation Path
- Technical/billing issues → platform owner (via support ticket — out of system)
- Spiritual/doctrinal issues → church hierarchy (out of system)
- No in-system escalation above super_admin

### Promotion Path
- NOT available via self-service or admin action
- Only platform owner can assign super_admin role
- Typically during church onboarding: the first user of a church becomes super_admin

### Demotion Path
- Only platform owner can demote a super_admin
- Cannot be demoted by another super_admin
- On demotion: super_admin → admin (requires target service assignment)

---

## Role: Admin

| Attribute | Value |
|-----------|-------|
| **System name** | `admin` |
| **Business title** | Ministry Leader, Service Leader, Department Head |
| **Scope** | Assigned services (L2) |
| **Church ID** | Set from profile |
| **Has servant record** | Yes |
| **Inherits from** | Super Admin |
| **Inherited by** | Servant, Pending User |

### Responsibilities
- Manage stages and classes within assigned services
- Oversee servants within assigned services
- Manage beneficiaries within assigned services
- Record and view attendance for assigned services
- View follow-ups for beneficiaries in assigned services
- Execute bulk import for servants and beneficiaries
- Cannot approve servants (super_admin only)
- Cannot delete beneficiaries (super_admin only)
- Cannot read spiritual journals (privacy invariant)

### Permissions
Inherits all servant permissions +:
- `servants.read` (assigned services only)
- `servants.update` (assigned services only)
- `servants.assign` (within assigned services)
- `beneficiaries.create`
- `beneficiaries.read` (assigned services)
- `beneficiaries.update` (assigned services)
- `beneficiaries.transfer`
- `stages.create`, `stages.update` (assigned services)
- `classes.create`, `classes.update` (assigned stages)
- `attendance.read` (all, assigned services)
- `attendance.export`
- `followups.read` (all, for beneficiaries in assigned services)
- `reports.read` (assigned services)
- `import.execute`, `export.execute`

### Visibility
| Entity | Scope |
|--------|-------|
| Beneficiaries | All in assigned services |
| Servants | In assigned services (full profiles) |
| Attendance | All records in assigned services |
| Spiritual journals | NEVER |
| Follow-ups | For beneficiaries in assigned services |
| Reports | Service/stage scope |

### Escalation Path
- Permission/approval issues → super_admin (priest)
- Cannot escalate within the system — must communicate externally

### Promotion Path
- Admin → super_admin: Only platform owner can promote
- Typically: a trusted admin may be promoted to super_admin by platform owner request

### Demotion Path
- Super admin can demote admin → servant
- Demotion requires re-assigning all servant's stages/classes
- On demotion: existing `servant_stage_assignments` end_date set to current date

---

## Role: Servant

| Attribute | Value |
|-----------|-------|
| **System name** | `servant` |
| **Business title** | Servant, Teacher, Volunteer |
| **Scope** | Assigned stages/classes/beneficiaries (L3/L4/L5) |
| **Church ID** | Set from profile |
| **Has servant record** | Yes |
| **Inherits from** | Admin |
| **Inherited by** | Pending User |

### Responsibilities
- Record attendance for assigned beneficiaries
- Create and manage follow-ups for assigned beneficiaries
- View own assigned beneficiaries
- Maintain personal spiritual journal
- View personal dashboard
- Cannot browse servant list
- Cannot create beneficiaries
- Cannot view beneficiaries outside their assignment

### Permissions
- `beneficiaries.read` (assigned only)
- `beneficiaries.update` (assigned only, limited fields)
- `attendance.create` (assigned stage/class)
- `attendance.read` (own records + assigned beneficiaries)
- `followups.create`
- `followups.read` (own)
- `followups.update` (own)
- `spiritual.create` (own journal)
- `spiritual.read` (own journal)
- `notifications.read` (own)
- `reports.read` (personal dashboard)

### Visibility
| Entity | Scope |
|--------|-------|
| Beneficiaries | Individually assigned only (unless stage_leader/class_leader) |
| Servants | Own profile only |
| Attendance | Own recording history + assigned beneficiaries |
| Spiritual journals | Own entries only |
| Follow-ups | Own follow-ups only |
| Reports | Personal dashboard |

### Escalation Path
- Need permission not granted → admin (ministry leader)
- Approval requests → super_admin (priest) via approval workflow

### Promotion Path
- Servant → admin: Super admin assigns admin role + service assignment
- Servant → stage_leader/class_leader: Super admin or admin assigns via `servant_stage_assignments.role`
- Requires approved servant status

### Demotion Path
- Admin can demote servant → pending_user (deactivate servant record)
- On demotion: `servants.approval_status = 'rejected'` or `deleted_at` set
- All active `servant_stage_assignments` end_date set

---

## Role: Pending User

| Attribute | Value |
|-----------|-------|
| **System name** | No system role — represented by `servants.approval_status = 'pending'` |
| **Business title** | Applicant, Prospective Servant |
| **Scope** | None (no access until approved) |
| **Church ID** | Set from profile |
| **Has servant record** | Yes, but `approval_status = 'pending'` |
| **Inherits from** | N/A |
| **Inherited by** | N/A |

### Responsibilities
- Complete registration/profile
- Wait for super_admin approval
- No operational access until approved

### Permissions
- None (can log in, see their own profile, see approval status)

### Visibility
- Own profile only
- No beneficiary, servant, attendance, or any operational data

### Escalation Path
- Approval not received → contact church directly (out of system)
- No in-system escalation available

### Promotion Path
- Pending → servant: super_admin sets `approval_status = 'approved'`
- Pending → rejected: super_admin sets `approval_status = 'rejected'`
- Rejected users can re-register (Phase 3)

### Demotion Path
- Servant → pending: not supported (servant is deactivated, not re-pended)
- Pending user → deactivated: profile soft-deleted

---

## Assignment Role Hierarchy

These are NOT system roles. They are values within `servant_stage_assignments.role` that control stage/class-level access granularity:

```
service_admin ──→ Full access to all stages/classes/beneficiaries within the service
     │
stage_leader ──→ Full access to all beneficiaries within the stage (across all classes)
     │
class_leader ──→ Full access to all beneficiaries within the class
     │
servant ──→ Access to individually assigned beneficiaries only
```

**Mapping:**
- `super_admin + service_admin`: combined for full church control
- `admin` system role can have `service_admin` assignment role for service-level control
- `admin` system role can have `stage_leader` assignment role for stage-level control
- `servant` system role can have `stage_leader` or `class_leader` assignment role
- `servant` system role with `servant` assignment role = basic servant

---

## Summary Table

| Role | System Name | Scope | Servant Record | Can Approve | Can Delete | Can Read Spiritual |
|------|-------------|-------|----------------|-------------|------------|-------------------|
| Platform Owner | `platform_owner` | System-wide | No | N/A | N/A | Never |
| Super Admin | `super_admin` | Church-wide | Yes | Yes | Yes | Yes (audited) |
| Admin | `admin` | Assigned services | Yes | No | No | Never |
| Servant | `servant` | Assigned classes/beneficiaries | Yes | No | No | Own only |
| Pending User | (pending) | None | Yes (pending) | No | No | Never |
