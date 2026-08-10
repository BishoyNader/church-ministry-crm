-- ============================================================================
-- Church Ministry CRM — RBAC Arabic Display Terminology
-- Migration: 045_rbac_arabic_role_labels.sql
-- Action: Update the Arabic display labels of two church-scoped system roles:
--           admin          'مدير الخدمة'        -> 'أمين الخدمة أو الكاهن المسئول'
--           stage_manager  'مدير المرحلة'       -> 'أمين المرحلة'
--         English labels are unchanged ('Admin' / 'Stage Manager').
-- Scope guard: presentation + provisioning-path ONLY. No RBAC semantics, no
--   permission codes, no RLS policies, no RPC signatures are changed.
--   platform_owner ('مدير النظام') and super_admin ('مدير الكنيسة') are
--   intentionally untouched.
--        1. Re-create seed_church_roles() (single source of truth for newly
--           provisioned churches — mirrors 044 exactly except the two labels).
--        2. Idempotent UPDATE of EXISTING system roles, scoped to
--           is_system = true so user-created custom roles are never touched.
-- Dependencies: 044 (current seed_church_roles baseline incl. events bundle),
--               041 (previous terminology migration / PO conversion).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — Update existing system-role labels (idempotent; scoped to
-- is_system = true). Applies to every environment.
-- ============================================================================

UPDATE roles SET name_ar = 'أمين الخدمة أو الكاهن المسئول'
WHERE role_type = 'admin' AND is_system = true;

UPDATE roles SET name_ar = 'أمين المرحلة'
WHERE role_type = 'stage_manager' AND is_system = true;

-- ============================================================================
-- PART 2 — seed_church_roles(): new canonical Arabic labels.
--   Full copy of 044's body (events bundle included) with ONLY the admin and
--   stage_manager name_ar values changed. super_admin, servant, all permission
--   grants, and the events.read grants are unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_church_roles(p_church_id uuid)
RETURNS void AS $$
DECLARE
  v_role_id uuid;
BEGIN
  -- Super Admin role (all permissions EXCEPT platform-only modules; the
  -- module-based grant below automatically includes module 'events')
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'super_admin', 'مدير الكنيسة', 'Church Manager', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE module NOT IN ('tenants', 'system');

  -- Admin role (full ministry operations + notifications + settings + events)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'admin', 'أمين الخدمة أو الكاهن المسئول', 'Admin', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code IN (
    'users.read', 'users.update',
    'beneficiaries.read', 'beneficiaries.create', 'beneficiaries.update', 'beneficiaries.transfer',
    'services.read', 'services.update', 'services.delete',
    'stages.read', 'stages.create', 'stages.update',
    'classes.read', 'classes.create', 'classes.update', 'classes.delete',
    'servants.read', 'servants.create', 'servants.update', 'servants.assign',
    'attendance.read', 'attendance.create', 'attendance.export',
    'followups.read', 'followups.create', 'followups.update', 'followups.delete',
    'reports.read', 'reports.export',
    'notifications.read',
    'settings.read', 'settings.update',
    'import.execute', 'export.execute',
    'events.read', 'events.create', 'events.update', 'events.delete'
  );

  -- Stage Manager role (stage-scoped ministry operations; events read-only)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'stage_manager', 'أمين المرحلة', 'Stage Manager', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code IN (
    'beneficiaries.read', 'beneficiaries.create', 'beneficiaries.update', 'beneficiaries.transfer',
    'attendance.read', 'attendance.create', 'attendance.export',
    'followups.read', 'followups.create', 'followups.update', 'followups.delete',
    'services.read', 'stages.read', 'classes.read',
    'servants.read',
    'notifications.read',
    'reports.read',
    'events.read'
  );

  -- Servant role (events read-only)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'servant', 'خادم', 'Servant', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code IN (
    'beneficiaries.read', 'beneficiaries.update',
    'services.read', 'stages.read', 'classes.read',
    'attendance.create', 'attendance.read',
    'followups.create', 'followups.read', 'followups.update', 'followups.delete',
    'spiritual.create', 'spiritual.read',
    'notifications.read',
    'reports.read',
    'events.read'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
--   SELECT role_type, name_ar, name_en FROM roles
--   WHERE is_system = true ORDER BY role_type;
--   -- admin          | أمين الخدمة أو الكاهن المسئول | Admin
--   -- stage_manager  | أمين المرحلة                  | Stage Manager
--   -- super_admin    | مدير الكنيسة                  | Church Manager
--   -- servant        | خادم                          | Servant
--   -- platform_owner | مدير النظام                  | Platform Owner
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   Revert the two labels and restore seed_church_roles() from 044:
--     UPDATE roles SET name_ar = 'مدير الخدمة' WHERE role_type = 'admin' AND is_system = true;
--     UPDATE roles SET name_ar = 'مدير المرحلة' WHERE role_type = 'stage_manager' AND is_system = true;
--   then re-apply the 044 CREATE OR REPLACE FUNCTION seed_church_roles(...).
-- ============================================================================
