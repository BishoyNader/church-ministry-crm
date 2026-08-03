-- ============================================================================
-- Church Ministry CRM — Phase A/B/C Security Remediation Batch
-- Migration: 028_security_remediation.sql
-- Action: Close the verified findings of the Phase A/B/C RLS audit. All changes
--         are RLS/function/trigger level; no column/table/index structure
--         changes. App code is NOT touched — every fix is designed so the
--         existing server-action gates (hasPermission + role checks) keep
--         working unchanged.
--
-- IMPORTANT — this batch applies ON TOP OF migration 027 (rbac_rls_hardening).
-- The applied database had recorded 027 in supabase_migrations WITHOUT actually
-- applying it, so the write-surface hardening that 027 already implements
-- (tenant_isolation → SELECT everywhere, followups_write / assignment_write /
-- beneficiaries_update / services_* / stages_* / profiles admin_write /
-- notifications / audit_logs) was MISSING at runtime. 027 MUST be applied first
-- (a clean `supabase db reset` replays 001 → 028 in order and does this). This
-- batch only adds the findings that 027 does NOT cover:
--
--   CRIT-1  (F1)  Platform-owner escalation: user_is_platform_owner() did not
--                  require a GLOBAL role AND a GLOBAL grant, so a church
--                  super_admin could create a church-scoped platform_owner
--                  role + self-grant and unlock platform_owner_* powers
--                  (churches / audit_logs / permissions / church_requests).
--   HIGH-2  (F2)  Platform Owner locked out of the RBAC layer: the PO reads
--                  roles / role_permissions under church-scoped RLS and sees
--                  zero rows for its global (church_id NULL) role, so
--                  loadCurrentUserRbac() yields no permissions and the
--                  hasPermission('tenants.read') gate fails.
--   A2      (F3)  tenants.read gate over-granted: the 021 super_admin seed
--                  bundled ALL permissions incl. platform codes (tenants.* /
--                  system.*), so a church super_admin passed the PO-only gate.
--                  (027's role_permissions.super_admin_all also had no WITH
--                  CHECK, so a super_admin could re-attach platform codes.)
--   HIGH-3  (F4)  followups DELETE: 027's followups_write is FOR ALL, and a
--                  FOR ALL policy's WITH CHECK does NOT apply to DELETE — the
--                  USING (church match) alone authorized any member to
--                  hard-delete any followup. Split into per-command policies
--                  with DELETE gated on followups.delete.
--   MED-5   (F5)  servant_stage_assignments DELETE: same FOR ALL / WITH CHECK
--                  gap in 027's assignment_write — any member could delete any
--                  assignment row. Per-command policies; DELETE gated on
--                  servants.assign.
--   MED-6   (F6)  beneficiaries UPDATE scope: 027's beneficiaries_update only
--                  checked the beneficiaries.update permission (held by every
--                  servant), so any servant could update beneficiaries they
--                  cannot even read. Now scoped to the read-scope.
--   MED-4   (F8)  beneficiary_assignments had no audit trigger (super_admin /
--                  admin RLS writes were unaudited).
--   MED-3   (F7)  Self-reactivation: own_profile_update let a deactivated user
--                  flip their OWN is_active back to true via PostgREST.
--   MED-7   (F9)  roles writes: 027 leaves roles.super_admin_all FOR ALL with
--                  no is_system guard (a super_admin could create/modify/delete
--                  system roles via RLS). Replaced with per-command policies
--                  that forbid touching system roles.
--   MED-8   (F10) deny_admin_spiritual (RESTRICTIVE) excluded plain admins
--                  from their OWN spiritual journal rows.
--
-- Not changed here (documented decisions, see audit report):
--   - LOW-7..LOW-11 items: cosmetic/observational; no RLS impact.
--   - followups soft-delete (UPDATE deleted_at) stays permission-gated
--     (followups.update OR followups.delete) — app intent (deleteFollowup is
--     a soft delete).
--   - MED-6 keeps stage/class/service scope so stage leaders / admins can
--     still update the beneficiaries they can legitimately read.
--   - priest_read (SELECT super_admin) on spiritual_journal_entries kept.
--
-- Dependencies (must exist from 001–027): roles, role_permissions, user_roles,
--   permissions, profiles, servants, followups, beneficiary_assignments,
--   servant_stage_assignments, beneficiaries, spiritual_journal_entries,
--   user_is_platform_owner (022), user_is_super_admin / user_is_admin (022),
--   get_user_stage_ids / get_user_class_ids / get_user_service_ids (022),
--   user_has_permission_in_church (027 T1), audit_trigger_fn (023).
-- Transaction: single BEGIN/COMMIT (matches 022/023/024/027 style). Any
--   failure rolls back the whole batch.
-- ============================================================================

