# RLS Implementation Plan

**Date:** 2026-07-30
**Source Documents:** PRD_V3.md, DATABASE_REQUIREMENTS.md, RBAC_ARCHITECTURE.md, SYSTEM_ARCHITECTURE.md, CLASS_ACCESS_ARCHITECTURE.md

---

## 1. RLS Pattern per Table

Every tenant-scoped table follows a consistent pattern. Below is the complete specification for each table after Phase 1B migration.

### 1.1 Helper Functions

```sql
-- Returns the church_id of the currently authenticated user
CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS uuid AS $$
  SELECT church_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Returns the servant_id if the user has one, NULL otherwise
CREATE OR REPLACE FUNCTION get_user_servant_id()
RETURNS uuid AS $$
  SELECT id FROM servants WHERE id = auth.uid() AND deleted_at IS NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Returns true if the user is a super_admin in the given church
CREATE OR REPLACE FUNCTION user_is_super_admin(p_church_id uuid DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := COALESCE(p_church_id, get_user_church_id());
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type = 'super_admin'
      AND ur.church_id = v_church_id
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Returns true if the user is an admin (church-level or service-level)
CREATE OR REPLACE FUNCTION user_is_admin(p_church_id uuid DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := COALESCE(p_church_id, get_user_church_id());
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type IN ('super_admin', 'admin')
      AND ur.church_id = v_church_id
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Returns the set of service_ids the user has access to
-- NULL = all services (super_admin)
CREATE OR REPLACE FUNCTION get_user_service_ids()
RETURNS uuid[] AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  -- Super admin sees all
  IF user_is_super_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM services WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  -- Admin or user — get from servant_stage_assignments
  RETURN ARRAY(
    SELECT DISTINCT ssa.service_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND ssa.end_date IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Returns the set of stage_ids the user has access to
CREATE OR REPLACE FUNCTION get_user_stage_ids()
RETURNS uuid[] AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_super_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM stages WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.stage_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND ssa.end_date IS NULL
      AND ssa.stage_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Returns the set of class_ids the user has access to
CREATE OR REPLACE FUNCTION get_user_class_ids()
RETURNS uuid[] AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_super_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM classes WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.class_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND ssa.end_date IS NULL
      AND ssa.class_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

---

## 2. Table-by-Table RLS Policies

### 2.1 `churches`

| Policy | Type | Rule |
|--------|------|------|
| tenant_read | SELECT | `id = get_user_church_id()` — users see only their own church |
| platform_owner_all | ALL | `auth.uid() IN (SELECT user_id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.role_type = 'platform_owner')` |
| super_admin_update | UPDATE | `id = get_user_church_id() AND user_is_super_admin(id)` |

---

### 2.2 `services`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `id = ANY(get_user_service_ids())` |
| admin_write | INSERT/UPDATE | `church_id = get_user_church_id() AND user_is_admin(church_id)` |

---

### 2.3 `stages`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `service_id = ANY(get_user_service_ids())` |
| admin_write | INSERT/UPDATE/DELETE | `church_id = get_user_church_id() AND user_is_admin(church_id)` OR `service_id = ANY(get_user_service_ids())` |

---

### 2.4 `classes`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `stage_id = ANY(get_user_stage_ids())` |
| admin_write | INSERT/UPDATE/DELETE | `church_id = get_user_church_id() AND (user_is_admin(church_id) OR service_id = ANY(get_user_service_ids()))` |

---

### 2.5 `profiles`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | SELECT | `church_id = get_user_church_id()` |
| own_profile | INSERT/UPDATE | `id = auth.uid()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_scoped | SELECT | `user_is_admin(church_id)` AND `church_id = get_user_church_id()` |

**Note:** Standard users can only see profiles within their church. Super admins see all. Admins see profiles of servants in their assigned services.

---

### 2.6 `servants`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `church_id = get_user_church_id() AND (id = auth.uid() OR service_id IN (SELECT unnest(get_user_service_ids())))` |

**Joins to resolve:** `servants` does not have `service_id`. Admin access to servants must go through `servant_stage_assignments`:

