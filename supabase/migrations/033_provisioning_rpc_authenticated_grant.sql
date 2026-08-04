-- ============================================================================
-- 033 — PO provisioning RPCs: add `authenticated` EXECUTE
-- Fixes 032. `provision_church` / `create_church_super_admin` guard on
-- `auth.uid()` and `user_is_platform_owner()` (022), which read the caller's
-- JWT `sub`. Called with the service_role key, `auth.uid()` is NULL, so the
-- `not_authenticated` guard always fires and the RPCs are uncallable.
--
-- Resolution mirrors the `approve_church_request` / `reject_church_request`
-- pattern (023 S11-7, S12): grant EXECUTE to `authenticated`, keep
-- `service_role`, and let the internal `user_is_platform_owner()` guard enforce
-- PO-only access. Server actions call the RPCs through the session client
-- (matches PLATFORM_OWNER_ADMIN_SPRINT_ARCHITECTURE_REVIEW "import_users" note:
-- "allow authenticated EXECUTE and let the RPC enforce the guard").
-- ============================================================================

BEGIN;

-- provision_church: authenticated (PO session path) + service_role (retained)
REVOKE ALL ON FUNCTION provision_church(
  text, text, text, text, text, text, uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION provision_church(
  text, text, text, text, text, text, uuid, text, text, text, text
) TO authenticated, service_role;

-- create_church_super_admin: authenticated (PO session path) + service_role
REVOKE ALL ON FUNCTION create_church_super_admin(
  uuid, uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION create_church_super_admin(
  uuid, uuid, text, text, text, text
) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Privileges (032 V2 expected values are superseded):
--   SELECT has_function_privilege('anon', 'provision_church(text,text,text,text,text,text,uuid,text,text,text,text)', 'EXECUTE');        -- false
--   SELECT has_function_privilege('authenticated', 'provision_church(text,text,text,text,text,text,uuid,text,text,text,text)', 'EXECUTE'); -- true
--   SELECT has_function_privilege('service_role', 'provision_church(text,text,text,text,text,text,uuid,text,text,text,text)', 'EXECUTE');  -- true
--   SELECT has_function_privilege('authenticated', 'create_church_super_admin(uuid,uuid,text,text,text,text)', 'EXECUTE');                 -- true
--   SELECT has_function_privilege('service_role', 'create_church_super_admin(uuid,uuid,text,text,text,text)', 'EXECUTE');                  -- true
--
-- V2 — PO-only guard still enforced from an authenticated session:
--   - Call provision_church(...) as a non-PO authenticated user → 'not_platform_owner'
--   - Call as anon → 'not_authenticated'
-- ============================================================================

-- ============================================================================
-- ROLLBACK
-- R1  REVOKE EXECUTE ON FUNCTION provision_church(
--       text, text, text, text, text, text, uuid, text, text, text, text
--     ) FROM authenticated;
-- R2  REVOKE EXECUTE ON FUNCTION create_church_super_admin(
--       uuid, uuid, text, text, text, text
--     ) FROM authenticated;
-- ============================================================================
