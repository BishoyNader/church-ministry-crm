-- ============================================================================
-- Church Ministry CRM — RBAC Terminology Correction & PO Conversion Path
-- Migration: 041_rbac_terminology_and_po_conversion.sql
-- Action: Make the system-role display labels canonical so the global Platform
--         Owner is the ONLY 'مدير النظام' / 'Platform Owner', while church-
--         scoped roles carry church-scope labels; and fix bootstrap_platform_
--         owner() so an EXISTING church-bound account can be converted into a
--         church-less Platform Owner (church_id NULL).
-- Root cause:
--   040:66 seeded the church-scoped super_admin role with name_ar 'مدير النظام'
--   (confusingly identical to the global platform_owner label), and 026:91
--   seeded the PO with name_ar 'مدير النظام الأساسي'. The live staging DB
--   (project dyfgflmrsmzgvpknbesi) carries a super_admin row labeled
--   'مدير النظام'/'Super Admin' as a result. Display labels flow straight to
--   the UI (role.name_ar, e.g. user-list-page.tsx) — no app code matches
--   display names, so DB labels are the single source of truth.
-- Canonical labels (single source of truth, enforced in this migration):
--   platform_owner -> 'مدير النظام' / 'Platform Owner'   (GLOBAL, church_id NULL)
--   super_admin    -> 'مدير الكنيسة' / 'Church Manager'  (church-scoped)
--   admin          -> 'مدير الخدمة' / 'Admin'            (church-scoped)
--   stage_manager  -> 'مدير المرحلة' / 'Stage Manager'   (church-scoped)
--   servant        -> 'خادم' / 'Servant'                 (church-scoped)
-- Scope guard: presentation + provisioning-path only. No RBAC semantics, RLS
--   policies, or permission grants are changed. chk_roles_platform_owner_global
--   (028) and user_is_platform_owner() (028) are untouched.
-- Dependencies: 021 (role_type enum, permissions catalog), 022 (roles/user_roles),
--               026 (seed_platform_owner_role / bootstrap_platform_owner),
--               040 (seed_church_roles baseline).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PART 1 — Correct existing system-role labels (idempotent; scoped to
-- is_system = true so user-created custom roles are never touched). Applies to
-- every environment; on staging it fixes the live super_admin row
-- 96983b3f-91df-4e86-8ceb-20968fa4d35d.
-- ----------------------------------------------------------------------------
UPDATE roles SET name_ar = 'مدير الكنيسة', name_en = 'Church Manager'
WHERE role_type = 'super_admin' AND is_system = true;

UPDATE roles SET name_ar = 'مدير الخدمة', name_en = 'Admin'
WHERE role_type = 'admin' AND is_system = true;

UPDATE roles SET name_ar = 'مدير المرحلة', name_en = 'Stage Manager'
WHERE role_type = 'stage_manager' AND is_system = true;

UPDATE roles SET name_ar = 'خادم', name_en = 'Servant'
WHERE role_type = 'servant' AND is_system = true;

UPDATE roles SET name_ar = 'مدير النظام', name_en = 'Platform Owner'
WHERE role_type = 'platform_owner' AND is_system = true;

