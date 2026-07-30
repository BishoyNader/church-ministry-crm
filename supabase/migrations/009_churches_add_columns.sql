-- ============================================================================
-- Church Ministry CRM — Churches Add Columns
-- Migration: 009_churches_add_columns.sql
-- Action: Add 9 canonical columns to churches, subscription index, drop old index
-- ============================================================================

-- ============================================================================
-- 1. ADD CANONICAL COLUMNS
-- ============================================================================

ALTER TABLE churches ADD COLUMN contact_email text;
ALTER TABLE churches ADD COLUMN contact_phone text;
ALTER TABLE churches ADD COLUMN address_ar text;
ALTER TABLE churches ADD COLUMN address_en text;
ALTER TABLE churches ADD COLUMN subscription_tier text NOT NULL DEFAULT 'trial';
ALTER TABLE churches ADD COLUMN subscription_status text NOT NULL DEFAULT 'active';
ALTER TABLE churches ADD COLUMN trial_ends_at timestamptz;
ALTER TABLE churches ADD COLUMN feature_flags jsonb NOT NULL DEFAULT '{}';
ALTER TABLE churches ADD COLUMN locale text NOT NULL DEFAULT 'ar';

-- ============================================================================
-- 2. CREATE SUBSCRIPTION INDEX
-- ============================================================================

CREATE INDEX idx_churches_subscription_status ON churches (subscription_status) WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. DROP OLD INDEX BEING REPLACED
-- ============================================================================

DROP INDEX IF EXISTS idx_churches_active;
