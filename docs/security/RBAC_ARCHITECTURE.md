# RBAC Architecture — Church Ministry Platform

**Version:** 1.0  
**Scope:** Role definitions, permission codes, inheritance, stage-level access control, resource ownership.

---

## 1. Role Hierarchy

### 1.1 Platform-Level Roles

```
PLATFORM OWNER  (system-wide)
  ├── Can access all churches (aggregate only)
  ├── Subscription management
  ├── Billing
  ├── System monitoring
  └── Tenant provisioning / suspension / deletion
```

### 1.2 Church-Level Roles

```
CHURCH :: SUPER ADMIN  (highest inside church)
  ├── Full data access (all services, stages, servants, beneficiaries)
  ├── Permission management
  ├── Leadership assignment
  ├── Servant approval
  ├── Church configuration
  └── Audit log viewer
  │
  ├── CHURCH :: ADMIN  (assigned to one or more services)
  │     ├── Service-level data access
  │     ├── Stage management
  │     ├── Servant oversight (within assigned services)
  │     ├── Beneficiary management (within assigned services)
  │     └── Attendance reports (within assigned services)
  │     │
  │     └── CHURCH :: USER  (assigned to specific stage + beneficiaries)
  │           ├── Own beneficiary list
  │           ├── Attendance recording
  │           ├── Follow-up management
  │           ├── Personal spiritual journal
  │           └── Personal dashboard
```

### 1.3 Role Mapping to Business Titles

| System Role | Business Title(s) | Scope |
|-------------|-------------------|-------|
| platform_owner | Platform Owner, System Admin | All tenants |
| super_admin | Priest, Church President, Senior Pastor | Own church |
| admin | Ministry Leader, Service Leader, Department Head | Assigned services |
| user | Servant, Teacher, Volunteer | Assigned stage/beneficiaries |

---

## 2. Inheritance Rules

Permissions are inherited **downward** in the role hierarchy:

```
super_admin → ALL permissions
admin → ALL permissions of user + admin-specific permissions
user → base permissions (own data, attendance, follow-ups, spiritual journal)
```

**Rule:** A role always includes all permissions of roles below it.  
**Exception:** Platform Owner is a separate hierarchy — does NOT inherit church-level roles.

### 2.1 Permission Set Definitions

#### user (base level)
- `beneficiaries.read`  (assigned only)
- `beneficiaries.update` (assigned only, limited fields)
- `attendance.create`
- `attendance.read` (own records)
- `followups.create`
- `followups.update` (own records)
- `followups.read` (own records)
- `spiritual.create` (own journal)
- `spiritual.read` (own journal)
- `dashboard.read` (personal)

#### admin (inherits user + adds)
- `servants.read` (assigned services)
- `beneficiaries.create`
- `beneficiaries.read` (assigned services, all)
- `beneficiaries.update` (assigned services, all fields)
- `beneficiaries.transfer`
- `attendance.read` (assigned services, all)
- `attendance.export`
- `followups.read` (assigned services, all)
- `stages.read` (assigned services)
- `stages.update` (assigned services)
- `reports.read` (assigned services)
- `import.execute`
- `export.execute`

#### super_admin (inherits admin + adds)
- `servants.create`
- `servants.read` (all)
- `servants.update` (all)
- `servants.delete`
- `servants.approve`
- `beneficiaries.delete`
- `services.create`
- `services.read` (all)
- `services.update` (all)
- `services.delete`
- `stages.create`
- `stages.delete`
- `roles.manage`
- `permissions.manage`
- `settings.read`
- `settings.update`
- `audit.read`
- `spiritual.read` (all servants)
- `reports.read` (all)

#### platform_owner (separate hierarchy)
- `tenants.create`
- `tenants.read`
- `tenants.update`
- `tenants.delete`
- `subscriptions.manage`
- `billing.read`
- `system.metrics`
- `system.audit`
- `support.manage`

---

## 3. Full Permission Code Catalog

