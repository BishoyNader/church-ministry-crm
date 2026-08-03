-- ============================================================================
-- 025_remove_church_english_name.sql
-- P1: remove the church English name from the data model per product guide
-- (Arabic-only identity). Drops:
--   - church_requests.church_name_en
--   - churches.name_en
--
-- Phase 3C RPC bodies that referenced these columns are recreated FIRST (so
-- the drop does not leave parsed function bodies dangling):
--   - list_churches_for_signup()         (023 S11-2)  — drops name_en from
--     RETURNS TABLE + SELECT
--   - submit_church_request(...)          (023 S11-4)  — drops p_church_name_en
--     param, the name_en dedupe branch, and the INSERT column
--   - approve_church_request(...)         (023 S11-7)  — drops v_church_name_en,
--     the name_en dedupe branch, the churches INSERT column, and the English
--     notification title now falls back to a static string
--
-- The other 5 Phase 3C RPCs (get_my_access_state, approve_servant,
-- reject_servant, reject_church_request, send_notification) are untouched.
-- Person/service/stage/class bilingual names (name_en / full_name_en) are
-- intentionally retained.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. list_churches_for_signup() — expose Arabic name + slug only.
-- ----------------------------------------------------------------------------
-- 023 returns (id, name_ar, name_en, slug); the return type changes here, so
-- CREATE OR REPLACE cannot do it — drop first, then recreate with the reduced
-- projection. (ACL is re-applied below, mirroring 023's lockdown.)
DROP FUNCTION IF EXISTS list_churches_for_signup();
CREATE OR REPLACE FUNCTION list_churches_for_signup()
RETURNS TABLE (id uuid, name_ar text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id, name_ar, slug
  FROM churches
  WHERE is_active = true AND deleted_at IS NULL
  ORDER BY name_ar;
$$;

-- ----------------------------------------------------------------------------
-- 2. submit_church_request(...) — no English name parameter; dedupe drops the
-- name_en branch; INSERT drops the church_name_en column.
-- ----------------------------------------------------------------------------
-- 023's version takes (text,text,text,text,text,text,text) incl. p_church_name_en;
-- the parameter is removed here, so CREATE OR REPLACE would otherwise create a
-- stale 7-param overload whose body references the dropped column. Drop the old
-- signature first.
DROP FUNCTION IF EXISTS submit_church_request(text, text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION submit_church_request(
  p_church_name_ar text,
  p_catechist_name text,
  p_applicant_name text,
  p_email text,
  p_phone text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_request_id uuid;
BEGIN
  IF p_church_name_ar IS NULL OR BTRIM(p_church_name_ar) = '' THEN
    RAISE EXCEPTION 'church_name_required';
  END IF;
  IF p_catechist_name IS NULL OR BTRIM(p_catechist_name) = '' THEN
    RAISE EXCEPTION 'catechist_name_required';
  END IF;
  IF p_applicant_name IS NULL OR BTRIM(p_applicant_name) = '' THEN
    RAISE EXCEPTION 'applicant_name_required';
  END IF;
  IF p_email IS NULL OR BTRIM(p_email) = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  v_email := LOWER(BTRIM(p_email));

  -- Dedupe 1: no existing profile (auth account) with this email
  IF EXISTS (SELECT 1 FROM profiles WHERE email = v_email) THEN
    RAISE EXCEPTION 'email_already_registered';
  END IF;

  -- Dedupe 2: no pending request already open for this email
  IF EXISTS (SELECT 1 FROM church_requests WHERE lower(email) = v_email AND status = 'pending') THEN
    RAISE EXCEPTION 'request_already_pending';
  END IF;

  -- Dedupe 3: no existing church with the same normalized Arabic name
  IF EXISTS (
    SELECT 1 FROM churches
    WHERE deleted_at IS NULL
      AND name_ar = BTRIM(p_church_name_ar)
  ) THEN
    RAISE EXCEPTION 'church_name_exists';
  END IF;

  INSERT INTO church_requests
    (church_name_ar, catechist_name, applicant_name, email, phone, notes)
  VALUES
    (BTRIM(p_church_name_ar), BTRIM(p_catechist_name),
     BTRIM(p_applicant_name), v_email, p_phone, p_notes)
  RETURNING id INTO v_request_id;

  -- D-6: explicit audit in the same transaction (church_requests has no table
  -- trigger; entity_id always passed per D-4). church_id is NULL (the church
  -- does not exist yet).
  PERFORM write_audit_log(
    NULL,
    'create',
    'church_request',
    v_request_id,
    NULL,
    jsonb_build_object('status', 'pending')
  );

  RETURN v_request_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2b. Privilege lockdown for the recreated functions. DROP + CREATE produces a
-- NEW function object whose ACL defaults to PUBLIC execute; re-apply the exact
-- grants 023 gave the originals (public signup surface = anon + authenticated).
-- (approve_church_request is recreated with CREATE OR REPLACE on an existing
-- signature, so its 023 ACL — authenticated + service_role — is preserved.)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION list_churches_for_signup() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION list_churches_for_signup() TO anon, authenticated;

REVOKE ALL ON FUNCTION submit_church_request(text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION submit_church_request(text, text, text, text, text, text)
  TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. approve_church_request(...) — no English name; English notification title
-- is a static fallback.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_church_request(
  p_request_id uuid,
  p_auth_user_id uuid,
  p_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status text;
  v_church_name_ar text;
  v_applicant_name text;
  v_email text;
  v_phone text;
  v_auth_email text;
  v_church_id uuid;
  v_role_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT user_is_platform_owner() THEN
    RAISE EXCEPTION 'not_platform_owner';
  END IF;

  -- Lock the request row to serialize review decisions
  SELECT cr.status, cr.church_name_ar, cr.applicant_name,
         cr.email, cr.phone
    INTO v_status, v_church_name_ar, v_applicant_name,
         v_email, v_phone
  FROM church_requests cr
  WHERE cr.id = p_request_id
  FOR UPDATE;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  -- D-8: provisioned auth user must exist and match the request's email
  SELECT au.email INTO v_auth_email
  FROM auth.users au
  WHERE au.id = p_auth_user_id;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'auth_user_not_found';
  END IF;

  IF lower(v_auth_email) <> lower(v_email) THEN
    RAISE EXCEPTION 'auth_user_email_mismatch';
  END IF;

  -- Dedupe: no existing church with the same normalized Arabic name
  IF EXISTS (
    SELECT 1 FROM churches
    WHERE deleted_at IS NULL
      AND name_ar = v_church_name_ar
  ) THEN
    RAISE EXCEPTION 'church_name_exists';
  END IF;

  -- Slug format guard (final uniqueness defense = churches.slug UNIQUE, 001)
  IF p_slug IS NULL OR p_slug <> lower(p_slug)
     OR p_slug !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'invalid_slug';
  END IF;

  -- Create the church (provisioning baseline: trial/active, +30d, locale ar)
  INSERT INTO churches
    (name_ar, slug, contact_email, contact_phone,
     subscription_tier, subscription_status, trial_ends_at, feature_flags, locale)
  VALUES
    (v_church_name_ar, p_slug, v_email, v_phone,
     'trial', 'active', now() + interval '30 days', '{}', 'ar')
  RETURNING id INTO v_church_id;

  -- Seed canonical roles (021)
  PERFORM seed_church_roles(v_church_id);

  -- Applicant profile (id = auth user id; canonical: first user is super_admin)
  INSERT INTO profiles (id, church_id, email, full_name_ar, full_name_en, phone, preferred_locale)
  VALUES (p_auth_user_id, v_church_id, v_email, v_applicant_name, NULL, v_phone, 'ar');

  -- Approved servant row for the new super_admin (canonical role model)
  INSERT INTO servants (id, church_id, approval_status, approved_by, approved_at)
  VALUES (p_auth_user_id, v_church_id, 'approved', auth.uid(), now());

  -- Initial super_admin grant (platform-owner only writer of super_admin)
  SELECT r.id INTO v_role_id
  FROM roles r
  WHERE r.church_id = v_church_id AND r.role_type = 'super_admin';

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'super_admin_role_not_found';
  END IF;

  INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)
  VALUES (v_church_id, p_auth_user_id, v_role_id, auth.uid(), CURRENT_DATE);

  -- Mark the request approved
  UPDATE church_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_request_id;

  -- Notification to the applicant (approval_result / approved; §8.1)
  PERFORM send_notification(
    v_church_id,
    p_auth_user_id,
    'approval_result',
    'تم إنشاء كنيسة ' || v_church_name_ar,
    'Your church is ready',
    'تم تفعيل حسابك كمدير للكنيسة',
    'Your account is now the church administrator',
    jsonb_build_object('decision', 'approved', 'church_id', v_church_id,
                       'church_request_id', p_request_id, 'role', 'super_admin')
  );

  -- Audit trail: request approve + church create + servant create (D-4)
  PERFORM write_audit_log(
    v_church_id, 'approve', 'church_request', p_request_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'approved', 'church_id', v_church_id)
  );
  PERFORM write_audit_log(
    v_church_id, 'create', 'church', v_church_id, NULL,
    jsonb_build_object('name_ar', v_church_name_ar, 'slug', p_slug, 'subscription_tier', 'trial')
  );
  PERFORM write_audit_log(
    v_church_id, 'create', 'servant', p_auth_user_id, NULL,
    jsonb_build_object('approval_status', 'approved')
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Drop the English-name columns.
-- ----------------------------------------------------------------------------
ALTER TABLE church_requests DROP COLUMN IF EXISTS church_name_en;
ALTER TABLE churches DROP COLUMN IF EXISTS name_en;

-- ============================================================================
-- VERIFICATION
--   1. \d church_requests        -> no church_name_en column
--   2. \d churches               -> no name_en column
--   3. SELECT pg_get_functiondef('list_churches_for_signup()'::regprocedure);
--      -> RETURNS TABLE (id, name_ar, slug)
--   4. SELECT pg_get_functiondef('submit_church_request(...)'::regprocedure);
--      -> no p_church_name_en parameter, INSERT without church_name_en
--   5. SELECT pg_get_functiondef('approve_church_request(...)'::regprocedure);
--      -> no name_en references; title_en = 'Your church is ready'
--   6. SELECT * FROM list_churches_for_signup(); -> id, name_ar, slug only
--   7. submit smoke test still passes: submit_church_request returns uuid and
--      approve_church_request creates church without name_en (SQL error would
--      surface here if a body still referenced the dropped column).
--
-- ROLLBACK
--   ALTER TABLE church_requests ADD COLUMN church_name_en text;
--   ALTER TABLE churches ADD COLUMN name_en text;
--   -- Re-run 023_phase3c_registration.sql S11-2/S11-4/S11-7 bodies to restore
--   -- the previous RPC signatures.
-- ============================================================================
