-- ============================================================================
-- 043 — Fix provision_church: drop obsolete churches.name_en references
--
-- Root cause (verified at runtime): migration 025 removed churches.name_en
-- (Arabic-only church identity). Migration 032 later created provision_church
-- whose PL/pgSQL body still references name_en — PL/pgSQL does not validate
-- column references at CREATE time, so the function deployed cleanly and fails
-- at RUNTIME with:
--
--   ERROR: 42703: column "name_en" does not exist
--
--   (hint: Perhaps you meant to reference the column "churches.name_ar")
--
-- This breaks the Platform Owner "Create New Church" provisioning path
-- (provisionChurchWizardAction -> provision_church).
--
-- Fix (additive, single CREATE OR REPLACE, mirrors 025's treatment of
-- approve_church_request):
--   * Signature is UNCHANGED — p_church_name_en is retained as an accepted
--     (now ignored) parameter for staged-deploy compatibility (an older
--     deployed frontend that still sends the argument keeps working against
--     the new function before the new frontend ships; the current caller
--     src/features/churches/services/provisioning.service.ts no longer sends
--     it). The function body ignores it — Arabic-only identity, 025.
--   * Body drops every churches.name_en reference:
--       - dedupe branch (name_en match)                       -> Arabic name only
--       - churches INSERT column list                         -> name_ar only
--       - English notification title from p_church_name_en    -> static fallback
--   * Security posture unchanged: SECURITY DEFINER, search_path = public, auth,
--     auth.uid() + user_is_platform_owner() guard, service_role/authenticated
--     EXECUTE only. No RLS changes, no service-role bypass of authorization.
--
-- Dependencies: 032 (provision_church), 025 (churches.name_en drop),
--   seed_church_roles (021/041), write_audit_log (019), send_notification (023),
--   user_is_platform_owner (022/028), get_user_church_id (022).
-- Transaction: single BEGIN/COMMIT (matches 032/033 style).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION provision_church(
  p_church_name_ar text,
  p_slug text,
  p_auth_user_id uuid,
  p_full_name_ar text,
  p_email text,
  p_church_name_en text DEFAULT NULL,  -- accepted for caller compatibility; IGNORED (Arabic-only identity, 025)
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

  -- Dedupe: no existing church with the same normalized Arabic name
  -- (name_en branch removed — churches.name_en no longer exists, 025)
  IF EXISTS (
    SELECT 1 FROM churches
    WHERE deleted_at IS NULL
      AND name_ar = BTRIM(p_church_name_ar)
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

  -- Create the church (trial baseline; Arabic-only identity, no name_en column)
  INSERT INTO churches
    (name_ar, slug, contact_email, contact_phone, address_ar,
     subscription_tier, subscription_status, locale)
  VALUES
    (BTRIM(p_church_name_ar), lower(BTRIM(p_slug)),
     NULLIF(BTRIM(p_contact_email), ''), NULLIF(BTRIM(p_contact_phone), ''),
     NULLIF(BTRIM(p_address_ar), ''), 'trial', 'active', 'ar')
  RETURNING id INTO v_church_id;

  -- Seed canonical roles (super_admin, admin, stage_manager, servant)
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

  -- Onboarding notification (static English title — Arabic-only identity, 025)
  PERFORM send_notification(
    v_church_id,
    p_auth_user_id,
    'approval_result',
    'تم إنشاء كنيسة ' || BTRIM(p_church_name_ar),
    'Your church is ready',
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
-- Privilege lockdown — self-contained (032/033 pattern). CREATE OR REPLACE
-- preserves ACLs, but re-issuing guarantees the exact boundary:
--   anon        -> no EXECUTE
--   authenticated -> EXECUTE (PO session path; internal guard enforces PO-only)
--   service_role -> EXECUTE (retained)
-- ============================================================================

REVOKE ALL ON FUNCTION provision_church(
  text, text, uuid, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION provision_church(
  text, text, uuid, text, text, text, text, text, text, text, text
) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — No churches.name_en column references remain in the function body:
--   (the retained back-compat parameter NAME p_church_name_en and explanatory
--   comments are expected; only actual column/table references must be gone)
--   SELECT pg_get_functiondef('provision_church'::regprocedure)
--     LIKE '%churches.name_en%' AS still_references_column;   -- false
-- V2 — Provision smoke (as the Platform Owner session):
--   provision_church(p_church_name_ar := 'كنيسة تجريبية', p_slug := 'smoke-<n>',
--     p_auth_user_id := '<auth uid>', p_full_name_ar := 'مدير', p_email := '<email>')
--     -> returns church_id (previously raised 42703 column "name_en" does not exist)
--   Verify: churches row (name_ar only), 4 canonical roles, profile + approved
--     servant + super_admin grant for the auth user, 3 audit rows.
-- V3 — Guard re-checks (unchanged behavior):
--   Call as anon -> permission denied (no EXECUTE — REVOKEd from anon, so the
--     call never reaches the body; the auth.uid() guard is defense-in-depth)
--   Call as a non-PO authenticated user -> 'not_platform_owner'
--   Duplicate Arabic name -> 'church_name_exists'
--   Mismatched auth email -> 'auth_user_email_mismatch'
-- V4 — Privileges:
--   SELECT has_function_privilege('anon', 'provision_church(text,text,uuid,text,text,text,text,text,text,text,text)', 'EXECUTE');          -- false
--   SELECT has_function_privilege('authenticated', 'provision_church(text,text,uuid,text,text,text,text,text,text,text,text)', 'EXECUTE'); -- true
--   SELECT has_function_privilege('service_role', 'provision_church(text,text,uuid,text,text,text,text,text,text,text,text)', 'EXECUTE');  -- true
-- ============================================================================

-- ============================================================================
-- ROLLBACK (in-place reverse; primary rollback = restore the pre-043 snapshot)
-- R1  Restore the 032/033 function body via CREATE OR REPLACE (the version with
--     the name_en references) — NOTE: that body raises 42703 at runtime on any
--     schema where 025 has applied (i.e. everywhere post-025), so rollback is
--     only meaningful together with restoring churches.name_en:
--     ALTER TABLE churches ADD COLUMN name_en text;
--     ALTER TABLE church_requests ADD COLUMN church_name_en text;
-- ============================================================================