| Code | Module | Description | Roles |
|------|--------|-------------|-------|
| `servants.create` | Servants | Create new servant | super_admin |
| `servants.read` | Servants | View servant list/profile | super_admin, admin (scoped) |
| `servants.update` | Servants | Edit servant details | super_admin, admin (scoped) |
| `servants.delete` | Servants | Deactivate servant | super_admin |
| `servants.approve` | Servants | Approve/reject registration | super_admin |
| `servants.assign` | Servants | Assign servant to stage/service | super_admin, admin |
| `beneficiaries.create` | Beneficiaries | Create new beneficiary | super_admin, admin |
| `beneficiaries.read` | Beneficiaries | View beneficiary list/profile | all (scoped) |
| `beneficiaries.update` | Beneficiaries | Edit beneficiary details | super_admin, admin, user (limited) |
| `beneficiaries.delete` | Beneficiaries | Deactivate beneficiary | super_admin |
| `beneficiaries.transfer` | Beneficiaries | Transfer between stages/servants | super_admin, admin |
| `attendance.create` | Attendance | Record attendance | all |
| `attendance.read` | Attendance | View attendance records | all (scoped) |
| `attendance.export` | Attendance | Export attendance data | super_admin, admin |
| `followups.create` | Follow-ups | Create follow-up | all |
| `followups.read` | Follow-ups | View follow-up records | all (scoped) |
| `followups.update` | Follow-ups | Update follow-up | all (own) |
| `followups.delete` | Follow-ups | Delete follow-up | all (own), super_admin |
| `services.create` | Services | Create service | super_admin |
| `services.read` | Services | View services | all (scoped) |
| `services.update` | Services | Edit service | super_admin |
| `services.delete` | Services | Archive service | super_admin |
| `stages.create` | Stages | Create stage | super_admin |
| `stages.read` | Stages | View stages | all (scoped) |
| `stages.update` | Stages | Edit stage | super_admin, admin (scoped) |
| `stages.delete` | Stages | Archive stage | super_admin |
| `spiritual.create` | Spiritual | Record spiritual journal entry | user |
| `spiritual.read` | Spiritual | View spiritual journal | user (own), super_admin (all) |
| `notifications.read` | Notifications | View notifications | all |
| `notifications.manage` | Notifications | Configure notification settings | super_admin |
| `reports.read` | Reports | View reports | all (scoped) |
| `reports.export` | Reports | Export reports | super_admin, admin |
| `import.execute` | Import | Execute bulk import | super_admin, admin |
| `export.execute` | Export | Execute bulk export | super_admin, admin |
| `roles.manage` | RBAC | Manage roles and permissions | super_admin |
| `settings.read` | Settings | View church settings | super_admin |
| `settings.update` | Settings | Update church settings | super_admin |
| `audit.read` | Audit | View audit logs | super_admin |

---

## 4. Resource Ownership Model

### 4.1 Ownership Chain

```
Church (tenant root)
  └── Services (owned by church)
       └── Stages (owned by service)
            └── Classes (owned by stage — optional)
                 └── Beneficiaries (assigned to stage + servant)
                      └── Attendance records
                      └── Follow-ups
                           └── Servants (assigned to stages, own follow-ups)
                                └── Spiritual journal entries
```

### 4.2 Access Control Levels

| Level | Scope | Determined By |
|-------|-------|---------------|
| L0 — System | All churches | Platform Owner role |
| L1 — Church | Own church only | `church_id` on profile |
| L2 — Service | Specific services | `servant_stage_assignments.service_id` |
| L3 — Stage | Specific stages | `servant_stage_assignments.stage_id` |
| L4 — Beneficiary | Specific beneficiaries | `beneficiary_assignments.servant_id` |
| L5 — Self | Own records only | `profile.id` |

### 4.3 Access Resolution Algorithm

```
function canAccess(resource, user):
  1. If user.role == 'platform_owner' → GRANT (L0)
  2. If user.role == 'super_admin' AND resource.church_id == user.church_id → GRANT (L1)
  3. If user.role == 'admin':
     a. Get user's assigned service_ids
     b. If resource.service_id IN assigned_service_ids → GRANT (L2)
     c. If resource is a stage AND stage.service_id IN assigned_service_ids → GRANT (L3)
     d. If resource is a beneficiary AND beneficiary's service_id IN assigned_service_ids → GRANT (L3)
  4. If user.role == 'user':
     a. Get user's assigned stage_ids
     b. If resource is a beneficiary AND beneficiary's assigned_servant_id == user.servant_id → GRANT (L4)
     c. If resource is a follow-up AND follow-up.servant_id == user.servant_id → GRANT (L4)
     d. If resource is a spiritual entry AND entry.servant_id == user.servant_id → GRANT (L5)
  5. Otherwise → DENY
```

