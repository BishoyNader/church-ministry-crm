# Canonical RLS Specification

**Date:** 2026-07-30  
**Status:** Final — single source of truth  
**Supersedes:** RLS_IMPLEMENTATION_PLAN.md  

---

## 1. Helper Functions

```sql
-- Auth context
CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS uuid AS $$
  SELECT church_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_servant_id()
RETURNS uuid AS $$
  SELECT id FROM servants WHERE id = auth.uid() AND deleted_at IS NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Role checks
CREATE OR REPLACE FUNCTION user_is_platform_owner()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type = 'platform_owner'
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

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

-- Scope resolution
CREATE OR REPLACE FUNCTION get_user_service_ids()
RETURNS uuid[] AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_super_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM services WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.service_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND ssa.end_date IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

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

CREATE OR REPLACE FUNCTION get_user_assigned_beneficiary_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY(
    SELECT ba.beneficiary_id
    FROM beneficiary_assignments ba
    WHERE ba.servant_id = auth.uid()
      AND ba.is_current = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## 2. Table-by-Table RLS Policies

### 2.1 `churches`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_read | SELECT | `id = get_user_church_id()` |
| platform_owner_all | ALL | `user_is_platform_owner()` |
| super_admin_update | UPDATE | `id = get_user_church_id() AND user_is_super_admin(id)` |

### 2.2 `services`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `id = ANY(get_user_service_ids())` |
| admin_write | INSERT/UPDATE | `church_id = get_user_church_id() AND user_is_admin(church_id)` |

### 2.3 `stages`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `service_id = ANY(get_user_service_ids())` |
| admin_write | INSERT/UPDATE/DELETE | `church_id = get_user_church_id() AND user_is_admin(church_id)` |

### 2.4 `classes`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `stage_id = ANY(get_user_stage_ids())` |
| admin_write | INSERT/UPDATE/DELETE | `church_id = get_user_church_id() AND user_is_admin(church_id)` |

### 2.5 `profiles`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | SELECT | `church_id = get_user_church_id()` |
| own_profile | INSERT/UPDATE | `id = auth.uid()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_scoped | SELECT | `user_is_admin(church_id) AND church_id = get_user_church_id()` |

### 2.6 `servants`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `church_id = get_user_church_id() AND (id = auth.uid() OR EXISTS (SELECT 1 FROM servant_stage_assignments ssa WHERE ssa.servant_id = servants.id AND ssa.service_id = ANY(get_user_service_ids()) AND ssa.is_active = true AND ssa.end_date IS NULL))` |

### 2.7 `servant_stage_assignments`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `user_is_admin(church_id) OR service_id = ANY(get_user_service_ids())` |
| admin_write | INSERT/UPDATE | `user_is_admin(church_id)` |
| own_read | SELECT | `servant_id = auth.uid()` |

### 2.8 `beneficiaries`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `EXISTS (SELECT 1 FROM beneficiary_assignments ba WHERE ba.beneficiary_id = beneficiaries.id AND ba.service_id = ANY(get_user_service_ids()) AND ba.is_current = true)` |
| servant_read | SELECT | `EXISTS (SELECT 1 FROM beneficiary_assignments ba WHERE ba.beneficiary_id = beneficiaries.id AND (ba.servant_id = auth.uid() OR (ba.stage_id = ANY(get_user_stage_ids()) AND EXISTS (SELECT 1 FROM servant_stage_assignments ssa WHERE ssa.servant_id = auth.uid() AND ssa.stage_id = ba.stage_id AND ssa.role IN ('stage_leader', 'class_leader') AND ssa.is_active = true AND ssa.end_date IS NULL)) OR (ba.class_id = ANY(get_user_class_ids()) AND EXISTS (SELECT 1 FROM servant_stage_assignments ssa WHERE ssa.servant_id = auth.uid() AND ssa.class_id = ba.class_id AND ssa.is_active = true AND ssa.end_date IS NULL))) AND ba.is_current = true)` |
| admin_write | INSERT/UPDATE | `user_is_admin(church_id)` |

### 2.9 `beneficiary_assignments`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `service_id = ANY(get_user_service_ids())` |
| admin_write | INSERT | `user_is_admin(church_id)` |
| own_read | SELECT | `servant_id = auth.uid() AND is_current = true` |
| immutable | UPDATE/DELETE | **DENY** — enforced via trigger (Phase 2) or app-level (MVP) |

### 2.10 `attendance_sessions`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `service_id = ANY(get_user_service_ids())` |
| stage_scope | INSERT/SELECT | `stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids())` |

### 2.11 `attendance_records`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| session_scope | SELECT | `EXISTS (SELECT 1 FROM attendance_sessions WHERE id = session_id AND (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids())))` |
| record_attendance | INSERT | `church_id = get_user_church_id() AND recorded_by = auth.uid()` |

