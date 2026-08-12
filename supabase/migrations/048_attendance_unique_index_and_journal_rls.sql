-- ============================================================================
-- Church Ministry CRM — Attendance Uniqueness + Spiritual Journal Admin Access
-- Migration: 048_attendance_unique_index_and_journal_rls.sql
-- Action:
--   1. Attendance — enforce one record per attendee per session.
--      attendance_records carries EITHER beneficiary_id OR servant_id
--      (exactly_one_attendee, migration 015), so a single composite unique
--      index cannot express the rule. Two partial unique indexes do:
--      (session_id, beneficiary_id) where beneficiary present, and
--      (session_id, servant_id) where servant present. This backs the admin
--      one-tap attendance toggle (requirement) and guarantees no duplicate
--      rows can be written from any path (UI, RPC, import).
--   2. Spiritual journal — restore Church Admin read access to the church-wide
--      overview. deny_admin_spiritual (028 F10) is a RESTRICTIVE FOR ALL policy
--      that excluded plain admins (not super_admin) from every non-own row.
--      The church-admin journal overview requirement needs those reads; the
--      write surface remains own-row-only via servant_owner (027), so dropping
--      this policy only widens SELECT, never mutation.
-- Dependencies: 015 (attendance_records), 027 (journal tenant_isolation +
--   servant_owner), 028 (deny_admin_spiritual), 022 (get_user_church_id).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — ATTENDANCE: one record per attendee per session
--
-- Postgres treats NULLs as distinct in unique indexes, so a single UNIQUE on
-- (session_id, beneficiary_id) permits exactly one row per (session,
-- beneficiary) while still allowing servant rows (beneficiary_id NULL); the
-- (session_id, servant_id) constraint does the mirror image for servants.
-- The pair therefore reproduces the exactly_one_attendee rule without partial
-- indexes — and, crucially, matches the ON CONFLICT target used by the app's
-- batch-attendance upsert (src/features/children/services/child.service.ts),
-- which previously referenced a non-existent (church_id, session_id,
-- beneficiary_id) constraint and would raise an arbiter error at runtime.
-- ============================================================================

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS uq_attendance_records_session_beneficiary,
  DROP CONSTRAINT IF EXISTS uq_attendance_records_session_servant;

ALTER TABLE attendance_records
  ADD CONSTRAINT uq_attendance_records_session_beneficiary
  UNIQUE (session_id, beneficiary_id);

ALTER TABLE attendance_records
  ADD CONSTRAINT uq_attendance_records_session_servant
  UNIQUE (session_id, servant_id);

-- ============================================================================
-- PART 2 — SPIRITUAL JOURNAL: admin overview read access
-- ============================================================================

DROP POLICY IF EXISTS deny_admin_spiritual ON spiritual_journal_entries;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Attendance uniqueness
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'attendance_records'::regclass
--     AND conname IN ('uq_attendance_records_session_beneficiary',
--                     'uq_attendance_records_session_servant');
--   -- Both unique constraints exist. The batch-attendance upsert
--   -- (onConflict: "session_id,beneficiary_id") now matches an arbiter.
--   -- Smoke: inserting a second (session_id, beneficiary_id) row raises
--   --   duplicate key violation (23505).
-- V2 — Journal policies
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='spiritual_journal_entries'
--   ORDER BY policyname;
--   -- deny_admin_spiritual is gone; tenant_isolation (SELECT) + servant_owner
--   -- (ALL own rows) + priest_read remain.
-- V3 — Journal overview smoke (as a plain church admin):
--   SELECT servant_id, count(*) FROM spiritual_journal_entries
--   WHERE church_id = get_user_church_id()
--   GROUP BY servant_id;
--   -- Full church-wide view (was: empty / denied before this migration).
--   -- Write regression: UPDATE spiritual_journal_entries SET ... WHERE
--   --   servant_id <> auth.uid() -> still denied (servant_owner own-rows only).
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   ALTER TABLE attendance_records
--     DROP CONSTRAINT IF EXISTS uq_attendance_records_session_beneficiary,
--     DROP CONSTRAINT IF EXISTS uq_attendance_records_session_servant;
--   CREATE POLICY deny_admin_spiritual ON spiritual_journal_entries
--     AS RESTRICTIVE FOR ALL
--     USING ((NOT (user_is_admin(church_id) AND NOT user_is_super_admin(church_id)))
--            OR servant_id = auth.uid());
-- ============================================================================
