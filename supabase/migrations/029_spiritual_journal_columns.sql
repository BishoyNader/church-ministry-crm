-- ============================================================================
-- Church Ministry CRM — Spiritual Journal Columns
-- Migration: 029_spiritual_journal_columns.sql
-- Action: Add prayer_completed and liturgy_attendance columns to
--         spiritual_journal_entries (additive; does not modify 001-028).
--
-- WHY THIS MIGRATION IS REQUIRED
--   Migration 017 created spiritual_journal_entries with granular prayer
--   booleans (morning_prayer, third_hour_prayer, sixth_hour_prayer,
--   ninth_hour_prayer, sunset_prayer, sleep_prayer) plus bible_reading,
--   confession, communion, and spiritual_notes. The Spiritual Journal module
--   spec requires the fields:
--     date, prayer_completed, bible_reading_completed, liturgy_attendance,
--     confession_completed, notes
--   The existing columns map as follows:
--     entry_date          -> date
--     bible_reading       -> bible_reading_completed
--     confession          -> confession_completed
--     spiritual_notes     -> notes
--   Two fields have NO existing column and must be added:
--     prayer_completed    (aggregate daily prayer completion)
--     liturgy_attendance  (liturgy attendance)
--   This migration is purely additive: it adds two nullable-defaulted boolean
--   columns. No existing column, index, trigger, or policy is modified.
--
-- RLS / PRIVACY
--   No RLS changes are needed. Migration 022 already enforces owner-only
--   access via servant_owner (FOR ALL USING servant_id = auth.uid()) and
--   deny_admin_spiritual (RESTRICTIVE, with the 028 F10 own-row exemption).
--   The new columns inherit the same RLS surface automatically.
-- ============================================================================

BEGIN;

ALTER TABLE spiritual_journal_entries
  ADD COLUMN IF NOT EXISTS prayer_completed boolean NOT NULL DEFAULT false;

ALTER TABLE spiritual_journal_entries
  ADD COLUMN IF NOT EXISTS liturgy_attendance boolean NOT NULL DEFAULT false;

COMMIT;

-- ============================================================================
-- VERIFICATION
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'spiritual_journal_entries'
--     AND column_name IN ('prayer_completed', 'liturgy_attendance');
--   -- Expect 2 rows: boolean, NOT NULL, default false.
--
-- ROLLBACK
--   ALTER TABLE spiritual_journal_entries DROP COLUMN IF EXISTS prayer_completed;
--   ALTER TABLE spiritual_journal_entries DROP COLUMN IF EXISTS liturgy_attendance;
-- ============================================================================