BEGIN;

-- ============================================================================
-- F1 (CRIT-1) — user_is_platform_owner() must require a GLOBAL role AND a
-- GLOBAL grant. A church-scoped platform_owner role (the escalation vector) or
-- a church-scoped grant of the global role must never satisfy the helper.
-- SECURITY DEFINER so the fix applies to every existing platform_owner_* RLS
-- policy and every RPC guard (approve_church_request / reject_church_request)
-- at once.
-- ============================================================================

CREATE OR REPLACE FUNCTION user_is_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.church_id IS NULL
      AND ur.church_id IS NULL
      AND r.role_type = 'platform_owner'
      AND (ur.start_date IS NULL OR ur.start_date <= CURRENT_DATE)
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
$$;

-- ============================================================================
-- F1b (CRIT-1, defense in depth) — a platform_owner role can never be
-- church-scoped. NOT VALID: existing rows (e.g., a role created by the old
-- escalation) are not validated at ADD time so the batch deploys cleanly; the
-- F1 function fix already neutralizes any such pre-existing row (it now
-- requires church_id IS NULL on both role and grant). New INSERT/UPDATE rows
-- are enforced immediately. Run the V1b verification query after apply to
-- detect and clean any pre-existing church-scoped platform_owner role.
-- ============================================================================

ALTER TABLE roles DROP CONSTRAINT IF EXISTS chk_roles_platform_owner_global;

ALTER TABLE roles ADD CONSTRAINT chk_roles_platform_owner_global
  CHECK (role_type <> 'platform_owner' OR church_id IS NULL) NOT VALID;

-- ============================================================================
-- Helper — user_has_permission_in_church(p_permission_code, church_id)
-- Strengthens 027's T1 helper: same active-grant contract, plus a hard role
-- church-match (r.church_id = p_church_id) and a start_date bound, so the RLS
-- WITH CHECK / USING quals enforce the exact app-level hasPermission() gate
-- (permissions granted via role_permissions on an ACTIVE user_roles grant
-- inside the given church). SECURITY DEFINER (bypasses RLS on the RBAC tables,
-- like the other *_helper functions) and STABLE so the planner can use it in
-- policy quals. Param names match 027 T1 so CREATE OR REPLACE can upgrade it.
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
    JOIN roles r ON r.id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND ur.church_id = p_church_id
      AND r.church_id = p_church_id
      AND p.code = p_permission_code
      AND (ur.start_date IS NULL OR ur.start_date <= CURRENT_DATE)
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
$$;

-- ============================================================================
-- F3a (A2) — reseed seed_church_roles so a church super_admin no longer
-- receives platform-only codes (tenants.* / system.*). Only affects future
-- churches (approve_church_request); existing rows handled in F3b below.
-- Function is SECURITY DEFINER (as before) so it continues to bypass RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_church_roles(p_church_id uuid)
RETURNS void AS $$
DECLARE
  v_role_id uuid;
