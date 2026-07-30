# Class-Based Access Architecture

**Date:** 2026-07-30
**Source Documents:** PRD_V3.md, RBAC_ARCHITECTURE.md, SYSTEM_ARCHITECTURE.md, DATABASE_REQUIREMENTS.md

---

## 1. Resource Hierarchy

### 1.1 The Four-Level Model

```
Church (tenant root)
  └── Service (ministry area — e.g., "Youth Service")
       └── Stage (age/level group — e.g., "Intermediate Stage")
            └── Class (optional subdivision — e.g., "First Year")
                 └── Beneficiaries (children/students)
                      └── Attendance Records
                      └── Follow-ups
```

### 1.2 Referential Chain

```
churches.id
  └── services.church_id = churches.id
       └── stages.service_id = services.id, stages.church_id = churches.id
            └── classes.stage_id = stages.id, classes.church_id = churches.id
                 └── beneficiary_assignments.class_id = classes.id (nullable)
                      └── beneficiary_assignments.stage_id = stages.id
                      └── beneficiary_assignments.service_id = services.id
                           └── attendance_sessions.class_id = classes.id (nullable)
                           └── servant_stage_assignments.class_id = classes.id (nullable)
```

### 1.3 Access Inheritance Path

```
Church-level (super_admin) ──→ ALL resources in church
  Service-level (admin) ──→ Resources in assigned services (includes stages + classes + beneficiaries)
    Stage-level (admin/user via servant_stage_assignments) ──→ Resources in assigned stages
      Class-level (admin/user via servant_stage_assignments.class_id) ──→ Resources in assigned classes
        Beneficiary-level (user) ──→ Individually assigned beneficiaries
```

**Rule:** Access at a higher level implicitly includes access to all descendants.

---

## 2. Role Definitions

### 2.1 Platform-Level Role

| Role | Scope | Description | Access Level |
|------|-------|-------------|--------------|
| **platform_owner** | All tenants | System administration, subscriptions, billing, monitoring, support. No PII access — aggregate data only. | L0 — System |

### 2.2 Church-Level Roles

| Role | Business Title | Scope | Access Level | Inherits From |
|------|----------------|-------|--------------|---------------|
| **super_admin** | Priest, Senior Pastor | Full church | L1 — Church | All permissions |
| **admin** | Ministry Leader, Service Leader, Department Head | Assigned services (+ descendant stages, classes) | L2 — Service | User permissions + admin-scoped |
| **user** | Servant, Teacher, Volunteer | Assigned stages/classes/beneficiaries | L3/L4/L5 — Stage/Class/Beneficiary | Base permissions only |

### 2.3 Granular Role Types at Each Level

For finer-grained control, the `servant_stage_assignments.role` field supports:

| Assignment Role | Level | Can |
|-----------------|-------|-----|
| `service_admin` | Service (L2) | Manage all stages/classes/beneficiaries within the service |
| `stage_leader` | Stage (L3) | Manage the stage, view all beneficiaries in it, manage attendance |
| `class_leader` | Class (L3 — scoped) | Manage the class, view all beneficiaries in it |
| `servant` | Stage/Class (L3/L4) | View only assigned beneficiaries, record attendance, manage follow-ups |

**Mapping to PRD roles:**
- PRD's "admin" = church-level admin role **OR** `service_admin` assignment role
- PRD's "user" = `servant` assignment role

---

## 3. Ownership Model

### 3.1 Resource Ownership

| Entity | Owned By | Notes |
|--------|----------|-------|
| `churches` | Platform Owner | Tenant root |
| `services` | Church (super_admin) | Named after "ministries" in current codebase |
| `stages` | Church → Service | Created by super_admin or admin |
| `classes` | Church → Service → Stage | Optional subdivision |
| `servants` | Church | One-to-one with profiles; approval workflow |
| `servant_stage_assignments` | Church | Temporal — end_date = historical |
| `beneficiaries` | Church | Always assigned via `beneficiary_assignments` |
| `beneficiary_assignments` | Church | Immutable — new row per change |
| `attendance_sessions` | Church → Stage/Class | Created by servant with stage access |
| `attendance_records` | Church | Tied to session |
| `followups` | Church → Servant (creator) | Transferable |
| `spiritual_journal_entries` | Servant (owner) + super_admin | Dual ownership — priest read-only |

### 3.2 Ownership Resolution

```sql
-- Who owns this beneficiary?
SELECT ba.servant_id, ba.stage_id, ba.service_id, s.church_id
FROM beneficiary_assignments ba
JOIN servants s ON s.id = ba.servant_id
WHERE ba.beneficiary_id = :target_id AND ba.is_current = true;
```

