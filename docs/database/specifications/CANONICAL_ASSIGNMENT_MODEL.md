# Canonical Assignment Model

**Date:** 2026-07-30  
**Status:** Final — single source of truth  
**Supersedes:** CLASS_ACCESS_ARCHITECTURE.md assignment rules, DATABASE_REQUIREMENTS.md assignment tables  

---

## 1. Assignment Tables

### 1.1 `servant_stage_assignments`

**Purpose:** Links a servant to a service/stage/class with a specific role. Supports temporal tracking (annual reassignments, historical preservation).

**Role values:** `service_admin`, `stage_leader`, `class_leader`, `servant`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | Tenant isolation |
| servant_id | UUID | NOT NULL, FK → servants(id) ON DELETE CASCADE | |
| service_id | UUID | NOT NULL, FK → services(id) | Denormalized for RLS performance |
| stage_id | UUID | FK → stages(id), nullable | NULL = service-level assignment (service_admin only) |
| class_id | UUID | FK → classes(id), nullable | NULL = stage-wide or service-wide |
| role | TEXT | NOT NULL | `service_admin`, `stage_leader`, `class_leader`, `servant` |
| assigned_by | UUID | NOT NULL, FK → profiles(id) | |
| start_date | DATE | NOT NULL | |
| end_date | DATE | nullable | NULL = current assignment |
| is_active | BOOLEAN | NOT NULL DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Unique constraint:** `(servant_id, stage_id, class_id, end_date)` prevents duplicate active assignments at the same scope.

### 1.2 `beneficiary_assignments`

**Purpose:** Immutable record of a beneficiary's placement in a service/stage/class under a specific servant. Only one current assignment per beneficiary.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| church_id | UUID | NOT NULL, FK → churches(id) | Tenant isolation |
| beneficiary_id | UUID | NOT NULL, FK → beneficiaries(id) ON DELETE CASCADE | |
| service_id | UUID | NOT NULL, FK → services(id) | Denormalized |
| stage_id | UUID | NOT NULL, FK → stages(id) | |
| class_id | UUID | FK → classes(id), nullable | NULL = assigned directly to stage |
| servant_id | UUID | NOT NULL, FK → servants(id) | Responsible servant |
| assigned_by | UUID | NOT NULL, FK → profiles(id) | |
| is_current | BOOLEAN | NOT NULL DEFAULT true | Exactly one TRUE per beneficiary |
| start_date | DATE | NOT NULL | |
| end_date | DATE | nullable | NULL = current |
| transfer_reason | TEXT | nullable | Required on transfer |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Immutability:** Once written, never updated or deleted. New assignment = new row with `is_current = false` on old row.

---

## 2. Ownership Rules

| Entity | Owner | Notes |
|--------|-------|-------|
| `servant_stage_assignments` | Church. Created by super_admin or admin. | super_admin can assign any servant to any stage. Admin can assign within their assigned services. |
| `beneficiary_assignments` | Church. Created by super_admin or admin. | Servant cannot self-assign. Transfer requires super_admin or admin. |

**Constraint:** An admin may only create assignments within their own assigned services (determined by their own `servant_stage_assignments.service_id`).

---

## 3. Assignment Validation Rules

### 3.1 Servant → Stage/Class Assignment

```
REQUIREMENTS:
  - Servant must exist AND approval_status = 'approved'
  - Service must exist AND is_active = true
  - Stage (if provided) must belong to service
  - Class (if provided) must belong to stage
  - Role must be valid: service_admin, stage_leader, class_leader, servant
  - No overlapping active assignment (same servant + same stage + same class + end_date IS NULL)

VALID COMBINATIONS:
  service_id + stage_id=NULL + class_id=NULL  → service_admin only
  service_id + stage_id=SET  + class_id=NULL  → stage-wide (stage_leader or servant)
  service_id + stage_id=SET  + class_id=SET   → class-scoped (class_leader or servant)

INVALID COMBINATIONS:
  service_id + stage_id=NULL + class_id=SET   → cannot skip stage level
  role='service_admin' + stage_id=SET         → service_admin is service-level only
```

### 3.2 Beneficiary → Stage/Class/Servant Assignment

```
REQUIREMENTS:
  - Beneficiary must exist AND deleted_at IS NULL
  - Service, Stage must exist and be active
  - Class (if provided) must belong to stage
  - Servant must exist AND approval_status = 'approved'
  - No other current assignment for this beneficiary (is_current = true)

ON TRANSFER:
  1. Mark old assignment: is_current = false, end_date = now()
  2. Create new assignment: is_current = true, start_date = now(), transfer_reason = SET
  3. Previous servant loses access; new servant gains access immediately
```

---

## 4. Access Evaluation Algorithm

### 4.1 Simplified Rule