BEGIN
  -- Super Admin role (all permissions EXCEPT platform-only codes)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'super_admin', 'مدير النظام', 'Super Admin', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE module NOT IN ('tenants', 'system');

  -- Admin role
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'admin', 'مدير الخدمة', 'Admin', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code IN (
    'users.read', 'users.update',
    'beneficiaries.read', 'beneficiaries.create', 'beneficiaries.update', 'beneficiaries.transfer',
    'services.read', 'stages.read', 'stages.create', 'stages.update',
    'classes.read', 'classes.create', 'classes.update',
    'servants.read', 'servants.update', 'servants.assign',
    'attendance.read', 'attendance.export',
    'followups.read',
    'reports.read', 'reports.export',
    'import.execute', 'export.execute'
  );

  -- Servant role
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'servant', 'خادم', 'Servant', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code IN (
    'beneficiaries.read', 'beneficiaries.update',
    'services.read', 'stages.read', 'classes.read',
    'attendance.create', 'attendance.read',
    'followups.create', 'followups.read', 'followups.update', 'followups.delete',
    'spiritual.create', 'spiritual.read',
    'notifications.read',
    'reports.read'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- F3b (A2) — strip platform-only codes from EXISTING church super_admin roles
-- so the hasPermission('tenants.read') gate accurately identifies POs. Pure
-- role_permissions cleanup; no RLS policy depends on these codes, so the only
-- effect is that church super_admins lose the app-side platform gates they
-- were never meant to pass (e.g., the PO-only church-request admin actions).
-- ============================================================================

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.role_type = 'super_admin'
  AND p.module IN ('tenants', 'system');

-- ============================================================================
-- F3c (A2) — role_permissions write surface. super_admin_all (FOR ALL) may no
-- longer attach platform codes (tenants.* / system.*) to any role via RLS; the
-- platform bundle is written only by seed_platform_owner_role (026, SECURITY
-- DEFINER). Explicit WITH CHECK so both INSERT and UPDATE paths are guarded.
-- tenant_isolation FOR ALL on role_permissions (the "any member can attach
-- permissions to any church role" hole) is dropped; its SELECT behavior is
-- fully covered by read_all (identical qual).
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON role_permissions;

DROP POLICY IF EXISTS super_admin_all ON role_permissions;
CREATE POLICY super_admin_all ON role_permissions
  FOR ALL USING (
    user_is_super_admin(get_user_church_id())
    AND role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())
  )
  WITH CHECK (
    user_is_super_admin(get_user_church_id())
    AND role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())
    AND NOT EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.id = permission_id AND p.module IN ('tenants', 'system')
    )
  );

-- ============================================================================
-- F9 (MED-7) — roles writes. tenant_isolation FOR ALL and super_admin_all
-- (FOR ALL, no is_system guard) are replaced by explicit INSERT/UPDATE/DELETE
-- policies. Only non-system roles in the actor's own church are writable by
-- RLS users; system roles (super_admin / admin / servant / platform_owner) are
-- managed exclusively by the SECURITY DEFINER seeds / service-role client.
-- The F1b CHECK constraint and the church scope block platform_owner creation
-- and cross-church writes respectively.
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON roles;
DROP POLICY IF EXISTS super_admin_all ON roles;

CREATE POLICY roles_insert ON roles
  FOR INSERT WITH CHECK (
    church_id = get_user_church_id()
    AND user_is_super_admin(church_id)
    AND is_system = false
  );

CREATE POLICY roles_update ON roles
  FOR UPDATE USING (
    church_id = get_user_church_id()
    AND user_is_super_admin(church_id)
    AND is_system = false
  )
  WITH CHECK (
    church_id = get_user_church_id()
    AND user_is_super_admin(church_id)
    AND is_system = false
  );

CREATE POLICY roles_delete ON roles
  FOR DELETE USING (
    church_id = get_user_church_id()
    AND user_is_super_admin(church_id)
    AND is_system = false
  );

-- ============================================================================
-- F2 (HIGH-2) — Platform Owner RBAC reads. The PO's global role/permissions
-- live in church_id NULL rows that no church-scoped policy exposes. Add
-- PO-gated SELECT policies so loadCurrentUserRbac() resolves the PO's bundle
-- (user_roles own_read already covers the PO's own grant, 022; permissions
-- read_all is SELECT true, so the final permissions query already works).
-- Regular church users still cannot read global roles/role_permissions.
-- ============================================================================

CREATE POLICY platform_owner_read ON roles
  FOR SELECT USING (church_id IS NULL AND user_is_platform_owner());

CREATE POLICY platform_owner_read ON role_permissions
  FOR SELECT USING (
    user_is_platform_owner()
    AND role_id IN (SELECT id FROM roles WHERE church_id IS NULL)
  );

-- PO also needs to read its own church-less servant row (026 S4); the
-- servant admin_read / tenant_isolation policies are church-scoped, so
-- without this the PO sees no servant row through RLS.
CREATE POLICY own_read ON servants
  FOR SELECT USING (id = auth.uid());

-- ============================================================================
-- F4 (HIGH-3) — followups. tenant_isolation FOR ALL (any member can write any
-- followup), own_all (FOR ALL) and 027 T3's followups_write (FOR ALL — its
-- USING clause let any member DELETE and its create|update|delete OR'd WITH
-- CHECK let an update-only holder INSERT) are replaced by per-command policies
-- gated on the followups.* permission codes — the same contract the app
-- actions enforce (createFollowup / updateFollowup / deleteFollowup gate on
-- FOLLOWUPS_CREATE / UPDATE / DELETE). createFollowup sets servant_id = the
-- actor, so INSERT also requires self-ownership. DELETE (hard) is restricted
-- to followups.delete holders; the app's soft-delete (UPDATE deleted_at,
-- deleteFollowupAction) is covered by the UPDATE policy via the
-- followups.update OR followups.delete OR.
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON followups;
DROP POLICY IF EXISTS own_all ON followups;
DROP POLICY IF EXISTS followups_write ON followups;

