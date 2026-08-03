-- ============================================================================
-- 027_rbac_rls_hardening.sql
-- P0-4 (F4): RBAC/RLS hardening — close tenant-scoped write surfaces, enforce
-- permission-based writes, make profiles.church_id immutable to RLS, and keep
-- beneficiary_assignments write-protected.
--
-- Context (prior migrations already applied):
--   022  canonical RLS rebuild (89 policies). Every tenant table carried
--        `tenant_isolation FOR ALL USING (church_id = get_user_church_id())`.
--        PostgreSQL uses a FOR ALL policy's USING as the WITH CHECK for
--        INSERT/UPDATE, so ANY authenticated member of a church could
--        INSERT/UPDATE/DELETE rows in any tenant table of that church via
--        PostgREST — bypassing the server-action hasPermission() gates.
--   023  already converted tenant_isolation → SELECT on user_roles (S4),
--        servants (S5), notifications (S6), and hardened profiles insert (S7).
--   026  PO bootstrap: church-less role/profile/servant + own_read on profiles.
--
-- This migration:
--   T1  user_has_permission_in_church(...) — church-scoped, active-grant
--       permission helper (the 001 user_has_permission is church-agnostic).
--   T2  Converts the remaining tenant_isolation FOR ALL → FOR SELECT on the
--       18 tenant tables whose writes are governed by narrower policies.
--   T3  Enforces permission-based writes (explicit WITH CHECK) on the tables
--       the app writes through the RLS-bound client: services, stages,
--       beneficiaries, servant_stage_assignments, attendance_sessions,
--       attendance_records, followups, beneficiary_assignments.
--   T4  profiles.church_id becomes immutable to RLS writers; adds an admin
--       profile-write path (USERS_UPDATE flow, was silently broken).
--   T5  Closes the self-notification spoof (recipient_scope → SELECT-only).
--   T6  Tenants audit_logs.append_only INSERT (no cross-tenant audit spoof).
--
-- Preserved unchanged:
--   - 023 church_requests policies and ALL SECURITY DEFINER RPCs (023 S11,
--     024, 026 S7). SECURITY DEFINER functions bypass RLS, so approve_servant,
--     approve_church_request, submit_church_request, create_beneficiary_
--     with_assignment, transfer_beneficiary and bootstrap_platform_owner work
--     exactly as before; all RPC signatures are untouched.
--   - Service-role (admin-client) signup / user-provisioning writes bypass RLS.
-- ============================================================================

BEGIN;

-- ============================================================================
-- T1 — Church-scoped permission helper
-- (Dependency: user_roles (001), roles (001/021/026), role_permissions (001),
--  permissions (001/021); mirrors the active-grant window of 022 helpers)
-- user_has_permission (001) ignores the church dimension; RLS write policies
-- must prove the grant exists IN the target church.
-- ============================================================================

CREATE OR REPLACE FUNCTION user_has_permission_in_church(
  p_permission_code text,
  p_church_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND ur.church_id = p_church_id
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
      AND p.code = p_permission_code
  );
$$;

-- ============================================================================
-- T2 + T3 — services / stages: tenant_isolation → SELECT, permission writes
-- App gates (server actions): createMinistry/createStage = stages.create,
-- updateMinistry/updateStage = stages.update, deactivate = stages.delete.
-- Seed (021): admin holds stages.create/update; super_admin holds all.
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON services;
CREATE POLICY tenant_isolation ON services
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS admin_write ON services;
CREATE POLICY services_insert ON services
  FOR INSERT WITH CHECK (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('stages.create', church_id)
  );
CREATE POLICY services_update ON services
  FOR UPDATE USING (church_id = get_user_church_id())
  WITH CHECK (
    church_id = get_user_church_id()
    AND (user_has_permission_in_church('stages.update', church_id)
         OR user_has_permission_in_church('stages.delete', church_id))
  );

DROP POLICY IF EXISTS tenant_isolation ON stages;
CREATE POLICY tenant_isolation ON stages
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS admin_write ON stages;
CREATE POLICY stages_insert ON stages
  FOR INSERT WITH CHECK (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('stages.create', church_id)
  );
