-- ============================================================================
-- Church Ministry CRM — Phase 2 Platform Owner Provisioning Core
-- Migration: 032_platform_owner_provisioning.sql
-- Action: 2 SECURITY DEFINER RPCs for atomic church provisioning:
--         provision_church (church + super admin in one transaction)
--         create_church_super_admin (add super admin to existing church)
-- Scope:   ONLY the approved Phase 2 surface. No table/column/index/policy
--          modifications. No DML on existing rows. Data-preserving.
-- Dependencies (must exist from 001–023): pgcrypto/gen_random_uuid,
--          churches, profiles, servants, roles, user_roles, notifications,
--          audit_logs, write_audit_log (019), seed_church_roles (021),
--          user_is_platform_owner / get_user_church_id (022).
-- Transaction: single BEGIN/COMMIT. Failure anywhere rolls back everything.
-- ============================================================================

BEGIN;

-- ============================================================================
-- RPC 1 — provision_church(...)
-- Atomic church + super admin provisioning. Direct PO equivalent of
-- approve_church_request (023). Creates church, seeds roles, creates profile,
-- creates approved servant, grants super_admin role, sends notification,
-- writes 3 audit rows. All in one transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION provision_church(
  p_church_name_ar text,
  p_slug text,
  p_auth_user_id uuid,
  p_full_name_ar text,
  p_email text,
  p_church_name_en text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_address_ar text DEFAULT NULL,
  p_full_name_en text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_role_id uuid;
  v_auth_email text;
BEGIN
  -- Guard: authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Guard: platform owner only
  IF NOT user_is_platform_owner() THEN
    RAISE EXCEPTION 'not_platform_owner';
  END IF;

  -- Validate required parameters
  IF p_church_name_ar IS NULL OR BTRIM(p_church_name_ar) = '' THEN
    RAISE EXCEPTION 'church_name_required';
  END IF;

  IF p_slug IS NULL OR BTRIM(p_slug) = '' THEN
    RAISE EXCEPTION 'slug_required';
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

  -- Slug format guard
  IF p_slug <> lower(p_slug)
     OR p_slug !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'invalid_slug';
  END IF;

  -- Dedupe: no existing church with the same normalized name
  IF EXISTS (
    SELECT 1 FROM churches
    WHERE deleted_at IS NULL
      AND (name_ar = BTRIM(p_church_name_ar)
           OR (p_church_name_en IS NOT NULL AND name_en = BTRIM(p_church_name_en)))
  ) THEN
    RAISE EXCEPTION 'church_name_exists';
  END IF;

  -- D-8: provisioned auth user must exist and match the provided email
  SELECT au.email INTO v_auth_email
  FROM auth.users au
  WHERE au.id = p_auth_user_id;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'auth_user_not_found';
  END IF;

  IF lower(v_auth_email) <> lower(BTRIM(p_email)) THEN
    RAISE EXCEPTION 'auth_user_email_mismatch';
  END IF;

  -- Create the church (trial baseline, matching approve_church_request)
  INSERT INTO churches
    (name_ar, name_en, slug, contact_email, contact_phone, address_ar,
     subscription_tier, subscription_status, locale)
  VALUES
    (BTRIM(p_church_name_ar), NULLIF(BTRIM(p_church_name_en), ''), lower(BTRIM(p_slug)),
     NULLIF(BTRIM(p_contact_email), ''), NULLIF(BTRIM(p_contact_phone), ''),
     NULLIF(BTRIM(p_address_ar), ''), 'trial', 'active', 'ar')
  RETURNING id INTO v_church_id;

  -- Seed canonical roles (super_admin, admin, servant)
  PERFORM seed_church_roles(v_church_id);

  -- Create profile for the super admin
  INSERT INTO profiles
    (id, church_id, email, full_name_ar, full_name_en, phone, preferred_locale)
  VALUES
    (p_auth_user_id, v_church_id, lower(BTRIM(p_email)), BTRIM(p_full_name_ar),
     NULLIF(BTRIM(p_full_name_en), ''), p_phone, 'ar');

  -- Create approved servant row (invariant: every church-scoped user has a servant)
  INSERT INTO servants
    (id, church_id, approval_status, approved_by, approved_at)
  VALUES
    (p_auth_user_id, v_church_id, 'approved', auth.uid(), now());

  -- Grant super_admin role
  SELECT r.id INTO v_role_id
  FROM roles r
  WHERE r.church_id = v_church_id AND r.role_type = 'super_admin';

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'super_admin_role_not_found';
  END IF;

  INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)
  VALUES (v_church_id, p_auth_user_id, v_role_id, auth.uid(), CURRENT_DATE);

  -- Onboarding notification
  PERFORM send_notification(
    v_church_id,
    p_auth_user_id,
    'approval_result',
    'تم إنشاء كنيسة ' || BTRIM(p_church_name_ar),
    CASE WHEN p_church_name_en IS NOT NULL THEN BTRIM(p_church_name_en) || ' is ready'
         ELSE 'Your church is ready' END,
    'تم تفعيل حسابك كمدير للكنيسة',
    'Your account is now the church administrator',
    jsonb_build_object('decision', 'approved', 'church_id', v_church_id, 'role', 'super_admin')
  );

  -- Audit trail: church create + profile create + servant create
  PERFORM write_audit_log(
    v_church_id, 'create', 'church', v_church_id, NULL,
    jsonb_build_object('name_ar', BTRIM(p_church_name_ar), 'slug', lower(BTRIM(p_slug)),
                       'subscription_tier', 'trial')
  );

  PERFORM write_audit_log(
    v_church_id, 'create', 'user', p_auth_user_id, NULL,
    jsonb_build_object('email', lower(BTRIM(p_email)), 'full_name_ar', BTRIM(p_full_name_ar))
  );

  PERFORM write_audit_log(
    v_church_id, 'create', 'servant', p_auth_user_id, NULL,
    jsonb_build_object('approval_status', 'approved')
  );

  RETURN v_church_id;
