-- ============================================================================
-- Church Ministry CRM — Stage Manager Enum Value (standalone commit)
-- Migration: 0355_stage_manager_enum.sql
-- Action: Fix for staging `supabase db push` failure on migration 036
--   (SQLSTATE 55P04 — unsafe use of new value "stage_manager" of enum type
--   user_role_type).
-- Root cause: 036 adds 'stage_manager' to the enum (line 29) and then USES it
--   in the SAME transaction (the church backfill inserts roles with
--   role_type = 'stage_manager'). PostgreSQL raises 55P04 when a value added
--   to an enum is used before the transaction that added it has committed —
--   on every supported PG version. Local `supabase db reset` passed only
--   because it starts from an EMPTY database (no churches), so 036's backfill
--   loop never executes; staging has real church rows, so the backfill runs
--   and the push fails at 036.
-- Fix: commit the enum value in its OWN migration, ordered between 035 and 036
--   ("0355" < "036"). 036 then runs in a separate transaction where
--   `ADD VALUE IF NOT EXISTS` is a no-op and its backfill uses an already
--   committed value — legal on all PG versions. Purely additive: 036-039 are
--   left byte-for-byte identical and no migration history is rewritten.
-- ============================================================================

BEGIN;

ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'stage_manager';

COMMIT;
