-- ============================================================================
-- Church Ministry CRM — Beneficiaries Table Restructure
-- Migration: 013_beneficiaries_table.sql
-- Action: Rename children → beneficiaries, restructure columns, archive
--         parent data, drop old enums. KEEPS stage_id for migration 014.
-- ============================================================================

-- ============================================================================
-- 1. RENAME TABLE
-- ============================================================================

ALTER TABLE children RENAME TO beneficiaries;

-- ============================================================================
-- 2. ADD CANONICAL COLUMNS
-- ============================================================================

ALTER TABLE beneficiaries ADD COLUMN full_name_ar text;
ALTER TABLE beneficiaries ADD COLUMN full_name_en text;

-- Merge existing name columns into full_name
UPDATE beneficiaries SET full_name_ar = CONCAT(COALESCE(first_name_ar, ''), ' ', COALESCE(last_name_ar, ''));
UPDATE beneficiaries SET full_name_en = CONCAT(COALESCE(first_name_en, ''), ' ', COALESCE(last_name_en, ''));

ALTER TABLE beneficiaries ALTER COLUMN full_name_ar SET NOT NULL;

-- ============================================================================
-- 3. UPDATE EVENT_REGISTRATIONS FK
-- ============================================================================

ALTER TABLE event_registrations RENAME COLUMN child_id TO beneficiary_id;

-- ============================================================================
-- 4. ARCHIVE PARENT DATA TO NOTES BEFORE DROPPING
-- ============================================================================

UPDATE beneficiaries SET notes = CONCAT(
  COALESCE(notes, ''),
  CASE WHEN father_name_ar IS NOT NULL THEN E'\nالأب: ' || father_name_ar ELSE '' END,
  CASE WHEN mother_name_ar IS NOT NULL THEN E'\nالأم: ' || mother_name_ar ELSE '' END,
  CASE WHEN parent_phone IS NOT NULL THEN E'\nهاتف ولي الأمر: ' || parent_phone ELSE '' END
);

-- ============================================================================
-- 5. DROP OLD COLUMNS (NOT dropping stage_id — kept for migration 014)
-- ============================================================================

ALTER TABLE beneficiaries DROP COLUMN first_name_ar;
ALTER TABLE beneficiaries DROP COLUMN last_name_ar;
ALTER TABLE beneficiaries DROP COLUMN first_name_en;
ALTER TABLE beneficiaries DROP COLUMN last_name_en;
ALTER TABLE beneficiaries DROP COLUMN emergency_contact_name;
ALTER TABLE beneficiaries DROP COLUMN emergency_contact_phone;
ALTER TABLE beneficiaries DROP COLUMN allergies;
ALTER TABLE beneficiaries DROP COLUMN medical_conditions;
ALTER TABLE beneficiaries DROP COLUMN medications;
ALTER TABLE beneficiaries DROP COLUMN confession_frequency;
ALTER TABLE beneficiaries DROP COLUMN spiritual_notes;
ALTER TABLE beneficiaries DROP COLUMN school_name_ar;
ALTER TABLE beneficiaries DROP COLUMN grade_level;
ALTER TABLE beneficiaries DROP COLUMN ministry_id;
ALTER TABLE beneficiaries DROP COLUMN pipeline_stage;
ALTER TABLE beneficiaries DROP COLUMN enrolled_at;
ALTER TABLE beneficiaries DROP COLUMN created_by;
ALTER TABLE beneficiaries DROP COLUMN parent_address_ar;
ALTER TABLE beneficiaries DROP COLUMN father_name_ar;
ALTER TABLE beneficiaries DROP COLUMN mother_name_ar;
ALTER TABLE beneficiaries DROP COLUMN parent_phone;
ALTER TABLE beneficiaries DROP COLUMN parent_email;
ALTER TABLE beneficiaries DROP COLUMN baptism_date;

-- ============================================================================
-- 6. ADD NEW CANONICAL COLUMNS
-- ============================================================================

ALTER TABLE beneficiaries ADD COLUMN address text;
ALTER TABLE beneficiaries ADD COLUMN school text;
ALTER TABLE beneficiaries ADD COLUMN father_mobile text;
ALTER TABLE beneficiaries ADD COLUMN mother_mobile text;
ALTER TABLE beneficiaries ADD COLUMN whatsapp text;
ALTER TABLE beneficiaries ADD COLUMN confession_father text;

-- ============================================================================
-- 7. CHANGE STATUS FROM ENUM TO TEXT
-- ============================================================================

ALTER TABLE beneficiaries ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE beneficiaries ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE beneficiaries ALTER COLUMN status SET NOT NULL;

-- ============================================================================
-- 8. ENSURE date_of_birth AND gender NOT NULL
-- ============================================================================

UPDATE beneficiaries SET date_of_birth = '2000-01-01' WHERE date_of_birth IS NULL;
ALTER TABLE beneficiaries ALTER COLUMN date_of_birth SET NOT NULL;
UPDATE beneficiaries SET gender = 'male' WHERE gender IS NULL;
ALTER TABLE beneficiaries ALTER COLUMN gender SET NOT NULL;

-- ============================================================================
-- 9. CREATE CANONICAL INDEX (no stage_id — uses beneficiary_assignments)
-- ============================================================================

CREATE INDEX idx_beneficiaries_church_status ON beneficiaries (church_id, status) WHERE deleted_at IS NULL;

-- ============================================================================
-- 10. DROP OLD CHILDREN INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_children_church;
DROP INDEX IF EXISTS idx_children_church_stage;
DROP INDEX IF EXISTS idx_children_church_ministry;
DROP INDEX IF EXISTS idx_children_church_status;
DROP INDEX IF EXISTS idx_children_name;
DROP INDEX IF EXISTS idx_children_mobile;
DROP INDEX IF EXISTS idx_children_parent_phone;
DROP INDEX IF EXISTS idx_children_pipeline;

-- ============================================================================
-- 11. UPDATE FOLLOW-UPS AND SPIRITUAL RECORDS FKs
-- ============================================================================

ALTER TABLE followups RENAME COLUMN child_id TO beneficiary_id;
ALTER TABLE spiritual_records RENAME COLUMN child_id TO beneficiary_id;

-- ============================================================================
-- 12. DROP OLD ENUMS
-- ============================================================================

DROP TYPE IF EXISTS child_status;
DROP TYPE IF EXISTS pipeline_stage_type;
