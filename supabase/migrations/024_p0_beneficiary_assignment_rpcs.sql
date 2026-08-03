-- ============================================================================
-- Church Ministry CRM — P0 Beneficiary Assignment RPCs
-- Migration: 024_p0_beneficiary_assignment_rpcs.sql
-- Action: Add 2 SECURITY DEFINER RPCs that perform the multi-row beneficiary
--         assignment writes the app layer cannot do directly:
--           1. create_beneficiary_with_assignment(...) — insert beneficiary +
--              its current beneficiary_assignments row atomically.
--           2. transfer_beneficiary(...) — close the current assignment
--              (is_current=false + end_date + reason) and open a new one.
-- Why RPC: beneficiary_assignments is RLS-immutable by design
--   (immutable_update / immutable_delete, 022). The old client code inserted a
--   second is_current=true row without closing the first, producing duplicate
--   current assignments (C4). Only a SECURITY DEFINER function may perform the
--   UPDATE+INSERT pair atomically. Mirrors the Phase 3C RPC conventions
--   (023 S11/S12): SECURITY DEFINER, search_path = public, auth, actor guards
--   inside, explicit audit rows, and REVOKE/GRANT privilege lockdown.
-- Dependencies (must exist from 001–023): gen_random_uuid (001), beneficiaries
--   (013), beneficiary_assignments (014), servants (011), gender_type enum (001),
--   get_user_church_id / user_is_admin (022), write_audit_log (019).
-- Transaction: single BEGIN/COMMIT (matches 022/023 style).
-- ============================================================================

BEGIN;

-- ============================================================================
-- R1 — create_beneficiary_with_assignment(...)
-- Guards (defense in depth): authenticated; caller has a profile; caller is
--   admin/super_admin of their church (matches the beneficiary_assignments
--   admin_write INSERT policy); service/stage belong to the caller's church;
--   caller has a servants row (canonical model: servants.id = profiles.id).
-- data quality: full_name_ar required; date_of_birth/gender are NOT NULL on
--   beneficiaries while the UI makes them optional, so they are COALESCE'd to
--   the same defaults used by migration 013's backfill ('2000-01-01'/'male').
-- Side effects: beneficiaries insert (auto-audited by audit_beneficiaries,
--   023 S10) + beneficiary_assignments insert + explicit audit row.
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_full_name_ar IS NULL OR BTRIM(p_full_name_ar) = '' THEN
    RAISE EXCEPTION 'full_name_required';
  END IF;

  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF NOT user_is_admin(v_church_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

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

  SELECT id INTO v_servant_id
  FROM servants
  WHERE id = auth.uid() AND deleted_at IS NULL;

  IF v_servant_id IS NULL THEN
    RAISE EXCEPTION 'servant_not_found';
  END IF;

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
-- R2 — transfer_beneficiary(...)
-- Guards: authenticated; caller is admin/super_admin of the beneficiary's
--   church; beneficiary exists in that church and is not deleted; new
--   service/stage belong to the church.
-- Semantics: closes EVERY current assignment (idempotent if duplicates exist
--   from the pre-fix C4 bug), then inserts a fresh is_current=true row. The
--   care-taker (servant_id) is carried over from the closed assignment; if the
--   beneficiary had none, the first church servant is used. No-op when the
--   target service/stage already equals the current assignment.
-- Side effects: UPDATE + INSERT (RLS-immutable table, function owner bypasses
--   RLS), explicit audit row (action 'transfer').
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF NOT user_is_admin(v_church_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM beneficiaries b
    WHERE b.id = p_beneficiary_id AND b.church_id = v_church_id AND b.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'beneficiary_not_found';
  END IF;

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

  SELECT servant_id, service_id, stage_id
    INTO v_servant_id, v_old_service_id, v_old_stage_id
  FROM beneficiary_assignments
  WHERE beneficiary_id = p_beneficiary_id AND is_current = true
  ORDER BY start_date DESC
  LIMIT 1;

  -- No-op: target already matches the current assignment.
  IF v_old_service_id IS NOT NULL
     AND v_old_service_id = p_new_service_id
     AND v_old_stage_id = p_new_stage_id THEN
    RETURN;
  END IF;

  -- Close all current assignments (idempotent; collapses C4 duplicates).
  UPDATE beneficiary_assignments
  SET is_current = false, end_date = CURRENT_DATE, transfer_reason = p_reason
  WHERE beneficiary_id = p_beneficiary_id AND is_current = true;

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
-- S1 — RPC privilege lockdown (matches 023 S12)
-- Supabase grants EXECUTE to PUBLIC by default, so revoke first, then grant to
-- the intended PostgREST surface (authenticated).
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
-- V2 — Flow smoke (scratch project, real sessions)
--   super_admin .rpc('create_beneficiary_with_assignment', {...}) → returns uuid;
--   verify exactly ONE is_current=true row per new beneficiary;
--   .rpc('transfer_beneficiary', {p_beneficiary_id, p_new_service_id, p_new_stage_id})
--   → old row is_current=false + end_date set, new row is_current=true;
--   repeat transfer → no-op (assignment count unchanged);
--   non-admin .rpc(...) → 'not_admin'.
-- ============================================================================

-- ============================================================================
-- ROLLBACK NOTES (in-place reverse DDL; primary rollback = restore the P0.7
-- backup snapshot, since the batch is non-destructive to existing data)
-- R1  DROP FUNCTION create_beneficiary_with_assignment(text,text,date,text,uuid,uuid,text,text,text,text,text,text,text,text,text);
-- R2  DROP FUNCTION transfer_beneficiary(uuid, uuid, uuid, text);
--     -- No data migration was done, so rollback restores the pre-fix state
--     -- (client-side transfer still broken until the code is also reverted).
-- ============================================================================