CREATE POLICY stages_update ON stages
  FOR UPDATE USING (church_id = get_user_church_id())
  WITH CHECK (
    church_id = get_user_church_id()
    AND (user_has_permission_in_church('stages.update', church_id)
         OR user_has_permission_in_church('stages.delete', church_id))
  );

-- ============================================================================
-- classes — no app RLS-bound writes; admin_write hardened with tenant WITH CHECK
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON classes;
CREATE POLICY tenant_isolation ON classes
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS admin_write ON classes;
CREATE POLICY admin_write ON classes
  FOR ALL USING (user_is_admin(church_id))
  WITH CHECK (user_is_admin(church_id) AND church_id = get_user_church_id());

-- ============================================================================
-- beneficiaries — tenant_isolation → SELECT; INSERT stays admin-only (the app
-- creates beneficiaries via the 024 SECURITY DEFINER RPC); UPDATE is
-- permission-gated (beneficiaries.update/delete). Seed (021): servant holds
-- beneficiaries.update, admin holds create/update/transfer.
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON beneficiaries;
CREATE POLICY tenant_isolation ON beneficiaries
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS admin_write ON beneficiaries;
CREATE POLICY beneficiaries_insert ON beneficiaries
  FOR INSERT WITH CHECK (
    church_id = get_user_church_id()
    AND user_is_admin(church_id)
  );
CREATE POLICY beneficiaries_update ON beneficiaries
  FOR UPDATE USING (church_id = get_user_church_id())
  WITH CHECK (
    church_id = get_user_church_id()
    AND (user_has_permission_in_church('beneficiaries.update', church_id)
         OR user_has_permission_in_church('beneficiaries.delete', church_id))
  );

-- ============================================================================
-- beneficiary_assignments — write-protected table (P0-4 "protect beneficiary
-- assignments"). tenant_isolation → SELECT; the ONLY client INSERT path is the
-- admin policy (now tenant-scoped); UPDATE/DELETE stay immutable; the app's
-- create/transfer run through the 024 SECURITY DEFINER RPCs (RLS-bypassed).
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON beneficiary_assignments;
CREATE POLICY tenant_isolation ON beneficiary_assignments
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS admin_write ON beneficiary_assignments;
CREATE POLICY admin_write ON beneficiary_assignments
  FOR INSERT WITH CHECK (
    church_id = get_user_church_id()
    AND user_is_admin(church_id)
  );

-- ============================================================================
-- servant_stage_assignments — tenant_isolation → SELECT; writes gated by
-- servants.assign (app: assignUsersToStageAction / assignStagesAction both
-- delete-then-insert under SERVANTS_ASSIGN). Seed (021): admin holds it.
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON servant_stage_assignments;
CREATE POLICY tenant_isolation ON servant_stage_assignments
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY assignment_write ON servant_stage_assignments
  FOR ALL USING (church_id = get_user_church_id())
  WITH CHECK (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('servants.assign', church_id)
  );

DROP POLICY IF EXISTS admin_write ON servant_stage_assignments;
CREATE POLICY admin_write ON servant_stage_assignments
  FOR ALL USING (user_is_admin(church_id))
  WITH CHECK (user_is_admin(church_id) AND church_id = get_user_church_id());

-- ============================================================================
-- attendance_sessions — tenant_isolation → SELECT. The app upserts sessions
-- (INSERT + UPDATE on conflict), so the old INSERT-only stage_scope_insert is
-- replaced by stage_scope_write (INSERT) + stage_scope_update (UPDATE), both
-- requiring the actor's stage/class scope (get_user_stage_ids/class_ids).
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON attendance_sessions;
CREATE POLICY tenant_isolation ON attendance_sessions
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS stage_scope_insert ON attendance_sessions;
CREATE POLICY stage_scope_write ON attendance_sessions
  FOR INSERT WITH CHECK (
    church_id = get_user_church_id()
    AND (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()))
  );
CREATE POLICY stage_scope_update ON attendance_sessions
  FOR UPDATE USING (church_id = get_user_church_id())
  WITH CHECK (
    church_id = get_user_church_id()
    AND (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()))
  );

