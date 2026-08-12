-- ============================================================================
-- Church Ministry CRM — Servant Service Assignments + Role Assignment Rules
-- Migration: 050_servant_service_assignments_and_role_rules.sql
-- Action:
--   1. servant_service_assignments — service-level servant assignments
--      (church_id, servant_id, service_id, is_active, start_date, end_date,
--      assigned_by) with the same RLS surface as servant_stage_assignments
--      (tenant SELECT + servants.assign / admin writes).
--   2. create_church_user() extended with p_service_ids and the role rules:
--        admin          -> one or more services, no stage required
--        stage_manager  -> exactly ONE service, no stage required
--        servant        -> exactly ONE service + exactly ONE stage IN that service
--      and the church-manager guard: a church-scoped actor (super_admin acting
--      as Church Manager) can NEVER grant the super_admin role — changing the
--      Church Manager is a Platform Owner operation only.
--   3. Terminology — admin system role Arabic label becomes
--      'الكاهن المسؤول / أمين القطاع' (replacing 'أمين الخدمة أو الكاهن المسئول',
--      045); stage_manager stays 'أمين المرحلة'; seed_church_roles() updated.
-- Dependencies: 034 (create_church_user), 022 (user_has_permission_in_church),
--               027 (RLS write-policy pattern), 045 (seed baseline).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — servant_service_assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS servant_service_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  servant_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  start_date  timestamptz NOT NULL DEFAULT now(),
  end_date    timestamptz,
  assigned_by uuid NOT NULL REFERENCES profiles (id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS): the table and its
