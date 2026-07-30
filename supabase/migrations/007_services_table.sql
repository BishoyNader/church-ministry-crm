-- ============================================================================
-- Church Ministry CRM — Services Table & FK Migration
-- Migration: 007_services_table.sql
-- Action: Rename ministries → services, update FKs in stages + events,
--         add events FK/NOT NULL, add stages canonical index
-- ============================================================================

-- ============================================================================
-- 1. CREATE SERVICES TABLE (replaces ministries)
-- ============================================================================

CREATE TABLE services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  name_ar         text NOT NULL,
  name_en         text,
  description_ar  text,
  description_en  text,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_services_church_active ON services (church_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- 2. DATA MIGRATION — copy ministries into services
-- ============================================================================

INSERT INTO services (id, church_id, name_ar, name_en, description_ar, description_en, sort_order, is_active, created_at, updated_at, deleted_at)
SELECT id, church_id, name_ar, name_en, description_ar, description_en, sort_order, is_active, created_at, updated_at, deleted_at FROM ministries;

-- ============================================================================
-- 3. UPDATE STAGES FK — rename ministry_id → service_id
-- ============================================================================

ALTER TABLE stages RENAME COLUMN ministry_id TO service_id;
ALTER TABLE stages DROP CONSTRAINT IF EXISTS stages_ministry_id_fkey;

-- ============================================================================
-- 4. UPDATE FKs — rename columns, drop stale FKs, add new constraints
-- ============================================================================

ALTER TABLE events RENAME COLUMN ministry_id TO service_id;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_ministry_id_fkey;

ALTER TABLE events ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE events ADD FOREIGN KEY (service_id) REFERENCES services(id);
ALTER TABLE stages ADD FOREIGN KEY (service_id) REFERENCES services(id);

-- ============================================================================
-- 5. DROP OLD STAGES INDEXES — create canonical index
-- ============================================================================

DROP INDEX IF EXISTS idx_stages_church;
DROP INDEX IF EXISTS idx_stages_church_ministry;
DROP INDEX IF EXISTS idx_stages_church_active;

CREATE INDEX idx_stages_service_sort ON stages (service_id, sort_order) WHERE deleted_at IS NULL;

-- ============================================================================
-- 6. BACKUP AND DROP MINISTRIES TABLE
-- ============================================================================

ALTER TABLE ministries RENAME TO ministries_backup_20260730;
ALTER TABLE ministries_backup_20260730 DROP CONSTRAINT IF EXISTS ministries_church_id_fkey;
