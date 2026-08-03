-- ============================================================================
-- Church Ministry CRM — Notification Automation Support
-- Migration: 030_notification_automation.sql
-- Action: Add notifications.dedupe_key (nullable text) + recipient-scoped
--         unique index for idempotent scheduled (cron) notification writes.
--         Purely additive: no existing column, index, trigger, policy, or
--         migration 001-029 behavior is modified.
--
-- WHY THIS MIGRATION IS REQUIRED
--   The Vercel Cron automation (/api/cron/notifications) runs daily scans
--   (birthdays, repeated absences, follow-up due reminders, approval
--   reminders). Each scan must be idempotent: the same entity/date/type must
--   never produce a duplicate notification for the same recipient, even if the
--   cron fires more than once in a day or is retried after a timeout.
--
--   The canonical `notifications.data` jsonb column cannot enforce this at the
--   database level (jsonb is not a unique key). A dedicated text dedupe key is
--   the minimal, deterministic uniqueness anchor:
--
--     birthday:{beneficiary_id}:{YYYY-MM-DD}
--     attendance_absence:{beneficiary_id}:{YYYY-MM-DD}
--     followup_reminder:{followup_id}:{YYYY-MM-DD}
--     servant_approval_reminder:{servant_id}:{YYYY-MM-DD}
--     church_request_reminder:{request_id}:{YYYY-MM-DD}
--
--   The unique index is scoped per recipient (recipient_id, dedupe_key):
--   the same event fans out to multiple recipients, and each recipient must be
--   allowed exactly one row per dedupe key.
--
--   Event-driven notifications (send_notification RPC / app-layer inserts) do
--   not set dedupe_key; Postgres treats NULLs as distinct in unique indexes,
--   so the index never blocks existing flows.
--
-- SECURITY
--   No RLS change: notifications writes from the cron use the approved
--   service-role path (same model as notification.service.ts / 3C.2A.3) and
--   remain explicitly church-scoped at the query layer.
-- ============================================================================

BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_recipient_dedupe
  ON notifications (recipient_id, dedupe_key);

COMMIT;

-- ============================================================================
-- VERIFICATION
--   SELECT column_name, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'notifications' AND column_name = 'dedupe_key';
--   -- Expect 1 row: text, nullable.
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename = 'notifications' AND indexname = 'uq_notifications_recipient_dedupe';
--   -- Expect a UNIQUE index over (recipient_id, dedupe_key).
--   -- Smoke (idempotency): inserting the same (recipient_id, dedupe_key) twice
--   -- must violate the index on the second attempt (23505).
--
-- ROLLBACK
--   DROP INDEX IF EXISTS uq_notifications_recipient_dedupe;
--   ALTER TABLE notifications DROP COLUMN IF EXISTS dedupe_key;
-- ============================================================================
