-- ============================================================================
-- Church Ministry CRM — Events Activation
-- Migration: 044_activate_events.sql
-- Action: Reactivate the Events module. The events table, event_type enum, and
--         RLS policies already exist (001/022/027), but the events.* permission
--         codes were removed from the catalog in 021, so no role could grant
--         them and no Events UI could be gated on them.
--         1. Re-insert events.read/create/update/delete into the permission
--            catalog (module 'events', canonical labels from 003).
--         2. Add an admin_write RLS policy on events so the admin role (and any
--            holder of events.create/update/delete) can actually manage events —
--            services/stages/classes already follow this admin_write pattern
--            (022:198/202/208/214), events was the only service-level table
--            without it.
--         3. Update seed_church_roles(): admin gets the full events bundle;
--            stage_manager and servant get events.read (matching the existing
--            tenant_isolation/stage_scope SELECT read model). Super Admin is
--            unchanged (module-based grant already includes module 'events').
--         4. Idempotent backfill of existing system roles.
-- Dependencies: 003 (canonical events.* labels), 021 (catalog removal),
--               022 (RLS helpers user_is_admin / get_user_church_id),
--               041 (current seed_church_roles baseline).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — Re-add the events.* permission codes (canonical labels from 003)
-- ============================================================================

INSERT INTO permissions (code, name_ar, name_en, module) VALUES
  ('events.read',   'عرض الفعاليات', 'View Events',   'events'),
  ('events.create', 'إضافة فعالية',  'Create Event',  'events'),
  ('events.update', 'تعديل فعالية',  'Update Event',  'events'),
  ('events.delete', 'حذف فعالية',    'Delete Event',  'events')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- PART 2 — admin_write RLS policy on events
--   Mirrors services/stages/classes (022): admins (user_is_admin includes
--   super_admin) may manage any event in their church; everyone else keeps the
--   existing SELECT-only tenant_isolation / stage_scope read model.
-- ============================================================================

DROP POLICY IF EXISTS admin_write ON events;
CREATE POLICY admin_write ON events
  FOR ALL USING (church_id = get_user_church_id() AND user_is_admin(church_id));

-- ============================================================================
-- PART 3 — seed_church_roles(): grant events to the canonical roles
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
    'import.execute', 'export.execute',
    'events.read', 'events.create', 'events.update', 'events.delete'
  );

  -- Stage Manager role (stage-scoped ministry operations; events read-only)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'stage_manager', 'مدير المرحلة', 'Stage Manager', true)
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

-- ============================================================================
-- PART 4 — Idempotent backfill of EXISTING system roles
--   super_admin: every events.* code (module-based grant already includes the
--                module, but existing roles were granted row-by-row at
--                provisioning time, so add the missing rows explicitly).
--   admin:       full events bundle.
--   stage_manager / servant: events.read.
-- ============================================================================

DO $$
DECLARE
  v_perm record;
BEGIN
  -- super_admin: all events.*
  FOR v_perm IN SELECT id FROM permissions WHERE module = 'events' LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, v_perm.id
    FROM roles r
    WHERE r.role_type = 'super_admin' AND r.is_system = true
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = r.id AND rp.permission_id = v_perm.id
      );
  END LOOP;

  -- admin: all events.*
  FOR v_perm IN SELECT id FROM permissions WHERE module = 'events' LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, v_perm.id
    FROM roles r
    WHERE r.role_type = 'admin' AND r.is_system = true
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = r.id AND rp.permission_id = v_perm.id
      );
  END LOOP;

  -- stage_manager / servant: events.read
  SELECT id INTO v_perm FROM permissions WHERE code = 'events.read';
  IF v_perm.id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, v_perm.id
    FROM roles r
    WHERE r.role_type IN ('stage_manager', 'servant') AND r.is_system = true
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = r.id AND rp.permission_id = v_perm.id
      );
  END IF;
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
--   SELECT code, module FROM permissions WHERE module = 'events' ORDER BY code;
--   -- 4 rows: events.read / events.create / events.update / events.delete
--   SELECT r.role_type, p.code, count(*) FROM roles r
--   JOIN role_permissions rp ON rp.role_id = r.id
--   JOIN permissions p ON p.id = rp.permission_id
--   WHERE r.is_system AND p.module = 'events'
--   GROUP BY r.role_type, p.code ORDER BY r.role_type, p.code;
--   -- super_admin & admin: 4 codes each; stage_manager & servant: 1 code each
--   SELECT polname FROM pg_policies WHERE tablename = 'events' ORDER BY polname;
--   -- tenant_isolation, super_admin_all, stage_scope, admin_write
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   DELETE FROM permissions WHERE code LIKE 'events.%';
--   DROP POLICY IF EXISTS admin_write ON events;
--   Restore seed_church_roles() from 041 (labels + code lists without the
--   events bundle). Remove the events.* rows added to existing roles with a
--   targeted DELETE by (role_id, permission_id).
-- ============================================================================