-- ----------------------------------------------------------------------------
-- PART 2 — seed_platform_owner_role(): canonical PO label 'مدير النظام'.
--   DO UPDATE (instead of 026's DO NOTHING) makes the seeder self-correcting:
--   any environment that runs it converges on the canonical label even if a
--   pre-041 row exists. Permission bundle unchanged (026 S6).
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
  VALUES (NULL, 'platform_owner', 'مدير النظام', 'Platform Owner', true)
  ON CONFLICT (role_type) WHERE church_id IS NULL DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en
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
-- PART 3 — seed_church_roles(): canonical super_admin label 'مدير الكنيسة'.
--   All other role labels/grants identical to the 040 baseline (verified
--   against 040:59-128). Super Admin still excludes the platform-only modules
--   ('tenants', 'system').
-- ----------------------------------------------------------------------------
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

  -- Admin role (full ministry operations + notifications + settings)
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
    'beneficiaries.read', 'beneficiaries.create', 'beneficiaries.update', 'beneficiaries.transfer',
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

-- ----------------------------------------------------------------------------
-- PART 4 — bootstrap_platform_owner(): conversion path for EXISTING accounts.
--   Previously the profiles/servants upserts only did ON CONFLICT (id) DO
--   UPDATE ... (keeping the existing church_id), and the app action refused
--   existing profiles — so a church-bound user could never become a PO. Now
--   the upserts explicitly null church_id, converting the existing account to
--   a church-less PO (profile, approved servant row, global grant). All other
--   behavior (single-flight guard, validation, audit, privileges) unchanged.
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

  -- PO profile (church-less; converts an existing church-bound profile)
  INSERT INTO profiles (id, church_id, email, full_name_ar, full_name_en, phone, preferred_locale, is_active)
  VALUES (p_auth_user_id, NULL, v_email, BTRIM(p_full_name_ar), NULL, p_phone, 'ar', true)
  ON CONFLICT (id) DO UPDATE SET
    church_id = NULL,
    email = EXCLUDED.email,
    full_name_ar = COALESCE(EXCLUDED.full_name_ar, profiles.full_name_ar),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    is_active = true;

  -- Approved servant row (middleware gate requires approval_status = 'approved';
  -- converts an existing church-bound servant row to church-less)
  INSERT INTO servants (id, church_id, approval_status, approved_by, approved_at)
  VALUES (p_auth_user_id, NULL, 'approved', p_auth_user_id, now())
  ON CONFLICT (id) DO UPDATE SET
    church_id = NULL,
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
-- PART 5 — Privileges. Re-issued so this batch is self-contained and idempotent
--   (CREATE OR REPLACE preserves privileges, but the REVOKE/GRANT guarantees
--   the exact boundary). Added: seed_church_roles() was SECURITY DEFINER and
--   PUBLIC-executable (040) — a self-promotion vector — now locked to
--   service_role, matching 026/040 lockdown conventions. All real callers are
--   SECURITY DEFINER RPCs (approve_church_request 023:726, provision_church
--   032:120, reactivation 025:229), which run as the definer (postgres), so
--   nothing breaks.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION seed_platform_owner_role() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION seed_platform_owner_role() TO service_role;

REVOKE ALL ON FUNCTION bootstrap_platform_owner(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION bootstrap_platform_owner(uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION seed_church_roles(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION seed_church_roles(uuid) TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Canonical labels
--   SELECT role_type, name_ar, name_en, church_id IS NULL AS is_global
--   FROM roles WHERE is_system = true ORDER BY role_type;
--   -- platform_owner | مدير النظام      | Platform Owner  | true
--   -- super_admin    | مدير الكنيسة     | Church Manager  | false
--   -- admin          | مدير الخدمة      | Admin           | false
--   -- stage_manager  | مدير المرحلة     | Stage Manager   | false
--   -- servant        | خادم             | Servant         | false
-- V2 — PO conversion (as the staging account 5ce66764-e8f7-4b9f-a22d-46e84df849b3)
--   SELECT church_id, is_active FROM profiles WHERE id = '<po>';      -> NULL | true
--   SELECT church_id, approval_status FROM servants WHERE id = '<po>';-> NULL | approved
--   SELECT r.role_type, ur.church_id, ur.end_date FROM user_roles ur
--   JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = '<po>';
--   -- platform_owner | NULL | NULL   (global grant active)
-- V3 — Security re-checks
--   SELECT user_is_platform_owner();                     -- true as the PO
--   SELECT has_function_privilege('anon',
--     'bootstrap_platform_owner(uuid,text,text,text)', 'EXECUTE'); -- false
--   SELECT has_function_privilege('authenticated',
--     'bootstrap_platform_owner(uuid,text,text,text)', 'EXECUTE'); -- false
--   SELECT has_function_privilege('public',
--     'seed_church_roles(uuid)', 'EXECUTE');             -- false (hardening)
--   Second bootstrap call -> RAISE platform_owner_already_exists
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   Part 1 labels: restore from the pre-041 snapshot, or re-run the old seed
--     labels manually (super_admin 'مدير النظام'/'Super Admin' etc.).
--   Parts 2-4: restore the pre-041 function bodies (026 / 040 definitions)
--     via CREATE OR REPLACE.
--   Part 5: GRANT EXECUTE ON FUNCTION seed_church_roles(uuid) TO PUBLIC;
--     (plus the 026 REVOKE/GRANT lines re-run as they were).
--   NOTE: this migration performs a small data migration (label UPDATEs).
--     Rollback of label changes is a data fix, not a DDL reversal.
-- ============================================================================
