-- ============================================================================
-- Church Ministry CRM — Dashboard Analytics Aggregation RPC
-- Migration: 038_dashboard_trends_rpc.sql
-- Action: Sprint 2 — Dashboard Performance (Phase 5). Move the expensive
--         dashboard series aggregations from client-side JS (which loaded
--         full tables) into a single SQL aggregation.
-- RPC: get_dashboard_trends(p_stage_ids uuid[] DEFAULT NULL) RETURNS jsonb
--   Returns raw buckets; the service layer fills the 12-week/12-month zero
--   series and merges stage names. Scoped:
--     - Admins / Platform Owner: whole church.
--     - Servants / Stage Managers: intersection of their active
--       servant_stage_assignments and p_stage_ids (if provided).
--   Because the function is SECURITY DEFINER (bypasses RLS), the scope is
--   enforced INSIDE the function — a non-admin caller can never read outside
--   their assigned stages.
-- Conventions: matches 024/035 — SECURITY DEFINER, search_path = public, auth,
--   auth.uid() guards, REVOKE/GRANT lockdown.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION get_dashboard_trends(p_stage_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_is_admin boolean;
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

  v_is_admin := user_is_admin(v_church_id) OR user_is_platform_owner();

  IF NOT v_is_admin THEN
    SELECT COALESCE(array_agg(stage_id), ARRAY[]::uuid[])
      INTO v_scope
    FROM servant_stage_assignments
    WHERE servant_id = auth.uid()
      AND is_active = true
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      AND stage_id IS NOT NULL;

    -- Defensive intersection with the optional caller-supplied scope.
    IF p_stage_ids IS NOT NULL AND array_length(p_stage_ids, 1) > 0 THEN
      SELECT ARRAY(
        SELECT unnest(v_scope) INTERSECT SELECT unnest(p_stage_ids)
      ) INTO v_scope;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'attendanceMonthlyTrend', COALESCE((
      SELECT jsonb_agg(t.x ORDER BY t.x->>'period')
      FROM (
        SELECT jsonb_build_object(
          'period', to_char(s.session_date, 'YYYY-MM'),
          'present', count(*) FILTER (WHERE r.status = 'present'),
          'absent', count(*) FILTER (WHERE r.status = 'absent'),
          'excused', count(*) FILTER (WHERE r.status = 'excused')
        ) AS x
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.session_id
        WHERE r.church_id = v_church_id
          AND s.session_date >= date_trunc('month', now()) - interval '11 months'
          AND (v_scope IS NULL OR s.stage_id = ANY(v_scope))
        GROUP BY to_char(s.session_date, 'YYYY-MM')
      ) t), '[]'::jsonb),
    'attendanceWeeklyTrend', COALESCE((
      SELECT jsonb_agg(t.x ORDER BY t.x->>'period')
      FROM (
        SELECT jsonb_build_object(
          'period', to_char(s.session_date, 'IYYY"-W"IW'),
          'present', count(*) FILTER (WHERE r.status = 'present'),
          'absent', count(*) FILTER (WHERE r.status = 'absent'),
          'excused', count(*) FILTER (WHERE r.status = 'excused')
        ) AS x
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.session_id
        WHERE r.church_id = v_church_id
          AND s.session_date >= date_trunc('week', now()) - interval '11 weeks'
          AND (v_scope IS NULL OR s.stage_id = ANY(v_scope))
        GROUP BY to_char(s.session_date, 'IYYY"-W"IW')
      ) t), '[]'::jsonb),
    'attendanceByStage', COALESCE((
      SELECT jsonb_agg(t.x)
      FROM (
        SELECT jsonb_build_object(
          'stage_id', s.stage_id,
          'present', count(*) FILTER (WHERE r.status = 'present'),
          'absent', count(*) FILTER (WHERE r.status = 'absent'),
          'excused', count(*) FILTER (WHERE r.status = 'excused')
        ) AS x
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.session_id
        WHERE r.church_id = v_church_id
          AND s.session_date >= date_trunc('month', now()) - interval '11 months'
          AND (v_scope IS NULL OR s.stage_id = ANY(v_scope))
        GROUP BY s.stage_id
      ) t), '[]'::jsonb),
    'attendanceThisMonthByStage', COALESCE((
      SELECT jsonb_agg(t.x)
      FROM (
        SELECT jsonb_build_object(
          'stage_id', s.stage_id,
          'attendance_count', count(*) FILTER (WHERE r.status = 'present'),
          'attendance_total', count(*)
        ) AS x
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.session_id
        WHERE r.church_id = v_church_id
          AND s.session_date >= date_trunc('month', now())
          AND (v_scope IS NULL OR s.stage_id = ANY(v_scope))
        GROUP BY s.stage_id
      ) t), '[]'::jsonb),
    'followupStatusCounts', COALESCE((
      SELECT jsonb_agg(t.x)
      FROM (
        SELECT jsonb_build_object('status', f.status, 'count', count(*)) AS x
        FROM followups f
        WHERE f.church_id = v_church_id
          AND (v_scope IS NULL OR EXISTS (
            SELECT 1 FROM beneficiary_assignments ba
            WHERE ba.beneficiary_id = f.beneficiary_id
              AND ba.is_current = true
              AND ba.stage_id = ANY(v_scope)
          ))
        GROUP BY f.status
      ) t), '[]'::jsonb),
    'overdue', (
      SELECT count(*)
      FROM followups f
      WHERE f.church_id = v_church_id
        AND f.status IN ('open', 'in_progress')
        AND f.scheduled_at IS NOT NULL
        AND f.scheduled_at < now()
        AND (v_scope IS NULL OR EXISTS (
          SELECT 1 FROM beneficiary_assignments ba
          WHERE ba.beneficiary_id = f.beneficiary_id
            AND ba.is_current = true
            AND ba.stage_id = ANY(v_scope)
        ))
    ),
    'childrenPerStage', COALESCE((
      SELECT jsonb_agg(t.x)
      FROM (
        SELECT jsonb_build_object('stage_id', stage_id, 'count', count(*)) AS x
        FROM beneficiary_assignments
        WHERE church_id = v_church_id
          AND is_current = true
          AND (v_scope IS NULL OR stage_id = ANY(v_scope))
        GROUP BY stage_id
      ) t), '[]'::jsonb),
    'followupsByStage', COALESCE((
      SELECT jsonb_agg(t.x)
      FROM (
        SELECT jsonb_build_object('stage_id', ba.stage_id, 'count', count(*)) AS x
        FROM followups f
        JOIN beneficiary_assignments ba
          ON ba.beneficiary_id = f.beneficiary_id
         AND ba.is_current = true
         AND ba.church_id = f.church_id
        WHERE f.church_id = v_church_id
          AND (v_scope IS NULL OR ba.stage_id = ANY(v_scope))
        GROUP BY ba.stage_id
      ) t), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Privilege lockdown (matches 024/035 conventions).
REVOKE ALL ON FUNCTION get_dashboard_trends(uuid[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION get_dashboard_trends(uuid[]) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
--   SELECT pg_get_function_identity_arguments('get_dashboard_trends(uuid[])'::regprocedure);
--   SELECT has_function_privilege('anon', 'get_dashboard_trends(uuid[])', 'EXECUTE'); -- false
--   SELECT has_function_privilege('authenticated', 'get_dashboard_trends(uuid[])', 'EXECUTE'); -- true
--   -- As super_admin: SELECT get_dashboard_trends();  → church-wide buckets
--   -- As a stage-scoped servant with stage A assigned, verify the same call
--   -- returns only stage A buckets (scope enforcement).
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   DROP FUNCTION IF EXISTS get_dashboard_trends(uuid[]);
--   -- The service layer falls back to JS aggregation automatically when the
--   -- RPC is missing, so the app remains functional without the function.
-- ============================================================================
