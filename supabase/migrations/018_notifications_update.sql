-- ============================================================================
-- Church Ministry CRM — Notifications Update
-- Migration: 018_notifications_update.sql
-- Action: Rename user_id → recipient_id, type → channel, add canonical
--         columns, rebuild indexes
-- ============================================================================

-- ============================================================================
-- 1. RENAME user_id → recipient_id
-- ============================================================================

ALTER TABLE notifications RENAME COLUMN user_id TO recipient_id;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD FOREIGN KEY (recipient_id) REFERENCES profiles (id) ON DELETE CASCADE;

-- ============================================================================
-- 2. RENAME type → channel (type is reserved keyword)
-- ============================================================================

ALTER TABLE notifications RENAME COLUMN type TO old_type;
ALTER TABLE notifications RENAME COLUMN channel TO channel_value;
ALTER TABLE notifications RENAME COLUMN old_type TO channel;

-- ============================================================================
-- 3. CHANGE channel FROM ENUM TO TEXT
-- ============================================================================

ALTER TABLE notifications ALTER COLUMN channel TYPE text USING channel::text;

-- ============================================================================
-- 4. ADD CANONICAL COLUMNS
-- ============================================================================

ALTER TABLE notifications ADD COLUMN notification_type text NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN is_read boolean NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN data jsonb;
ALTER TABLE notifications DROP COLUMN channel_value;
DROP TYPE IF EXISTS notification_channel;
DROP TYPE IF EXISTS notification_type;
ALTER TABLE notifications RENAME COLUMN metadata TO old_metadata;
ALTER TABLE notifications ALTER COLUMN read_at DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN sent_at SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN sent_at SET DEFAULT now();

-- ============================================================================
-- 5. REBUILD INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_notifications_church_user_read;
DROP INDEX IF EXISTS idx_notifications_user_created;

CREATE INDEX idx_notifications_recipient_read ON notifications (recipient_id, is_read, sent_at DESC);