-- ============================================================================
-- attendance_records — tenant_isolation → SELECT. The app upserts records
-- (INSERT + UPDATE on conflict, church_id/session_id/beneficiary_id UNIQUE),
-- so the recording paths become INSERT and UPDATE policies restricted to own
-- records. (RLS policies accept only a single command per FOR clause, so the
-- upsert is covered by two policies rather than FOR INSERT OR UPDATE.)
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON attendance_records;
CREATE POLICY tenant_isolation ON attendance_records
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS record_attendance ON attendance_records;
CREATE POLICY record_attendance ON attendance_records
  FOR INSERT
  WITH CHECK (church_id = get_user_church_id() AND recorded_by = auth.uid());

CREATE POLICY record_attendance_update ON attendance_records
  FOR UPDATE
  USING (church_id = get_user_church_id() AND recorded_by = auth.uid())
  WITH CHECK (church_id = get_user_church_id() AND recorded_by = auth.uid());

-- ============================================================================
-- followups — tenant_isolation → SELECT. Writes preserved via own_all
-- (servant_id = auth.uid()) plus a permission-gated policy mirroring the app's
-- FOLLOWUPS_CREATE/UPDATE/DELETE gates (seed: servant holds all three).
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON followups;
CREATE POLICY tenant_isolation ON followups
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY followups_write ON followups
  FOR ALL USING (church_id = get_user_church_id())
  WITH CHECK (
    church_id = get_user_church_id()
    AND (user_has_permission_in_church('followups.create', church_id)
         OR user_has_permission_in_church('followups.update', church_id)
         OR user_has_permission_in_church('followups.delete', church_id))
  );

-- ============================================================================
-- spiritual_journal_entries — tenant_isolation → SELECT (self-writes remain
-- covered by servant_owner FOR ALL).
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON spiritual_journal_entries;
CREATE POLICY tenant_isolation ON spiritual_journal_entries
  FOR SELECT USING (church_id = get_user_church_id());

-- ============================================================================
-- roles / role_permissions — tenant_isolation → SELECT; role_permissions
-- super_admin_all is additionally scoped to the actor's own-church roles so a
-- super_admin cannot attach permissions to another church's roles.
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON roles;
CREATE POLICY tenant_isolation ON roles
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS tenant_isolation ON role_permissions;
CREATE POLICY tenant_isolation ON role_permissions
  FOR SELECT USING (
    role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())
  );

DROP POLICY IF EXISTS super_admin_all ON role_permissions;
CREATE POLICY super_admin_all ON role_permissions
  FOR ALL USING (
    user_is_super_admin(get_user_church_id())
    AND role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())
  );

-- ============================================================================
-- events / event_registrations / documents / ai_conversations / ai_messages /
-- document_embeddings — tenant_isolation → SELECT (no app RLS-bound writes;
-- owner_scope / super_admin_all cover any legitimate writes).
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON events;
CREATE POLICY tenant_isolation ON events
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS tenant_isolation ON event_registrations;
CREATE POLICY tenant_isolation ON event_registrations
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS tenant_isolation ON documents;
CREATE POLICY tenant_isolation ON documents
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS tenant_isolation ON ai_conversations;
CREATE POLICY tenant_isolation ON ai_conversations
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS tenant_isolation ON ai_messages;
CREATE POLICY tenant_isolation ON ai_messages
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS tenant_isolation ON document_embeddings;
CREATE POLICY tenant_isolation ON document_embeddings
  FOR SELECT USING (church_id = get_user_church_id());

-- ============================================================================
-- T4 — profiles.church_id immutability to RLS writers (P0-4 item 4) + admin
-- profile-write path. church_id can only change via the service-role admin
-- client or a SECURITY DEFINER RPC — never through PostgREST.
--   own_profile_update   self-edit; church_id must stay the actor's church.
--   super_admin_all      explicit WITH CHECK (same role semantics as before).
--   admin_write          USERS_UPDATE flow (admin manages same-church users;
--                        this closes the silent-0-rows gap that existed for
--                        admin edits under 022).
-- ============================================================================