END;
$$;

-- ============================================================================
-- RPC 2 — create_church_super_admin(...)
-- Add a super admin to an existing church. Idempotent: ON CONFLICT DO NOTHING
-- for role grants, ON CONFLICT DO UPDATE for profile/servant.
-- Guards: PO-only, church exists, auth user exists, email match.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_church_super_admin(
  p_church_id uuid,
  p_auth_user_id uuid,
  p_full_name_ar text,
  p_email text,
  p_full_name_en text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role_id uuid;
  v_auth_email text;
  v_user_id uuid;
BEGIN
  -- Guard: authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Guard: platform owner only
  IF NOT user_is_platform_owner() THEN
    RAISE EXCEPTION 'not_platform_owner';
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

  -- Guard: church must exist and be active
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

  -- Idempotent profile insert/update
  INSERT INTO profiles
    (id, church_id, email, full_name_ar, full_name_en, phone, preferred_locale)
  VALUES
    (p_auth_user_id, p_church_id, lower(BTRIM(p_email)), BTRIM(p_full_name_ar),
     NULLIF(BTRIM(p_full_name_en), ''), p_phone, 'ar')
  ON CONFLICT (id) DO UPDATE
    SET church_id = EXCLUDED.church_id,
        email = EXCLUDED.email,
        full_name_ar = EXCLUDED.full_name_ar,
        full_name_en = EXCLUDED.full_name_en,
        phone = EXCLUDED.phone,
        preferred_locale = EXCLUDED.preferred_locale,
        updated_at = now();

  -- Idempotent servant insert/update (approved, by PO)
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

  -- Grant super_admin role (idempotent: DO NOTHING if already granted)
  SELECT r.id INTO v_role_id
  FROM roles r
  WHERE r.church_id = p_church_id AND r.role_type = 'super_admin';

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'super_admin_role_not_found';
  END IF;

  INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)
  VALUES (p_church_id, p_auth_user_id, v_role_id, auth.uid(), CURRENT_DATE)
  ON CONFLICT (church_id, user_id, role_id) WHERE end_date IS NULL DO NOTHING;

  -- Onboarding notification
  PERFORM send_notification(
    p_church_id,
    p_auth_user_id,
    'approval_result',
    'تم تعيينك كمدير للكنيسة',
    'You have been assigned as church administrator',
    'يمكنك الآن الدخول لإدارة الكنيسة',
    'You can now sign in to manage the church',
    jsonb_build_object('decision', 'approved', 'church_id', p_church_id, 'role', 'super_admin')
  );

  -- Audit trail: profile update + servant create/update
  PERFORM write_audit_log(
    p_church_id, 'create', 'user', p_auth_user_id, NULL,
    jsonb_build_object('email', lower(BTRIM(p_email)), 'full_name_ar', BTRIM(p_full_name_ar))
  );

  PERFORM write_audit_log(
    p_church_id, 'create', 'servant', p_auth_user_id, NULL,
    jsonb_build_object('approval_status', 'approved')
  );

  RETURN p_auth_user_id;
