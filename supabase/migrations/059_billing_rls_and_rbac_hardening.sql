-- ============================================================================
-- Church Ministry CRM — Billing RLS & RBAC Hardening
-- Migration: 059_billing_rls_and_rbac_hardening.sql
-- Action:
--   1. Fix payment_requests tenant UPDATE: add WITH CHECK to prevent
--      self-approval (status must remain 'pending' or 'cancelled')
--   2. Restrict tenant UPDATE to the original requester only
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX: payment_requests tenant UPDATE policy
-- ============================================================================
-- PROBLEM: The old policy had no WITH CHECK clause, allowing any church
-- member to set status='approved' and self-approve their own payment.
-- FIX: Drop and recreate with:
--   - USING: must be pending, must belong to user's church, must be the
--     original requester (prevents one member modifying another's request)
--   - WITH CHECK: status must remain within {pending, cancelled} — prevents
--     escalating to approved/rejected

DROP POLICY IF EXISTS payment_requests_tenant_update ON payment_requests;

CREATE POLICY payment_requests_tenant_update ON payment_requests
  FOR UPDATE USING (
    church_id = get_user_church_id()
    AND status = 'pending'
    AND requested_by = auth.uid()
  ) WITH CHECK (
    church_id = get_user_church_id()
    AND status IN ('pending', 'cancelled')
  );

COMMIT;
