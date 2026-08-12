-- ============================================================================
-- Church Ministry CRM — attendance_records.updated_at
-- Migration: 056_attendance_updated_at.sql
-- Action:
--   Add attendance_records.updated_at so the attendance reports can show a
--   truthful "last updated" time. The app's status writes are PostgREST
--   upserts keyed on the (session_id, beneficiary_id/servant_id) unique
--   constraints (048/055); upserts preserve created_at (not in the payload),
--   so without this column "last updated" could only be approximated by the
--   original creation time.
--   A BEFORE INSERT OR UPDATE trigger stamps updated_at = now() so every
--   status re-save (INSERT and ON CONFLICT DO UPDATE alike) advances it.
--   Existing rows are backfilled to created_at (their last known change time).
-- Safety: additive column + trigger, no data loss, no RLS/RPC changes,
--   idempotent (guarded by IF NOT EXISTS / DROP IF EXISTS + recreate).
-- ============================================================================

BEGIN;

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Backfill: any pre-existing row has no update history; created_at is the
-- closest truthful timestamp.
UPDATE attendance_records
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION set_attendance_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER trg_attendance_records_updated_at
  BEFORE INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION set_attendance_updated_at();

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
--   SELECT id, created_at, updated_at, status FROM attendance_records
--   ORDER BY updated_at DESC LIMIT 10;
--   -- updated_at equals created_at for untouched rows and advances after any
--   -- status re-save (upsert). The daily attendance report reads it.
-- ============================================================================
