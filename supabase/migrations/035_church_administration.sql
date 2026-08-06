-- ============================================================================
-- 035 — Church administration enhancement: four-state status + change manager
--
-- Sprint 1 (PLATFORM_OWNER_ADMIN_SPRINT_CHURCH_MANAGEMENT). Two additive
-- changes, no RLS/RBAC weakening:
--
--   S1  churches.status column (active/inactive/suspended/disabled)
--       * backfilled from the existing is_active boolean
--       * a BEFORE trigger keeps is_active and status in sync (status is the
--         source of truth; is_active is retained for the existing RLS/RPC
--         surfaces that filter on it, e.g. list_churches_for_signup 023).
--   S2  change_church_manager(p_church_id, p_new_user_id) SECURITY DEFINER RPC
--       * ends the current active super_admin grant, then reactivates-or-
--         inserts the grant for the new manager (same user_roles pattern as
--         create_church_user, 034)
--       * audits both the church update and the role assignment
--       * privilege pattern mirrors 033/034: authenticated + service_role
--         EXECUTE, anon blocked; internal user_is_platform_owner() /
--         user_is_super_admin(church_id) guard is the enforcement boundary.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- S1. churches.status — four-state tenant status.
-- ----------------------------------------------------------------------------
ALTER TABLE churches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'suspended', 'disabled'));

-- Backfill from the existing boolean state (default is 'active', so only
-- rows that are inactive need an explicit value).
UPDATE churches
SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
WHERE status <> CASE WHEN is_active THEN 'active' ELSE 'inactive' END;

-- ----------------------------------------------------------------------------
-- S1a. Sync trigger — status is the source of truth; is_active follows.
-- Existing callers that set is_active (activate/deactivate) keep working: the
-- trigger maps is_active=false -> status='inactive', and conversely setting
-- status='suspended'/'disabled' flips is_active=false so the existing RLS/RPC
-- surfaces (signup dropdown, create_church_user guard) correctly exclude
-- non-active tenants.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_church_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_active := (NEW.status = 'active');
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.status := CASE WHEN NEW.is_active THEN 'active' ELSE 'inactive' END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_churches_sync_status ON churches;

CREATE TRIGGER trg_churches_sync_status
BEFORE INSERT OR UPDATE ON churches
FOR EACH ROW EXECUTE FUNCTION sync_church_status();

