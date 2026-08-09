-- ============================================================================
-- Church Ministry CRM — Stage Manager Enum Value (standalone commit)
-- Migration: 036_stage_manager_enum.sql
-- Action: Fix for staging `supabase db push` failure on the role-matrix
--   migration (SQLSTATE 55P04 — unsafe use of new value "stage_manager" of
--   enum type user_role_type).
-- Root cause: the role-matrix migration added 'stage_manager' to the enum and
--   then USED it in the SAME transaction (the church backfill inserts roles
--   with role_type = 'stage_manager'). PostgreSQL raises 55P04 when a value
--   added to an enum is used before the transaction that added it has
--   committed — on every supported PG version. Local `supabase db reset`
--   passed only because it starts from an EMPTY database (no churches), so the
--   backfill loop never executes; staging has real church rows, so the
--   backfill runs and the push fails.
-- Fix: commit the enum value in its OWN migration. Migration 035 is already
--   applied on staging, so the fix is inserted as the NEXT sequential
--   migration (036) and the role matrix / dashboard / scope / beneficiary
--   migrations are renumbered to 037-040. 037 then runs in a separate
--   transaction where `ADD VALUE IF NOT EXISTS` is a no-op and its backfill
--   uses an already committed value — legal on all PG versions.
-- Scope: this migration ONLY adds the enum value. It modifies no data, no
--   permissions/RLS, no RPCs, and no application code. It is idempotent.
-- ============================================================================

BEGIN;

ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'stage_manager';

COMMIT;
