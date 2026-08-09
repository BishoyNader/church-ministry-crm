-- ============================================================================
-- Church Ministry CRM — Platform Beneficiary Management
-- Migration: 042_platform_beneficiary_management.sql
-- Action: Add SECURITY DEFINER RPC create_beneficiary_for_church(...) that lets
--         a Platform Owner (church_id NULL, no RLS path to beneficiaries) OR a
--         church super_admin create a beneficiary for a specific church — with
--         an optional current stage assignment — atomically.
-- Why RPC: beneficiaries INSERT is RLS-gated to the actor's own church (022);
--   the PO has no platform_owner_* policies on beneficiaries, and the existing
--   024 RPC (create_beneficiary_with_assignment) hard-scopes to the caller's
--   church (get_user_church_id) and requires a servants row. This RPC accepts
--   an explicit p_church_id and guards it with the same identity helpers as
--   034 (create_church_user): user_is_platform_owner() OR user_is_super_admin(p_church_id).
--   beneficiary_assignments is RLS-immutable, so assignment creation must run
--   inside the RPC (mirrors 024/034 conventions): SECURITY DEFINER,
--   search_path = public, auth, actor guards, explicit audit, privilege lockdown.
-- Dependencies (must exist from 001–041): beneficiaries (013),
--   beneficiary_assignments (014), servants (011), gender_type enum (001),
--   user_is_platform_owner() / user_is_super_admin(p_church_id) (022/028/041),
--   write_audit_log (019).
-- Transaction: single BEGIN/COMMIT (matches 022/023/024 style).
-- ============================================================================

BEGIN;

-- ============================================================================
-- R1 — create_beneficiary_for_church(...)
-- Guards (defense in depth): authenticated; platform owner OR super admin of
--   the target church; church exists and is not deleted; full_name_ar required;
--   service + stage must be provided together (or neither) and must belong to
--   the church. When a stage is given, the caretaker (servant_id) is the acting
--   user if they are a servant of that church, otherwise the first active church
--   servant (the PO has no servants row of their own). Raises servant_not_found
--   when the church has no servants at all.
-- Side effects: beneficiaries insert (auto-audited by audit_beneficiaries,
--   023 S10) + optional beneficiary_assignments insert + explicit audit row.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_beneficiary_for_church(
  p_church_id uuid,
  p_full_name_ar text,
  p_service_id uuid DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
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
  v_beneficiary_id uuid;
  v_servant_id uuid;
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

  IF p_full_name_ar IS NULL OR BTRIM(p_full_name_ar) = '' THEN
    RAISE EXCEPTION 'full_name_ar_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM churches c
    WHERE c.id = p_church_id AND c.deleted_at IS NULL
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'church_not_found';
  END IF;

  -- Service and stage must be supplied together (a current assignment needs both).
  IF (p_service_id IS NULL) <> (p_stage_id IS NULL) THEN
    RAISE EXCEPTION 'service_and_stage_required';
  END IF;

  IF p_service_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = p_service_id AND s.church_id = p_church_id AND s.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'service_not_found';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM stages st
      WHERE st.id = p_stage_id AND st.church_id = p_church_id AND st.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'stage_not_found';
    END IF;
  END IF;

  INSERT INTO beneficiaries
    (church_id, full_name_ar, full_name_en, date_of_birth, gender,
     father_mobile, mother_mobile, mobile, whatsapp, address, school,
     confession_father, notes, photo_url)
  VALUES
    (p_church_id, BTRIM(p_full_name_ar), NULLIF(BTRIM(p_full_name_en), ''),
     COALESCE(p_date_of_birth, '2000-01-01'),
     COALESCE(p_gender, 'male')::gender_type,
     NULLIF(BTRIM(p_father_mobile), ''), NULLIF(BTRIM(p_mother_mobile), ''),
     NULLIF(BTRIM(p_mobile), ''), NULLIF(BTRIM(p_whatsapp), ''),
     NULLIF(BTRIM(p_address), ''), NULLIF(BTRIM(p_school), ''),
     NULLIF(BTRIM(p_confession_father), ''), NULLIF(BTRIM(p_notes), ''),
     NULLIF(BTRIM(p_photo_url), ''))
  RETURNING id INTO v_beneficiary_id;

  IF p_service_id IS NOT NULL THEN
    SELECT id INTO v_servant_id
    FROM servants
    WHERE id = auth.uid() AND church_id = p_church_id AND deleted_at IS NULL;

    IF v_servant_id IS NULL THEN
      SELECT id INTO v_servant_id
      FROM servants
      WHERE church_id = p_church_id AND deleted_at IS NULL
      ORDER BY created_at
      LIMIT 1;
    END IF;

    IF v_servant_id IS NULL THEN
      RAISE EXCEPTION 'servant_not_found';
    END IF;

    INSERT INTO beneficiary_assignments
      (church_id, beneficiary_id, service_id, stage_id, servant_id, assigned_by,
       is_current, start_date)
    VALUES
      (p_church_id, v_beneficiary_id, p_service_id, p_stage_id, v_servant_id,
       auth.uid(), true, CURRENT_DATE);

    PERFORM write_audit_log(
      p_church_id, 'create', 'beneficiary_assignment', v_beneficiary_id, NULL,
      jsonb_build_object('service_id', p_service_id, 'stage_id', p_stage_id)
    );
  END IF;

  RETURN v_beneficiary_id;
END;
$$;

-- ============================================================================
-- S1 — RPC privilege lockdown (matches 024 S1 / 034)
-- Supabase grants EXECUTE to PUBLIC by default, so revoke first, then grant to
-- the intended PostgREST surface (authenticated). service_role is granted so
-- maintenance tooling may invoke it without a user session.
-- ============================================================================

REVOKE ALL ON FUNCTION create_beneficiary_for_church(
  uuid, text, uuid, uuid, text, date, text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_beneficiary_for_church(
  uuid, text, uuid, uuid, text, date, text, text, text, text, text, text, text, text, text, text
) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Function & privileges
--   SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname='public' AND p.proname = 'create_beneficiary_for_church';
--   -- prosecdef = true; proconfig contains search_path
--   SELECT has_function_privilege('anon',
--     'create_beneficiary_for_church(uuid,text,uuid,uuid,text,date,text,text,text,text,text,text,text,text,text,text)',
--     'EXECUTE'); -- false
--   SELECT has_function_privilege('authenticated',
--     'create_beneficiary_for_church(uuid,text,uuid,uuid,text,date,text,text,text,text,text,text,text,text,text,text)',
--     'EXECUTE'); -- true
-- V2 — Flow smoke (scratch project, real sessions)
--   super_admin .rpc('create_beneficiary_for_church', {p_church_id, p_full_name_ar: 'اختبار'}) → uuid;
--   PO .rpc('create_beneficiary_for_church', {p_church_id, p_full_name_ar: 'اختبار', p_service_id, p_stage_id})
--     → uuid + exactly ONE is_current=true assignment row (caretaker = church servant);
--   non-admin church user .rpc(...) → 'not_allowed';
--   stage-only (no service) .rpc(...) → 'service_and_stage_required'.
-- ============================================================================

-- ============================================================================
-- ROLLBACK NOTES (in-place reverse DDL; primary rollback = restore the 042
-- backup snapshot, since the batch is non-destructive to existing data)
-- R1  DROP FUNCTION create_beneficiary_for_church(uuid,text,uuid,uuid,text,date,text,text,text,text,text,text,text,text,text,text);
--     -- No data migration was done, so rollback restores the pre-fix state
--     -- (client bulk-import for PO falls back to the 024 RPC + plain insert).
-- ============================================================================
