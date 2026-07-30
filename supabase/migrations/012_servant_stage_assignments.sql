-- ============================================================================
-- Church Ministry CRM — Servant Stage Assignments
-- Migration: 012_servant_stage_assignments.sql
-- Action: Create servant_stage_assignments, migrate from user_stage_assignments,
--         add UNIQUE constraint per ASSIGNMENT_MODEL, drop old table
-- ============================================================================

-- ============================================================================
-- 1. CREATE servant_stage_assignments TABLE
-- ============================================================================

CREATE TABLE servant_stage_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  servant_id  uuid NOT NULL REFERENCES servants (id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES services (id),
  stage_id    uuid REFERENCES stages (id),
  class_id    uuid REFERENCES classes (id),
  role        text NOT NULL DEFAULT 'servant',
  assigned_by uuid NOT NULL REFERENCES profiles (id),
  start_date  date NOT NULL DEFAULT CURRENT_DATE,
  end_date    date,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ssa_servant_active ON servant_stage_assignments (servant_id, is_active);
CREATE INDEX idx_ssa_stage_active ON servant_stage_assignments (church_id, stage_id, is_active);
CREATE INDEX idx_ssa_service_active ON servant_stage_assignments (church_id, service_id, is_active);

-- Canonical UNIQUE constraint per ASSIGNMENT_MODEL §1.1
ALTER TABLE servant_stage_assignments ADD UNIQUE (servant_id, stage_id, class_id, end_date);

-- ============================================================================
-- 2. DATA MIGRATION — from user_stage_assignments
-- ============================================================================

INSERT INTO servant_stage_assignments (church_id, servant_id, service_id, stage_id, class_id, role, assigned_by, start_date, is_active, created_at)
SELECT
  usa.church_id,
  usa.user_id,
  st.service_id,
  usa.stage_id,
  NULL,
  'servant',
  COALESCE(usa.assigned_by, usa.user_id),
  CURRENT_DATE,
  true,
  usa.created_at
FROM user_stage_assignments usa
JOIN stages st ON st.id = usa.stage_id;

-- ============================================================================
-- 3. BACKUP AND DROP OLD TABLE
-- ============================================================================

ALTER TABLE user_stage_assignments RENAME TO user_stage_assignments_backup_20260730;
