-- ============================================================================
-- Church Ministry CRM — Attendance Data-Integrity Reconciliation
-- Migration: 055_attendance_integrity_reconcile.sql
-- Action:
--   1. Reconcile LEGACY duplicate attendance_sessions for the same
--      (stage_id, session_date): every record is moved onto the earliest
--      session for that identity, and emptied later siblings are deleted.
--      After this, one session per (stage, date) is guaranteed — the
--      identity the app's session upsert uses (onConflict stage_id,
--      session_date).
--   2. Reconcile LEGACY duplicate attendance_records so every attendee has
--      exactly ONE record per session: for both beneficiaries and servants
--      the LATEST row (greatest created_at, then greatest id) is kept and
--      older duplicates are deleted.
--   3. Guarantee the invariants are enforced going forward by adding the
--      unique constraints (if an environment never applied migration 048):
--        uq_attendance_records_session_beneficiary UNIQUE (session_id, beneficiary_id)
--        uq_attendance_records_session_servant    UNIQUE (session_id, servant_id)
--        uq_attendance_sessions_stage_date        UNIQUE (stage_id, session_date)
--      Existing constraints are left untouched (no duplicate-constraint
--      errors, no index rebuilds).
-- Safety: strictly additive data fixes + constraint creation. No RLS/RPC
--   changes, no foreign-key changes, no production data deleted beyond
--   obsolete duplicates. Fully idempotent — re-running is a no-op.
--   Ordering matters: sessions are reconciled FIRST (their records move
--   between sessions, which can create new duplicates), then records are
--   deduplicated, then constraints are added.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PART 1 — Reconcile duplicate sessions for (stage_id, session_date)
-- ----------------------------------------------------------------------------

-- 1a) Move every record of a later sibling session onto the EARLIEST session
--     for the same (stage_id, session_date). Only rows whose session actually
--     changes are touched (WHERE s.id <> k.id).
UPDATE attendance_records r
SET session_id = k.id
FROM attendance_sessions s
JOIN LATERAL (
  SELECT k2.id
  FROM attendance_sessions k2
  WHERE k2.stage_id = s.stage_id
    AND k2.session_date = s.session_date
  ORDER BY k2.created_at ASC, k2.id ASC
  LIMIT 1
) k ON true
WHERE r.session_id = s.id
  AND s.id <> k.id;

-- 1b) Delete sibling sessions that no longer own any records (safe: their
--     records were reassigned above). The earliest session is never deleted.
DELETE FROM attendance_sessions s
WHERE EXISTS (
  SELECT 1
  FROM attendance_sessions k
  WHERE k.stage_id = s.stage_id
    AND k.session_date = s.session_date
    AND (k.created_at < s.created_at
         OR (k.created_at = s.created_at AND k.id < s.id))
)
AND NOT EXISTS (
  SELECT 1 FROM attendance_records r WHERE r.session_id = s.id
);

-- ----------------------------------------------------------------------------
-- PART 2 — Reconcile duplicate records (one row per attendee per session)
-- ----------------------------------------------------------------------------

-- 2a) Beneficiary records: keep the LATEST (created_at, id); delete any row
--     that has a strictly-later sibling for the same (session, beneficiary).
DELETE FROM attendance_records ar
USING attendance_records dup
WHERE ar.beneficiary_id IS NOT NULL
  AND dup.beneficiary_id IS NOT NULL
  AND ar.session_id = dup.session_id
  AND ar.beneficiary_id = dup.beneficiary_id
  AND (dup.created_at > ar.created_at
       OR (dup.created_at = ar.created_at AND dup.id > ar.id));

-- 2b) Servant records: same rule, keyed on (session, servant).
DELETE FROM attendance_records ar
USING attendance_records dup
WHERE ar.servant_id IS NOT NULL
  AND dup.servant_id IS NOT NULL
  AND ar.session_id = dup.session_id
  AND ar.servant_id = dup.servant_id
  AND (dup.created_at > ar.created_at
       OR (dup.created_at = ar.created_at AND dup.id > ar.id));

-- ----------------------------------------------------------------------------
-- PART 3 — Enforce the invariants (only where the constraints are missing)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  -- One beneficiary record per session.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'attendance_records'::regclass
      AND conname = 'uq_attendance_records_session_beneficiary'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT uq_attendance_records_session_beneficiary
      UNIQUE (session_id, beneficiary_id);
  END IF;

  -- One servant record per session.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'attendance_records'::regclass
      AND conname = 'uq_attendance_records_session_servant'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT uq_attendance_records_session_servant
      UNIQUE (session_id, servant_id);
  END IF;

  -- One session per (stage, date) — the session upsert arbiter.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'attendance_sessions'::regclass
      AND conname = 'uq_attendance_sessions_stage_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'attendance_sessions'::regclass
      AND conname = 'attendance_sessions_stage_id_session_date_key'
  ) THEN
    ALTER TABLE attendance_sessions
      ADD CONSTRAINT uq_attendance_sessions_stage_date
      UNIQUE (stage_id, session_date);
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
--   -- No duplicate beneficiary/servant rows:
--   SELECT count(*) FROM (
--     SELECT session_id, beneficiary_id, count(*)
--     FROM attendance_records WHERE beneficiary_id IS NOT NULL
--     GROUP BY 1, 2 HAVING count(*) > 1
--   ) d;
--   -- No duplicate sessions:
--   SELECT count(*) FROM (
--     SELECT stage_id, session_date, count(*)
--     FROM attendance_sessions GROUP BY 1, 2 HAVING count(*) > 1
--   ) d;
--   -- Constraints present:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid IN ('attendance_records'::regclass, 'attendance_sessions'::regclass)
--     AND conname LIKE 'uq_attendance%';
-- ============================================================================
