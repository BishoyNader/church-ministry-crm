-- ============================================================================
-- Church Ministry CRM — Servants Table
-- Migration: 011_servants_table.sql
-- Action: Create servants table (FK → profiles), migrate existing profiles,
--         exclude platform owner (church_id IS NULL)
-- ============================================================================

-- ============================================================================
-- 1. CREATE SERVANTS TABLE
-- ============================================================================

CREATE TABLE servants (
  id                    uuid PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  church_id             uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  confession_father_name text,
  join_date             date,
  service_history       jsonb NOT NULL DEFAULT '[]',
  notes                 text,
  approval_status       text NOT NULL DEFAULT 'pending',
  approved_by           uuid REFERENCES profiles (id),
  approved_at           timestamptz,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_servants_church_approval ON servants (church_id, approval_status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_servants_updated_at
  BEFORE UPDATE ON servants
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- 2. DATA MIGRATION — create servant records for all profiles
--    EXCLUDING platform owner (church_id IS NULL)
-- ============================================================================

INSERT INTO servants (id, church_id, notes, approval_status, created_at, updated_at)
SELECT id, church_id, NULL, 'approved', now(), now()
FROM profiles
WHERE deleted_at IS NULL AND church_id IS NOT NULL;