-- indexes may already exist when this migration is (re)applied after an
-- interrupted/out-of-band apply — a failed push must be retryable.
CREATE INDEX IF NOT EXISTS idx_ssa_servant_active
  ON servant_service_assignments (church_id, servant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ssa_service
  ON servant_service_assignments (service_id);

ALTER TABLE servant_service_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON servant_service_assignments;
CREATE POLICY tenant_isolation ON servant_service_assignments
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS assignment_write ON servant_service_assignments;
CREATE POLICY assignment_write ON servant_service_assignments
  FOR ALL
  USING (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('servants.assign', church_id)
  )
  WITH CHECK (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('servants.assign', church_id)
  );

DROP POLICY IF EXISTS admin_write ON servant_service_assignments;
CREATE POLICY admin_write ON servant_service_assignments
  FOR ALL USING (user_is_admin(church_id))
  WITH CHECK (user_is_admin(church_id) AND church_id = get_user_church_id());

-- ============================================================================
-- PART 2 — create_church_user(): service assignments + role rules + manager guard
-- ----------------------------------------------------------------------------
-- The 034 signature (9 args, no p_service_ids) is DROPPED first: keeping it
-- would leave an executable overload with the OLD body — bypassing the
-- manager guard (cannot_assign_manager_role) and the 050 role rules
-- (service_required / servant_stage_required). The 10-arg version below is
-- the ONLY create_church_user that exists after this migration.
-- ============================================================================

-- REVOKE on a missing function raises undefined_function, so guard it: an
-- out-of-band apply may already have dropped the old overload.
DO $$
BEGIN
  BEGIN
    REVOKE ALL ON FUNCTION create_church_user(
      uuid, uuid, text, text, uuid[], text, text, text, uuid[]
    ) FROM PUBLIC, anon, authenticated, service_role;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;
END $$;

DROP FUNCTION IF EXISTS create_church_user(
  uuid, uuid, text, text, uuid[], text, text, text, uuid[]
);

CREATE OR REPLACE FUNCTION create_church_user(
  p_church_id uuid,
  p_auth_user_id uuid,
  p_full_name_ar text,
  p_email text,
  p_role_ids uuid[],
  p_full_name_en text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_preferred_locale text DEFAULT 'ar',
  p_stage_ids uuid[] DEFAULT NULL,
  p_service_ids uuid[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_email text;
  v_user_id uuid;
  v_role_count integer;
  v_stage_count integer;
  v_service_count integer;
  v_role_types user_role_type[] := '{}'::user_role_type[];
  v_has_admin boolean;
  v_has_stage_manager boolean;
  v_has_servant boolean;
BEGIN
  -- Guard: authenticated session
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Guard: platform owner OR super admin of the target church
  IF NOT (user_is_platform_owner() OR user_is_super_admin(p_church_id)) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  -- Validate required parameters
  IF p_church_id IS NULL THEN
    RAISE EXCEPTION 'church_id_required';
  END IF;

  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_id_required';
  END IF;

  IF p_full_name_ar IS NULL OR BTRIM(p_full_name_ar) = '' THEN
    RAISE EXCEPTION 'full_name_ar_required';
  END IF;

  IF p_email IS NULL OR BTRIM(p_email) = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF p_role_ids IS NULL OR array_length(p_role_ids, 1) = 0 THEN
    RAISE EXCEPTION 'roles_required';
  END IF;

  -- Guard: church must exist, be active and not deleted
  IF NOT EXISTS (
    SELECT 1 FROM churches
    WHERE id = p_church_id AND deleted_at IS NULL AND is_active = true
  ) THEN
    RAISE EXCEPTION 'church_not_found';
  END IF;

  -- D-8: auth user must exist and match the provided email
  SELECT au.email, au.id INTO v_auth_email, v_user_id
  FROM auth.users au
  WHERE au.id = p_auth_user_id;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'auth_user_not_found';
  END IF;

  IF lower(v_auth_email) <> lower(BTRIM(p_email)) THEN
    RAISE EXCEPTION 'auth_user_email_mismatch';
  END IF;

  -- Guard: every role must belong to the target church
  SELECT count(*) INTO v_role_count
  FROM roles
  WHERE church_id = p_church_id AND id = ANY(p_role_ids);

  IF v_role_count <> array_length(p_role_ids, 1) THEN
    RAISE EXCEPTION 'role_not_in_church';
  END IF;

  SELECT array_agg(role_type) INTO v_role_types
  FROM roles
  WHERE church_id = p_church_id AND id = ANY(p_role_ids);

  -- CHURCH MANAGER GUARD: a church-scoped actor may never grant the
  -- super_admin (Church Manager) role — that is a Platform Owner operation
  -- (035 change_church_manager). The platform owner keeps the full flow.
  IF NOT user_is_platform_owner() AND 'super_admin' = ANY(v_role_types) THEN
    RAISE EXCEPTION 'cannot_assign_manager_role';
  END IF;

  v_has_admin        := 'admin' = ANY(v_role_types);
  v_has_stage_manager := 'stage_manager' = ANY(v_role_types);
  v_has_servant      := 'servant' = ANY(v_role_types);

  -- Guard: every stage must belong to the target church (when provided)
  IF p_stage_ids IS NOT NULL AND array_length(p_stage_ids, 1) > 0 THEN
    SELECT count(*) INTO v_stage_count
    FROM stages
    WHERE church_id = p_church_id AND id = ANY(p_stage_ids) AND deleted_at IS NULL;

    IF v_stage_count <> array_length(p_stage_ids, 1) THEN
      RAISE EXCEPTION 'stage_not_in_church';
    END IF;
  END IF;

  -- Guard: every service must belong to the target church (when provided)
  IF p_service_ids IS NOT NULL AND array_length(p_service_ids, 1) > 0 THEN
    SELECT count(*) INTO v_service_count
    FROM services
    WHERE church_id = p_church_id AND id = ANY(p_service_ids) AND deleted_at IS NULL;

    IF v_service_count <> array_length(p_service_ids, 1) THEN
      RAISE EXCEPTION 'service_not_in_church';
    END IF;
  END IF;

  -- ROLE ASSIGNMENT RULES (the UI mirrors these; the RPC is the hard boundary):
  --   admin          -> service assignment(s) required; stage not required
  --   stage_manager  -> exactly ONE service; stage not required
  --   servant        -> exactly ONE service + exactly ONE stage IN that service
  IF v_has_admin OR v_has_stage_manager OR v_has_servant THEN
    IF p_service_ids IS NULL OR array_length(p_service_ids, 1) = 0 THEN
      RAISE EXCEPTION 'service_required';
    END IF;
  END IF;

  IF v_has_stage_manager AND array_length(p_service_ids, 1) <> 1 THEN
    RAISE EXCEPTION 'stage_manager_single_service';
  END IF;

  IF v_has_servant THEN
    IF array_length(p_service_ids, 1) <> 1 THEN
      RAISE EXCEPTION 'servant_single_service';
    END IF;
    IF p_stage_ids IS NULL OR array_length(p_stage_ids, 1) <> 1 THEN
      RAISE EXCEPTION 'servant_stage_required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM stages
      WHERE id = p_stage_ids[1] AND service_id = p_service_ids[1]
        AND church_id = p_church_id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'stage_service_mismatch';
    END IF;
  END IF;

  -- Profile (idempotent insert/update, mirrors 032 create_church_super_admin)
  INSERT INTO profiles
    (id, church_id, email, full_name_ar, full_name_en, phone, preferred_locale)
  VALUES
    (p_auth_user_id, p_church_id, lower(BTRIM(p_email)), BTRIM(p_full_name_ar),
     NULLIF(BTRIM(p_full_name_en), ''), p_phone, COALESCE(p_preferred_locale, 'ar'))
  ON CONFLICT (id) DO UPDATE
    SET church_id = EXCLUDED.church_id,
        email = EXCLUDED.email,
        full_name_ar = EXCLUDED.full_name_ar,
        full_name_en = EXCLUDED.full_name_en,
        phone = EXCLUDED.phone,
        preferred_locale = EXCLUDED.preferred_locale,
        is_active = true,
        deleted_at = NULL,
        updated_at = now();

  -- Servant (idempotent upsert; approved so the created user can sign in)
  INSERT INTO servants
    (id, church_id, approval_status, approved_by, approved_at)
  VALUES
    (p_auth_user_id, p_church_id, 'approved', auth.uid(), now())
  ON CONFLICT (id) DO UPDATE
    SET church_id = EXCLUDED.church_id,
        approval_status = 'approved',
        approved_by = auth.uid(),
        approved_at = now(),
        deleted_at = NULL;

  -- Role grants — reactivation-first (mirrors TS syncRoleGrants)
  UPDATE user_roles
  SET end_date = CURRENT_DATE
  WHERE church_id = p_church_id
    AND user_id = p_auth_user_id
    AND end_date IS NULL
    AND NOT (role_id = ANY(p_role_ids));

  UPDATE user_roles
  SET end_date = NULL
  WHERE church_id = p_church_id
    AND user_id = p_auth_user_id
    AND end_date IS NOT NULL
    AND role_id = ANY(p_role_ids);

  INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)
  SELECT p_church_id, p_auth_user_id, r.id, auth.uid(), CURRENT_DATE
  FROM unnest(p_role_ids) AS t(role_id)
  JOIN roles r ON r.id = t.role_id AND r.church_id = p_church_id
  WHERE NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.church_id = p_church_id
      AND ur.user_id = p_auth_user_id
      AND ur.role_id = t.role_id
  );

  -- Stage assignments (deactivate-existing then insert new)
  IF p_stage_ids IS NOT NULL AND array_length(p_stage_ids, 1) > 0 THEN
    UPDATE servant_stage_assignments
    SET is_active = false, end_date = now()
    WHERE servant_id = p_auth_user_id
      AND church_id = p_church_id
      AND is_active = true
      AND end_date IS NULL;

    INSERT INTO servant_stage_assignments
      (church_id, servant_id, stage_id, service_id, is_active, start_date, end_date, assigned_by)
    SELECT p_church_id, p_auth_user_id, s.id, s.service_id, true, now(), NULL, auth.uid()
    FROM unnest(p_stage_ids) AS t(stage_id)
    JOIN stages s ON s.id = t.stage_id;
  END IF;

  -- Service assignments (deactivate-existing then insert new)
  IF p_service_ids IS NOT NULL AND array_length(p_service_ids, 1) > 0 THEN
    UPDATE servant_service_assignments
    SET is_active = false, end_date = now()
    WHERE servant_id = p_auth_user_id
      AND church_id = p_church_id
      AND is_active = true
      AND end_date IS NULL;

    INSERT INTO servant_service_assignments
      (church_id, servant_id, service_id, is_active, start_date, end_date, assigned_by)
    SELECT p_church_id, p_auth_user_id, s.id, true, now(), NULL, auth.uid()
    FROM unnest(p_service_ids) AS t(service_id)
    JOIN services s ON s.id = t.service_id AND s.church_id = p_church_id;
  END IF;

  -- Onboarding notification
  PERFORM send_notification(
    p_church_id,
    p_auth_user_id,
    'approval_result',
    'تم إنشاء حسابك في الكنيسة',
    'Your church account has been created',
    'يمكنك الآن تسجيل الدخول للكنيسة',
    'You can now sign in to the church',
    jsonb_build_object('decision', 'approved', 'church_id', p_church_id)
  );

  -- Audit trail: user + servant
  PERFORM write_audit_log(
    p_church_id, 'create', 'user', p_auth_user_id, NULL,
    jsonb_build_object(
      'email', lower(BTRIM(p_email)),
      'full_name_ar', BTRIM(p_full_name_ar),
      'role_ids', p_role_ids
    )
  );

  PERFORM write_audit_log(
    p_church_id, 'create', 'servant', p_auth_user_id, NULL,
    jsonb_build_object('approval_status', 'approved')
  );

  RETURN p_auth_user_id;
END;
$$;

-- ============================================================================
-- PART 3 — RPC privilege lockdown (new signature)
-- ============================================================================

-- REVOKE on a missing function raises undefined_function, so guard it: the
-- 10-arg signature may not exist yet on a partially-applied database.
DO $$
BEGIN
  BEGIN
    REVOKE ALL ON FUNCTION create_church_user(
      uuid, uuid, text, text, uuid[], text, text, text, uuid[], uuid[]
    ) FROM PUBLIC, anon, authenticated, service_role;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;
END $$;

GRANT EXECUTE ON FUNCTION create_church_user(
  uuid, uuid, text, text, uuid[], text, text, text, uuid[], uuid[]
) TO authenticated, service_role;

-- ============================================================================
-- PART 3b — Stage scope for service-level assignments
-- ----------------------------------------------------------------------------
-- Under the 050 rules أمين مرحلة (stage_manager) is assigned to a SERVICE and
-- needs NO stage assignment. The stage-scope helpers therefore union the
-- active stages of the actor's active servant_service_assignments, so a
-- stage manager whose scope comes from a service still sees that service's
-- stages (and a servant keeps exactly their own stage — the servant rules
-- require one stage inside one service, so the union adds nothing).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_stage_manager_stage_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  -- super_admin / admin: whole-church scope (matches 038/039).
  IF user_is_admin(v_church_id) THEN
    RETURN ARRAY(
      SELECT id FROM stages
      WHERE church_id = v_church_id AND deleted_at IS NULL
    );
  END IF;

  -- stage_manager: stage assignments UNION the stages of active service
  -- assignments (050 — a stage manager's service IS its scope).
  -- servant / any other scoped role: stage assignments ONLY — a servant must
  -- never see stages beyond their own assignment, even though the 050 rules
  -- also give servants a service assignment.
  IF user_has_role('stage_manager') THEN
    RETURN ARRAY(
      SELECT DISTINCT s.stage_id
      FROM (
        SELECT ssa.stage_id AS stage_id
        FROM servant_stage_assignments ssa
        WHERE ssa.servant_id = auth.uid()
          AND ssa.is_active = true
          AND (ssa.end_date IS NULL OR ssa.end_date >= CURRENT_DATE)
          AND ssa.stage_id IS NOT NULL
        UNION
        SELECT st.id AS stage_id
        FROM servant_service_assignments svsa
        JOIN stages st ON st.service_id = svsa.service_id
          AND st.church_id = svsa.church_id
          AND st.deleted_at IS NULL
          AND st.is_active = true
        WHERE svsa.servant_id = auth.uid()
          AND svsa.is_active = true
          AND (svsa.end_date IS NULL OR svsa.end_date >= CURRENT_DATE)
      ) s
    );
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.stage_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND (ssa.end_date IS NULL OR ssa.end_date >= CURRENT_DATE)
      AND ssa.stage_id IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_user_service_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM services WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  -- Stage assignments AND service assignments (050) both grant service scope.
  RETURN ARRAY(
    SELECT DISTINCT s.service_id
    FROM (
      SELECT ssa.service_id AS service_id
      FROM servant_stage_assignments ssa
      WHERE ssa.servant_id = auth.uid()
        AND ssa.is_active = true
        AND (ssa.end_date IS NULL OR ssa.end_date >= CURRENT_DATE)
        AND ssa.service_id IS NOT NULL
      UNION
      SELECT svsa.service_id AS service_id
      FROM servant_service_assignments svsa
      WHERE svsa.servant_id = auth.uid()
        AND svsa.is_active = true
        AND (svsa.end_date IS NULL OR svsa.end_date >= CURRENT_DATE)
    ) s
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_user_stage_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM stages WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  -- stage_manager: stage assignments UNION the stages of active service
  -- assignments (050 — a stage manager's service IS its scope).
  -- servant / any other scoped role: stage assignments ONLY — a servant must
  -- never see stages beyond their own assignment.
  IF user_has_role('stage_manager') THEN
    RETURN ARRAY(
      SELECT DISTINCT s.stage_id
      FROM (
        SELECT ssa.stage_id AS stage_id
        FROM servant_stage_assignments ssa
        WHERE ssa.servant_id = auth.uid()
          AND ssa.is_active = true
          AND (ssa.end_date IS NULL OR ssa.end_date >= CURRENT_DATE)
          AND ssa.stage_id IS NOT NULL
        UNION
        SELECT st.id AS stage_id
        FROM servant_service_assignments svsa
        JOIN stages st ON st.service_id = svsa.service_id
          AND st.church_id = svsa.church_id
          AND st.deleted_at IS NULL
          AND st.is_active = true
        WHERE svsa.servant_id = auth.uid()
          AND svsa.is_active = true
          AND (svsa.end_date IS NULL OR svsa.end_date >= CURRENT_DATE)
      ) s
    );
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.stage_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND (ssa.end_date IS NULL OR ssa.end_date >= CURRENT_DATE)
      AND ssa.stage_id IS NOT NULL
  );
END;
$$;

-- ============================================================================
-- PART 4 — Terminology: admin role label + seed_church_roles()
-- ============================================================================

UPDATE roles SET name_ar = 'الكاهن المسؤول / أمين القطاع'
WHERE role_type = 'admin' AND is_system = true;

-- seed_church_roles(): 045 baseline with the corrected admin label.
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

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Table + RLS
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='servant_service_assignments'
--   ORDER BY cmd;  -- tenant_isolation SELECT + assignment_write ALL + admin_write ALL
-- V2 — Privileges (new signature)
--   SELECT has_function_privilege('authenticated',
--     'create_church_user(uuid,uuid,text,text,uuid[],text,text,text,uuid[],uuid[])',
--     'EXECUTE');  -- true
-- V3 — Manager guard: as a church super_admin (not PO), create a user whose
--   role set includes the church's super_admin role -> 'cannot_assign_manager_role'.
--   As the PO the same call succeeds (or 'manager_replacement_required' at the
--   app layer when an active manager exists).
-- V4 — Role rules:
--   admin role + no service -> 'service_required'
--   stage_manager + 2 services -> 'stage_manager_single_service'
--   servant + 1 service + no stage -> 'servant_stage_required'
--   servant + 1 service + stage of another service -> 'stage_service_mismatch'
--   servant + valid service + stage -> success; servant_service_assignments row
--   + servant_stage_assignments row created.
-- V5 — Labels:
--   SELECT role_type, name_ar FROM roles WHERE is_system = true ORDER BY role_type;
--   -- admin | الكاهن المسؤول / أمين القطاع ; stage_manager | أمين المرحلة
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   REVOKE EXECUTE ON FUNCTION create_church_user(uuid,uuid,text,text,uuid[],
--     text,text,text,uuid[],uuid[]) FROM authenticated, service_role;
--   DROP FUNCTION create_church_user(uuid,uuid,text,text,uuid[],text,text,text,
--     uuid[],uuid[]);            -- restore the 034 definition (9-arg) afterwards
--   UPDATE roles SET name_ar = 'أمين الخدمة أو الكاهن المسئول'
--     WHERE role_type = 'admin' AND is_system = true;   -- restore 045 label
--   DROP TABLE servant_service_assignments;
-- ============================================================================
