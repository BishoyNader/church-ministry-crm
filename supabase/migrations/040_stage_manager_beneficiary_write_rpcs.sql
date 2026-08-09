-- ============================================================================
-- Church Ministry CRM — Stage-Manager-Aware Beneficiary Write RPCs
-- Migration: 040_stage_manager_beneficiary_write_rpcs.sql
-- Action: Recreate create_beneficiary_with_assignment(...) and
--         transfer_beneficiary(...) so Stage Managers (and any non-admin
--         holder of beneficiaries.create / beneficiaries.transfer) can operate
--         strictly within their assigned stage scope, while Admin / Super
--         Admin retain their existing church-wide behavior.
-- Root cause (UAT): 024 only recognized user_is_admin(); Stage Managers hold
--         beneficiaries.create from seed_church_roles (037) and the UI/actions
--         allow create/transfer, but the RPCs rejected them with 'not_admin'
--         (HTTP 400 / P0001), so stage-scoped writes were impossible.
-- Authorization model (inside the RPC — the DB is the final boundary):
--   * Caller must be authenticated and have a profile (church) — unchanged.
--   * Admin / Super Admin (user_is_admin, 022) -> church-wide path, unchanged.
--   * Everyone else (stage_manager, servant, …):
--       - create_beneficiary_with_assignment: requires the
--         'beneficiaries.create' permission (user_has_permission_in_church,
--         028) AND p_stage_id IN get_user_stage_ids() (022/039).
--       - transfer_beneficiary: requires the 'beneficiaries.transfer'
--         permission AND the beneficiary's current assignment stage AND the
--         destination stage are BOTH in get_user_stage_ids(). This blocks:
--           * Stage A manager -> transfer a Stage A child to Stage B (no B)
--           * Stage B manager -> transfer a Stage A child (no source access)
--         i.e. transfer can never be used to escape the actor's stage scope.
--   * New integrity guard on both RPCs: p_stage_id must belong to
--     p_service_id (stages.service_id, NOT NULL) — a forged/mismatched pair is
--     rejected with 'stage_service_mismatch'. Only rejects invalid input.
-- Error codes (consistent with the existing lowercase code convention):
--   not_authenticated | profile_not_found | full_name_required (create)
--   service_not_found | stage_not_found | beneficiary_not_found (transfer)
--   stage_service_mismatch | not_authorized | stage_access_denied
--   source_stage_access_denied | destination_stage_access_denied | servant_not_found
-- Behavior preservation vs 024: exact function signatures (no defaults
--   added), the beneficiaries INSERT column list + COALESCE/NULLIF defaults,
--   the beneficiary_assignments INSERT column lists, the current-assignment
--   lookup (ORDER BY start_date DESC LIMIT 1), the transfer UPDATE + orphan
--   servant fallback (first church servant) + transfer_reason carried to the
--   new row, and BOTH write_audit_log calls (action 'create'/'transfer',
--   entity 'beneficiary_assignment'/'beneficiary', same old/new JSON shapes)
--   are unchanged for the admin path.
-- Part 1 additionally grants 'beneficiaries.transfer' to the stage_manager
--   system role (seed_church_roles for future churches + idempotent backfill
--   of existing churches) so the RPC permission gate can be satisfied.
-- Dependencies: 022 (get_user_church_id/user_is_admin/get_user_stage_ids),
--               028 (user_has_permission_in_church), 037 (stage_manager role),
--               039 (stage-scope resolution alignment).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — Grant 'beneficiaries.transfer' to the stage_manager system role
--   1a. seed_church_roles(): add 'beneficiaries.transfer' to the
--       stage_manager code list (applies to churches provisioned after this).
--   1b. Backfill existing stage_manager system roles (idempotent).
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_church_roles(p_church_id uuid)
RETURNS void AS $$
DECLARE
  v_role_id uuid;
BEGIN
  -- Super Admin role (all permissions EXCEPT platform-only modules)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'super_admin', 'مدير النظام', 'Super Admin', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE module NOT IN ('tenants', 'system');

  -- Admin role (corrected: full ministry operations + notifications + settings)
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

-- Backfill EXISTING stage_manager system roles with beneficiaries.transfer
-- (idempotent: only rows missing the permission are inserted).
DO $$
DECLARE
  v_role_id uuid;
  v_perm_id uuid;
