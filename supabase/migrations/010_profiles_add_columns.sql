-- ============================================================================
-- Church Ministry CRM — Profiles Add Columns
-- Migration: 010_profiles_add_columns.sql
-- Action: Add 4 canonical columns, fix indexes, enforce email NOT NULL
-- ============================================================================

-- ============================================================================
-- 1. ADD CANONICAL COLUMNS
-- ============================================================================

ALTER TABLE profiles ADD COLUMN date_of_birth date;
ALTER TABLE profiles ADD COLUMN gender gender_type;
ALTER TABLE profiles ADD COLUMN spiritual_title text;
ALTER TABLE profiles ADD COLUMN service_started_at date;

-- ============================================================================
-- 2. ENFORCE EMAIL NOT NULL
-- ============================================================================

ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;

-- ============================================================================
-- 3. REPLACE INDEXES — drop old, create canonical
-- ============================================================================

DROP INDEX IF EXISTS idx_profiles_church_email;
DROP INDEX IF EXISTS idx_profiles_church_phone;
DROP INDEX IF EXISTS idx_profiles_church_active;

CREATE UNIQUE INDEX idx_profiles_email ON profiles (email);
CREATE INDEX idx_profiles_church_active ON profiles (church_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_spiritual_title ON profiles (church_id, spiritual_title) WHERE deleted_at IS NULL AND spiritual_title IS NOT NULL;
