-- ============================================================================
-- Church Ministry CRM — Annual Promotion Automation (Jan 1 cron hook)
-- Migration: 047_promotion_automation.sql
-- Action: Add run_annual_promotions_auto(...) — the service-role-only runner
--         invoked by the Vercel Cron job (/api/cron/annual-promotion, Jan 1)
--         through the admin (service-role) client. Applies an annual promotion
--         run for every active stage across all active churches.
-- Why not pg_cron: this deployment uses Vercel Cron (see vercel.json +
--   src/features/notifications/cron), matching the existing notification scans.
-- Security: the auto-runner is REVOKED from every client role and only granted
--   to service_role — no authenticated user can trigger church-wide writes.
--   It reuses apply_promotion_run (046) for the per-stage logic, so idempotency
--   (one 'applied' run per stage + academic year), graduation handling, audit
--   rows and notifications behave identically to the manual admin path.
-- Dependencies: 046 (annual_promotions tables + apply_promotion_run).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- run_annual_promotions_auto(p_academic_year) RETURNS jsonb
--   For every active church -> active service -> active stage (with at least
--   one active beneficiary assigned), apply_promotion_run(...) and collect a
--   summary. Errors on one stage (e.g. already applied -> NULL, not an error)
--   are caught per-stage so one broken stage never aborts the whole batch.
--   The returned jsonb is an array of {church_id, stage_id, run_id} where
--   run_id IS NULL means "no-op (already applied)".
-- ============================================================================

CREATE OR REPLACE FUNCTION run_annual_promotions_auto(
  p_academic_year integer DEFAULT (EXTRACT(YEAR FROM CURRENT_DATE))::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_stage_id uuid;
  v_church_id uuid;
  v_run_id uuid;
  v_item jsonb;
BEGIN
  FOR v_church_id, v_stage_id IN
    SELECT st.church_id, st.id
    FROM stages st
    JOIN services sv ON sv.id = st.service_id
    JOIN churches ch ON ch.id = st.church_id
    WHERE st.deleted_at IS NULL
      AND st.is_active = true
      AND sv.deleted_at IS NULL
      AND ch.is_active = true
      AND EXISTS (
        SELECT 1
        FROM beneficiary_assignments ba
        JOIN beneficiaries b ON b.id = ba.beneficiary_id
        WHERE ba.stage_id = st.id AND ba.is_current = true
          AND b.deleted_at IS NULL AND b.status = 'active'
      )
    ORDER BY st.church_id, st.id
  LOOP
    BEGIN
      v_run_id := apply_promotion_run(v_stage_id, p_academic_year, NULL, NULL);
    EXCEPTION WHEN OTHERS THEN
      v_run_id := NULL;
    END;

    SELECT jsonb_build_object(
      'church_id', v_church_id,
      'stage_id', v_stage_id,
      'run_id', v_run_id
    ) INTO v_item;

    v_result := v_result || v_item;
  END LOOP;

  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- Privilege lockdown — service_role ONLY.
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION run_annual_promotions_auto(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION run_annual_promotions_auto(integer)
  TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Privileges
--   SELECT has_function_privilege('authenticated',
--     'run_annual_promotions_auto(integer)', 'EXECUTE');  -- false
--   SELECT has_function_privilege('service_role',
--     'run_annual_promotions_auto(integer)', 'EXECUTE');  -- true
-- V2 — Dry smoke (service-role client, as the cron would):
--   SELECT run_annual_promotions_auto(2026);
--   -- Returns an array of {church_id, stage_id, run_id}; a second call for the
--   -- same year returns run_id = NULL everywhere (idempotent no-op).
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   DROP FUNCTION run_annual_promotions_auto(integer);
-- ============================================================================
