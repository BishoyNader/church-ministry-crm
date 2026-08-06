-- ============================================================================
-- 034 — Church user management: create_church_user RPC
--
-- Phase 4 (PLATFORM_OWNER_USER_MANAGEMENT_PLAN D1/D2). Centralizes the
-- profile + approved-servant + role-assignment invariant in a single
-- SECURITY DEFINER RPC so every user creation path (PO and church super_admin)
-- produces a fully provisioned, app-accessible user in one atomic call.
--
-- Background:
--   * The previous super_admin create path (user.service.createUser) created
--     profile + roles + stages but NO servants row, so the proxy gate
--     (get_my_access_state: servant_approval_status='approved' AND has_roles)
--     redirected every such user to /pending-approval indefinitely.
--   * PO session-client access to profiles/servants/user_roles/church roles is
--     blocked by RLS (no platform_owner_* policies on those tables), so the PO
--     path must flow through this RPC (grant pattern per 033).
--
-- Guards (inside the RPC, identity derived from auth.uid() only):
--   not_authenticated / not_allowed (PO OR church super_admin)
--   church_id_required / auth_user_id_required / full_name_ar_required / email_required
--   church_not_found / auth_user_not_found / auth_user_email_mismatch
--   roles_required / role_not_in_church / stage_not_in_church
--
-- Privileges mirror 033: authenticated + service_role EXECUTE; anon blocked.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION create_church_user(
  p_church_id uuid,
  p_auth_user_id uuid,
  p_full_name_ar text,
  p_email text,
  p_role_ids uuid[],
  p_full_name_en text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_preferred_locale text DEFAULT 'ar',
  p_stage_ids uuid[] DEFAULT NULL
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

  -- Guard: every stage must belong to the target church (when provided)
  IF p_stage_ids IS NOT NULL AND array_length(p_stage_ids, 1) > 0 THEN
    SELECT count(*) INTO v_stage_count
    FROM stages
    WHERE church_id = p_church_id AND id = ANY(p_stage_ids) AND deleted_at IS NULL;

    IF v_stage_count <> array_length(p_stage_ids, 1) THEN
      RAISE EXCEPTION 'stage_not_in_church';
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

  -- Stage assignments (optional; deactivate-existing then insert new)
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
-- RPC Privilege Lockdown — 033 pattern. The RPC guards on auth.uid(), so it
-- must be invoked through the session client by authenticated callers; the
-- internal user_is_platform_owner() / user_is_super_admin() guard is the
-- enforcement boundary. service_role is retained for the import path.
-- ============================================================================

REVOKE ALL ON FUNCTION create_church_user(
  uuid, uuid, text, text, uuid[], text, text, text, uuid[]
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION create_church_user(
  uuid, uuid, text, text, uuid[], text, text, text, uuid[]
) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Privileges:
--   SELECT has_function_privilege('anon', 'create_church_user(uuid,uuid,text,text,uuid[],text,text,text,uuid[])', 'EXECUTE');        -- false
--   SELECT has_function_privilege('authenticated', 'create_church_user(uuid,uuid,text,text,uuid[],text,text,text,uuid[])', 'EXECUTE'); -- true
--   SELECT has_function_privilege('service_role', 'create_church_user(uuid,uuid,text,text,uuid[],text,text,text,uuid[])', 'EXECUTE');  -- true
-- V2 — Guards from an authenticated session:
--   - Call as anon → 'not_authenticated'
--   - Call as a non-super-admin, non-PO authenticated user → 'not_allowed'
--   - Call as PO with a role id from another church → 'role_not_in_church'
-- V3 — Invariant: after a successful call, exactly one profile row, one servants
--   row with approval_status='approved', and N user_roles rows exist for the
--   created auth user in the target church.
-- ============================================================================

-- ============================================================================
-- ROLLBACK
-- R1  REVOKE EXECUTE ON FUNCTION create_church_user(
--       uuid, uuid, text, text, uuid[], text, text, text, uuid[]
--     ) FROM authenticated, service_role;
-- R2  DROP FUNCTION create_church_user(
--       uuid, uuid, text, text, uuid[], text, text, text, uuid[]
--     );
-- ============================================================================
