-- ============================================================================
-- Church Ministry CRM — Audit Logs Update
-- Migration: 019_audit_logs_update.sql
-- Action: Rename user_id → actor_id, change action to TEXT, drop
--         ip_address/user_agent, rebuild indexes, drop audit_action enum
-- ============================================================================

-- ============================================================================
-- 1. RENAME user_id → actor_id (nullable)
-- ============================================================================

ALTER TABLE audit_logs RENAME COLUMN user_id TO actor_id;

-- ============================================================================
-- 2. CHANGE action FROM ENUM TO TEXT
-- ============================================================================

ALTER TABLE audit_logs ALTER COLUMN action TYPE text USING action::text;

-- ============================================================================
-- 3. DROP COLUMNS NOT IN CANONICAL SPEC
-- ============================================================================

ALTER TABLE audit_logs DROP COLUMN ip_address;
ALTER TABLE audit_logs DROP COLUMN user_agent;

-- ============================================================================
-- 4. ENFORCE entity_id NOT NULL PER CANONICAL SPEC
-- ============================================================================

UPDATE audit_logs SET entity_id = '00000000-0000-0000-0000-000000000000' WHERE entity_id IS NULL;
ALTER TABLE audit_logs ALTER COLUMN entity_id SET NOT NULL;

-- ============================================================================
-- 5. ADD metadata JSONB COLUMN PER CANONICAL SPEC
-- ============================================================================

ALTER TABLE audit_logs ADD COLUMN metadata jsonb;

-- 6. DROP OLD INDEXES AND CREATE CANONICAL
-- ============================================================================

DROP INDEX IF EXISTS idx_audit_logs_church_created;
DROP INDEX IF EXISTS idx_audit_logs_church_entity;
DROP INDEX IF EXISTS idx_audit_logs_user_created;

CREATE INDEX idx_audit_logs_church_time ON audit_logs (church_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

-- ============================================================================
-- 7. DROP OLD ENUM NO LONGER NEEDED
-- ============================================================================

DROP TYPE IF EXISTS audit_action CASCADE;

-- Recreate function with text parameter (CASCADE above drops the old one)
CREATE OR REPLACE FUNCTION write_audit_log(
  p_church_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO audit_logs (church_id, actor_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (p_church_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_old_values, p_new_values)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
