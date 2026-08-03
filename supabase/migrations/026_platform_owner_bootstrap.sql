-- ============================================================================
-- 026_platform_owner_bootstrap.sql
-- P0-3 (F3): enable the global Platform Owner and provide a one-time,
-- service-role-only provisioning path.
--
-- The schema has *always* been designed for a church-less global PO
-- (user_is_platform_owner() is church-agnostic, 022:25-31; PO policies on
-- churches/audit_logs/permissions/church_requests; notifications.church_id
-- made nullable for "platform-owner recipients", 023; servants data migration
-- explicitly EXCLUDES the platform owner "church_id IS NULL", 011). Four
-- NOT NULL constraints plus a seed that never creates the role made the PO
-- structurally impossible. This migration removes those blockers and ships:
--
--   S1  roles.church_id        DROP NOT NULL + single-global-PO unique index
--   S2  user_roles.church_id   DROP NOT NULL + single-active-global-grant index
--   S3  profiles.church_id     DROP NOT NULL (PO profile is church-less)
--   S4  servants.church_id     DROP NOT NULL (approved servant row, church-less)
--   S5  profiles own_read policy (PO church_id = NULL can read own profile)
--   S6  seed_platform_owner_role()   — creates the global role + platform bundle
--   S7  bootstrap_platform_owner()   — SECURITY DEFINER, service_role-only
--
-- Design (Option A, per docs/project/P0-3_PLATFORM_OWNER_BOOTSTRAP.md):
--   - PO is expressed as a canonical platform_owner role (church_id NULL) with
--     a permission bundle, so the P0-1-fixed hasPermission(tenants.read) gate
--     works unchanged and the existing platform_owner_* policies activate with
--     no edits.
--   - get_user_church_id() returns NULL for the PO, so tenant-isolation
--     policies continue to exclude the PO from church data (isolation
--     preserved); platform-wide access flows only through platform_owner_*.
--   - Normal users can NEVER self-promote: both functions are REVOKEd from
--     PUBLIC/anon/authenticated and GRANTed to service_role only, and the
--     bootstrap RPC raises platform_owner_already_exists on any second run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- S1. roles.church_id nullable + exactly-one-global-PO invariant
--     (Postgres treats NULLs as distinct in unique indexes, so the existing
--      UNIQUE (church_id, role_type) at 001 cannot police NULL-church rows;
--      the partial index below restores the invariant.)
-- ----------------------------------------------------------------------------
ALTER TABLE roles ALTER COLUMN church_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_global_platform_owner
  ON roles (role_type) WHERE church_id IS NULL;

-- ----------------------------------------------------------------------------
-- S2. user_roles.church_id nullable + single-active-global-grant invariant
-- ----------------------------------------------------------------------------
ALTER TABLE user_roles ALTER COLUMN church_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_active_global
  ON user_roles (user_id, role_id) WHERE church_id IS NULL AND end_date IS NULL;

-- ----------------------------------------------------------------------------
-- S3. profiles.church_id nullable (PO profile has no church)
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ALTER COLUMN church_id DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- S4. servants.church_id nullable (PO servant row has no church; middleware's
--     get_my_access_state() requires an APPROVED servant row to pass the gate)
-- ----------------------------------------------------------------------------
ALTER TABLE servants ALTER COLUMN church_id DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- S5. profiles own_read policy
--     Pre-existing RLS gap: a church-less user fails every profiles policy
--     (tenant_isolation = church_id = get_user_church_id() -> NULL = NULL ->
--     false; super_admin_all / admin_scoped are church-scoped). The PO must
--     be able to read its own profile.
-- ----------------------------------------------------------------------------
CREATE POLICY own_read ON profiles FOR SELECT USING (id = auth.uid());