BEGIN
  FOR v_role_id IN
    SELECT r.id
    FROM roles r
    WHERE r.role_type = 'stage_manager' AND r.is_system = true
      AND NOT EXISTS (
        SELECT 1
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = r.id AND p.code = 'beneficiaries.transfer'
      )
  LOOP
    SELECT id INTO v_perm_id
    FROM permissions
    WHERE code = 'beneficiaries.transfer';

    IF v_perm_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- PART 2 — R1: create_beneficiary_with_assignment(...)
-- Guards (defense in depth): authenticated; full_name_ar required; caller has
--   a profile; service/stage exist in the caller's church; stage belongs to
--   the selected service; Admin/Super Admin church-wide OR non-admin with
--   'beneficiaries.create' AND p_stage_id inside get_user_stage_ids(); caller
--   has a servants row (canonical model: servants.id = profiles.id).
-- Side effects: beneficiaries insert (auto-audited by audit_beneficiaries)
--   + beneficiary_assignments insert + explicit audit row (unchanged from 024).
-- ============================================================================

CREATE OR REPLACE FUNCTION create_beneficiary_with_assignment(
  p_full_name_ar text,
  p_service_id uuid,
  p_stage_id uuid,
  p_full_name_en text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_mobile text DEFAULT NULL,
  p_father_mobile text DEFAULT NULL,
  p_mother_mobile text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_school text DEFAULT NULL,
  p_confession_father text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_beneficiary_id uuid;
  v_servant_id uuid;
BEGIN
  -- 1. AUTH — actor must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- 2. DATA QUALITY — full Arabic name is required
  IF p_full_name_ar IS NULL OR BTRIM(p_full_name_ar) = '' THEN
    RAISE EXCEPTION 'full_name_required';
  END IF;

  -- 3. PROFILE — actor must have a church profile
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  -- 4. CHURCH-BOUND VALIDATION — service & stage exist in this church
  IF NOT EXISTS (
    SELECT 1 FROM services s
    WHERE s.id = p_service_id AND s.church_id = v_church_id AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'service_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stages st
    WHERE st.id = p_stage_id AND st.church_id = v_church_id AND st.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'stage_not_found';
  END IF;

  -- 5. INTEGRITY — selected stage must belong to the selected service
  IF NOT EXISTS (
    SELECT 1 FROM stages st
    WHERE st.id = p_stage_id AND st.service_id = p_service_id
  ) THEN
    RAISE EXCEPTION 'stage_service_mismatch';
  END IF;

  -- 6. AUTHORIZATION — Admin / Super Admin are church-wide; everyone else must
  --    hold 'beneficiaries.create' and operate inside their stage scope
  IF NOT user_is_admin(v_church_id) THEN
    IF NOT user_has_permission_in_church('beneficiaries.create', v_church_id) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;

    IF NOT (p_stage_id = ANY(get_user_stage_ids())) THEN
      RAISE EXCEPTION 'stage_access_denied';
    END IF;
  END IF;

  -- 7. SERVANT ROW — canonical model requires a servants row for the actor
  SELECT id INTO v_servant_id
  FROM servants
  WHERE id = auth.uid() AND deleted_at IS NULL;

  IF v_servant_id IS NULL THEN
    RAISE EXCEPTION 'servant_not_found';
  END IF;

  -- 8. INSERT BENEFICIARY + ASSIGNMENT + AUDIT (atomic, single tx)
  INSERT INTO beneficiaries
    (church_id, full_name_ar, full_name_en, date_of_birth, gender,
     father_mobile, mother_mobile, mobile, whatsapp, address, school,
     confession_father, notes, photo_url)
  VALUES
    (v_church_id, BTRIM(p_full_name_ar), NULLIF(BTRIM(p_full_name_en), ''),
     COALESCE(p_date_of_birth, '2000-01-01'),
     COALESCE(p_gender, 'male')::gender_type,
     NULLIF(BTRIM(p_father_mobile), ''), NULLIF(BTRIM(p_mother_mobile), ''),
     NULLIF(BTRIM(p_mobile), ''), NULLIF(BTRIM(p_whatsapp), ''),
     NULLIF(BTRIM(p_address), ''), NULLIF(BTRIM(p_school), ''),
     NULLIF(BTRIM(p_confession_father), ''), NULLIF(BTRIM(p_notes), ''),
     NULLIF(BTRIM(p_photo_url), ''))
  RETURNING id INTO v_beneficiary_id;

  INSERT INTO beneficiary_assignments
    (church_id, beneficiary_id, service_id, stage_id, servant_id, assigned_by,
     is_current, start_date)
  VALUES
    (v_church_id, v_beneficiary_id, p_service_id, p_stage_id, v_servant_id,
     auth.uid(), true, CURRENT_DATE);

  PERFORM write_audit_log(
    v_church_id, 'create', 'beneficiary_assignment', v_beneficiary_id, NULL,
    jsonb_build_object('service_id', p_service_id, 'stage_id', p_stage_id)
  );

  RETURN v_beneficiary_id;
END;
$$;

-- ============================================================================
-- PART 3 — R2: transfer_beneficiary(...)
-- Guards: authenticated; caller has a profile; beneficiary exists in that
--   church and is not deleted; destination service/stage belong to the
--   church; destination stage belongs to the destination service; Admin /
--   Super Admin church-wide OR non-admin with 'beneficiaries.transfer' AND
--   the source stage AND the destination stage inside get_user_stage_ids().
-- Semantics (unchanged from 024): closes EVERY current assignment
--   (idempotent if duplicates exist), inserts a fresh is_current=true row,
--   the care-taker (servant_id) is carried over from the closed assignment,
--   falling back to the first church servant if the beneficiary had none;
--   no-op when the target service/stage already equals the current
--   assignment; transfer_reason preserved on both the closed and new rows.
-- Side effects: UPDATE + INSERT (RLS-immutable table, function owner bypasses
--   RLS), explicit audit row (action 'transfer', unchanged from 024).
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_beneficiary(
  p_beneficiary_id uuid,
  p_new_service_id uuid,
  p_new_stage_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_servant_id uuid;
  v_old_service_id uuid;
  v_old_stage_id uuid;
BEGIN
  -- 1. AUTH — actor must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- 2. PROFILE — actor must have a church profile
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  -- 3. EXISTENCE — beneficiary exists in this church and is not deleted
  IF NOT EXISTS (
    SELECT 1 FROM beneficiaries b
    WHERE b.id = p_beneficiary_id AND b.church_id = v_church_id AND b.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'beneficiary_not_found';
  END IF;

  -- 4. DESTINATION — service & stage exist in this church
  IF NOT EXISTS (
    SELECT 1 FROM services s
    WHERE s.id = p_new_service_id AND s.church_id = v_church_id AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'service_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stages st
    WHERE st.id = p_new_stage_id AND st.church_id = v_church_id AND st.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'stage_not_found';
  END IF;

  -- 5. INTEGRITY — destination stage must belong to the destination service
  IF NOT EXISTS (
    SELECT 1 FROM stages st
    WHERE st.id = p_new_stage_id AND st.service_id = p_new_service_id
  ) THEN
    RAISE EXCEPTION 'stage_service_mismatch';
  END IF;

  -- 6. CURRENT ASSIGNMENT — locate the open assignment (matches 024 exactly:
  --    single current row by design, ORDER BY start_date DESC LIMIT 1)
  SELECT servant_id, service_id, stage_id
    INTO v_servant_id, v_old_service_id, v_old_stage_id
  FROM beneficiary_assignments
  WHERE beneficiary_id = p_beneficiary_id AND is_current = true
  ORDER BY start_date DESC
  LIMIT 1;

  -- 7. AUTHORIZATION — Admin / Super Admin are church-wide; everyone else must
  --    hold 'beneficiaries.transfer' and stay inside their stage scope:
  --    - source: the current assignment's stage must be in scope
  --      (beneficiaries outside the actor's stages are untouchable)
  --    - destination: the target stage must be in scope
  --      (blocks using transfer to escape into other stages)
  IF NOT user_is_admin(v_church_id) THEN
    IF NOT user_has_permission_in_church('beneficiaries.transfer', v_church_id) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;

    IF v_old_stage_id IS NULL OR NOT (v_old_stage_id = ANY(get_user_stage_ids())) THEN
      RAISE EXCEPTION 'source_stage_access_denied';
    END IF;

    IF NOT (p_new_stage_id = ANY(get_user_stage_ids())) THEN
      RAISE EXCEPTION 'destination_stage_access_denied';
    END IF;
  END IF;

  -- 8. NO-OP — target already matches the current assignment
  IF v_old_service_id IS NOT NULL
     AND v_old_service_id = p_new_service_id
     AND v_old_stage_id = p_new_stage_id THEN
    RETURN;
  END IF;

  -- 9. CLOSE — close all current assignments (idempotent; collapses duplicates)
  UPDATE beneficiary_assignments
  SET is_current = false, end_date = CURRENT_DATE, transfer_reason = p_reason
  WHERE beneficiary_id = p_beneficiary_id AND is_current = true;

  -- 10. SERVANT FALLBACK — carry over the care-taker; if the beneficiary had
  --     no current assignment, use the first church servant (024 semantics)
  IF v_servant_id IS NULL THEN
    SELECT id INTO v_servant_id
    FROM servants
    WHERE church_id = v_church_id AND deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_servant_id IS NULL THEN
    RAISE EXCEPTION 'servant_not_found';
  END IF;

  -- 11. INSERT — fresh current assignment (transfer_reason preserved) + audit
  INSERT INTO beneficiary_assignments
    (church_id, beneficiary_id, service_id, stage_id, servant_id, assigned_by,
     is_current, start_date, transfer_reason)
  VALUES
    (v_church_id, p_beneficiary_id, p_new_service_id, p_new_stage_id,
     v_servant_id, auth.uid(), true, CURRENT_DATE, p_reason);

  PERFORM write_audit_log(
    v_church_id, 'transfer', 'beneficiary', p_beneficiary_id,
    jsonb_build_object('service_id', v_old_service_id, 'stage_id', v_old_stage_id),
    jsonb_build_object('service_id', p_new_service_id, 'stage_id', p_new_stage_id)
  );
END;
$$;

-- ============================================================================
-- PART 4 — RPC privilege lockdown (matches 024 S1 exactly; re-issued so the
-- batch is self-contained and idempotent for a fresh install too)
-- ============================================================================

REVOKE ALL ON FUNCTION create_beneficiary_with_assignment(
  text, uuid, uuid, text, date, text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_beneficiary_with_assignment(
  text, uuid, uuid, text, date, text, text, text, text, text, text, text, text, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION transfer_beneficiary(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION transfer_beneficiary(uuid, uuid, uuid, text)
  TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Functions & privileges
--   SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname='public' AND p.proname IN
--     ('create_beneficiary_with_assignment','transfer_beneficiary');
--   -- prosecdef = true; proconfig contains search_path
--   SELECT has_function_privilege('anon',
--     'create_beneficiary_with_assignment(text,uuid,uuid,text,date,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE'); -- false
--   SELECT has_function_privilege('authenticated',
--     'create_beneficiary_with_assignment(text,uuid,uuid,text,date,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE'); -- true
-- V2 — Role grant
--   SELECT r.church_id, count(*) FROM roles r
--   JOIN role_permissions rp ON rp.role_id = r.id
--   JOIN permissions p ON p.id = rp.permission_id
--   WHERE r.role_type = 'stage_manager' AND p.code = 'beneficiaries.transfer'
--   GROUP BY r.church_id;  -- one row per church with stage_manager role
-- V3 — Flow smoke (see docs/project/STAGE_MANAGER_BENEFICIARY_WRITE_SECURITY_REPORT.md
--   for the full live matrix; representative cases below):
--   Stage Manager (Stage A only), as an authenticated session:
--     create in Stage A          -> returns uuid (PASS)
--     create in Stage B          -> 'stage_access_denied'
--     create with another church stage -> 'stage_not_found'
--     transfer A child A1 -> A1  -> void no-op (PASS)
--     transfer A1 -> B (B out of scope) -> 'destination_stage_access_denied'
--     transfer B child -> A      -> 'source_stage_access_denied'
--   Admin / Super Admin: same calls -> all succeed (church-wide, unchanged).
--   Servant: create / transfer   -> 'not_authorized'
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   Restore the pre-040 function bodies (see 024) via CREATE OR REPLACE with
--   the 024 definitions, or restore the pre-040 database snapshot. Remove
--   'beneficiaries.transfer' from stage_manager roles with a targeted DELETE
--   by (role_id, permission_id). No data migration was performed, so the
--   rollback is purely DDL + a permission row.
-- ============================================================================
