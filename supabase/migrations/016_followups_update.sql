-- ============================================================================
-- Church Ministry CRM — Follow-ups Update
-- Migration: 016_followups_update.sql
-- Action: Update followups FKs (beneficiary_id, servant_id), status enum,
--         column changes, next_action, drop stage_id
-- ============================================================================

-- ============================================================================
-- 1. UPDATE FOREIGN KEYS
--    beneficiary_id already renamed in migration 013
-- ============================================================================

ALTER TABLE followups RENAME COLUMN created_by TO servant_id;

ALTER TABLE followups DROP CONSTRAINT IF EXISTS followups_child_id_fkey;
ALTER TABLE followups ADD FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id) ON DELETE CASCADE;

ALTER TABLE followups DROP CONSTRAINT IF EXISTS followups_created_by_fkey;
ALTER TABLE followups ADD FOREIGN KEY (servant_id) REFERENCES servants (id) ON DELETE CASCADE;

ALTER TABLE followups DROP CONSTRAINT IF EXISTS followups_assigned_to_fkey;
ALTER TABLE followups ADD FOREIGN KEY (assigned_to) REFERENCES servants (id);

-- ============================================================================
-- 2. ADD COLUMNS AND DROP OLD
-- ============================================================================

ALTER TABLE followups ADD COLUMN next_action text;
ALTER TABLE followups ADD COLUMN deleted_at timestamptz;
ALTER TABLE followups DROP COLUMN stage_id CASCADE;

-- ============================================================================
-- 3. CHANGE TYPE FROM ENUM TO TEXT
-- ============================================================================

ALTER TABLE followups ALTER COLUMN type TYPE text USING type::text;

UPDATE followups SET type = 'phone' WHERE type = 'phone_call';
UPDATE followups SET type = 'visit' WHERE type = 'home_visit';
UPDATE followups SET type = 'meeting' WHERE type = 'church_meeting';

-- ============================================================================
-- 4. REBUILD INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_followups_church_child;
DROP INDEX IF EXISTS idx_followups_church_assigned;
DROP INDEX IF EXISTS idx_followups_church_scheduled;
DROP INDEX IF EXISTS idx_followups_church_status;

CREATE INDEX idx_followups_servant_status ON followups (servant_id, status, scheduled_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- 5. UPDATE followup_status ENUM
-- ============================================================================

ALTER TYPE followup_status RENAME TO followup_status_old;
CREATE TYPE followup_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
ALTER TABLE followups ALTER COLUMN status TYPE text;
UPDATE followups SET status = 'open' WHERE status = 'scheduled';
ALTER TABLE followups ALTER COLUMN status DROP DEFAULT;
ALTER TABLE followups ALTER COLUMN status TYPE followup_status USING status::followup_status;
DROP TYPE IF EXISTS followup_status_old;

-- ============================================================================
-- 6. DROP OLD ENUM
-- ============================================================================

DROP TYPE IF EXISTS followup_type;