### 2.12 `followups`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| admin_read | SELECT | `EXISTS (SELECT 1 FROM beneficiary_assignments ba WHERE ba.beneficiary_id = followups.beneficiary_id AND ba.service_id = ANY(get_user_service_ids()) AND ba.is_current = true)` |
| own_all | ALL | `servant_id = auth.uid()` |

### 2.13 `spiritual_journal_entries`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| servant_owner | ALL | `servant_id = auth.uid()` |
| priest_read | SELECT | `user_is_super_admin(church_id)` |

**Restrictive policy (blocks admin):**
```sql
CREATE POLICY deny_admin_spiritual ON spiritual_journal_entries
  AS RESTRICTIVE FOR ALL
  USING (NOT (user_is_admin(church_id) AND NOT user_is_super_admin(church_id)));
```

### 2.14 `notifications`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| recipient_scope | ALL | `recipient_id = auth.uid()` |
| super_admin_read | SELECT | `user_is_super_admin(church_id)` |

### 2.15 `audit_logs`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | SELECT | `church_id = get_user_church_id()` |
| super_admin_read | SELECT | `user_is_super_admin(church_id)` |
| platform_owner_read | SELECT | `user_is_platform_owner()` |
| append_only | INSERT | `true` (any authenticated user) |
| immutable | UPDATE/DELETE | **DENY** — enforced via app (MVP) / trigger (Phase 2) |

### 2.16 `roles`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| read_all | SELECT | `church_id = get_user_church_id()` |

### 2.17 `permissions`

| Policy | Operation | Rule |
|--------|-----------|------|
| read_all | SELECT | `true` |
| platform_owner_write | INSERT/UPDATE/DELETE | `user_is_platform_owner()` |

### 2.18 `role_permissions`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())` |
| super_admin_all | ALL | `user_is_super_admin(get_user_church_id())` |
| read_all | SELECT | `role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())` |

### 2.19 `user_roles`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| own_read | SELECT | `user_id = auth.uid()` |
| admin_read | SELECT | `user_is_admin(church_id)` |

### 2.20 `events`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| stage_scope | SELECT | `stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()) OR service_id = ANY(get_user_service_ids())` |

### 2.21 `event_registrations`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| servant_scope | SELECT | `beneficiary_id IN (SELECT beneficiary_id FROM beneficiary_assignments WHERE servant_id = auth.uid() AND is_current = true)` |

### 2.22 `documents`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| super_admin_all | ALL | `user_is_super_admin(church_id)` |
| owner_scope | ALL | `uploaded_by = auth.uid()` |

### 2.23 `ai_conversations`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| owner_scope | ALL | `user_id = auth.uid()` |

### 2.24 `ai_messages`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| owner_scope | ALL | `user_id = auth.uid()` |

### 2.25 `document_embeddings`

| Policy | Operation | Rule |
|--------|-----------|------|
| tenant_isolation | ALL | `church_id = get_user_church_id()` |
| owner_scope | ALL | `user_id = auth.uid()` |

---

## 3. Policy Count Summary

| Table | Policies | Notes |
|-------|----------|-------|
| churches | 3 | |
| services | 4 | |
| stages | 4 | |
| classes | 4 | |
| profiles | 4 | |
| servants | 3 | |
| servant_stage_assignments | 5 | |
| beneficiaries | 5 | servant_read covers stage_leader/class_leader + individual |
| beneficiary_assignments | 6 | includes immutable deny |
| attendance_sessions | 4 | |
| attendance_records | 4 | |
| followups | 4 | |
| spiritual_journal_entries | 4 | 3 permissive + 1 restrictive |
| notifications | 3 | |
| audit_logs | 5 | |
| roles | 3 | |
| permissions | 2 | |
| role_permissions | 3 | |
| user_roles | 4 | |
| events | 4 | |
| event_registrations | 3 | |
| documents | 3 | |
| ai_conversations | 2 | |
| ai_messages | 2 | |
| document_embeddings | 2 | |
| **Total** | **89** | |

---

## 4. Key Policy Logic Changes from Prior Spec

| Change | Reason |
|--------|--------|
| `servant_read` on `beneficiaries` now checks `role IN ('stage_leader', 'class_leader')` | Resolves Conflict 1 — assignment roles now use `stage_leader`/`class_leader` values |
| `event_registrations` now uses `beneficiary_id` | Resolves Conflict 3 — column renamed from `child_id` |
| `events` now filters on `service_id` via `get_user_service_ids()` | Resolves Conflict 2 — events FK updated to services |
| Added `get_user_assigned_beneficiary_ids()` helper | Simplifies servant-level beneficiary access checks |
| `spiritual_journal_entries` uses explicit restrictive policy to block admin | Ensures privacy invariant — admin NEVER has access |
