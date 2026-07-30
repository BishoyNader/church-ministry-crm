-- ============================================================================
-- Church Ministry CRM — User Roles Update
-- Migration: 020_user_roles_update.sql
-- Action: Add assigned_by NOT NULL, start_date, end_date, canonical index
-- ============================================================================

-- ============================================================================
-- 1. MAKE assigned_by NOT NULL
-- ============================================================================

UPDATE user_roles SET assigned_by = (SELECT id FROM profiles WHERE church_id = user_roles.church_id LIMIT 1) WHERE assigned_by IS NULL;
ALTER TABLE user_roles ALTER COLUMN assigned_by SET NOT NULL;

-- ============================================================================
-- 2. ADD start_date COLUMN
-- ============================================================================

ALTER TABLE user_roles ADD COLUMN start_date date;
UPDATE user_roles SET start_date = created_at::date;
ALTER TABLE user_roles ALTER COLUMN start_date SET NOT NULL;

-- ============================================================================
-- 3. ADD end_date COLUMN (nullable)
-- ============================================================================

ALTER TABLE user_roles ADD COLUMN end_date date;

-- ============================================================================
-- 4. DROP OLD INDEXES, CREATE CANONICAL
-- ============================================================================

DROP INDEX IF EXISTS idx_user_roles_church_user;
DROP INDEX IF EXISTS idx_user_roles_user;

CREATE INDEX idx_user_roles_user_active ON user_roles (user_id, role_id) WHERE end_date IS NULL;
