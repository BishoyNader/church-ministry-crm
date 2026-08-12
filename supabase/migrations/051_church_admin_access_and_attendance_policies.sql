-- ============================================================================
-- Church Ministry CRM — Church Admin Access + Attendance Edit/Remove Policies
-- Migration: 051_church_admin_access_and_attendance_policies.sql
-- Action:
--   1. Spiritual journal — the admin role (الكاهن المسؤول / أمين القطاع) was
--      seeded WITHOUT 'spiritual.read' / 'spiritual.create' (045/050), so the
--      Church Admin never saw the الجدول الروحي nav tab or its route. Grant
--      both codes to every existing system admin role, and update
--      seed_church_roles() so newly provisioned churches get them too.
--   2. attendance_records — the RLS write surface only allowed INSERT and
--      UPDATE of records where recorded_by = auth.uid() (027), with NO DELETE
--      policy for non-super-admins. That means:
--        * a second admin (or a stage manager) editing a session recorded by
--          someone else hit an RLS violation on the upsert UPDATE path, and
--          * the one-tap "remove attendance" toggle silently failed for admins.
--      Add scope-based UPDATE + DELETE policies: same church, 'attendance.create'
--      permission, and the record's session stage inside the actor's stage
--      scope (get_user_stage_ids — admins are church-wide, stage managers get
--      their assigned stages/services via 050). recorded_by is preserved on
--      the new row (the app always writes recorded_by = auth.uid()), so the
--      WITH CHECK keeps attribution intact.
--   3. Servant attendance — index for the new servant-attendance feature
--      (attendance_records.servant_id + status queries; the (session_id,
--      servant_id) unique constraint already exists from migration 048).
-- Dependencies: 021 (permissions), 045/050 (seed_church_roles baseline),
--               027 (record_attendance_update), 048 (session unique pair),
--               050 (get_user_stage_ids service-union for stage managers),
--               spiritual_journal_entries RLS (tenant_isolation SELECT, 027;
--               deny_admin_spiritual dropped, 048).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — SPIRITUAL JOURNAL: grant spiritual.* to existing admin roles
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('spiritual.read', 'spiritual.create')
WHERE r.role_type = 'admin'
  AND r.is_system = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 2 — seed_church_roles(): canonical admin role now includes spiritual.*
--   Full copy of the 050 body with ONLY the admin permission list extended by
--   'spiritual.read' and 'spiritual.create' (stage_manager / servant lists are
--   unchanged; stage managers keep the permission surface 050 defined).
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_church_roles(p_church_id uuid)
RETURNS void AS $$
DECLARE
  v_role_id uuid;
BEGIN
  -- Super Admin role (all permissions EXCEPT platform-only modules)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'super_admin', 'مدير الكنيسة', 'Church Manager', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE module NOT IN ('tenants', 'system');

  -- Admin role: الكاهن المسؤول / أمين القطاع (full ministry operations)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'admin', 'الكاهن المسؤول / أمين القطاع', 'Admin', true)
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
    'spiritual.read', 'spiritual.create',
    'reports.read', 'reports.export',
    'notifications.read',
    'settings.read', 'settings.update',
    'import.execute', 'export.execute',
    'events.read', 'events.create', 'events.update', 'events.delete'
  );

  -- Stage Manager role (أمين المرحلة; stage-scoped ministry operations)
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

  -- Servant role (خادم)
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
-- PART 3 — attendance_records: scope-based UPDATE + DELETE
--   update_scope / delete_scope let any authorized in-scope actor edit or
--   remove attendance for a session whose stage lies inside their scope. The
--   existing own-record policy (record_attendance_update) is preserved; the
--   scope policies ADD the shared-session editing path the UI needs. Deletes
--   were previously impossible for non-super-admins (no policy matched).
-- ============================================================================

DROP POLICY IF EXISTS scope_attendance_update ON attendance_records;
CREATE POLICY scope_attendance_update ON attendance_records
  FOR UPDATE
  USING (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('attendance.create', church_id)
    AND EXISTS (
      SELECT 1 FROM attendance_sessions s
      WHERE s.id = attendance_records.session_id
        AND s.stage_id = ANY(get_user_stage_ids())
    )
  )
  WITH CHECK (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('attendance.create', church_id)
    AND recorded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM attendance_sessions s
      WHERE s.id = attendance_records.session_id
        AND s.stage_id = ANY(get_user_stage_ids())
    )
  );

DROP POLICY IF EXISTS scope_attendance_delete ON attendance_records;
CREATE POLICY scope_attendance_delete ON attendance_records
  FOR DELETE
  USING (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('attendance.create', church_id)
    AND EXISTS (
      SELECT 1 FROM attendance_sessions s
      WHERE s.id = attendance_records.session_id
        AND s.stage_id = ANY(get_user_stage_ids())
    )
  );

-- ============================================================================
-- PART 4 — servant attendance index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_attendance_records_servant_status
  ON attendance_records (servant_id, status);

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Admin spiritual grants:
--   SELECT r.role_type, p.code FROM role_permissions rp
--   JOIN roles r ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id
--   WHERE r.role_type = 'admin' AND r.is_system = true
--     AND p.code IN ('spiritual.read', 'spiritual.create');
--   -- Every system admin role now holds both codes.
-- V2 — Attendance edit/remove smoke (as a plain admin, session recorded by
--   another user, stage inside scope):
--   UPDATE attendance_records SET status = 'present' WHERE id = '<id>';
--   DELETE FROM attendance_records WHERE id = '<id>';
--   -- Both succeed for in-scope stages; a stage OUTSIDE the actor's scope
--   -- still raises an RLS violation (no policy matches).
-- V3 — New policies present:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='attendance_records'
--   ORDER BY policyname;
--   -- scope_attendance_update (UPDATE) + scope_attendance_delete (DELETE).
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   DELETE FROM role_permissions rp USING roles r, permissions p
--   WHERE rp.role_id = r.id AND rp.permission_id = p.id
--     AND r.role_type = 'admin' AND r.is_system = true
--     AND p.code IN ('spiritual.read', 'spiritual.create');
--   DROP POLICY IF EXISTS scope_attendance_update ON attendance_records;
--   DROP POLICY IF EXISTS scope_attendance_delete ON attendance_records;
--   DROP INDEX IF EXISTS idx_attendance_records_servant_status;
-- ============================================================================