-- Reads are preserved exactly as before: any church member may read church
-- followups (admin_read covers service-scoped reads for admins; tenant_isolation
-- SELECT keeps the pre-existing read surface for everyone else, incl. a
-- servant reading their own followups when they hold no service scope).
CREATE POLICY tenant_isolation ON followups
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY followups_insert ON followups
  FOR INSERT WITH CHECK (
    church_id = get_user_church_id()
    AND servant_id = auth.uid()
    AND user_has_permission_in_church('followups.create', church_id)
  );

CREATE POLICY followups_update ON followups
  FOR UPDATE USING (church_id = get_user_church_id())
  WITH CHECK (
    church_id = get_user_church_id()
    AND (
      user_has_permission_in_church('followups.update', church_id)
      OR user_has_permission_in_church('followups.delete', church_id)
    )
  );

CREATE POLICY followups_delete ON followups
  FOR DELETE USING (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('followups.delete', church_id)
  );

-- ============================================================================
-- F5 (MED-5) — servant_stage_assignments. tenant_isolation FOR ALL let any
-- member write (incl. delete) any assignment row. Converted to SELECT-only;
-- 027 T3's assignment_write (FOR ALL — its USING clause let any member DELETE)
-- is replaced by per-command policies gated on servants.assign (only admin /
-- super_admin hold it in the 021 seed), preserving the app's assignUsersToStage
-- Action / assignStagesAction delete-then-insert contract.
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON servant_stage_assignments;
CREATE POLICY tenant_isolation ON servant_stage_assignments
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS assignment_write ON servant_stage_assignments;

CREATE POLICY assignment_insert ON servant_stage_assignments
  FOR INSERT WITH CHECK (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('servants.assign', church_id)
  );

CREATE POLICY assignment_update ON servant_stage_assignments
  FOR UPDATE USING (church_id = get_user_church_id())
  WITH CHECK (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('servants.assign', church_id)
  );

CREATE POLICY assignment_delete ON servant_stage_assignments
  FOR DELETE USING (
    church_id = get_user_church_id()
    AND user_has_permission_in_church('servants.assign', church_id)
  );

-- ============================================================================
-- F6 (MED-6) — beneficiaries. tenant_isolation FOR ALL (any member could
-- UPDATE any beneficiary) converted to SELECT-only (reads unchanged: admin_read
-- + servant_read + tenant_isolation). The UPDATE surface is now:
--   * admin_write  -> admins keep church-wide updates (beneficiary management)
--   * super_admin_all -> super_admins unchanged
--   * beneficiaries_update (replaces 027 T3's church-wide UPDATE WITH CHECK —
--     this version is strictly narrower) -> a servant may update only a
--     beneficiary inside their read-scope: an active assignment where they are
--     the servant, or the beneficiary's stage/class/service is in their scope —
--     matching the servant_read policy. updateChildAction is unaffected for
--     every flow that could read the row in the first place.
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON beneficiaries;
CREATE POLICY tenant_isolation ON beneficiaries
  FOR SELECT USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS beneficiaries_update ON beneficiaries;
CREATE POLICY beneficiaries_update ON beneficiaries
  FOR UPDATE USING (church_id = get_user_church_id())
  WITH CHECK (
    church_id = get_user_church_id()
    AND (
      user_is_admin(church_id)
      OR user_is_super_admin(church_id)
      OR (
        user_has_permission_in_church('beneficiaries.update', church_id)
        AND EXISTS (
          SELECT 1 FROM beneficiary_assignments ba
          WHERE ba.beneficiary_id = beneficiaries.id
            AND ba.is_current = true
            AND (
              ba.servant_id = auth.uid()
              OR ba.stage_id = ANY(get_user_stage_ids())
              OR ba.class_id = ANY(get_user_class_ids())
              OR ba.service_id = ANY(get_user_service_ids())
            )
        )
      )
    )
  );