---

## 4. Access Inheritance Rules

### 4.1 Super Admin (L1 — Church)

```
GRANT ALL on all tables WHERE church_id = user.church_id
```

- Can read/write any service, stage, class, beneficiary, attendance record, follow-up
- Can manage any servant in the church
- Can read any spiritual journal entry (audit-logged)
- Can configure church settings

### 4.2 Admin (L2 — Service)

```
GRANT on all tables WHERE resource.service_id IN user.assigned_service_ids
```

- Can read/write all stages under assigned services
- Can read/write all classes under those stages
- Can read (but not delete) all beneficiaries in those stages
- Can read/write attendance for those stages
- Can read follow-ups for beneficiaries in those stages
- Can manage servant assignments within those stages
- **Cannot** read spiritual journal entries
- **Cannot** manage roles/permissions
- **Cannot** delete beneficiaries

### 4.3 User (L3 — Stage / L4 — Beneficiary)

**Stage-level user** (assigned to stage with role = `servant`):

```
GRANT on beneficiaries WHERE beneficiary_assignments.stage_id IN user.assigned_stage_ids
  AND beneficiary_assignments.servant_id = user.servant_id
```

- Can read/write only beneficiaries they are individually assigned to
- Can record attendance for those beneficiaries
- Can create/manage follow-ups for those beneficiaries
- Can read their own spiritual journal entries

**Class-level user** (assigned to class via `servant_stage_assignments.class_id`):

```
Same as stage-level but scoped to class_id
```

**Stage leader** (assigned to stage with role = `stage_leader`):

```
GRANT on beneficiaries WHERE beneficiary_assignments.stage_id IN user.assigned_stage_ids
  -- ALL beneficiaries in the stage (not just individually assigned)
```

### 4.4 Platform Owner (L0 — System)

```
GRANT SELECT on aggregate views only
GRANT on churches table (all rows)
GRANT on audit_logs (all rows)
```

- **No** direct access to PII (beneficiary names, servant names, spiritual data)
- Access via admin interface only (separate layout, separate auth boundary)
- Can view: tenant list, subscription status, system metrics, audit logs

---

## 5. Multi-Class Assignment

### 5.1 Servant Assigned to Multiple Classes

A servant can be assigned to multiple classes within a stage, or across stages:

```sql
-- Find all classes assigned to a servant
SELECT c.*, st.service_id, st.name_ar AS stage_name
FROM servant_stage_assignments ssa
JOIN classes c ON c.id = ssa.class_id
JOIN stages st ON st.id = c.stage_id
WHERE ssa.servant_id = :servant_id
  AND ssa.is_active = true
  AND ssa.end_date IS NULL;
```

### 5.2 Beneficiary Assigned to One Class

A beneficiary always has exactly one **current** assignment (`beneficiary_assignments.is_current = true`). Historical assignments are preserved with `is_current = false`.

```sql
-- Current class for a beneficiary
SELECT c.* FROM beneficiary_assignments ba
JOIN classes c ON c.id = ba.class_id
WHERE ba.beneficiary_id = :beneficiary_id AND ba.is_current = true;
```

---

## 6. Stage-Wide Assignment

### 6.1 What It Means

A `servant_stage_assignments` row with `stage_id` set but `class_id = NULL` means the servant operates at the **stage level**, giving them access to all beneficiaries in that stage (regardless of class):

```sql
-- Servants with stage-wide access
SELECT * FROM servant_stage_assignments
WHERE stage_id = :stage_id
  AND class_id IS NULL
  AND is_active = true
  AND end_date IS NULL;
```

### 6.2 Stage Leaders

A `servant_stage_assignments` row with `role = 'stage_leader'` also grants stage-wide access:

```sql
-- Stage leaders (explicit role)
SELECT * FROM servant_stage_assignments
WHERE stage_id = :stage_id
  AND role = 'stage_leader'
  AND is_active = true
  AND end_date IS NULL;
```

---

## 7. Access Evaluation Flow

### 7.1 Permission Check Algorithm