END;
$$;

-- ============================================================================
-- RPC Privilege Lockdown
-- Follows 023 S12 pattern: REVOKE ALL, then GRANT EXECUTE to intended callers.
-- Both RPCs are called by server actions via the admin client (service_role).
-- ============================================================================

-- provision_church: service_role only (PO provisioning path)
REVOKE ALL ON FUNCTION provision_church(
  text, text, uuid, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION provision_church(
  text, text, uuid, text, text, text, text, text, text, text, text
) TO service_role;

-- create_church_super_admin: service_role only (PO add-admin path)
REVOKE ALL ON FUNCTION create_church_super_admin(
  uuid, uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION create_church_super_admin(
  uuid, uuid, text, text, text, text
) TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Functions exist and are SECURITY DEFINER
--   SELECT p.proname, p.prosecdef, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.proname IN
--     ('provision_church','create_church_super_admin');
--   -- prosecdef = true; proconfig contains 'search_path=public, auth'
--
-- V2 — Privileges
--   SELECT has_function_privilege('anon', 'provision_church(text,text,uuid,text,text,text,text,text,text,text,text)', 'EXECUTE');        -- false
--   SELECT has_function_privilege('authenticated', 'provision_church(text,text,uuid,text,text,text,text,text,text,text,text)', 'EXECUTE'); -- false
--   SELECT has_function_privilege('service_role', 'provision_church(text,text,uuid,text,text,text,text,text,text,text,text)', 'EXECUTE');  -- true
--   SELECT has_function_privilege('service_role', 'create_church_super_admin(uuid,uuid,text,text,text,text)', 'EXECUTE');                  -- true
--
-- V3 — Smoke test (scratch project, service-role client) — named-notation calls
--   (positional argument order follows the fixed signature: required params first,
--   then optional defaults)
--   1. provision_church(p_church_name_ar := 'Test Church', p_slug := 'test-church', p_auth_user_id := 'PO Auth User ID', p_full_name_ar := 'Super Admin', p_email := 'super@example.com', p_church_name_en := 'Test Church', p_contact_email := 'test@example.com')
--      → returns church_id
--   2. Verify: church row exists, profile exists, servant exists (approved), super_admin role granted, 3 audit rows written
--   3. create_church_super_admin(p_church_id := church_id, p_auth_user_id := 'PO Auth User ID', p_full_name_ar := 'Another Admin', p_email := 'admin2@example.com')
--      → returns user_id
--   4. Verify: profile updated, servant approved, super_admin role granted (idempotent), 2 audit rows written
--
-- V4 — Guard verification
--   - Call as anon → 'not_authenticated'
--   - Call as non-PO authenticated user → 'not_platform_owner'
--   - Call with duplicate church name → 'church_name_exists'
--   - Call with invalid slug → 'invalid_slug'
--   - Call with mismatched auth email → 'auth_user_email_mismatch'
--   - Call create_church_super_admin with non-existent church → 'church_not_found'
--
-- V5 — Idempotency
--   - Call create_church_super_admin twice with same user → second call succeeds, no duplicate role grant
-- ============================================================================

-- ============================================================================
-- ROLLBACK (in-place reverse DDL)
-- R1  DROP FUNCTION IF EXISTS provision_church(text, text, uuid, text, text, text, text, text, text, text, text);
-- R2  DROP FUNCTION IF EXISTS create_church_super_admin(uuid, uuid, text, text, text, text);
-- No data cleanup needed. The RPCs are the only new objects.
-- ============================================================================