-- ============================================================================
-- F8 (MED-4) — beneficiary_assignments. tenant_isolation FOR ALL defeated the
-- immutable_update / immutable_delete policies (any member could rewrite
-- assignment history the RPC layer owns). Converted to SELECT-only so the
-- immutable policies finally hold: the only non-RPC write bypass is
-- super_admin_all (deliberate, matches the rest of the schema). Also add the
-- missing audit trigger (matches audit_user_roles / audit_followups pattern;
-- RPC paths double-audit exactly as user_roles already does).
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON beneficiary_assignments;
CREATE POLICY tenant_isolation ON beneficiary_assignments
  FOR SELECT USING (church_id = get_user_church_id());

DROP TRIGGER IF EXISTS audit_beneficiary_assignments ON beneficiary_assignments;
CREATE TRIGGER audit_beneficiary_assignments
  AFTER INSERT OR UPDATE OR DELETE ON beneficiary_assignments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- ============================================================================
-- F7 (MED-3) — profiles.is_active. A user may never flip their OWN is_active
-- via RLS (self-reactivation). The service-role admin client (auth.uid() IS
-- NULL) and a super_admin editing another same-church user's status
-- (USERS_UPDATE / deactivateUserAction) keep working. RLS remains the
-- authorization layer; this trigger is the enforcement backstop that a WITH
-- CHECK alone cannot express (it cannot compare OLD vs NEW).
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_profile_is_active_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    IF NEW.id = auth.uid() THEN
      RAISE EXCEPTION 'cannot_change_own_active_status';
    END IF;
    IF NOT user_is_super_admin(OLD.church_id) AND NOT user_is_admin(OLD.church_id) THEN
      RAISE EXCEPTION 'not_authorized_to_change_active_status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_is_active_guard ON profiles;
CREATE TRIGGER trg_profiles_is_active_guard
  BEFORE UPDATE OF is_active ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_profile_is_active_update();

-- ============================================================================
-- F10 (MED-8) — deny_admin_spiritual (RESTRICTIVE) previously excluded plain
-- admins (not super_admin) from their OWN journal rows because the restrictive
-- USING evaluated before servant_owner. Exempt own rows so a self-entry is
-- always visible while the admin-denial on OTHERS' rows is preserved.
-- (027 already converted the journal tenant_isolation write surface to SELECT.)
-- ============================================================================