```
function canAccess(user, resource, requiredPermission):

  // ── L0: Platform Owner ──
  if user.role == 'platform_owner':
    if resource is aggregate/church-level: GRANT
    else: DENY (no PII)

  // ── Resolve church context ──
  userChurchId = user.profile.church_id

  // ── L1: Super Admin ──
  if user.role == 'super_admin':
    if resource.church_id == userChurchId: GRANT
    else: DENY

  // ── L2+: Service-level and below ──
  // Get all active stage assignments
  assignments = SELECT * FROM servant_stage_assignments
    WHERE servant_id = user.servant_id
      AND end_date IS NULL
      AND is_active = true

  if assignments.length == 0: DENY

  assignedServiceIds = unique(assignments.service_id)
  assignedStageIds = unique(assignments.stage_id)
  assignedClassIds = unique(assignments.class_id WHERE NOT NULL)

  // ── L5: Self-owned resources ──
  if resource.type in ['spiritual_entry', 'followup']:
    if resource.owner_id == user.servant_id: GRANT

  // ── Check required permission ──
  if not userHasPermission(user, requiredPermission): DENY

  // ── L2: Service-level access (admin role) ──
  if user.role == 'admin' OR hasAssignmentWithRole(assignments, 'service_admin'):
    if resource.service_id IN assignedServiceIds: GRANT

  // ── L3: Stage-level access ──
  if resource.type == 'beneficiary':
    if assignments has stage_id == resource.stage_id:
      if role in ['stage_leader', 'servant']:
        if role == 'stage_leader': GRANT (all beneficiaries in stage)
        elif role == 'servant':
          // Check individual beneficiary assignment
          ba = SELECT * FROM beneficiary_assignments
            WHERE beneficiary_id == resource.id
              AND servant_id == user.servant_id
              AND is_current == true
          if ba: GRANT

  // ── L3: Class-level access ──
  if resource.type == 'beneficiary':
    if assignments has class_id == resource.class_id: GRANT

  // ── L4: Specific beneficiary assignment ──
  if resource.type == 'beneficiary':
    ba = SELECT * FROM beneficiary_assignments
      WHERE beneficiary_id == resource.id
        AND servant_id == user.servant_id
        AND is_current == true
    if ba: GRANT (limited update only)

  // ── Default: DENY ──
  return DENY
```

### 7.2 Permission Check Order

For efficiency, checks are ordered from cheapest to most expensive:

1. **Authentication check** (session exists) — O(1)
2. **Permission code check** (cached in session/request) — O(1)
3. **Church ID match** (on the resource) — O(1)
4. **Super Admin bypass** (single query) — O(1)
5. **Assignment lookup** (indexed query) — O(log n)
6. **Individual assignment check** (if scoped) — O(1)

### 7.3 Stage-Level Permission Enforcement

| Action | Required Permission | Required Assignment |
|--------|-------------------|-------------------|
| View beneficiary list | `beneficiaries.read` | stage_id match + role >= servant |
| View beneficiary detail | `beneficiaries.read` | beneficiary_assignments.servant_id match |
| Create beneficiary | `beneficiaries.create` | stage_id match + role >= stage_leader |
| Update beneficiary | `beneficiaries.update` | stage_id match + role >= stage_leader OR own assignment |
| Delete beneficiary | `beneficiaries.delete` | super_admin only |
| Transfer beneficiary | `beneficiaries.transfer` | stage_id match + role >= admin |
| Record attendance | `attendance.create` | stage_id/class_id match |
| View attendance | `attendance.read` | stage_id/class_id match |
| Create follow-up | `followups.create` | beneficiary assignment |
| View follow-up | `followups.read` | beneficiary assignment OR stage_id match + role >= stage_leader |
| View servant list | `servants.read` | role >= admin (scoped to service) |

---

## 8. Data Visibility by Role

### 8.1 Beneficiary Visibility

| Role | Can View | Scope |
|------|----------|-------|
| platform_owner | Aggregate counts only | No PII |
| super_admin | All beneficiaries | Church-wide |
| admin | All beneficiaries | Assigned services only |
| stage_leader | All beneficiaries | Assigned stages only |
| class_leader | All beneficiaries | Assigned classes only |
| servant | Assigned beneficiaries only | Via beneficiary_assignments |

### 8.2 Attendance Visibility

| Role | Can View | Scope |
|------|----------|-------|
| platform_owner | Aggregates only | Per church |
| super_admin | All attendance | Church-wide |
| admin | All attendance | Assigned services |
| stage_leader | All attendance | Assigned stages |
| class_leader | All attendance | Assigned classes |
| servant | Own recording history | Personal |

### 8.3 Spiritual Journal Visibility

| Role | Can View | Scope | Audit |
|------|----------|-------|-------|
| platform_owner | **Never** | N/A | N/A |
| super_admin | All journals | Church-wide | Every access logged |
| admin | **Never** | N/A | N/A |
| user | Own journal only | Self | Entry creation logged |

### 8.4 Servant Visibility