```sql
CREATE POLICY admin_read_servants ON servants FOR SELECT
  USING (
    church_id = get_user_church_id()
    AND (
      user_is_super_admin(church_id)
      OR id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM servant_stage_assignments ssa
        WHERE ssa.servant_id = servants.id
          AND ssa.service_id = ANY(get_user_service_ids())
          AND ssa.is_active = true
          AND ssa.end_date IS NULL
      )
    )
  );
```

---

### 2.7 `servant_stage_assignments`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `user_is_admin(church_id)` OR `service_id = ANY(get_user_service_ids())` |
| admin_write | INSERT/UPDATE | `user_is_admin(church_id)` OR `service_id = ANY(get_user_service_ids())` |
| own_read | SELECT | `servant_id = auth.uid()` (servants see their own assignments) |

---

### 2.8 `beneficiaries`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `EXISTS (SELECT 1 FROM beneficiary_assignments ba WHERE ba.beneficiary_id = beneficiaries.id AND ba.service_id = ANY(get_user_service_ids()) AND ba.is_current = true)` |
| servant_read | SELECT | `EXISTS (SELECT 1 FROM beneficiary_assignments ba WHERE ba.beneficiary_id = beneficiaries.id AND ba.servant_id = auth.uid() AND ba.is_current = true)` |
| admin_write | INSERT/UPDATE | `user_is_admin(church_id)` |

---

### 2.9 `beneficiary_assignments`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `service_id = ANY(get_user_service_ids())` |
| admin_write | INSERT | `user_is_admin(church_id)` OR `service_id = ANY(get_user_service_ids())` |
| own_read | SELECT | `servant_id = auth.uid()` AND `is_current = true` |
| immutable | UPDATE/DELETE | **DENY** — beneficiary_assignments is immutable. New rows only. |

---

### 2.10 `attendance_sessions`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `service_id = ANY(get_user_service_ids())` |
| stage_scope | INSERT/SELECT | `stage_id = ANY(get_user_stage_ids())` OR `class_id = ANY(get_user_class_ids())` |
| record_attendance | INSERT | `church_id = get_user_church_id() AND (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()))` |

---

### 2.11 `attendance_records`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| session_scope | SELECT | `EXISTS (SELECT 1 FROM attendance_sessions WHERE id = session_id AND (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids())))` |
| record_attendance | INSERT | `church_id = get_user_church_id() AND recorded_by = auth.uid()` |

---

### 2.12 `followups`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `EXISTS (SELECT 1 FROM beneficiary_assignments ba WHERE ba.beneficiary_id = followups.beneficiary_id AND ba.service_id = ANY(get_user_service_ids()) AND ba.is_current = true)` |
| own_all | ALL | `servant_id = auth.uid()` |

---

### 2.13 `spiritual_journal_entries`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| servant_owner | ALL | `servant_id = auth.uid()` |
| priest_read | SELECT | `user_is_super_admin(church_id)` |
| no_admin | ALL | **Admin role has NO access** — denied by exclusion |

**Explicit deny for admin:**
```sql
CREATE POLICY deny_admin_access ON spiritual_journal_entries
  AS RESTRICTIVE
  FOR ALL
  USING (
    NOT (user_is_admin(church_id) AND NOT user_is_super_admin(church_id))
  );
```

**Note:** `user_is_super_admin` already excludes `platform_owner`. Add restrictive policy to block `admin`.

---

### 2.14 `notifications`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| recipient_scope | ALL | `recipient_id = auth.uid()` (most restrictive — users see only their own) |
| super_admin_read | SELECT | `user_is_super_admin(church_id)` (priest can see all notifications in church) |

---

### 2.15 `audit_logs`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | SELECT | `church_id = get_user_church_id()` |
| super_admin_read | SELECT | `user_is_super_admin(church_id)` |
| platform_owner_read | SELECT | `auth.uid() IN (SELECT user_id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.role_type = 'platform_owner')` |
| append_only | INSERT | `true` (any authenticated user can insert audit logs via app code) |
| immutable | UPDATE/DELETE | **DENY** — enforced via trigger |