-- ----------------------------------------------------------------------------
-- S6. seed_platform_owner_role()
--     Idempotent: creates the single global platform_owner role and grants the
--     platform bundle. Only codes that actually exist in the permissions
--     catalog are granted (robust to catalog drift). SECURITY DEFINER so it
--     can write roles/role_permissions (RLS-bypassed), called from S7.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_platform_owner_role()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (NULL, 'platform_owner', 'مدير النظام الأساسي', 'Platform Owner', true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_role_id;

  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id
    FROM roles
    WHERE church_id IS NULL AND role_type = 'platform_owner';
  END IF;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'platform_owner_role_not_found';
  END IF;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, p.id
  FROM permissions p
  WHERE p.code IN (
    'tenants.create', 'tenants.read', 'tenants.update', 'tenants.delete',
    'subscriptions.manage', 'billing.read',
    'system.metrics', 'system.audit', 'support.manage',
    'users.read', 'reports.read', 'reports.export',
    'audit.read', 'notifications.read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = v_role_id AND rp.permission_id = p.id
  );

  RETURN v_role_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- S7. bootstrap_platform_owner(...)
--     One-time provisioning of the initial Platform Owner. service_role-only
--     (see REVOKE/GRANT below). Creates the PO profile (church_id NULL), the
--     approved servant row, and the single global role grant, then audits.
--
--     Guards:
--       - single-flight: a second call raises platform_owner_already_exists
--       - auth account must already exist (the action creates it via
--         auth.admin.createUser, mirroring approve_church_request)
--     actor_id on the audit row is NULL (service-role bootstrap) by design.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bootstrap_platform_owner(
  p_auth_user_id uuid,
  p_full_name_ar text,
  p_email text,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role_id uuid;
  v_email text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.church_id IS NULL AND r.role_type = 'platform_owner'
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'platform_owner_already_exists';
  END IF;

  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_not_found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
    RAISE EXCEPTION 'auth_user_not_found';
  END IF;

  IF p_email IS NULL OR BTRIM(p_email) = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF p_full_name_ar IS NULL OR BTRIM(p_full_name_ar) = '' THEN
    RAISE EXCEPTION 'applicant_name_required';
  END IF;

  v_email := LOWER(BTRIM(p_email));

  v_role_id := seed_platform_owner_role();

  -- PO profile (church-less)
  INSERT INTO profiles (id, church_id, email, full_name_ar, full_name_en, phone, preferred_locale, is_active)
  VALUES (p_auth_user_id, NULL, v_email, BTRIM(p_full_name_ar), NULL, p_phone, 'ar', true)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name_ar = COALESCE(EXCLUDED.full_name_ar, profiles.full_name_ar),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    is_active = true;

  -- Approved servant row (middleware gate requires approval_status = 'approved')
  INSERT INTO servants (id, church_id, approval_status, approved_by, approved_at)
  VALUES (p_auth_user_id, NULL, 'approved', p_auth_user_id, now())
  ON CONFLICT (id) DO UPDATE SET
    approval_status = 'approved',
    approved_at = COALESCE(servants.approved_at, now());

  -- Global role grant (assigned_by references the PO's own profile, 020 NOT NULL)
  INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)
  VALUES (NULL, p_auth_user_id, v_role_id, p_auth_user_id, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  PERFORM write_audit_log(
    NULL, 'create', 'platform_owner', p_auth_user_id, NULL,
    jsonb_build_object('role_id', v_role_id, 'email', v_email)
  );

  RETURN v_role_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- S8. Privileges — security boundary. Only the service role may bootstrap the
--     Platform Owner; a normal authenticated user cannot self-promote.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION seed_platform_owner_role() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION seed_platform_owner_role() TO service_role;

REVOKE ALL ON FUNCTION bootstrap_platform_owner(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION bootstrap_platform_owner(uuid, text, text, text) TO service_role;

-- ============================================================================
-- VERIFICATION
--   1. SELECT user_is_platform_owner();                       -> false (before)
--   2. SELECT role_type FROM roles WHERE church_id IS NULL;   -> platform_owner
--      (exactly 1 row — uq_roles_global_platform_owner)
--   3. SELECT role_type FROM user_roles ur JOIN roles r ON r.id = ur.role_id
--      WHERE r.church_id IS NULL AND ur.user_id = '<po>';     -> platform_owner
--   4. SELECT church_id FROM profiles WHERE id = '<po>';      -> NULL
--   5. SELECT church_id, approval_status FROM servants
--      WHERE id = '<po>';                                     -> NULL | approved
--   6. SELECT count(*) FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
--      WHERE r.church_id IS NULL;                             -> bundle size
--   7. SELECT * FROM permissions p WHERE p.code = 'tenants.read'; -> 1 row (021)
--   8. As PO (authenticated): SELECT * FROM profiles WHERE id = auth.uid();
--      -> own row (own_read policy; was impossible before S5)
--   9. As PO: SELECT * FROM church_requests WHERE status = 'pending';
--      -> visible (platform_owner_all, 023)
--  10. Second bootstrap_platform_owner(...) call
--      -> RAISE platform_owner_already_exists
--  11. As a normal authenticated user:
--      EXECUTE bootstrap_platform_owner(...) -> permission denied (S8)
--  12. Super_admin of an existing church still sees only their church
--      (tenant-isolation preserved; get_user_church_id() = NULL for PO only)
--
-- ROLLBACK
--   DROP FUNCTION bootstrap_platform_owner(uuid, text, text, text);
--   DROP FUNCTION seed_platform_owner_role();
--   DROP POLICY own_read ON profiles;
--   DROP INDEX IF EXISTS uq_user_roles_active_global;
--   DROP INDEX IF EXISTS uq_roles_global_platform_owner;
--   DELETE FROM user_roles WHERE church_id IS NULL;
--   DELETE FROM servants WHERE church_id IS NULL;
--   DELETE FROM profiles WHERE church_id IS NULL;
--   ALTER TABLE roles        ALTER COLUMN church_id SET NOT NULL;
--   ALTER TABLE user_roles   ALTER COLUMN church_id SET NOT NULL;
--   ALTER TABLE profiles     ALTER COLUMN church_id SET NOT NULL;
--   ALTER TABLE servants     ALTER COLUMN church_id SET NOT NULL;
-- ============================================================================
