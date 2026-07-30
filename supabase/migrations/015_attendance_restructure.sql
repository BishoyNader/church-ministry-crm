-- ============================================================================
-- Church Ministry CRM — Attendance Restructure
-- Migration: 015_attendance_restructure.sql
-- Action: Create attendance_sessions + attendance_records, migrate from
--         attendance table, backup and drop old
-- ============================================================================

-- ============================================================================
-- 1. CREATE attendance_sessions TABLE
-- ============================================================================

CREATE TABLE attendance_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  service_id    uuid NOT NULL REFERENCES services (id),
  stage_id      uuid NOT NULL REFERENCES stages (id),
  class_id      uuid REFERENCES classes (id),
  session_date  date NOT NULL,
  notes         text,
  created_by    uuid NOT NULL REFERENCES profiles (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_id, session_date)
);

CREATE INDEX idx_attendance_sessions_stage_date ON attendance_sessions (church_id, stage_id, session_date);

-- ============================================================================
-- 2. CREATE attendance_records TABLE
-- ============================================================================

CREATE TABLE attendance_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  session_id      uuid NOT NULL REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  beneficiary_id  uuid REFERENCES beneficiaries (id),
  servant_id      uuid REFERENCES servants (id),
  status          attendance_status NOT NULL,
  recorded_by     uuid NOT NULL REFERENCES profiles (id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exactly_one_attendee CHECK (
    (beneficiary_id IS NOT NULL AND servant_id IS NULL) OR
    (beneficiary_id IS NULL AND servant_id IS NOT NULL)
  )
);

CREATE INDEX idx_attendance_records_session ON attendance_records (session_id);
CREATE INDEX idx_attendance_records_beneficiary_status ON attendance_records (beneficiary_id, status);

-- ============================================================================
-- 3. DATA MIGRATION — from old attendance table
-- ============================================================================

INSERT INTO attendance_sessions (church_id, service_id, stage_id, session_date, created_by, created_at)
SELECT DISTINCT
  a.church_id,
  st.service_id,
  a.stage_id,
  a.attendance_date,
  a.recorded_by,
  a.created_at
FROM attendance a
JOIN stages st ON st.id = a.stage_id;

INSERT INTO attendance_records (church_id, session_id, beneficiary_id, servant_id, status, recorded_by, notes, created_at)
SELECT
  a.church_id,
  asess.id,
  a.child_id,
  NULL,
  a.status,
  a.recorded_by,
  a.notes,
  a.created_at
FROM attendance a
JOIN attendance_sessions asess ON asess.stage_id = a.stage_id AND asess.session_date = a.attendance_date;

-- ============================================================================
-- 4. BACKUP AND DROP OLD TABLE
-- ============================================================================

ALTER TABLE attendance RENAME TO attendance_backup_20260730;
