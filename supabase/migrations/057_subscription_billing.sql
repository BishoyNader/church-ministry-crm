-- ============================================================================
-- Church Ministry CRM — Subscription & Billing System
-- Migration: 057_subscription_billing.sql
-- Action:
--   1. Add new columns to churches (trial_used, subscription_expires_at)
--   2. Create payment_requests, invoices, refunds tables
--   3. Create invoice number generator
--   4. Add RLS policies (tenant isolation + platform owner)
--   5. Add audit triggers
--   6. Backfill trial_ends_at for existing trial churches
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. MODIFY CHURCHES TABLE
-- ============================================================================

-- Add trial_used flag (a church can only use the free trial once)
ALTER TABLE churches ADD COLUMN IF NOT EXISTS trial_used boolean NOT NULL DEFAULT false;

-- Add subscription_expires_at (when current subscription expires)
ALTER TABLE churches ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- Update default subscription_tier to 'free' for new churches going forward
-- Existing churches keep their current tier values
ALTER TABLE churches ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- ============================================================================
-- 2. CREATE PAYMENT_REQUESTS TABLE
-- ============================================================================

CREATE TABLE payment_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  requested_by    uuid NOT NULL REFERENCES profiles (id),
  plan            text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount          numeric(10,2) NOT NULL,
  currency        text NOT NULL DEFAULT 'EGP',
  payment_method  text NOT NULL DEFAULT 'instapay',
  transfer_date   date,
  payment_reference text,
  note            text,
  payment_proof_path text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by     uuid REFERENCES profiles (id),
  reviewed_at     timestamptz,
  reviewer_notes  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_requests_church ON payment_requests (church_id);
CREATE INDEX idx_payment_requests_church_status ON payment_requests (church_id, status);
CREATE INDEX idx_payment_requests_status ON payment_requests (status) WHERE status = 'pending';

CREATE TRIGGER trg_payment_requests_updated_at
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- 3. CREATE INVOICES TABLE
-- ============================================================================

CREATE TABLE invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  payment_request_id uuid REFERENCES payment_requests (id) ON DELETE SET NULL,
  invoice_number    text NOT NULL UNIQUE,
  plan              text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount            numeric(10,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'EGP',
  payment_method    text NOT NULL DEFAULT 'instapay',
  paid_at           timestamptz NOT NULL DEFAULT now(),
  subscription_start timestamptz NOT NULL,
  subscription_end  timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'void')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_church ON invoices (church_id);
CREATE INDEX idx_invoices_church_created ON invoices (church_id, created_at DESC);

-- ============================================================================
-- 4. CREATE REFUNDS TABLE
-- ============================================================================

CREATE TABLE refunds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  payment_request_id uuid NOT NULL REFERENCES payment_requests (id) ON DELETE CASCADE,
  invoice_id        uuid REFERENCES invoices (id) ON DELETE SET NULL,
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  refund_reference  text,
  reviewed_by       uuid REFERENCES profiles (id),
  reviewed_at       timestamptz,
  completed_at      timestamptz,
  completed_by      uuid REFERENCES profiles (id),
  reviewer_notes    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refunds_church ON refunds (church_id);
CREATE INDEX idx_refunds_church_status ON refunds (church_id, status);
CREATE INDEX idx_refunds_status ON refunds (status) WHERE status = 'pending';

CREATE TRIGGER trg_refunds_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- 5. INVOICE NUMBER GENERATOR
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  v_year text;
  v_next_num integer;
  v_invoice_number text;
BEGIN
  v_year := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 10) AS integer)
  ), 0) + 1
  INTO v_next_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || v_year || '-%';

  v_invoice_number := 'INV-' || v_year || '-' || LPAD(v_next_num::text, 6, '0');
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- payment_requests: church members see own church, platform owner sees all
CREATE POLICY payment_requests_tenant_read ON payment_requests
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY payment_requests_tenant_insert ON payment_requests
  FOR INSERT WITH CHECK (
    church_id = get_user_church_id()
    AND requested_by = auth.uid()
  );

CREATE POLICY payment_requests_tenant_update ON payment_requests
  FOR UPDATE USING (
    church_id = get_user_church_id()
    AND status = 'pending'
  );

CREATE POLICY payment_requests_platform_owner ON payment_requests
  FOR ALL USING (user_is_platform_owner());

-- invoices: church members see own church, platform owner sees all
CREATE POLICY invoices_tenant_read ON invoices
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY invoices_platform_owner ON invoices
  FOR ALL USING (user_is_platform_owner());

-- refunds: church members see own church, platform owner sees all
CREATE POLICY refunds_tenant_read ON refunds
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY refunds_tenant_insert ON refunds
  FOR INSERT WITH CHECK (church_id = get_user_church_id());

CREATE POLICY refunds_platform_owner ON refunds
  FOR ALL USING (user_is_platform_owner());

-- ============================================================================
-- 7. AUDIT TRIGGERS
-- ============================================================================

CREATE TRIGGER audit_payment_requests
  AFTER INSERT OR UPDATE OR DELETE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_refunds
  AFTER INSERT OR UPDATE OR DELETE ON refunds
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- ============================================================================
-- 8. BACKFILL: Set trial_ends_at for existing trial churches
-- ============================================================================

UPDATE churches
SET trial_ends_at = created_at + interval '30 days',
    subscription_expires_at = created_at + interval '30 days'
WHERE subscription_tier = 'trial'
  AND trial_ends_at IS NULL;

COMMIT;
