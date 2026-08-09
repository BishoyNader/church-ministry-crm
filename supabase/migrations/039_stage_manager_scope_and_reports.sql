-- ============================================================================
-- Church Ministry CRM — Stage Manager Secure Scope + Stage Reports RPC
-- Migration: 039_stage_manager_scope_and_reports.sql
-- Action: Sprint — Stage Manager Secure Scope Implementation (P0/P1/P3).
--   1. New scope helper get_stage_manager_stage_ids(): church + role-aware.
--      super_admin / admin -> whole church; stage_manager / servant -> their
--      active servant_stage_assignments rows. (Consolidates F4/D4/D1 into one
--      server-side resolution point.)
--   2. (D4) Recreate the 022 scope helpers (get_user_stage_ids /
--      get_user_class_ids / get_user_service_ids) so `admin` is treated as
--      church-wide, aligning the RLS read/write scope with migration 038's
--      user_is_admin() branch. Also aligns the active-assignment predicate
--      with 038: (end_date IS NULL OR end_date >= CURRENT_DATE).
--   3. New get_stage_reports(...) SECURITY DEFINER RPC — SQL port of the
--      reports module's client aggregation (reports.service.ts:90-331),
--      scoped exactly like 038: the actor scope is computed INSIDE the
--      function from get_user_stage_ids() / servant_stage_assignments and is
--      defensively INTERSECTed with the caller-supplied p_stage_ids, so a
--      stage-scoped caller can never read outside their assigned stages.
--      Follow-ups are scoped through beneficiary_assignments (D5 — no
--      followups.stage_id column, no schema change).
--   4. (F9) Harden attendance_records INSERT/UPDATE policies: records may only
--      be attached to attendance sessions whose stage/class is inside the
--      actor's scope (get_user_stage_ids / get_user_class_ids).
-- Security posture: additive SECURITY DEFINER functions + policy replacement.
-- No destructive DDL, no table changes, no RLS weakening.
-- Dependency: 037 (stage_manager role + permissions), 038 (038 scope pattern,
--             applied before this migration).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: get_stage_manager_stage_ids() — role-aware stage scope
-- ============================================================================

CREATE OR REPLACE FUNCTION get_stage_manager_stage_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  -- super_admin / admin: whole-church scope (D4 — matches 038).
  IF user_is_admin(v_church_id) THEN
    RETURN ARRAY(
      SELECT id FROM stages
      WHERE church_id = v_church_id AND deleted_at IS NULL
    );
  END IF;

  -- stage_manager / servant: active stage assignments only.
  RETURN ARRAY(
    SELECT DISTINCT ssa.stage_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND (ssa.end_date IS NULL OR ssa.end_date >= CURRENT_DATE)
      AND ssa.stage_id IS NOT NULL
  );
END;
$$;

-- ============================================================================
-- PART 2 (D4): 022 scope helpers — admin is church-wide
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_service_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM services WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.service_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND (ssa.end_date IS NULL OR ssa.end_date >= CURRENT_DATE)
      AND ssa.service_id IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_user_stage_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM stages WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.stage_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND (ssa.end_date IS NULL OR ssa.end_date >= CURRENT_DATE)
      AND ssa.stage_id IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_user_class_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM classes WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.class_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND (ssa.end_date IS NULL OR ssa.end_date >= CURRENT_DATE)
      AND ssa.class_id IS NOT NULL
  );
END;
$$;

