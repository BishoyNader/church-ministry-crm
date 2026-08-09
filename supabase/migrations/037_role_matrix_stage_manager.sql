-- ============================================================================
-- Church Ministry CRM — Role Matrix Correction + Stage Manager Role
-- Migration: 037_role_matrix_stage_manager.sql
-- Action: Sprint 2 — Permission Matrix Review (Phase 4).
--   1. Ensure 'stage_manager' is in user_role_type (no-op — committed by 036).
--   2. Rebuild seed_church_roles(): fix the admin role's missing operational
--      permissions (attendance.create, follow-ups CRUD, notifications.read,
--      settings.read/update, services.update/delete, classes.delete,
--      servants.create) and add the stage_manager system role (stage-scoped
--      ministry operations).
--   3. Backfill EXISTING churches idempotently:
--        a. add the corrected permissions to existing admin roles, and
--        b. create + permission the stage_manager system role where missing.
-- Security posture: pure role/permission data changes. RLS policies,
-- SECURITY DEFINER functions, tenant isolation and audit triggers are
-- untouched. Stage access remains bound by servant_stage_assignments rows via
-- the existing user_has_stage_access() policies — a stage_manager without
-- stage assignments has no stage scope.
-- Dependency: seed_church_roles baseline is 028 (super_admin excludes
-- platform-only modules 'tenants'/'system').
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: ENUM — ensure stage_manager exists (no-op; committed by 036)
-- ============================================================================

ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'stage_manager';

-- ============================================================================
-- PART 2: seed_church_roles — corrected admin set + stage_manager role
-- (applies to churches provisioned after this migration)
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_church_roles(p_church_id uuid)
RETURNS void AS $$
DECLARE
  v_role_id uuid;
BEGIN
  -- Super Admin role (all permissions EXCEPT platform-only modules)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'super_admin', 'مدير النظام', 'Super Admin', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE module NOT IN ('tenants', 'system');

  -- Admin role (corrected: full ministry operations + notifications + settings)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'admin', 'مدير الخدمة', 'Admin', true)
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
    'import.execute', 'export.execute'
  );

  -- Stage Manager role (stage-scoped ministry operations)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'stage_manager', 'مدير المرحلة', 'Stage Manager', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code IN (
    'beneficiaries.read', 'beneficiaries.create', 'beneficiaries.update',
    'attendance.read', 'attendance.create', 'attendance.export',
    'followups.read', 'followups.create', 'followups.update', 'followups.delete',
    'services.read', 'stages.read', 'classes.read',
    'servants.read',
    'notifications.read',
    'reports.read'
  );

  -- Servant role
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
    'reports.read'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 3: Backfill EXISTING churches (idempotent)
-- ============================================================================

DO $$
DECLARE
  v_church RECORD;
  v_admin_id uuid;
  v_sm_id uuid;
BEGIN
  FOR v_church IN SELECT id FROM churches LOOP
    -- a. Admin role: add the corrected operational permissions
    SELECT id INTO v_admin_id
    FROM roles
    WHERE church_id = v_church.id AND role_type = 'admin' AND is_system = true
    LIMIT 1;

    IF v_admin_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT v_admin_id, p.id FROM permissions p
      WHERE p.code IN (
        'attendance.create',
        'followups.create', 'followups.update', 'followups.delete',
        'notifications.read', 'settings.read', 'settings.update',
        'services.update', 'services.delete', 'classes.delete',
        'servants.create'
      )
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = v_admin_id AND rp.permission_id = p.id
      );
    END IF;

    -- b. Stage Manager system role + permissions
    SELECT id INTO v_sm_id
    FROM roles
    WHERE church_id = v_church.id AND role_type = 'stage_manager' AND is_system = true
    LIMIT 1;

    IF v_sm_id IS NULL THEN
      INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
      VALUES (v_church.id, 'stage_manager', 'مدير المرحلة', 'Stage Manager', true)
      RETURNING id INTO v_sm_id;
    END IF;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_sm_id, p.id FROM permissions p
    WHERE p.code IN (
      'beneficiaries.read', 'beneficiaries.create', 'beneficiaries.update',
      'attendance.read', 'attendance.create', 'attendance.export',
      'followups.read', 'followups.create', 'followups.update', 'followups.delete',
      'services.read', 'stages.read', 'classes.read',
      'servants.read',
      'notifications.read',
      'reports.read'
    )
    AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = v_sm_id AND rp.permission_id = p.id
    );
  END LOOP;
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
--   SELECT unnest(enum_range(NULL::user_role_type));  -- includes stage_manager
--   SELECT r.role_type, count(rp.id)
--   FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id
--   WHERE r.is_system GROUP BY r.role_type ORDER BY r.role_type;
--   -- super_admin ~= all non-platform codes, admin ~34, stage_manager ~16, servant ~13
--   SELECT role_type FROM roles WHERE role_type='stage_manager' AND is_system;
--   -- Should return one row per church.
--   -- Confirm the gate fix: admin roles now have attendance.create +
--   -- followups.* + settings.read + notifications.read (see PART 3a list).
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   ALTER TYPE user_role_type RENAME TO user_role_type_new;
--   CREATE TYPE user_role_type AS ENUM ('platform_owner','super_admin','admin','servant');
--   ALTER TABLE roles ALTER COLUMN role_type TYPE user_role_type USING role_type::text::user_role_type;
--   DROP TYPE user_role_type_new;
--   -- Restore seed_church_roles to the 028 definition (see migration 028 F3a).
--   DELETE FROM roles WHERE role_type = 'stage_manager';
--   DELETE FROM role_permissions WHERE role_id IN
--     (SELECT id FROM roles WHERE role_type = 'stage_manager');
--   -- Note: the admin role additions are additive and can be removed with a
--   -- targeted DELETE by permission code; the primary rollback path is the
--   -- pre-037 database backup snapshot.
-- ============================================================================