---

### 2.16 `roles`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| read_all | SELECT | `church_id = get_user_church_id()` (any authenticated user can see available roles) |

---

### 2.17 `permissions`

| Policy | Type | Rule |
|--------|------|------|
| read_all | SELECT | `true` (any authenticated user can see available permission codes) |
| platform_owner_write | INSERT/UPDATE/DELETE | `auth.uid() IN (SELECT user_id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.role_type = 'platform_owner')` |

---

### 2.18 `role_permissions`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())` |
| super_admin_all | ALL | `user_is_super_admin(get_user_church_id())` |
| read_all | SELECT | `role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())` |

---

### 2.19 `user_roles`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| own_read | SELECT | `user_id = auth.uid()` (users see their own role assignments) |
| admin_read | SELECT | `user_is_admin(church_id)` |

---

### 2.20 `events`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| stage_scope | SELECT | `stage_id = ANY(get_user_stage_ids())` OR `class_id = ANY(get_user_class_ids())` OR `ministry_id = ANY(get_user_service_ids())` |

---

### 2.21 `event_registrations`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| servant_scope | SELECT | `child_id IN (SELECT beneficiary_id FROM beneficiary_assignments WHERE servant_id = auth.uid() AND is_current = true)` |

---

### 2.22 `documents`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| owner_scope | ALL | `uploaded_by = auth.uid()` |

---

### 2.23 `ai_conversations` / `ai_messages` / `document_embeddings`

| Policy | Type | Rule |
|--------|------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| owner_scope | ALL | `user_id = auth.uid()` (for conversations and messages) |

---

## 3. Policy Application Order

PostgreSQL applies policies in this order:

1. **All permissive policies** are combined with OR (if any permits, access is granted)
2. **All restrictive policies** are combined with AND (all must pass)

**Design principle:** Default to permissive policies that overlap. Restrictive policies only used for:
- `spiritual_journal_entries` — deny admin access even if other policies would allow it

---

## 4. Super Admin Visibility Rules

Super Admin bypass is implemented as a permissive policy on every table:

```sql
CREATE POLICY super_admin_all ON <table>
  FOR ALL
  USING (user_is_super_admin(church_id));
```

This gives the super admin access to ALL rows in their church, regardless of other scoping policies.

**Exception:** `spiritual_journal_entries` — super admin gets SELECT only, via separate policy:

```sql
CREATE POLICY super_admin_read_spiritual ON spiritual_journal_entries
  FOR SELECT
  USING (user_is_super_admin(church_id));
```

---

## 5. Servant Ownership Rules

Servants see only their own data:

| Data | Servant Access | Condition |
|------|---------------|-----------|
| Own profile | ✅ Full | `id = auth.uid()` |
| Assigned beneficiaries | ✅ Full | `beneficiary_assignments.servant_id = auth.uid()` AND `is_current = true` |
| Their attendance records | ✅ Full | `recorded_by = auth.uid()` |
| Own follow-ups | ✅ Full | `servant_id = auth.uid()` |
| Own spiritual journal | ✅ Full | `servant_id = auth.uid()` |
| Own notifications | ✅ Read-only | `recipient_id = auth.uid()` |
| Own assignments | ✅ Read-only | `servant_id = auth.uid()` |
| Servant list | ❌ Denied | Unless super_admin or admin |
| Other beneficiaries | ❌ Denied | Unless stage-wide assignment with stage_leader role |

---

## 6. Class Visibility Rules

Class-level visibility is enforced via `get_user_class_ids()`:

```sql
-- Servant sees beneficiaries in their assigned classes
CREATE POLICY servant_class_scope ON beneficiaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM beneficiary_assignments ba
      WHERE ba.beneficiary_id = beneficiaries.id
        AND ba.class_id = ANY(get_user_class_ids())
        AND ba.is_current = true
    )
  );
```

Combined with stage-level visibility via `get_user_stage_ids()`:

