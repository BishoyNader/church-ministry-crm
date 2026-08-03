-- ============================================================================
-- Church Ministry CRM — Production Remediation (Audit P0/P1 Round 2)
-- Migration: 031_production_remediation.sql
-- Action: Remediate the confirmed P0/P1 findings from the production-readiness
--         audit:
--           F1 (was HIGH-1) user_roles role-grant escalation — a church
--              super_admin could INSERT a user_roles row with church_id NULL
--              (a "global" grant), turning an arbitrary user into a global
--              platform_owner. Root cause: super_admin_all on user_roles has
--              only USING, no WITH CHECK, and user_is_super_admin(NULL)
--              coalesces to the caller's own church (022).
--           F2 (was HIGH-2) write_audit_log is SECURITY DEFINER but its ACL is
--              the Postgres default (PUBLIC) — anon/authenticated could forge
--              audit rows with arbitrary church_id / entity.
--           F3 (was HIGH-3) notifications.recipient_scope is SELECT-only, so
--              marking a notification read (now gated on notifications.read
--              app-side) silently returned 0 rows for non-managers. Add the
--              missing recipient-scoped UPDATE policy.
--
-- FIXES ARE ADDITIVE / NON-DESTRUCTIVE
--   * No existing column, index, or function is modified.
--   * All legitimate user_roles writes run through SECURITY DEFINER RPCs
--     (023/025/026) or the service-role admin client (src/features/users/
--     services/user.service.ts) — both bypass RLS, so the WITH CHECK only
--     closes the direct PostgREST escalation path.
--   * src/lib/audit.ts writes audit rows via a direct RLS-bound insert, not the
--     write_audit_log RPC, so revoking anon/authenticated does not affect app
--     audit logging; the SECURITY DEFINER RPCs that call write_audit_log
--     internally run as the function owner and are unaffected.
--
-- Dependencies (must exist from 001-030): user_roles policies (022/023),
--   write_audit_log (019), notifications (030), get_user_church_id (022),
--   user_is_super_admin (022).
-- Transaction: single BEGIN/COMMIT (matches 022/023 style).
-- ============================================================================

BEGIN;

-- ============================================================================
-- F1 — user_roles.super_admin_all WITH CHECK (HIGH-1)
-- Allows super_admin to manage role grants ONLY within their own church and
-- only for users who belong to that church. Blocks:
--   * church_id NULL (global) grants — the platform_owner escalation vector.
--   * cross-tenant grants to users of other churches.
-- The USING clause is unchanged (SELECT/UPDATE/DELETE of existing rows).
-- ============================================================================

DROP POLICY IF EXISTS super_admin_all ON user_roles;
CREATE POLICY super_admin_all ON user_roles
  FOR ALL USING (user_is_super_admin(church_id))
  WITH CHECK (
    church_id IS NOT NULL
    AND church_id = get_user_church_id()
    AND user_is_super_admin(church_id)
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = user_id
        AND p.church_id = get_user_church_id()
        AND p.deleted_at IS NULL
    )
  );

-- ============================================================================
-- F2 — write_audit_log privilege lockdown (HIGH-2)
-- SECURITY DEFINER audit-writer callable only by service_role (and postgres).
-- anon/authenticated cannot forge audit rows with arbitrary church_id.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb) TO service_role;

-- ============================================================================
-- F3 — notifications.recipient_scope_update (HIGH-3)
-- A recipient may mark their own notifications as read. The mark-read actions
-- are now gated on notifications.read app-side (HIGH-3 fix); this policy makes
-- the UPDATE effective for ordinary users instead of silently updating 0 rows.
-- ============================================================================

DROP POLICY IF EXISTS recipient_scope_update ON notifications;
CREATE POLICY recipient_scope_update ON notifications
  FOR UPDATE USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

COMMIT;