-- ============================================================================
-- PART 3: get_stage_reports(...) — scoped reports aggregation RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION get_stage_reports(
  p_stage_ids  uuid[]   DEFAULT NULL,
  p_from_date  date     DEFAULT NULL,
  p_to_date    date     DEFAULT NULL,
  p_service_id uuid     DEFAULT NULL,
  p_stage_id   uuid     DEFAULT NULL,
  p_servant_id uuid     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_scope uuid[] := NULL;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  -- Church-wide scope for super_admin / admin; assignment-scoped otherwise.
  IF user_is_admin(v_church_id) THEN
    v_scope := NULL;
  ELSE
    SELECT COALESCE(array_agg(DISTINCT stage_id), ARRAY[]::uuid[])
      INTO v_scope
    FROM servant_stage_assignments
    WHERE servant_id = auth.uid()
      AND is_active = true
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      AND stage_id IS NOT NULL;
  END IF;

  -- Defensive intersection: a caller-supplied stage list can only narrow the
  -- actor's real scope, never widen it.
  IF p_stage_ids IS NOT NULL AND array_length(p_stage_ids, 1) > 0 THEN
    IF v_scope IS NULL THEN
      v_scope := p_stage_ids;
    ELSE
      SELECT ARRAY(
        SELECT unnest(v_scope) INTERSECT SELECT unnest(p_stage_ids)
      ) INTO v_scope;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'attendanceRate', (
      SELECT jsonb_build_object(
        'present', count(*) FILTER (WHERE r.status = 'present'),
        'absent', count(*) FILTER (WHERE r.status = 'absent'),
        'excused', count(*) FILTER (WHERE r.status = 'excused'),
        'total', count(*),
        'rate', round(
          (count(*) FILTER (WHERE r.status = 'present')::numeric * 100.0
           / NULLIF(count(*), 0))::numeric, 2)
      )
      FROM attendance_records r
      JOIN attendance_sessions s ON s.id = r.session_id
      WHERE r.church_id = v_church_id
        AND (p_from_date IS NULL OR s.session_date >= p_from_date)
        AND (p_to_date IS NULL OR s.session_date <= p_to_date)
        AND (p_service_id IS NULL OR s.service_id = p_service_id)
        AND (p_servant_id IS NULL OR r.servant_id = p_servant_id)
        AND (p_stage_id IS NULL OR s.stage_id = p_stage_id)
        AND (v_scope IS NULL OR s.stage_id = ANY(v_scope))
    ),
    'monthlyTrends', COALESCE((
      SELECT jsonb_agg(t.x ORDER BY t.x->>'period')
      FROM (
        SELECT jsonb_build_object(
          'period', to_char(s.session_date, 'YYYY-MM'),
          'present', count(*) FILTER (WHERE r.status = 'present'),
          'absent', count(*) FILTER (WHERE r.status = 'absent'),
          'excused', count(*) FILTER (WHERE r.status = 'excused'),
          'total', count(*)
        ) AS x
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.session_id
        WHERE r.church_id = v_church_id
          AND (p_from_date IS NULL OR s.session_date >= p_from_date)
          AND (p_to_date IS NULL OR s.session_date <= p_to_date)
          AND (p_service_id IS NULL OR s.service_id = p_service_id)
          AND (p_servant_id IS NULL OR r.servant_id = p_servant_id)
          AND (p_stage_id IS NULL OR s.stage_id = p_stage_id)
          AND (v_scope IS NULL OR s.stage_id = ANY(v_scope))
        GROUP BY to_char(s.session_date, 'YYYY-MM')
      ) t), '[]'::jsonb),
    'yearlyTrends', COALESCE((
      SELECT jsonb_agg(t.x ORDER BY t.x->>'period')
      FROM (
        SELECT jsonb_build_object(
          'period', to_char(s.session_date, 'YYYY'),
          'present', count(*) FILTER (WHERE r.status = 'present'),
          'absent', count(*) FILTER (WHERE r.status = 'absent'),
          'excused', count(*) FILTER (WHERE r.status = 'excused'),
          'total', count(*)
        ) AS x
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.session_id
        WHERE r.church_id = v_church_id
          AND (p_from_date IS NULL OR s.session_date >= p_from_date)
          AND (p_to_date IS NULL OR s.session_date <= p_to_date)
          AND (p_service_id IS NULL OR s.service_id = p_service_id)
          AND (p_servant_id IS NULL OR r.servant_id = p_servant_id)
          AND (p_stage_id IS NULL OR s.stage_id = p_stage_id)
          AND (v_scope IS NULL OR s.stage_id = ANY(v_scope))
        GROUP BY to_char(s.session_date, 'YYYY')
      ) t), '[]'::jsonb),
    'stageComparison', COALESCE((
      SELECT jsonb_agg(t.x)
      FROM (
        SELECT jsonb_build_object(
          'stage_id', s.stage_id,
          'stage_name', COALESCE(st.name_ar, st.name_en, 'Stage'),
          'present', count(*) FILTER (WHERE r.status = 'present'),
          'absent', count(*) FILTER (WHERE r.status = 'absent'),
          'excused', count(*) FILTER (WHERE r.status = 'excused'),
          'total', count(*),
          'attendance_rate', round(
            (count(*) FILTER (WHERE r.status = 'present')::numeric * 100.0
             / NULLIF(count(*), 0))::numeric, 2),
          'beneficiary_count', count(DISTINCT r.beneficiary_id),
          'followup_count', (
            SELECT count(*)
            FROM followups f
            WHERE f.church_id = v_church_id
              AND (p_from_date IS NULL OR f.created_at >= p_from_date)
              AND (p_to_date IS NULL OR f.created_at < p_to_date::date + 1)
              AND EXISTS (
                SELECT 1 FROM beneficiary_assignments ba
                WHERE ba.beneficiary_id = f.beneficiary_id
                  AND ba.is_current = true
                  AND ba.stage_id = s.stage_id
              )
          )
        ) AS x
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.session_id
        LEFT JOIN stages st ON st.id = s.stage_id
        WHERE r.church_id = v_church_id
          AND (p_from_date IS NULL OR s.session_date >= p_from_date)
          AND (p_to_date IS NULL OR s.session_date <= p_to_date)
          AND (p_service_id IS NULL OR s.service_id = p_service_id)
          AND (p_servant_id IS NULL OR r.servant_id = p_servant_id)
          AND (p_stage_id IS NULL OR s.stage_id = p_stage_id)
          AND (v_scope IS NULL OR s.stage_id = ANY(v_scope))
        GROUP BY s.stage_id, st.name_ar, st.name_en
      ) t), '[]'::jsonb),
    'servantAttendance', COALESCE((
      SELECT jsonb_agg(t.x ORDER BY t.x->>'servant_name')
      FROM (
        SELECT jsonb_build_object(
          'servant_id', r.servant_id,
          'servant_name', COALESCE(p.full_name_ar, 'Servant'),
          'present', count(*) FILTER (WHERE r.status = 'present'),
          'absent', count(*) FILTER (WHERE r.status = 'absent'),
          'excused', count(*) FILTER (WHERE r.status = 'excused'),
          'total', count(*),
          'rate', round(
            (count(*) FILTER (WHERE r.status = 'present')::numeric * 100.0
             / NULLIF(count(*), 0))::numeric, 2)
        ) AS x
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.session_id
        LEFT JOIN profiles p ON p.id = r.servant_id AND p.church_id = r.church_id
        WHERE r.church_id = v_church_id
          AND r.servant_id IS NOT NULL
          AND (p_from_date IS NULL OR s.session_date >= p_from_date)
          AND (p_to_date IS NULL OR s.session_date <= p_to_date)
          AND (p_service_id IS NULL OR s.service_id = p_service_id)
          AND (p_servant_id IS NULL OR r.servant_id = p_servant_id)
          AND (p_stage_id IS NULL OR s.stage_id = p_stage_id)
          AND (v_scope IS NULL OR s.stage_id = ANY(v_scope))
        GROUP BY r.servant_id, p.full_name_ar
      ) t), '[]'::jsonb),
    'beneficiaryAttendance', COALESCE((
      SELECT jsonb_agg(t.x ORDER BY t.x->>'beneficiary_name')
      FROM (
        SELECT jsonb_build_object(
          'beneficiary_id', r.beneficiary_id,
          'beneficiary_name', COALESCE(b.full_name_ar, 'Beneficiary'),
          'present', count(*) FILTER (WHERE r.status = 'present'),
          'absent', count(*) FILTER (WHERE r.status = 'absent'),
          'excused', count(*) FILTER (WHERE r.status = 'excused'),
          'total', count(*),
          'rate', round(
            (count(*) FILTER (WHERE r.status = 'present')::numeric * 100.0
             / NULLIF(count(*), 0))::numeric, 2)
        ) AS x
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.session_id
        LEFT JOIN beneficiaries b ON b.id = r.beneficiary_id AND b.church_id = r.church_id
        WHERE r.church_id = v_church_id
          AND r.beneficiary_id IS NOT NULL
          AND (p_from_date IS NULL OR s.session_date >= p_from_date)
          AND (p_to_date IS NULL OR s.session_date <= p_to_date)
          AND (p_service_id IS NULL OR s.service_id = p_service_id)
          AND (p_servant_id IS NULL OR r.servant_id = p_servant_id)
          AND (p_stage_id IS NULL OR s.stage_id = p_stage_id)
          AND (v_scope IS NULL OR s.stage_id = ANY(v_scope))
        GROUP BY r.beneficiary_id, b.full_name_ar
      ) t), '[]'::jsonb),
    'followupCompletion', (
      SELECT jsonb_build_object(
        'completed', count(*) FILTER (WHERE f.status = 'completed'),
        'open', count(*) FILTER (
          WHERE f.status IN ('open', 'in_progress')
            AND (f.scheduled_at IS NULL OR f.scheduled_at >= now())),
        'overdue', count(*) FILTER (
          WHERE f.status IN ('open', 'in_progress')
            AND f.scheduled_at IS NOT NULL AND f.scheduled_at < now()),
        'total', count(*),
        'completion_rate', round(
          (count(*) FILTER (WHERE f.status = 'completed')::numeric * 100.0
           / NULLIF(count(*), 0))::numeric, 2)
      )
      FROM followups f
      WHERE f.church_id = v_church_id
        AND (p_from_date IS NULL OR f.created_at >= p_from_date)
        AND (p_to_date IS NULL OR f.created_at < p_to_date::date + 1)
        AND (p_stage_id IS NULL OR EXISTS (
          SELECT 1 FROM beneficiary_assignments ba
          WHERE ba.beneficiary_id = f.beneficiary_id
            AND ba.is_current = true
            AND ba.stage_id = p_stage_id
        ))
        AND (v_scope IS NULL OR EXISTS (
          SELECT 1 FROM beneficiary_assignments ba
          WHERE ba.beneficiary_id = f.beneficiary_id
            AND ba.is_current = true
            AND ba.stage_id = ANY(v_scope)
        ))
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- PART 4 (F9): attendance_records INSERT/UPDATE bound to in-scope sessions
-- ============================================================================

DROP POLICY IF EXISTS record_attendance ON attendance_records;
CREATE POLICY record_attendance ON attendance_records FOR INSERT WITH CHECK (
  church_id = get_user_church_id()
  AND recorded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM attendance_sessions s
    WHERE s.id = session_id
      AND (s.stage_id = ANY(get_user_stage_ids()) OR s.class_id = ANY(get_user_class_ids()))
  )
);

DROP POLICY IF EXISTS record_attendance_update ON attendance_records;
CREATE POLICY record_attendance_update ON attendance_records FOR UPDATE
  USING (
    church_id = get_user_church_id()
    AND recorded_by = auth.uid()
  )
  WITH CHECK (
    church_id = get_user_church_id()
    AND recorded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM attendance_sessions s
      WHERE s.id = session_id
        AND (s.stage_id = ANY(get_user_stage_ids()) OR s.class_id = ANY(get_user_class_ids()))
    )
  );

