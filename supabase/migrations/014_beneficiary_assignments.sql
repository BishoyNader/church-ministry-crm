-- ============================================================================
-- Church Ministry CRM — Beneficiary Assignments
-- Migration: 014_beneficiary_assignments.sql
-- Action: Create beneficiary_assignments, migrate from beneficiaries.stage_id,
--         then drop stage_id from beneficiaries
-- ============================================================================

-- ============================================================================
-- 1. CREATE beneficiary_assignments TABLE
-- ============================================================================

CREATE TABLE beneficiary_assignments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  beneficiary_id    uuid NOT NULL REFERENCES beneficiaries (id) ON DELETE CASCADE,
  service_id        uuid NOT NULL REFERENCES services (id),
  stage_id          uuid NOT NULL REFERENCES stages (id),
  class_id          uuid REFERENCES classes (id),
  servant_id        uuid NOT NULL REFERENCES servants (id),
  assigned_by       uuid NOT NULL REFERENCES profiles (id),
  is_current        boolean NOT NULL DEFAULT true,
  start_date        date NOT NULL DEFAULT CURRENT_DATE,
  end_date          date,
  transfer_reason   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ba_current ON beneficiary_assignments (beneficiary_id) WHERE is_current = true;
CREATE INDEX idx_ba_stage_current ON beneficiary_assignments (church_id, stage_id, is_current);
CREATE INDEX idx_ba_servant_current ON beneficiary_assignments (church_id, servant_id, is_current);

-- ============================================================================
-- 2. DATA MIGRATION — resolve service_id from stage_id via JOIN,
--    resolve servant from user_stage_assignments backup
-- ============================================================================
-- NOTE: Beneficiaries from churches with zero servants are NOT migrated
-- (skipped to avoid NOT NULL violation on servant_id).
-- Run the pre-flight check from PRODUCTION_READINESS_CHECKLIST.md before executing.

INSERT INTO beneficiary_assignments (church_id, beneficiary_id, service_id, stage_id, class_id, servant_id, assigned_by, is_current, start_date)
SELECT
  b.church_id,
  b.id,
  st.service_id,
  b.stage_id,
  NULL,
  COALESCE(
    (SELECT s.id FROM servants s
     JOIN user_stage_assignments_backup_20260730 usa ON usa.user_id = s.id
     WHERE usa.stage_id = b.stage_id AND usa.church_id = b.church_id
     LIMIT 1),
    (SELECT id FROM servants WHERE church_id = b.church_id LIMIT 1)
  ),
  (SELECT id FROM profiles WHERE church_id = b.church_id LIMIT 1),
  true,
  CURRENT_DATE
FROM beneficiaries b
JOIN stages st ON st.id = b.stage_id
WHERE b.deleted_at IS NULL AND b.status = 'active'
  AND EXISTS (SELECT 1 FROM servants s WHERE s.church_id = b.church_id);

-- ============================================================================
-- 3. DROP stage_id FROM BENEFICIARIES
-- ============================================================================

ALTER TABLE beneficiaries DROP COLUMN stage_id CASCADE;