---

## 5. Stage-Level Access Control

Stage-level access is the most granular permission boundary for administrative actions.

### 5.1 How It Works

1. A `servant_stage_assignments` row links a servant to a stage with a role (`admin` or `user`)
2. `admins` at the stage level can:
   - View all beneficiaries in that stage
   - View all servants assigned to that stage
   - Manage attendance for that stage
   - View follow-ups for beneficiaries in that stage
3. `users` at the stage level can:
   - View only beneficiaries they are individually assigned to (via `beneficiary_assignments`)
   - Record attendance for their assigned beneficiaries
   - Create/manage follow-ups for their assigned beneficiaries

### 5.2 Stage Assignment API

```typescript
// Assign servant to stage
assignServantToStage(
  servantId: UUID,
  stageId: UUID,
  role: 'admin' | 'user',
  assignedBy: UUID
): void

// Annual reassignment
reassignServantsForYear(
  assignments: Array<{ servantId, stageId, role }>,
  newYearStartDate: Date,
  assignedBy: UUID
): void

// End assignment
endServantStageAssignment(
  assignmentId: UUID,
  endDate: Date
): void
```

### 5.3 Stage-Level Permission Checks

All Server Actions that operate on stage-scoped resources MUST check:

1. Is the user authenticated?
2. Does the user have the required permission code?
3. Is the user's stage assignment active for the target stage?
4. Is the target resource within the user's church?

Failure at any step → deny with appropriate error message.

---

## 6. Annual Role Change Workflow

In many churches, servant assignments reset annually (e.g., at the start of the service year in September).

### 6.1 Annual Change Process

1. **Freeze period** (2 weeks before change): All assignment changes are queued, not applied
2. **Reassignment window** (1 week): Super Admin / Admin reassigns servants to stages
3. **Mass update**: Existing `servant_stage_assignments` get `end_date = freeze_date`; new rows created with `start_date = new_year_date`
4. **Notification**: Affected servants notified of their new assignments
5. **Rollback window** (48 hours): Super Admin can revert individual assignments

### 6.2 History Preservation

All previous assignments are preserved with `end_date` set. The `service_history` JSONB field on the servant record is updated with each annual change for quick reference, but the authoritative history is in `servant_stage_assignments`.

---

## 7. Service History Tracking

### 7.1 Data Model

```typescript
interface ServiceHistoryEntry {
  serviceId: string
  serviceNameAr: string
  stageId: string
  stageNameAr: string
  role: 'admin' | 'user'
  startDate: string  // ISO date
  endDate: string | null  // null = current
  assignedBy: string  // profile name
}
```

### 7.2 Display

- Servant profile page shows a timeline of assignments
- Current assignment highlighted
- Future assignments shown with "upcoming" badge
- Exportable as part of servant report

---

## 8. Role Override Rules

The Super Admin (Priest) can override permissions at the role level:

| Setting | Can Override? | Scope |
|---------|---------------|-------|
| User can view all beneficiaries in stage | Yes | Per stage or global |
| User can create beneficiaries | No | Only Admin+ |
| User can view spiritual journals of peers | No | Privacy invariant |
| Admin can view all church data | Yes | Per service |
| Admin can approve servants | No | Only Super Admin |
| User can edit beneficiary medical info | No | Privacy invariant |

**Rules:**
- Overrides can only **tighten** restrictions, never loosen beyond the role's defined maximum
- Overrides are logged in audit
- Override changes require Super Admin permission
- Overrides are stored in `church_config.role_overrides` as JSONB

---

## 9. Enforcement Layers

```
┌─────────────────────────────────────────────┐
│  UI Layer                                    │
│  - PermissionGuard component (hide/show)     │
│  - RoleGuard component (hide/show)           │
│  - Disabled buttons with tooltip             │
├─────────────────────────────────────────────┤
│  Server Action Layer                         │
│  - hasPermission(code) check                │
│  - hasStageAccess(stageId, role) check      │
│  - hasChurchAccess(churchId) check          │
│  - Audit log on mutation                    │
├─────────────────────────────────────────────┤
│  Database Layer (RLS)                        │
│  - church_id policy on every table          │
│  - Role-based policies (super_admin sees     │
│    all, admin sees assigned services, etc.)  │
│  - spiritual_journal: owner OR priest only   │
└─────────────────────────────────────────────┘
```