```
A user can access a resource if their role + assignment scope covers the resource.

Super Admin → covers CHURCH scope
Admin      → covers assigned SERVICE scope (via user_roles + servant_stage_assignments)
Servant    → covers assigned STAGE/CLASS scope (via servant_stage_assignments)
```

### 4.2 Detailed Algorithm

```
function canAccessResource(user, resource, requiredPermission):

  // L0 — Platform Owner
  if user.role == 'platform_owner':
    return resource is aggregate view only (no PII)

  // L1 — Super Admin
  if user.role == 'super_admin':
    return resource.church_id == user.church_id

  // Get servant (all roles below super_admin need a servant record)
  servant = getServant(user.id)
  if not servant or servant.approval_status != 'approved':
    return DENY

  // Get active assignments
  assignments = getActiveStageAssignments(servant.id)

  // L2 — Admin (service-scoped via system role or assignment role)
  if user.role == 'admin' or hasAssignmentWithRole(assignments, 'service_admin'):
    return resource.service_id IN getAssignedServiceIds(assignments)

  // L3 — Stage Leader (stage-wide access)
  if hasAssignmentWithRole(assignments, 'stage_leader'):
    return resource.stage_id IN getAssignedStageIds(assignments)

  // L3 — Class Leader (class-scoped access)
  if hasAssignmentWithRole(assignments, 'class_leader'):
    return resource.class_id IN getAssignedClassIds(assignments)

  // L4 — Servant (individual beneficiary access)
  if hasAssignmentWithRole(assignments, 'servant'):
    return isBeneficiaryAssignedToServant(resource.beneficiary_id, servant.id)

  // L5 — Self-owned
  if resource.owner_id == servant.id:
    return GRANT

  return DENY
```

### 4.3 Scope Resolution

| Access Level | Scope Identifier | How Determined |
|-------------|-----------------|----------------|
| L1 — Church | `church_id` | From profile |
| L2 — Service | `service_id` | From `user_roles` (admin role) OR `servant_stage_assignments` with `service_admin` role |
| L3 — Stage | `stage_id` | From `servant_stage_assignments` with `stage_leader` or `class_leader` role and `class_id IS NULL` |
| L3 — Class | `class_id` | From `servant_stage_assignments` with `class_leader` or `servant` role and `class_id IS NOT NULL` |
| L4 — Beneficiary | `beneficiary_id` | From `beneficiary_assignments` where `servant_id = user.servant.id` |
| L5 — Self | `servant_id` | From authenticated user |

---

## 5. Transfer Workflows

### 5.1 Beneficiary Transfer

```
ACTOR: super_admin OR admin (within their service scope)

1. Select beneficiary → "Transfer"
2. Select target stage (required) and optionally target class
3. Select target servant (required)
4. Provide transfer reason (required)
5. System:
   a. Validates target stage belongs to same service (or new service if cross-service)
   b. Validates target servant is approved
   c. Sets old assignment: is_current = false, end_date = now()
   d. Creates new assignment: is_current = true, start_date = now(), transfer_reason provided
   e. Writes audit log (old + new assignment details)
6. Result: Beneficiary appears in new stage/class/servant immediately

CONSTRAINTS:
  - Cross-service transfer requires super_admin (admin cannot transfer across services)
  - Transfer history is visible on beneficiary profile
  - Previous servant loses edit access; new servant gains access
```

### 5.2 Servant Reassignment (Annual Change)

```
ACTOR: super_admin

CONTEXT: Annual reassignment window (September)

1. Freeze period (2 weeks before): assignment changes are queued, not applied
2. Super admin uses reassignment UI to create new assignment plan
3. On go-live date:
   a. All current servant_stage_assignments get end_date = freeze_date
   b. New servant_stage_assignments created with start_date = go_live_date
   c. Notifications sent to all affected servants
4. Rollback window (48 hours): super admin can revert individual assignments
   a. Revert: set new assignment end_date = now(), restore old assignment end_date = NULL
```

### 5.3 Servant Departure

```
ACTOR: super_admin

1. Set servants.approval_status = 'rejected' OR servants.deleted_at = now()
2. All active servant_stage_assignments: end_date = now(), is_active = false
3. Beneficiaries under this servant: must be reassigned (blocked if not)
4. Open follow-ups: assigned_to updated to another servant (or closed)
```

---

## 6. Assignment Visibility Summary

| Role | Servant List | Stage Assignments | Class Assignments | Beneficiary Assignments |
|------|-------------|-------------------|-------------------|------------------------|
| platform_owner | Aggregate only | N/A | N/A | Aggregate only |
| super_admin | All in church | All in church | All in church | All in church |
| admin | In assigned services | In assigned services | In assigned services | In assigned services |
| service_admin | In assigned services | In assigned services | In assigned services | In assigned services |
| stage_leader | In assigned stage | In assigned stage | In assigned stage | All in assigned stage |
| class_leader | In assigned class | In assigned class | In assigned class | All in assigned class |
| servant | Own only | Own only | Own only | Individually assigned |
