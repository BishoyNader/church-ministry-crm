-- ============================================================================
-- Church Ministry CRM — Promotion Cycles, Academic Progression & Confirmation
-- Migration: 049_promotion_cycles_and_academic_progression.sql
-- Action:
--   1. Academic progression metadata — services.service_type / next_service_id,
--      stages.stage_code / next_stage_id. resolve_next_stage() now honours an
--      explicit per-stage override, then the service's configured next
--      destination, then the standard academic code chain, then in-service
--      sort_order. Services/stages stay flexible (custom names/counts remain
--      fully supported); codes are internal identifiers only (never shown in UI).
--   2. Promotion cycles — promotion_cycles (church + academic_year, status
--      pending_confirmation / confirmed, confirmed_at/by). annual_promotions
--      and promotion_entries gain cycle_id so the whole year's runs share one
--      confirmation surface. apply_promotion_run() find-or-creates the church's
--      open cycle and records pending SERVANT transitions (promotion_servant_
--      transitions) for every promoted beneficiary's caretaker — servant
--      assignments are NEVER moved automatically; they are only published by
--      confirm_promotion_cycle().
--   3. confirm_promotion_cycle() — ONE senior-church-user confirmation
--      (user_is_admin) that publishes every pending servant transition for the
--      cycle: activates the target-stage servant assignment, retires the
--      source-stage assignment when the servant no longer has live
--      beneficiaries there, audits, and notifies each affected servant.
--      Idempotent (confirmed cycles are a no-op). Transitions whose promoted
--      placements were undone before confirmation are marked 'skipped'.
--   4. revert_promotion_entry() — after undoing a promotion it re-syncs the
--      servant's stage assignments with the actual beneficiary cohort so undo
--      after confirmation leaves no stale published assignment.
-- Dependencies: 046 (annual_promotions/promotion_entries/apply_promotion_run),
--               047 (run_annual_promotions_auto), 014 (beneficiary_assignments),
--               012/034 (servant_stage_assignments), 022 (get_user_church_id /
--               user_is_admin), 023 (send_notification), 019 (write_audit_log).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — ACADEMIC PROGRESSION METADATA (internal, presentation-free)
-- ============================================================================

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS next_service_id uuid REFERENCES services (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_services_type
  ON services (service_type) WHERE deleted_at IS NULL;

ALTER TABLE stages
  ADD COLUMN IF NOT EXISTS stage_code text,
  ADD COLUMN IF NOT EXISTS next_stage_id uuid REFERENCES stages (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stages_church_code
  ON stages (church_id, stage_code) WHERE deleted_at IS NULL AND is_active = true;

-- ============================================================================
-- PART 2 — PROMOTION CYCLES + PENDING SERVANT TRANSITIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS promotion_cycles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  academic_year integer NOT NULL,
  status        text NOT NULL DEFAULT 'pending_confirmation'
                CONSTRAINT chk_promotion_cycles_status
                CHECK (status IN ('pending_confirmation', 'confirmed')),
  confirmed_at  timestamptz,
  confirmed_by  uuid REFERENCES profiles (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_promotion_cycles_church_year
  ON promotion_cycles (church_id, academic_year, status);

CREATE TRIGGER trg_promotion_cycles_updated_at
  BEFORE UPDATE ON promotion_cycles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Every annual run belongs to the open cycle of its church + year.
ALTER TABLE annual_promotions
  ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES promotion_cycles (id) ON DELETE SET NULL;

-- Denormalized cycle key on entries (backfilled below) so dashboard counts and
-- confirmation queries are simple and stay consistent with transitions.
ALTER TABLE promotion_entries
  ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES promotion_cycles (id) ON DELETE SET NULL;

UPDATE promotion_entries pe
SET cycle_id = ap.cycle_id
FROM annual_promotions ap
WHERE ap.id = pe.annual_promotion_id;

-- Pending servant assignment transitions per cycle. A row is created when a
-- promoted beneficiary's caretaker moves with them (from_stage -> to_stage);
-- the assignment is only published by confirm_promotion_cycle().
CREATE TABLE IF NOT EXISTS promotion_servant_transitions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id        uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  cycle_id         uuid NOT NULL REFERENCES promotion_cycles (id) ON DELETE CASCADE,
  servant_id       uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  from_stage_id    uuid NOT NULL REFERENCES stages (id),
  to_stage_id      uuid NOT NULL REFERENCES stages (id),
  from_service_id  uuid NOT NULL REFERENCES services (id),
  to_service_id    uuid NOT NULL REFERENCES services (id),
  status           text NOT NULL DEFAULT 'pending'
                   CONSTRAINT chk_promotion_transitions_status
                   CHECK (status IN ('pending', 'published', 'skipped')),
  published_at     timestamptz,
  published_by     uuid REFERENCES profiles (id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_promotion_transitions_cycle_servant
    UNIQUE (cycle_id, servant_id, from_stage_id, to_stage_id)
);

CREATE INDEX idx_promotion_transitions_church
  ON promotion_servant_transitions (church_id);
CREATE INDEX idx_promotion_transitions_servant_pending
  ON promotion_servant_transitions (servant_id, status);

-- ============================================================================
-- PART 3 — RLS (read-only tenant surface; all mutation is RPC-only)
-- ============================================================================

ALTER TABLE promotion_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_servant_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON promotion_cycles
  FOR SELECT USING (church_id = get_user_church_id());
CREATE POLICY tenant_isolation ON promotion_servant_transitions
  FOR SELECT USING (church_id = get_user_church_id());

-- ============================================================================
-- PART 4 — STANDARD ACADEMIC CODE CHAIN
-- ============================================================================

-- Canonical ordered progression: Baby Class -> KG -> Primary -> Preparatory ->
-- Secondary. Codes are internal identifiers assigned by the academic presets;
-- custom stages have no code and rely on explicit next_stage_id /
-- next_service_id / in-service sort_order instead.
CREATE OR REPLACE FUNCTION standard_next_stage_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT codes[position + 1]
  FROM (
    SELECT ARRAY[
      'baby_1','baby_2',
      'kg_1','kg_2',
      'primary_1','primary_2','primary_3','primary_4','primary_5','primary_6',
      'prep_1','prep_2','prep_3',
      'sec_1','sec_2','sec_3'
    ] AS codes
  ) c
  CROSS JOIN LATERAL (
    SELECT array_position(codes, p_code) AS position
  ) p
  WHERE p.position IS NOT NULL AND p.position < array_length(codes, 1);
$$;

-- ----------------------------------------------------------------------------
-- resolve_next_stage(p_stage_id) — promotion destination for a stage.
-- Resolution order (first hit wins):
--   1. stages.next_stage_id            (explicit per-stage override)
--   2. next stage in the SAME service by (sort_order, id)
--   3. first stage of services.next_service_id (explicit service destination)
--   4. standard academic code chain (same church, any service)
-- NULL = terminal (beneficiary graduates).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resolve_next_stage(p_stage_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT next_stage_id FROM stages WHERE id = p_stage_id),
    (SELECT st.id
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
      LIMIT 1),
    (SELECT st.id
       FROM stages st
       JOIN services sv ON sv.id = st.service_id AND sv.deleted_at IS NULL
       JOIN stages cur ON cur.id = p_stage_id AND cur.deleted_at IS NULL
       JOIN services cur_sv ON cur_sv.id = cur.service_id
      WHERE cur_sv.next_service_id = st.service_id
        AND st.church_id = cur.church_id
        AND st.deleted_at IS NULL
        AND st.is_active = true
      ORDER BY st.sort_order, st.id
      LIMIT 1),
    (SELECT nxt.id
       FROM stages cur
       JOIN stages nxt
         ON nxt.church_id = cur.church_id
        AND nxt.deleted_at IS NULL
        AND nxt.is_active = true
      WHERE cur.id = p_stage_id
        AND cur.stage_code IS NOT NULL
        AND nxt.stage_code = standard_next_stage_code(cur.stage_code)
      LIMIT 1)
  );
$$;

-- ============================================================================
-- PART 5 — apply_promotion_run (cycle-aware)
-- ----------------------------------------------------------------------------
-- Same contract as 046 (idempotent per stage + year; promotion / graduation;
-- audit; caretaker notifications) PLUS:
--   * attaches the run to the church's OPEN cycle for the year (finds the most
--     recent pending_confirmation cycle, or creates one), and stamps cycle_id
--     on every promotion entry;
--   * records a PENDING promotion_servant_transitions row for each promoted
--     beneficiary's caretaker servant — the servant's published assignment is
--     intentionally NOT changed here (that only happens on confirmation).
-- ============================================================================
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
  v_cycle_id uuid;
  v_run_id uuid;
  v_beneficiary_id uuid;
  v_target_stage_id uuid;
  v_servant_id uuid;
  v_entry_id uuid;
  v_stage_name text;
  v_from_service_id uuid;
  v_to_service_id uuid;
  v_caretaker_ids uuid[];
  v_graduated integer := 0;
  v_promoted integer := 0;
BEGIN
  SELECT church_id, name_ar, service_id
  INTO v_church_id, v_stage_name, v_from_service_id
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

  -- Find the church's open cycle for this year, or open a fresh one.
  SELECT id INTO v_cycle_id
  FROM promotion_cycles
  WHERE church_id = v_church_id AND academic_year = p_academic_year
    AND status = 'pending_confirmation'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    INSERT INTO promotion_cycles (church_id, academic_year)
    VALUES (v_church_id, p_academic_year)
    RETURNING id INTO v_cycle_id;
  END IF;

  INSERT INTO annual_promotions (church_id, stage_id, academic_year, notes, run_by, cycle_id)
  VALUES (v_church_id, p_stage_id, p_academic_year, p_notes, p_run_by, v_cycle_id)
  RETURNING id INTO v_run_id;

  -- Capture every caretaker servant with active beneficiaries at the source
  -- stage BEFORE the promotion loop closes those assignments, so the
  -- notification below reaches servants whose whole cohort was promoted — not
  -- just those who still have graduates left behind.
  SELECT array_agg(DISTINCT servant_id) INTO v_caretaker_ids
  FROM beneficiary_assignments
  WHERE stage_id = p_stage_id AND is_current = true AND servant_id IS NOT NULL;

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
        (annual_promotion_id, cycle_id, church_id, beneficiary_id, from_stage_id,
         to_stage_id, is_graduated, note)
      VALUES
        (v_run_id, v_cycle_id, v_church_id, v_beneficiary_id, p_stage_id,
         v_target_stage_id, false, p_notes)
      RETURNING id INTO v_entry_id;

      -- Pending servant transition: the caretaker follows the beneficiary, but
      -- the published servant assignment ONLY changes on confirmation.
      IF v_servant_id IS NOT NULL THEN
        SELECT service_id INTO v_to_service_id FROM stages WHERE id = v_target_stage_id;

        INSERT INTO promotion_servant_transitions
          (church_id, cycle_id, servant_id, from_stage_id, to_stage_id,
           from_service_id, to_service_id)
        VALUES
          (v_church_id, v_cycle_id, v_servant_id, p_stage_id, v_target_stage_id,
           v_from_service_id, v_to_service_id)
        ON CONFLICT (cycle_id, servant_id, from_stage_id, to_stage_id)
        DO NOTHING;
      END IF;

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
        (annual_promotion_id, cycle_id, church_id, beneficiary_id, from_stage_id,
         to_stage_id, is_graduated, note)
      VALUES
        (v_run_id, v_cycle_id, v_church_id, v_beneficiary_id, p_stage_id,
         NULL, true, p_notes)
      RETURNING id INTO v_entry_id;

      v_graduated := v_graduated + 1;
    END IF;
  END LOOP;

  -- Notify every caretaker servant captured before the promotion loop.
  IF v_caretaker_ids IS NOT NULL THEN
    FOREACH v_servant_id IN ARRAY v_caretaker_ids
    LOOP
      PERFORM send_notification(
        v_church_id, v_servant_id, 'promotion',
        'الترقية السنوية / Annual promotion',
        'Annual promotion',
        'تم تنفيذ الترقية السنوية لمرحلة ' || COALESCE(v_stage_name, '') ||
        ' - سنة ' || p_academic_year || ' (ترقية: ' || v_promoted ||
        '، تخرج: ' || v_graduated || '). وهي بانتظار الاعتماد.',
        'Annual promotion executed for stage ' || COALESCE(v_stage_name, '') ||
        ' - year ' || p_academic_year || ' (promoted: ' || v_promoted ||
        ', graduated: ' || v_graduated || '). Pending confirmation.',
        jsonb_build_object('annual_promotion_id', v_run_id, 'academic_year', p_academic_year)
      );
    END LOOP;
  END IF;

  RETURN v_run_id;
END;
$$;

-- ============================================================================
-- PART 6 — confirm_promotion_cycle (GLOBAL CONFIRMATION)
-- ----------------------------------------------------------------------------
-- ONE senior-church-user confirmation for the whole affected set (no per-
-- servant confirmation). Publishes every eligible pending servant transition:
--   * activates the servant_stage_assignments row at the target stage
--     (reactivating a historical row when present),
--   * retires the source-stage assignment once the servant has no live
--     beneficiaries left there,
--   * marks the transition published and notifies the servant.
-- Transitions whose promoted placements were undone before confirmation are
-- marked 'skipped' (never published). The cycle becomes 'confirmed' with
-- confirmed_at / confirmed_by and an audit row. Idempotent.
-- ============================================================================
CREATE OR REPLACE FUNCTION confirm_promotion_cycle(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_transition record;
  v_has_active_to boolean;
  v_has_active_from boolean;
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
    SELECT 1 FROM promotion_cycles
    WHERE id = p_cycle_id AND church_id = v_church_id
  ) THEN
    RAISE EXCEPTION 'cycle_not_found';
  END IF;

  IF (SELECT status FROM promotion_cycles WHERE id = p_cycle_id) = 'confirmed' THEN
    RETURN; -- idempotent
  END IF;

  FOR v_transition IN
    SELECT t.id, t.servant_id, t.from_stage_id, t.to_stage_id, t.to_service_id
    FROM promotion_servant_transitions t
    WHERE t.cycle_id = p_cycle_id AND t.church_id = v_church_id
      AND t.status = 'pending'
  LOOP
    -- Publish only transitions with a still-live promoted placement.
    SELECT EXISTS (
      SELECT 1
      FROM promotion_entries pe
      JOIN beneficiary_assignments ba
        ON ba.beneficiary_id = pe.beneficiary_id
       AND ba.is_current = true
       AND ba.stage_id = pe.to_stage_id
       AND ba.servant_id = v_transition.servant_id
      WHERE pe.cycle_id = p_cycle_id
        AND pe.from_stage_id = v_transition.from_stage_id
        AND pe.to_stage_id = v_transition.to_stage_id
        AND pe.undone_at IS NULL
    ) INTO v_has_active_to;

    IF NOT v_has_active_to THEN
      UPDATE promotion_servant_transitions
      SET status = 'skipped'
      WHERE id = v_transition.id;
      CONTINUE;
    END IF;

    -- Publish: ensure the servant has an active assignment at the target stage.
    IF NOT EXISTS (
      SELECT 1 FROM servant_stage_assignments
      WHERE servant_id = v_transition.servant_id AND church_id = v_church_id
        AND stage_id = v_transition.to_stage_id AND is_active = true AND end_date IS NULL
    ) THEN
      UPDATE servant_stage_assignments
      SET is_active = true, end_date = NULL, assigned_by = auth.uid()
      WHERE servant_id = v_transition.servant_id AND church_id = v_church_id
        AND stage_id = v_transition.to_stage_id
        AND is_active = false;

      IF NOT FOUND THEN
        INSERT INTO servant_stage_assignments
          (church_id, servant_id, stage_id, service_id, is_active, start_date, end_date, assigned_by)
        VALUES
          (v_church_id, v_transition.servant_id, v_transition.to_stage_id,
           v_transition.to_service_id, true, now(), NULL, auth.uid());
      END IF;
    END IF;

    -- Retire the source-stage assignment when the servant has no live
    -- beneficiaries there any more (old assignment becomes historical).
    SELECT NOT EXISTS (
      SELECT 1 FROM beneficiary_assignments ba
      WHERE ba.servant_id = v_transition.servant_id
        AND ba.church_id = v_church_id
        AND ba.stage_id = v_transition.from_stage_id
        AND ba.is_current = true
    ) INTO v_has_active_from;

    IF v_has_active_from THEN
      UPDATE servant_stage_assignments
      SET is_active = false, end_date = now()
      WHERE servant_id = v_transition.servant_id AND church_id = v_church_id
        AND stage_id = v_transition.from_stage_id
        AND is_active = true AND end_date IS NULL;
    END IF;

    UPDATE promotion_servant_transitions
    SET status = 'published', published_at = now(), published_by = auth.uid()
    WHERE id = v_transition.id;

    PERFORM send_notification(
      v_church_id, v_transition.servant_id, 'promotion',
      'تحديث توزيع الخدام / Servant assignment update',
      'Servant assignment update',
      'تم اعتماد الترقية السنوية — تم نشر توزيعك الجديد على المرحلة الجديدة.',
      'The annual promotion was confirmed — your new stage assignment is now published.',
      jsonb_build_object('cycle_id', p_cycle_id)
    );
  END LOOP;

  UPDATE promotion_cycles
  SET status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid()
  WHERE id = p_cycle_id;

  PERFORM write_audit_log(
    v_church_id, 'confirm', 'promotion_cycle', p_cycle_id, NULL,
    jsonb_build_object('status', 'confirmed')
  );
END;
$$;

-- ============================================================================
-- PART 7 — revert_promotion_entry (servant assignment re-sync)
-- ----------------------------------------------------------------------------
-- Extension of 046's defensive revert: after moving a beneficiary back to the
-- source stage, the caretaker's stage assignments are re-synced with the
-- actual cohort — the target-stage assignment is retired when the servant has
-- no live beneficiaries left there, and the source-stage assignment is
-- reactivated when the servant has live beneficiaries there again. Never
-- clobbers newer manual changes.
-- ============================================================================
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
  v_from_service_id uuid;
  v_has_at_from boolean;
  v_has_at_to boolean;
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

      -- Re-sync the caretaker's published stage assignments with the cohort.
      IF v_servant_id IS NOT NULL THEN
        SELECT NOT EXISTS (
          SELECT 1 FROM beneficiary_assignments ba
          WHERE ba.servant_id = v_servant_id AND ba.church_id = v_church_id
            AND ba.stage_id = v_to_stage_id AND ba.is_current = true
        ) INTO v_has_at_to;

        SELECT EXISTS (
          SELECT 1 FROM beneficiary_assignments ba
          WHERE ba.servant_id = v_servant_id AND ba.church_id = v_church_id
            AND ba.stage_id = v_from_stage_id AND ba.is_current = true
        ) INTO v_has_at_from;

        IF v_has_at_to THEN
          UPDATE servant_stage_assignments
          SET is_active = false, end_date = now()
          WHERE servant_id = v_servant_id AND church_id = v_church_id
            AND stage_id = v_to_stage_id AND is_active = true AND end_date IS NULL;
        END IF;

        IF v_has_at_from THEN
          SELECT service_id INTO v_from_service_id FROM stages WHERE id = v_from_stage_id;

          IF NOT EXISTS (
            SELECT 1 FROM servant_stage_assignments
            WHERE servant_id = v_servant_id AND church_id = v_church_id
              AND stage_id = v_from_stage_id AND is_active = true AND end_date IS NULL
          ) THEN
            UPDATE servant_stage_assignments
            SET is_active = true, end_date = NULL
            WHERE servant_id = v_servant_id AND church_id = v_church_id
              AND stage_id = v_from_stage_id
              AND is_active = false;

            IF NOT FOUND THEN
              INSERT INTO servant_stage_assignments
                (church_id, servant_id, stage_id, service_id, is_active, start_date, end_date, assigned_by)
              VALUES
                (v_church_id, v_servant_id, v_from_stage_id, v_from_service_id,
                 true, now(), NULL, p_undo_by);
            END IF;
          END IF;
        END IF;
      END IF;

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

-- ============================================================================
-- PART 8 — RPC privilege lockdown
-- ============================================================================

REVOKE ALL ON FUNCTION standard_next_stage_code(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION resolve_next_stage(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION apply_promotion_run(uuid, integer, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION revert_promotion_entry(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION confirm_promotion_cycle(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION confirm_promotion_cycle(uuid)
  TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Tables & RLS
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename IN
--     ('promotion_cycles','promotion_servant_transitions')
--   ORDER BY tablename;  -- one tenant_isolation SELECT policy per table only
-- V2 — Progression metadata
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name IN ('services','stages','annual_promotions','promotion_entries')
--     AND column_name IN ('service_type','next_service_id','stage_code','next_stage_id','cycle_id');
-- V3 — Next-stage resolution (create two services with coded stages, then):
--   SELECT resolve_next_stage('<primary_5_stage>');  -- primary_6 (same service)
--   SELECT resolve_next_stage('<primary_6_stage>');  -- prep_1 via next_service_id OR code chain
--   SELECT resolve_next_stage('<sec_3_stage>');      -- NULL (graduates)
-- V4 — Cycle flow (as a church super_admin):
--   SELECT run_annual_promotions('<stage_id>', 2026, NULL);       -- run id
--   SELECT id, status FROM promotion_cycles WHERE academic_year=2026; -- pending_confirmation
--   SELECT count(*) FROM promotion_servant_transitions WHERE status='pending';
--   SELECT confirm_promotion_cycle('<cycle_id>');                 -- publishes
--   -- servant_stage_assignments gained the target stage; old retired where empty
--   SELECT confirm_promotion_cycle('<cycle_id>');                 -- no-op (idempotent)
-- V5 — Non-admin denial: servant calls confirm_promotion_cycle -> not_authorized
-- V6 — Re-run idempotency: run_annual_promotions same (stage, year) again -> NULL
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   REVOKE EXECUTE ON FUNCTION confirm_promotion_cycle(uuid) FROM authenticated;
--   DROP FUNCTION confirm_promotion_cycle(uuid);
--   DROP FUNCTION standard_next_stage_code(text);
--   DROP FUNCTION resolve_next_stage(uuid);     -- restore the 046 definition
--   DROP FUNCTION apply_promotion_run(uuid, integer, text, uuid);
--   DROP FUNCTION revert_promotion_entry(uuid, uuid);
--   DROP TABLE promotion_servant_transitions;
--   DROP TABLE promotion_cycles;
--   ALTER TABLE promotion_entries DROP COLUMN IF EXISTS cycle_id;
--   ALTER TABLE annual_promotions DROP COLUMN IF EXISTS cycle_id;
--   ALTER TABLE stages DROP COLUMN IF EXISTS next_stage_id, DROP COLUMN IF EXISTS stage_code;
--   ALTER TABLE services DROP COLUMN IF EXISTS next_service_id, DROP COLUMN IF EXISTS service_type;
--   NOTE: published servant_stage_assignments are NOT auto-reverted by the
--   rollback — undo each affected run via undo_all_promotions first (the 049
--   revert path re-syncs the assignments).
-- ============================================================================