DROP POLICY IF EXISTS own_profile_update ON profiles;
CREATE POLICY own_profile_update ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (church_id IS NOT DISTINCT FROM get_user_church_id())
  );

DROP POLICY IF EXISTS super_admin_all ON profiles;
CREATE POLICY super_admin_all ON profiles
  FOR ALL USING (user_is_super_admin(church_id))
  WITH CHECK (user_is_super_admin(church_id));

CREATE POLICY admin_write ON profiles
  FOR UPDATE USING (user_is_admin(church_id) AND church_id = get_user_church_id())
  WITH CHECK (user_is_admin(church_id) AND church_id = get_user_church_id());

-- ============================================================================
-- T5 — notifications.recipient_scope → SELECT-only (all notification writes
-- already flow through send_notification (023) or the service-role client).
-- ============================================================================

DROP POLICY IF EXISTS recipient_scope ON notifications;
CREATE POLICY recipient_scope ON notifications
  FOR SELECT USING (recipient_id = auth.uid());

-- ============================================================================
-- T6 — audit_logs.append_only: no cross-tenant audit-row spoofing. Legit
-- RLS-bound inserts come from src/lib/audit.ts (actor's own church) or a
-- platform-owner actor (church_id NULL, P0-3); the audit TRIGGER and
-- write_audit_log RPC are SECURITY DEFINER (unaffected).
-- ============================================================================

DROP POLICY IF EXISTS append_only ON audit_logs;
CREATE POLICY append_only ON audit_logs
  FOR INSERT WITH CHECK (
    church_id = get_user_church_id()
    OR (church_id IS NULL AND user_is_platform_owner())
  );

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — tenant_isolation is SELECT-only on every converted table
--   SELECT tablename, cmd FROM pg_policies
--   WHERE schemaname='public' AND policyname='tenant_isolation'
--   ORDER BY tablename;
--       -- cmd = 'SELECT' for services, stages, classes, beneficiaries,
--       --   beneficiary_assignments, servant_stage_assignments,
--       --   attendance_sessions, attendance_records, followups,
--       --   spiritual_journal_entries, roles, role_permissions, events,
--       --   event_registrations, documents, ai_conversations, ai_messages,
--       --   document_embeddings (plus user_roles/servants/notifications, 023).
-- V2 — permission-based write policies present with WITH CHECK
--   SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
--   WHERE schemaname='public' AND policyname IN
--     ('services_insert','services_update','stages_insert','stages_update',
--      'beneficiaries_insert','beneficiaries_update','assignment_write',
--      'stage_scope_write','stage_scope_update','record_attendance',
--      'followups_write','admin_write')
--   ORDER BY tablename, policyname;
--   -- admin_write appears on classes, beneficiary_assignments,
--   --   servant_stage_assignments, profiles
-- V3 — profiles.church_id immutability
--   SELECT tablename, policyname, with_check FROM pg_policies
--   WHERE schemaname='public' AND tablename='profiles';
--       -- own_profile_update with_check mentions 'church_id IS NOT DISTINCT'
--       -- admin_write with_check includes user_is_admin + church_id
-- V4 — beneficiary_assignments still immutable
--   SELECT policyname, cmd, qual FROM pg_policies
--   WHERE schemaname='public' AND tablename='beneficiary_assignments';
--       -- immutable_update (UPDATE USING false), immutable_delete (DELETE
--       -- USING false), tenant_isolation (SELECT), admin_write (INSERT)
-- V5 — audit_logs append_only tenanted
--   SELECT with_check FROM pg_policies
--   WHERE schemaname='public' AND tablename='audit_logs' AND policyname='append_only';
--       -- contains get_user_church_id() and user_is_platform_owner()
-- V6 — RLS regression matrix (scratch project, real sessions, no service role)
--   R-1  any authenticated member INSERTs into services/stages        → DENIED
--   R-2  member UPDATE/DELETE services/stages                          → DENIED
--   R-3  admin INSERT/UPDATE services & stages                         → ALLOWED
--   R-4  member INSERT beneficiaries                                   → DENIED
--   R-5  servant UPDATE beneficiaries (has beneficiaries.update)       → ALLOWED
--   R-6  member INSERT/UPDATE/DELETE beneficiary_assignments           → DENIED
--   R-7  admin INSERT beneficiary_assignments (own church)             → ALLOWED
--   R-8  member INSERT/UPDATE/DELETE servant_stage_assignments         → DENIED
--   R-9  admin DELETE+INSERT servant_stage_assignments (own church)    → ALLOWED
--   R-10 member upsert attendance_sessions/records outside scope       → DENIED
--   R-11 servant upsert attendance within assigned stage               → ALLOWED
--   R-12 member UPDATE followups (has followups.update)                → ALLOWED
--   R-13 user UPDATE own profile with church_id change                 → DENIED
--   R-14 user UPDATE own profile without church_id change              → ALLOWED
--   R-15 admin UPDATE same-church profile (USERS_UPDATE)               → ALLOWED
--   R-16 admin UPDATE other-church profile                             → DENIED
--   R-17 member INSERT audit_logs for another church                   → DENIED
--   R-18 member INSERT own-church audit_logs                           → ALLOWED
--   R-19 super_admin of church A edits role_permissions of church B    → DENIED
--   R-20 self-notification INSERT (recipient_scope)                    → DENIED
-- V7 — Flow smoke (unchanged by 027)
--   Existing church signup → approve_servant → login → create stage/ministry
--   → create/transfer beneficiary (RPCs) → record attendance → followups;
--   new-church request → approve_church_request; PO bootstrap (026);
--   notifications delivered via send_notification; audit rows written.
--
-- ROLLBACK (in-place reverse; primary rollback = restore the pre-P0.4 backup)
--   DROP FUNCTION user_has_permission_in_church(text, uuid);
--   -- Restore 022 FOR ALL tenant_isolation on each converted table:
--   --   DROP POLICY tenant_isolation ON <table>;
--   --   CREATE POLICY tenant_isolation ON <table> FOR ALL USING (church_id = get_user_church_id());
--   --   (role_permissions: USING (role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())))
--   -- Restore 022 write policies dropped/renamed here:
--   --   services/stages:  DROP services_insert/services_update/stages_insert/stages_update;
--   --                     CREATE admin_write ON services/stages FOR ALL USING (user_is_admin(church_id));
--   --   classes:          DROP admin_write; CREATE admin_write ON classes FOR ALL USING (user_is_admin(church_id));
--   --   beneficiaries:    DROP beneficiaries_insert/beneficiaries_update;
--   --                     CREATE admin_write ON beneficiaries FOR ALL USING (user_is_admin(church_id));
--   --   beneficiary_assignments: DROP admin_write;
--   --                     CREATE admin_write ON beneficiary_assignments FOR INSERT WITH CHECK (user_is_admin(church_id));
--   --   servant_stage_assignments: DROP assignment_write/admin_write;
--   --                     CREATE admin_write ON servant_stage_assignments FOR ALL USING (user_is_admin(church_id));
--   --   attendance_sessions: DROP stage_scope_write/stage_scope_update;
--   --                     CREATE stage_scope_insert ON attendance_sessions FOR INSERT WITH CHECK (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()));
--   --   attendance_records: DROP record_attendance;
--   --                     CREATE record_attendance ON attendance_records FOR INSERT WITH CHECK (church_id = get_user_church_id() AND recorded_by = auth.uid());
--   --   followups:        DROP followups_write;
--   --   role_permissions: DROP super_admin_all; CREATE super_admin_all ON role_permissions FOR ALL USING (user_is_super_admin(get_user_church_id()));
--   --   profiles:         DROP own_profile_update/super_admin_all/admin_write;
--   --                     CREATE own_profile_update ON profiles FOR UPDATE USING (id = auth.uid());
--   --                     CREATE super_admin_all ON profiles FOR ALL USING (user_is_super_admin(church_id));
--   --   notifications:    DROP recipient_scope; CREATE recipient_scope ON notifications FOR ALL USING (recipient_id = auth.uid());
--   --   audit_logs:       DROP append_only; CREATE append_only ON audit_logs FOR INSERT WITH CHECK (true);
-- ============================================================================
