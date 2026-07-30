-- ============================================================================
-- Church Ministry CRM — Classes Table
-- Migration: 008_classes_table.sql
-- Action: Create classes table with indexes and trigger
-- ============================================================================

CREATE TABLE classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  stage_id    uuid NOT NULL REFERENCES stages (id) ON DELETE CASCADE,
  name_ar     text NOT NULL,
  name_en     text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_church_stage ON classes (church_id, stage_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