| Role | Can View | Can View Details |
|------|----------|-----------------|
| platform_owner | Aggregate counts only | No |
| super_admin | All servants | Full profile |
| admin | Servants in assigned services | Full profile |
| user | Own profile | Full profile |

---

## 9. Assignment Validation Rules

### 9.1 Creating an Assignment

```typescript
function validateAssignment(assignment: {
  servantId: string;
  serviceId: string;
  stageId?: string;
  classId?: string;
  role: string;
}): ValidationResult {
  // 1. Servant must exist and be approved
  const servant = servants.findById(assignment.servantId);
  if (!servant || servant.approval_status !== 'approved')
    return { valid: false, reason: 'Servant not approved' };

  // 2. Service must exist and be active
  const service = services.findById(assignment.serviceId);
  if (!service || !service.is_active)
    return { valid: false, reason: 'Service not active' };

  // 3. Stage must belong to service
  if (assignment.stageId) {
    const stage = stages.findById(assignment.stageId);
    if (!stage || stage.service_id !== assignment.serviceId)
      return { valid: false, reason: 'Stage not in service' };
  }

  // 4. Class must belong to stage
  if (assignment.classId) {
    const cls = classes.findById(assignment.classId);
    if (!cls || cls.stage_id !== assignment.stageId)
      return { valid: false, reason: 'Class not in stage' };
  }

  // 5. Role must be valid
  const validRoles = ['service_admin', 'stage_leader', 'class_leader', 'servant'];
  if (!validRoles.includes(assignment.role))
    return { valid: false, reason: 'Invalid role' };

  // 6. No overlapping active assignment
  const existing = servant_stage_assignments.find({
    servant_id: assignment.servantId,
    stage_id: assignment.stageId,
    class_id: assignment.classId,
    is_active: true,
    end_date: null,
  });
  if (existing)
    return { valid: false, reason: 'Overlapping active assignment exists' };

  return { valid: true };
}
```

### 9.2 Conflict Rules

| Scenario | Resolution |
|----------|-----------|
| Servant assigned to stage + class simultaneously | Allowed — separate rows, different scope |
| Servant assigned to two classes in same stage | Allowed |
| Servant assigned stage-wide (no class) + specific class | Redundant but allowed — stage-wide wins |
| Servant assigned same stage with end_date in past + new assignment | Allowed — historical |
| Beneficiary assigned to two servants in same stage | Not allowed — only one current assignment |

---

## 10. Permission Inheritance Summary

```
platform_owner ──→ System-level (aggregate only). Does NOT inherit church roles.
                      │
super_admin ──→ ALL permissions within church (L1).
    │             Includes admin + user permissions.
    │
    ├── admin ──→ Assigned services (L2).
    │   │          Includes user permissions within scope.
    │   │
    │   ├── service_admin ──→ All stages/classes in assigned service.
    │   │
    │   ├── stage_leader ──→ All beneficiaries in assigned stage.
    │   │
    │   └── class_leader ──→ All beneficiaries in assigned class.
    │
    └── user ──→ Base permissions only (own records, assigned beneficiaries).
        │
        └── servant ──→ Assigned beneficiaries only (L4).
```

**Rule:** A higher role always includes all permissions of all lower roles within its scope.
**Exception:** `platform_owner` does NOT include any church-level permissions.

---

## 11. Access Enforcement Layers

```
┌──────────────────────────────────────────────────────┐
│  Layer 1: UI                                        │
│  ───────────────────────────────────────────────────  │
│  <PermissionGuard code="beneficiaries.read">         │
│  <RoleGuard role="super_admin">                     │
│  <StageGuard stageId="..." requiredRole="servant">  │
│  <ClassGuard classId="..." requiredRole="servant">  │
│                                                      │
│  Component-level hiding/showing of UI elements       │
├──────────────────────────────────────────────────────┤
│  Layer 2: Server Action                             │
│  ───────────────────────────────────────────────────  │
│  1. hasPermission('beneficiaries.read')             │
│  2. hasStageAccess(stageId, 'servant')              │
│  3. hasClassAccess(classId, 'servant')              │
│  4. hasBeneficiaryAccess(beneficiaryId)              │
│                                                      │
│  Every mutation checks at least permission + scope   │
├──────────────────────────────────────────────────────┤
│  Layer 3: Database (RLS)                             │
│  ───────────────────────────────────────────────────  │
│  - church_id policy (every table)                   │
│  - super_admin bypass policy                        │
│  - admin service-scoped policy                      │
│  - user own-records policy                          │
│  - spiritual_journal: owner OR priest only          │
└──────────────────────────────────────────────────────┘
```
