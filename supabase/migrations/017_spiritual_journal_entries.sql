-- ============================================================================
-- Church Ministry CRM — Spiritual Journal Entries
-- Migration: 017_spiritual_journal_entries.sql
-- Action: Create spiritual_journal_entries table
-- ============================================================================

CREATE TABLE spiritual_journal_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  servant_id        uuid NOT NULL REFERENCES servants (id) ON DELETE CASCADE,
  entry_date        date NOT NULL,
  morning_prayer    boolean NOT NULL DEFAULT false,
  third_hour_prayer boolean NOT NULL DEFAULT false,
  sixth_hour_prayer boolean NOT NULL DEFAULT false,
  ninth_hour_prayer boolean NOT NULL DEFAULT false,
  sunset_prayer     boolean NOT NULL DEFAULT false,
  sleep_prayer      boolean NOT NULL DEFAULT false,
  bible_reading     boolean NOT NULL DEFAULT false,
  confession        boolean NOT NULL DEFAULT false,
  communion         boolean NOT NULL DEFAULT false,
  spiritual_notes   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (servant_id, entry_date)
);

CREATE UNIQUE INDEX idx_spiritual_servant_date ON spiritual_journal_entries (servant_id, entry_date);

CREATE TRIGGER trg_spiritual_journal_updated_at
  BEFORE UPDATE ON spiritual_journal_entries
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