-- ============================================================================
-- PRIVILEGE LOCKDOWN (matches 024/035/038 conventions)
-- ============================================================================

REVOKE ALL ON FUNCTION get_stage_manager_stage_ids() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION get_stage_manager_stage_ids() TO authenticated;

REVOKE ALL ON FUNCTION get_stage_reports(uuid[], date, date, uuid, uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION get_stage_reports(uuid[], date, date, uuid, uuid, uuid) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
--   SELECT get_stage_manager_stage_ids();               -- [] for users with no church
--   SELECT pg_get_function_identity_arguments('get_stage_reports(uuid[], date, date, uuid, uuid, uuid)'::regprocedure);
--   SELECT has_function_privilege('anon', 'get_stage_reports(uuid[], date, date, uuid, uuid, uuid)', 'EXECUTE'); -- false
--   SELECT has_function_privilege('authenticated', 'get_stage_reports(uuid[], date, date, uuid, uuid, uuid)', 'EXECUTE'); -- true
--   -- As super_admin: SELECT get_stage_reports();                        -> church-wide buckets
--   -- As a stage-scoped servant with stage A assigned:
--   --   SELECT get_stage_reports(p_stage_ids := ARRAY['A','foreign-id']); -> only stage A rows
--   --   SELECT get_stage_reports(p_stage_ids := ARRAY['foreign-id']);     -> empty buckets (no leak)
--   -- As admin: get_user_stage_ids() returns all active church stages (D4).
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   DROP FUNCTION IF EXISTS get_stage_reports(uuid[], date, date, uuid, uuid, uuid);
--   DROP FUNCTION IF EXISTS get_stage_manager_stage_ids();
--   -- Restore the 022 scope helpers to their pre-039 (pre-D4) bodies, i.e.
--   -- user_is_super_admin(v_church_id) instead of user_is_admin(v_church_id)
--   -- and end_date IS NULL, then re-create the original record_attendance and
--   -- record_attendance_update policies (see 022/027/028).
--   -- Primary rollback path in all cases: restore the pre-039 database snapshot.
-- ============================================================================
