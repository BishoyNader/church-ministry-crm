-- ============================================================================
-- Church Ministry CRM — Annual Promotion / Graduation Engine
-- Migration: 046_annual_promotion_tables_and_rpcs.sql
-- Action: Add annual_promotions + promotion_entries tables (RPC-only writes,
--         read-only via RLS), and the promotion/graduation RPCs:
--         run_annual_promotions (bulk, per source stage + academic year),
--         run_single_promotion (manual per-beneficiary),
--         undo_promotion (single revert), undo_all_promotions (whole run).
-- Requirement: "Annual promotion / graduation: manual run + undo-all,
--              verified status & noted."
--   * Graduation  = the source stage has no next stage in its service
--                   (ordered by stages.sort_order). Sets beneficiaries.status
--                   to 'inactive' (graduated) with the run noted, and KEEPS the
--                   current beneficiary_assignment so the graduate stays
--                   addressable for attendance/search by name in the old stage.
--   * Promotion   = a next stage exists. Closes the current assignment, opens a
--                   fresh is_current=true assignment at the target stage (the
--                   caretaker servant is carried over, 040 semantics).
--   * Undo        = both are reversible: promotion re-opens the source-stage
--                   assignment; graduation restores status='active'. Already
--                   overwritten by later manual changes are left untouched
--                   (only the current assignment / inactive flag are reverted).
--   * Audit       = write_audit_log rows for promote/graduate/undo actions.
--   * Notification= one in-app notification per caretaker servant of the source
--                   stage (via the send_notification S11-1 helper).
-- Authorization model: SECURITY DEFINER (function owner bypasses RLS); every
--   client-facing RPC re-validates auth.uid() + user_is_admin(church_id)
--   (super_admin or admin) inside the function body. Client SELECT on both
--   tables is tenant-scoped via a read-only tenant_isolation policy; there are
--   NO direct INSERT/UPDATE/DELETE policies — all mutation goes through RPCs.
-- Dependencies: 014 (beneficiary_assignments), 019 (write_audit_log text),
--               022 (get_user_church_id / user_is_admin),
--               023 (send_notification S11-1), 013/040 (beneficiaries model).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS annual_promotions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  stage_id      uuid NOT NULL REFERENCES stages (id) ON DELETE CASCADE,
  academic_year integer NOT NULL,
  status        text NOT NULL DEFAULT 'applied'
                CONSTRAINT chk_annual_promotions_status
                CHECK (status IN ('applied', 'reverted')),
  notes         text,
  run_by        uuid NOT NULL REFERENCES profiles (id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_annual_promotions_church_year
  ON annual_promotions (church_id, academic_year);
CREATE INDEX idx_annual_promotions_stage
  ON annual_promotions (stage_id);

CREATE TABLE IF NOT EXISTS promotion_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_promotion_id uuid NOT NULL REFERENCES annual_promotions (id) ON DELETE CASCADE,
  church_id           uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  beneficiary_id      uuid NOT NULL REFERENCES beneficiaries (id) ON DELETE CASCADE,
  from_stage_id       uuid NOT NULL REFERENCES stages (id),
  to_stage_id         uuid REFERENCES stages (id),
  is_graduated        boolean NOT NULL DEFAULT false,
  note                text,
  undone_at           timestamptz,
  undone_by           uuid REFERENCES profiles (id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_promotion_entries_undone CHECK (
    (undone_at IS NULL AND undone_by IS NULL) OR
    (undone_at IS NOT NULL AND undone_by IS NOT NULL)
  ),
  CONSTRAINT uq_promotion_entries_run_beneficiary
    UNIQUE (annual_promotion_id, beneficiary_id)
);

CREATE INDEX idx_promotion_entries_church
  ON promotion_entries (church_id);
CREATE INDEX idx_promotion_entries_beneficiary
  ON promotion_entries (beneficiary_id);
CREATE INDEX idx_promotion_entries_stage
  ON promotion_entries (from_stage_id);

-- ============================================================================
-- PART 2 — RLS (read-only; all mutation is RPC-only)
-- ============================================================================

ALTER TABLE annual_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON annual_promotions
  FOR SELECT USING (church_id = get_user_church_id());
CREATE POLICY tenant_isolation ON promotion_entries
  FOR SELECT USING (church_id = get_user_church_id());

-- ============================================================================
-- PART 3 — INTERNAL HELPERS (not exposed to clients)
-- ============================================================================

-- Next stage in the same service by sort_order; NULL when the source stage is
-- the last one (i.e. the beneficiary graduates).
CREATE OR REPLACE FUNCTION resolve_next_stage(p_stage_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT st.id
  FROM stages cur
  JOIN stages st
    ON st.service_id = cur.service_id
   AND st.church_id  = cur.church_id
   AND st.deleted_at IS NULL
   AND st.is_active  = true
   AND (st.sort_order, st.id) > (cur.sort_order, cur.id)
  WHERE cur.id = p_stage_id
    AND cur.deleted_at IS NULL
  ORDER BY st.sort_order, st.id
  LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- Apply a promotion run for ONE source stage + academic year. Shared by the
-- admin RPC (after the auth gate) and the automated service-role runner (047).
-- No-op (returns NULL) when an 'applied' run already exists for the pair.
-- Returns the annual_promotions id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_promotion_run(
  p_stage_id uuid,
  p_academic_year integer,
  p_notes text,
  p_run_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_run_id uuid;
  v_beneficiary_id uuid;
  v_target_stage_id uuid;
  v_servant_id uuid;
  v_entry_id uuid;
  v_from_assignment uuid;
  v_stage_name text;
  v_graduated integer := 0;
  v_promoted integer := 0;
BEGIN
  SELECT church_id, name_ar INTO v_church_id, v_stage_name
  FROM stages WHERE id = p_stage_id AND deleted_at IS NULL;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'stage_not_found';
  END IF;

  -- Idempotency: one 'applied' run per (stage, academic_year).
  IF EXISTS (
    SELECT 1 FROM annual_promotions
    WHERE stage_id = p_stage_id AND academic_year = p_academic_year
      AND status = 'applied'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO annual_promotions (church_id, stage_id, academic_year, notes, run_by)
  VALUES (v_church_id, p_stage_id, p_academic_year, p_notes, p_run_by)
  RETURNING id INTO v_run_id;

  FOR v_beneficiary_id, v_servant_id IN
    SELECT ba.beneficiary_id, ba.servant_id
    FROM beneficiary_assignments ba
    JOIN beneficiaries b ON b.id = ba.beneficiary_id
    WHERE ba.stage_id = p_stage_id
      AND ba.is_current = true
      AND b.deleted_at IS NULL
      AND b.status = 'active'
  LOOP
    v_target_stage_id := resolve_next_stage(p_stage_id);

    IF v_target_stage_id IS NOT NULL THEN
      -- PROMOTION — close current assignment, open one at the target stage.
      UPDATE beneficiary_assignments
      SET is_current = false, end_date = CURRENT_DATE,
          transfer_reason = COALESCE(p_notes, 'الترقية السنوية / Annual promotion')
      WHERE stage_id = p_stage_id AND beneficiary_id = v_beneficiary_id
        AND is_current = true;

      INSERT INTO beneficiary_assignments
        (church_id, beneficiary_id, service_id, stage_id, servant_id,
         assigned_by, is_current, start_date, transfer_reason)
      SELECT ba.church_id, ba.beneficiary_id, st.service_id, v_target_stage_id,
             COALESCE(ba.servant_id, v_servant_id), p_run_by, true, CURRENT_DATE,
             COALESCE(p_notes, 'الترقية السنوية / Annual promotion')
      FROM beneficiary_assignments ba
      JOIN stages st ON st.id = v_target_stage_id
      WHERE ba.beneficiary_id = v_beneficiary_id
        AND ba.is_current = false
        AND ba.stage_id = p_stage_id
      ORDER BY ba.start_date DESC
      LIMIT 1;

      PERFORM write_audit_log(
        v_church_id, 'promote', 'beneficiary_assignment', v_beneficiary_id,
        jsonb_build_object('from_stage_id', p_stage_id),
        jsonb_build_object('to_stage_id', v_target_stage_id, 'academic_year', p_academic_year)
      );

      INSERT INTO promotion_entries
        (annual_promotion_id, church_id, beneficiary_id, from_stage_id,
         to_stage_id, is_graduated, note)
      VALUES
        (v_run_id, v_church_id, v_beneficiary_id, p_stage_id,
         v_target_stage_id, false, p_notes)
      RETURNING id INTO v_entry_id;

      v_promoted := v_promoted + 1;
    ELSE
      -- GRADUATION — mark status inactive (graduated) with the run noted.
      UPDATE beneficiaries
      SET status = 'inactive',
          notes = COALESCE(notes, '') ||
                  E'\n[ترقية سنوية ' || p_academic_year || E'] تم التخرج من مرحلة ' ||
                  COALESCE(v_stage_name, '') ||
                  CASE WHEN p_notes IS NOT NULL THEN E'\n' || p_notes ELSE '' END
      WHERE id = v_beneficiary_id;

      PERFORM write_audit_log(
        v_church_id, 'graduate', 'beneficiary', v_beneficiary_id,
        jsonb_build_object('from_stage_id', p_stage_id, 'academic_year', p_academic_year),
        jsonb_build_object('status', 'inactive')
      );

      INSERT INTO promotion_entries
        (annual_promotion_id, church_id, beneficiary_id, from_stage_id,
         to_stage_id, is_graduated, note)
      VALUES
        (v_run_id, v_church_id, v_beneficiary_id, p_stage_id,
         NULL, true, p_notes)
      RETURNING id INTO v_entry_id;

      v_graduated := v_graduated + 1;
    END IF;
  END LOOP;

  -- Notify every caretaker servant assigned to the source stage.
  FOR v_servant_id IN
    SELECT DISTINCT servant_id
    FROM beneficiary_assignments
    WHERE stage_id = p_stage_id AND is_current = true AND servant_id IS NOT NULL
  LOOP
    PERFORM send_notification(
      v_church_id, v_servant_id, 'promotion',
      'الترقية السنوية / Annual promotion',
      'Annual promotion',
      'تم تنفيذ الترقية السنوية لمرحلة ' || COALESCE(v_stage_name, '') ||
      ' - سنة ' || p_academic_year || ' (ترقية: ' || v_promoted ||
      '، تخرج: ' || v_graduated || ').',
      'Annual promotion executed for stage ' || COALESCE(v_stage_name, '') ||
      ' - year ' || p_academic_year || ' (promoted: ' || v_promoted ||
      ', graduated: ' || v_graduated || ').',
      jsonb_build_object('annual_promotion_id', v_run_id, 'academic_year', p_academic_year)
    );
  END LOOP;

  RETURN v_run_id;
END;
$$;

-- ============================================================================
-- PART 4 — CLIENT-FACING RPCs (admin-gated)
-- ============================================================================

-- Bulk annual promotion for a source stage + academic year (church admin).
CREATE OR REPLACE FUNCTION run_annual_promotions(
  p_stage_id uuid,
  p_academic_year integer,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF NOT user_is_admin(v_church_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stages
    WHERE id = p_stage_id AND church_id = v_church_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'stage_not_found';
  END IF;

  RETURN apply_promotion_run(p_stage_id, p_academic_year, p_notes, auth.uid());
END;
$$;

-- Manual single-beneficiary promotion to a chosen target stage in the SAME
-- service (church admin). Returns the promotion_entries id.
CREATE OR REPLACE FUNCTION run_single_promotion(
  p_beneficiary_id uuid,
  p_target_stage_id uuid,
  p_academic_year integer,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_current_stage_id uuid;
  v_servant_id uuid;
  v_entry_id uuid;
  v_run_id uuid;
  v_target_service uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF NOT user_is_admin(v_church_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM beneficiaries
    WHERE id = p_beneficiary_id AND church_id = v_church_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'beneficiary_not_found';
  END IF;

  SELECT ba.stage_id, ba.servant_id INTO v_current_stage_id, v_servant_id
  FROM beneficiary_assignments ba
  WHERE ba.beneficiary_id = p_beneficiary_id AND ba.is_current = true;

  IF v_current_stage_id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stages
    WHERE id = p_target_stage_id AND church_id = v_church_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'stage_not_found';
  END IF;

  IF v_current_stage_id = p_target_stage_id THEN
    RAISE EXCEPTION 'same_stage';
  END IF;

  -- Target must live in the same service as the current assignment.
  SELECT service_id INTO v_target_service FROM stages WHERE id = p_target_stage_id;
  IF NOT EXISTS (
    SELECT 1 FROM stages WHERE id = v_current_stage_id AND service_id = v_target_service
  ) THEN
    RAISE EXCEPTION 'stage_service_mismatch';
  END IF;

  -- Reuse the run table (single-entry run) for a uniform history/undo surface.
  INSERT INTO annual_promotions (church_id, stage_id, academic_year, notes, run_by)
  VALUES (v_church_id, v_current_stage_id, p_academic_year,
          COALESCE(p_note, 'ترقية يدوية / Manual promotion'), auth.uid())
  RETURNING id INTO v_run_id;

  UPDATE beneficiary_assignments
  SET is_current = false, end_date = CURRENT_DATE,
      transfer_reason = COALESCE(p_note, 'ترقية يدوية / Manual promotion')
  WHERE beneficiary_id = p_beneficiary_id AND is_current = true;

  INSERT INTO beneficiary_assignments
    (church_id, beneficiary_id, service_id, stage_id, servant_id,
     assigned_by, is_current, start_date, transfer_reason)
  SELECT ba.church_id, ba.beneficiary_id, st.service_id, p_target_stage_id,
         COALESCE(ba.servant_id, v_servant_id), auth.uid(), true, CURRENT_DATE,
         COALESCE(p_note, 'ترقية يدوية / Manual promotion')
  FROM beneficiary_assignments ba
  JOIN stages st ON st.id = p_target_stage_id
  WHERE ba.beneficiary_id = p_beneficiary_id
    AND ba.is_current = false
  ORDER BY ba.start_date DESC
  LIMIT 1;

  PERFORM write_audit_log(
    v_church_id, 'promote', 'beneficiary_assignment', p_beneficiary_id,
    jsonb_build_object('from_stage_id', v_current_stage_id),
    jsonb_build_object('to_stage_id', p_target_stage_id, 'academic_year', p_academic_year)
  );

  INSERT INTO promotion_entries
    (annual_promotion_id, church_id, beneficiary_id, from_stage_id,
     to_stage_id, is_graduated, note)
  VALUES
    (v_run_id, v_church_id, p_beneficiary_id, v_current_stage_id,
     p_target_stage_id, false, p_note)
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Revert a SINGLE promotion entry. Shared by undo_promotion and
-- undo_all_promotions. Defensive: never clobbers newer manual changes — the
-- assignment is only flipped when the beneficiary's current assignment is still
-- at to_stage_id; the inactive flag is only restored for graduates whose
-- status is still 'inactive'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION revert_promotion_entry(
  p_entry_id uuid,
  p_undo_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_beneficiary_id uuid;
  v_from_stage_id uuid;
  v_to_stage_id uuid;
  v_is_graduated boolean;
  v_servant_id uuid;
  v_current_stage_id uuid;
BEGIN
  SELECT church_id, beneficiary_id, from_stage_id, to_stage_id, is_graduated
  INTO v_church_id, v_beneficiary_id, v_from_stage_id, v_to_stage_id, v_is_graduated
  FROM promotion_entries WHERE id = p_entry_id;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'entry_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM promotion_entries WHERE id = p_entry_id AND undone_at IS NOT NULL) THEN
    RAISE EXCEPTION 'already_undone';
  END IF;

  IF v_is_graduated THEN
    -- Graduation revert — restore the beneficiary to active if still inactive.
    UPDATE beneficiaries
    SET status = 'active'
    WHERE id = v_beneficiary_id AND status = 'inactive';

    PERFORM write_audit_log(
      v_church_id, 'undo_graduate', 'beneficiary', v_beneficiary_id,
      jsonb_build_object('to_stage_id', v_to_stage_id),
      jsonb_build_object('status', 'active')
    );
  ELSE
    -- Promotion revert — re-open the source stage assignment IF the current
    -- assignment is still at the promoted stage (never clobber later moves).
    SELECT stage_id INTO v_current_stage_id
    FROM beneficiary_assignments
    WHERE beneficiary_id = v_beneficiary_id AND is_current = true;

    IF v_current_stage_id = v_to_stage_id THEN
      SELECT servant_id INTO v_servant_id
      FROM beneficiary_assignments
      WHERE beneficiary_id = v_beneficiary_id AND is_current = true;

      UPDATE beneficiary_assignments
      SET is_current = false, end_date = CURRENT_DATE,
          transfer_reason = 'تراجع عن الترقية / Promotion reverted'
      WHERE beneficiary_id = v_beneficiary_id AND is_current = true;

      INSERT INTO beneficiary_assignments
        (church_id, beneficiary_id, service_id, stage_id, servant_id,
         assigned_by, is_current, start_date, transfer_reason)
      SELECT ba.church_id, ba.beneficiary_id, st.service_id, v_from_stage_id,
             COALESCE(ba.servant_id, v_servant_id), p_undo_by, true, CURRENT_DATE,
             'تراجع عن الترقية / Promotion reverted'
      FROM beneficiary_assignments ba
      JOIN stages st ON st.id = v_from_stage_id
      WHERE ba.beneficiary_id = v_beneficiary_id
        AND ba.is_current = false
        AND ba.stage_id = v_to_stage_id
      ORDER BY ba.start_date DESC
      LIMIT 1;

      PERFORM write_audit_log(
        v_church_id, 'undo_promotion', 'beneficiary_assignment', v_beneficiary_id,
        jsonb_build_object('to_stage_id', v_to_stage_id),
        jsonb_build_object('from_stage_id', v_from_stage_id)
      );
    END IF;
  END IF;

  UPDATE promotion_entries
  SET undone_at = now(), undone_by = p_undo_by
  WHERE id = p_entry_id;
END;
$$;

-- Undo a single promotion/graduation entry (church admin).
CREATE OR REPLACE FUNCTION undo_promotion(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF NOT user_is_admin(v_church_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM promotion_entries WHERE id = p_entry_id AND church_id = v_church_id
  ) THEN
    RAISE EXCEPTION 'entry_not_found';
  END IF;

  PERFORM revert_promotion_entry(p_entry_id, auth.uid());
END;
$$;

-- Undo an ENTIRE run (church admin) — reverts every not-yet-undone entry and
-- marks the run 'reverted' so a fresh run for the same pair becomes possible.
CREATE OR REPLACE FUNCTION undo_all_promotions(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_entry_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF NOT user_is_admin(v_church_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM annual_promotions WHERE id = p_run_id AND church_id = v_church_id
  ) THEN
    RAISE EXCEPTION 'run_not_found';
  END IF;

  FOR v_entry_id IN
    SELECT id FROM promotion_entries
    WHERE annual_promotion_id = p_run_id AND undone_at IS NULL
  LOOP
    PERFORM revert_promotion_entry(v_entry_id, auth.uid());
  END LOOP;

  UPDATE annual_promotions SET status = 'reverted' WHERE id = p_run_id;
END;
$$;

-- ============================================================================
-- PART 5 — RPC privilege lockdown (client surface = authenticated only)
-- ============================================================================

REVOKE ALL ON FUNCTION resolve_next_stage(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION apply_promotion_run(uuid, integer, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION revert_promotion_entry(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION run_annual_promotions(uuid, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION run_annual_promotions(uuid, integer, text)
  TO authenticated;

REVOKE ALL ON FUNCTION run_single_promotion(uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION run_single_promotion(uuid, uuid, integer, text)
  TO authenticated;

REVOKE ALL ON FUNCTION undo_promotion(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION undo_promotion(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION undo_all_promotions(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION undo_all_promotions(uuid)
  TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Tables + RLS read-only
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename IN ('annual_promotions','promotion_entries')
--   ORDER BY tablename;
--   -- Exactly one tenant_isolation SELECT policy per table. No INSERT/UPDATE/
--   -- DELETE policies exist -> direct client mutation is impossible.
-- V2 — Functions & privileges
--   SELECT has_function_privilege('anon',
--     'run_annual_promotions(uuid,integer,text)', 'EXECUTE');          -- false
--   SELECT has_function_privilege('authenticated',
--     'run_annual_promotions(uuid,integer,text)', 'EXECUTE');          -- true
-- V3 — Admin flow smoke (as a church super_admin):
--   SELECT run_annual_promotions('<stage_id>', 2026, 'اختبار');        -- uuid or NULL (dup)
--   SELECT * FROM promotion_entries ORDER BY created_at DESC;          -- rows
--   SELECT * FROM annual_promotions ORDER BY created_at DESC;          -- run row
--   -- Graduated beneficiaries: SELECT id, status, notes FROM beneficiaries
--   --   WHERE status='inactive' AND notes LIKE '%ترقية سنوية 2026%';
--   SELECT undo_all_promotions('<run_id>');
--   -- Re-run same (stage, year) succeeds (previous run is now 'reverted').
-- V4 — Non-admin denial:
--   -- As a servant: run_annual_promotions(...) -> 'not_authorized'.
-- V5 — Manual single promotion smoke:
--   SELECT run_single_promotion('<beneficiary_id>', '<target_stage_id>', 2026, 'ملاحظة');
--   SELECT undo_promotion('<entry_id>');
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   DROP TABLE promotion_entries;
--   DROP TABLE annual_promotions;
--   DROP FUNCTION undo_all_promotions(uuid);
--   DROP FUNCTION undo_promotion(uuid);
--   DROP FUNCTION run_single_promotion(uuid, uuid, integer, text);
--   DROP FUNCTION run_annual_promotions(uuid, integer, text);
--   DROP FUNCTION revert_promotion_entry(uuid, uuid);
--   DROP FUNCTION apply_promotion_run(uuid, integer, text, uuid);
--   DROP FUNCTION resolve_next_stage(uuid);
--   No data was destroyed outside the promotion tables; promotion/graduation
--   side effects on beneficiary_assignments / beneficiaries.status are NOT
--   auto-reverted by the rollback — undo each affected run via undo_all_
--   promotions BEFORE rolling back to keep those tables consistent.
-- ============================================================================