DROP POLICY IF EXISTS deny_admin_spiritual ON spiritual_journal_entries;
CREATE POLICY deny_admin_spiritual ON spiritual_journal_entries
  AS RESTRICTIVE FOR ALL
  USING ((NOT (user_is_admin(church_id) AND NOT user_is_super_admin(church_id)))
         OR servant_id = auth.uid());

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — CRIT-1 function fix
--   SELECT user_is_platform_owner();
--   -- As a church super_admin who previously self-granted a church-scoped
--   -- platform_owner role: must now return false.
-- V1b — CHECK constraint + pre-existing escalation rows
--   SELECT id, church_id, role_type FROM roles WHERE role_type = 'platform_owner';
--   -- Every row MUST have church_id IS NULL (chk_roles_platform_owner_global).
--   -- Any church-scoped row found = pre-existing escalation artifact; demote/
--   -- delete it (and its user_roles/role_permissions rows) before go-live.
-- V2 — A2 super_admin platform-code strip
--   SELECT count(*) FROM role_permissions rp
--   JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
--   WHERE r.role_type = 'super_admin' AND p.module IN ('tenants','system');
--   -- Must be 0.
-- V3 — HIGH-2 PO RBAC read path (real PO session)
--   SELECT * FROM roles WHERE church_id IS NULL;                    -- PO only
--   SELECT count(*) FROM role_permissions rp
--   JOIN roles r ON r.id = rp.role_id WHERE r.church_id IS NULL;    -- bundle
--   SELECT * FROM servants WHERE id = auth.uid();                   -- PO row
-- V4 — write surfaces: tenant_isolation must be SELECT-only
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename IN
--     ('followups','beneficiary_assignments','servant_stage_assignments',
--      'beneficiaries')
--     AND policyname = 'tenant_isolation'
--   ORDER BY tablename;
--   -- cmd must be SELECT for every row (no FOR ALL left). (spiritual_journal_
--   -- entries + the other tenant tables are converted by 027; verify together
--   -- via 027's own V1 query.)
-- V5 — per-command followups/roles policies
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND policyname IN
--     ('followups_insert','followups_update','followups_delete',
--      'roles_insert','roles_update','roles_delete','beneficiaries_update')
--   ORDER BY tablename, policyname;
-- V6 — MED-3 is_active guard
--   -- As any user vs self:
--   --   UPDATE profiles SET is_active = true WHERE id = auth.uid();
--   --   -> ERROR cannot_change_own_active_status
--   -- As a super_admin of church A vs another user in A:
--   --   UPDATE profiles SET is_active = false WHERE id = <other user in A>;
--   --   -> allowed.
-- V7 — MED-6 beneficiaries_update
--   -- Servant with beneficiaries.update updating a beneficiary they cannot
--   -- read (no active assignment/scope): row is visible via tenant_isolation
--   -- SELECT so the UPDATE USING passes, but the scoped WITH CHECK fails ->
--   -- ERROR "new row violates row-level security policy" (write denied).
--   -- Admin updating any beneficiary in own church -> allowed.
-- V8 — MED-8 own-journal visibility
--   -- As a plain admin: SELECT * FROM spiritual_journal_entries
--   --   WHERE servant_id = auth.uid() -> own rows visible (and writable).
-- V9 — MED-4 audit trigger present
--   SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
--   WHERE t.tgname = 'audit_beneficiary_assignments';
-- V10 — Regression spot-checks (existing flows)
--   -- approve_church_request / reject_church_request as PO: still pass
--   --   (user_is_platform_owner now requires global grant; PO has it).
--   -- bootstrap_platform_owner second call: still raises
--   --   platform_owner_already_exists.
--   -- super_admin createUser / deactivateUser via admin client: unaffected
--   --   (service role; is_active trigger allows auth.uid() IS NULL).
--   -- servant createFollowup / updateFollowup / soft-delete: unchanged.
--   -- assignUsersToStageAction / assignStagesAction (admin): unchanged.
--
-- ROLLBACK NOTES (in-place reverse; primary rollback = restore the pre-028
-- backup snapshot, since the batch is non-destructive to existing data)
-- R1  DROP TRIGGER trg_profiles_is_active_guard ON profiles;
--     DROP FUNCTION enforce_profile_is_active_update();
-- R2  DROP TRIGGER audit_beneficiary_assignments ON beneficiary_assignments;
-- R3  DROP POLICY deny_admin_spiritual ON spiritual_journal_entries;
--     -- restore: CREATE POLICY deny_admin_spiritual ON spiritual_journal_entries
--     --   AS RESTRICTIVE FOR ALL
--     --   USING (NOT (user_is_admin(church_id) AND NOT user_is_super_admin(church_id)));
-- R4  DROP POLICY beneficiaries_update ON beneficiaries;
--     -- restore pre-028 beneficiaries UPDATE surface = admin_write + super_admin_all.
-- R5  servant_stage_assignments: DROP POLICY tenant_isolation;
--     -- restore: CREATE POLICY tenant_isolation ON servant_stage_assignments
--     --   FOR ALL USING (church_id = get_user_church_id());
-- R6  followups: DROP POLICY followups_delete / followups_update / followups_insert;
--     -- restore: CREATE POLICY own_all ON followups FOR ALL
--     --   USING (servant_id = auth.uid());
--     -- restore: CREATE POLICY tenant_isolation ON followups
--     --   FOR ALL USING (church_id = get_user_church_id());
-- R7  DROP POLICY own_read ON servants;
-- R8  DROP POLICY platform_owner_read ON role_permissions;
-- R9  DROP POLICY platform_owner_read ON roles;
-- R10 DROP POLICY roles_delete / roles_update / roles_insert ON roles;
--     -- restore: CREATE POLICY super_admin_all ON roles FOR ALL
--     --   USING (user_is_super_admin(church_id));
--     -- restore: CREATE POLICY tenant_isolation ON roles FOR ALL
--     --   USING (church_id = get_user_church_id());
-- R11 DROP POLICY super_admin_all ON role_permissions;
--     -- restore: CREATE POLICY tenant_isolation ON role_permissions FOR ALL
--     --   USING (role_id IN (SELECT id FROM roles
--     --                      WHERE church_id = get_user_church_id()));
-- R12 Re-grant stripped platform codes to church super_admins:
--     INSERT INTO role_permissions (role_id, permission_id)
--     SELECT r.id, p.id FROM roles r, permissions p
--     WHERE r.role_type = 'super_admin' AND p.module IN ('tenants','system');
--     -- Restore the pre-028 seed_church_roles definition (021).
-- R13 ALTER TABLE roles DROP CONSTRAINT chk_roles_platform_owner_global;
-- R14 Restore the pre-028 user_is_platform_owner() definition (022).
-- ============================================================================