```sql
CREATE POLICY servant_stage_scope ON beneficiaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM beneficiary_assignments ba
      WHERE ba.beneficiary_id = beneficiaries.id
        AND ba.stage_id = ANY(get_user_stage_ids())
        AND ba.is_current = true
        -- Stage-wide assignment (class_id IS NULL in servant_stage_assignments)
        AND EXISTS (
          SELECT 1 FROM servant_stage_assignments ssa
          WHERE ssa.servant_id = auth.uid()
            AND ssa.stage_id = ba.stage_id
            AND ssa.class_id IS NULL  -- stage-wide
            AND ssa.is_active = true
            AND ssa.end_date IS NULL
        )
    )
  );
```

---

## 7. Stage Visibility Rules

Stage visibility follows the same pattern as class visibility but without the class filter:

| Assignment Pattern | Stage Access | Class Access |
|-------------------|-------------|-------------|
| `stage_id` set, `class_id` NULL | ✅ All beneficiaries in stage | ✅ All classes in stage |
| `stage_id` set, `class_id` set | ❌ (scoped to class) | ✅ Only that class |
| `stage_id` NULL, `class_id` set | ❌ | ✅ Only that class |

---

## 8. Platform Owner Visibility

Platform owner operates in a **separate interface** with **no PII access**:

```sql
-- Platform owner sees only aggregate data
CREATE POLICY platform_owner_churches ON churches FOR ALL
  USING (auth.uid() IN (SELECT ...platform_owner...));

-- Platform owner sees aggregate views only
CREATE VIEW church_aggregates AS
SELECT
  c.id,
  c.name_ar,
  c.subscription_tier,
  c.subscription_status,
  c.trial_ends_at,
  c.created_at,
  COUNT(DISTINCT s.id) AS servant_count,
  COUNT(DISTINCT b.id) AS beneficiary_count,
  COUNT(DISTINCT att.id) AS attendance_record_count
FROM churches c
LEFT JOIN servants s ON s.church_id = c.id AND s.deleted_at IS NULL
LEFT JOIN beneficiaries b ON b.church_id = c.id AND b.deleted_at IS NULL
LEFT JOIN attendance_records att ON att.church_id = c.id
GROUP BY c.id;

-- The app's admin interface queries ONLY the aggregate view
```

---

## 9. RLS Policy Naming Convention

| Prefix | Purpose |
|--------|---------|
| `tenant_isolation_` | Church ID scoping (all tables) |
| `super_admin_` | Super admin bypass |
| `admin_` | Admin-level access (service-scoped) |
| `servant_` | User-level access (stage/class scoped) |
| `own_` | Self-owned records only |
| `platform_owner_` | Platform owner access |
| `immutable_` | Blocks UPDATE/DELETE |
| `deny_` | Explicit deny (restrictive) |

**Example names:**
- `tenant_isolation_beneficiaries`
- `super_admin_all_beneficiaries`
- `admin_read_beneficiaries`
- `servant_read_beneficiaries`
- `deny_admin_spiritual_journal`

---

## 10. Policy Count Summary

| Table | Policies | RLS Enabled |
|-------|----------|-------------|
| churches | 3 | ✅ |
| services | 4 | ✅ |
| stages | 4 | ✅ |
| classes | 4 | ✅ |
| profiles | 4 | ✅ |
| servants | 3 | ✅ |
| servant_stage_assignments | 5 | ✅ |
| beneficiaries | 5 | ✅ |
| beneficiary_assignments | 6 | ✅ |
| attendance_sessions | 5 | ✅ |
| attendance_records | 4 | ✅ |
| followups | 4 | ✅ |
| spiritual_journal_entries | 4 | ✅ |
| notifications | 3 | ✅ |
| audit_logs | 5 | ✅ |
| roles | 3 | ✅ |
| permissions | 2 | ✅ |
| role_permissions | 3 | ✅ |
| user_roles | 4 | ✅ |
| events | 4 | ✅ |
| event_registrations | 3 | ✅ |
| documents | 3 | ✅ |
| ai_conversations | 2 | ✅ |
| ai_messages | 2 | ✅ |
| document_embeddings | 2 | ✅ |

**Total: ~93 policies across 24 tables**