-- ----------------------------------------------------------------------------
-- S2. change_church_manager(...) — swap the active super_admin of a church.
--
-- Guards (identity derived from auth.uid() only):
--   not_authenticated / not_allowed / church_id_required / user_id_required
--   church_not_found / user_not_in_church / super_admin_role_not_found
--
-- Semantics:
--   * new manager must already be a user of the church (approved profile row)
--   * ends the current active super_admin grant(s)
--   * reactivates a historical super_admin grant if one exists, else inserts
--   * audits: 'update' on church (manager_user_id old -> new) + 'assign' on
--     the new manager's user_roles row
-- ============================================================================
CREATE OR REPLACE FUNCTION change_church_manager(
  p_church_id uuid,
  p_new_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role_id uuid;
  v_old_manager uuid;
  v_old_values jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT (user_is_platform_owner() OR user_is_super_admin(p_church_id)) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_church_id IS NULL THEN
    RAISE EXCEPTION 'church_id_required';
  END IF;

  IF p_new_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM churches WHERE id = p_church_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'church_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_new_user_id AND church_id = p_church_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'user_not_in_church';
  END IF;

  SELECT id INTO v_role_id
  FROM roles
  WHERE church_id = p_church_id AND role_type = 'super_admin';

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'super_admin_role_not_found';
  END IF;

  SELECT ur.user_id INTO v_old_manager
  FROM user_roles ur
  WHERE ur.church_id = p_church_id
    AND ur.role_id = v_role_id
    AND ur.end_date IS NULL
  LIMIT 1;

  IF v_old_manager IS NOT DISTINCT FROM p_new_user_id THEN
    RETURN p_new_user_id;
  END IF;

  v_old_values := jsonb_build_object('manager_user_id', v_old_manager);

  -- End the current manager's active grant(s)
  UPDATE user_roles
  SET end_date = CURRENT_DATE
  WHERE church_id = p_church_id
    AND role_id = v_role_id
    AND end_date IS NULL
    AND user_id IS DISTINCT FROM p_new_user_id;

  -- Reactivate a historical grant for the new manager, if any
  UPDATE user_roles
  SET end_date = NULL
  WHERE church_id = p_church_id
    AND role_id = v_role_id
    AND user_id = p_new_user_id
    AND end_date IS NOT NULL;

  -- Otherwise create a fresh grant
  INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)
  SELECT p_church_id, p_new_user_id, v_role_id, auth.uid(), CURRENT_DATE
  WHERE NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE church_id = p_church_id
      AND role_id = v_role_id
      AND user_id = p_new_user_id
      AND end_date IS NULL
  );

  PERFORM write_audit_log(
    p_church_id, 'update', 'church', p_church_id, v_old_values,
    jsonb_build_object('manager_user_id', p_new_user_id)
  );

  PERFORM write_audit_log(
    p_church_id, 'assign', 'role', p_new_user_id, NULL,
    jsonb_build_object('role_type', 'super_admin', 'church_id', p_church_id)
  );

  RETURN p_new_user_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- S3. deactivate_church_user(...) — deactivate a user of a church (used by the
--     church manager card's "disable" action and by PO user management).
--
-- Guards (identity derived from auth.uid() only):
--   not_authenticated / not_allowed / church_id_required / user_id_required
--   church_not_found / user_not_in_church / cannot_disable_last_manager
--
-- Semantics:
--   * sets profiles.is_active = false for the target user in the church
--   * ends that user's active role grants in the church
--   * refuses to deactivate the church's last active super_admin (a church
--     must keep a manager; change the manager first)
--   * audits an 'update' on 'user'
-- ============================================================================
CREATE OR REPLACE FUNCTION deactivate_church_user(
  p_church_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role_id uuid;
  v_active_super_admins integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT (user_is_platform_owner() OR user_is_super_admin(p_church_id)) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_church_id IS NULL THEN
    RAISE EXCEPTION 'church_id_required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM churches WHERE id = p_church_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'church_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND church_id = p_church_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'user_not_in_church';
  END IF;

  SELECT id INTO v_role_id
  FROM roles
  WHERE church_id = p_church_id AND role_type = 'super_admin';

  IF v_role_id IS NOT NULL THEN
    SELECT count(*) INTO v_active_super_admins
    FROM user_roles
    WHERE church_id = p_church_id
      AND role_id = v_role_id
      AND end_date IS NULL
      AND user_id IS DISTINCT FROM p_user_id;

    IF v_active_super_admins = 0 AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE church_id = p_church_id
        AND role_id = v_role_id
        AND user_id = p_user_id
        AND end_date IS NULL
    ) THEN
      RAISE EXCEPTION 'cannot_disable_last_manager';
    END IF;
  END IF;

  UPDATE profiles
  SET is_active = false, updated_at = now()
  WHERE id = p_user_id AND church_id = p_church_id;

  UPDATE user_roles
  SET end_date = CURRENT_DATE
  WHERE church_id = p_church_id
    AND user_id = p_user_id
    AND end_date IS NULL;

  PERFORM write_audit_log(
    p_church_id, 'update', 'user', p_user_id,
    jsonb_build_object('is_active', true),
    jsonb_build_object('is_active', false)
  );

  RETURN p_user_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- S4. Privilege lockdown — 033/034 pattern.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION change_church_manager(uuid, uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION change_church_manager(uuid, uuid)
TO authenticated, service_role;

REVOKE ALL ON FUNCTION deactivate_church_user(uuid, uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION deactivate_church_user(uuid, uuid)
TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Privileges:
--   SELECT has_function_privilege('anon', 'change_church_manager(uuid,uuid)', 'EXECUTE');        -- false
--   SELECT has_function_privilege('authenticated', 'change_church_manager(uuid,uuid)', 'EXECUTE'); -- true
--   SELECT has_function_privilege('service_role', 'change_church_manager(uuid,uuid)', 'EXECUTE');  -- true
-- V2 — Status column:
--   SELECT status, is_active, count(*) FROM churches GROUP BY 1,2;
--   -> backfilled rows are consistent (status='active' <=> is_active=true)
--   UPDATE churches SET status='suspended' WHERE id='<church>'; -> is_active=false
--   UPDATE churches SET status='active'     WHERE id='<church>'; -> is_active=true
--   UPDATE churches SET is_active=false WHERE id='<church>';     -> status='inactive'
-- V3 — change_church_manager:
--   - Call as anon → 'not_authenticated'
--   - Call as non-PO, non-super-admin authenticated user → 'not_allowed'
--   - Call with a user id not in the church → 'user_not_in_church'
--   - Successful call: old manager's super_admin grant has end_date set;
--     new manager has an active super_admin grant; 2 audit rows written.
-- V4 — deactivate_church_user:
--   - Call on the church's last active super_admin → 'cannot_disable_last_manager'
--   - Successful call: profile is_active=false, role grants ended, audit row.
-- ============================================================================

-- ============================================================================
-- ROLLBACK
-- R1  REVOKE EXECUTE ON FUNCTION change_church_manager(uuid,uuid) FROM authenticated;
-- R2  REVOKE EXECUTE ON FUNCTION deactivate_church_user(uuid,uuid) FROM authenticated;
-- R3  DROP FUNCTION change_church_manager(uuid,uuid);
-- R4  DROP FUNCTION deactivate_church_user(uuid,uuid);
-- R5  DROP TRIGGER trg_churches_sync_status ON churches;
-- R6  DROP FUNCTION sync_church_status();
-- R7  ALTER TABLE churches DROP COLUMN IF EXISTS status;
-- ============================================================================
