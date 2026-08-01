-- ============================================================================
-- Church Ministry CRM — Phase 3C Registration & Church Provisioning
-- Migration: 023_phase3c_registration.sql
-- Action: church_requests table + indexes/constraints/policies/trigger,
--         notifications.church_id nullable, 3 tenant_isolation policy
--         replacements (SELECT-only, C-1/C-2/C-3), profiles.own_profile_insert
--         hardening, user_roles temporal unique index (A3), audit subsystem
--         restoration (A4, 6 triggers), 8 SECURITY DEFINER RPCs (7 client +
--         send_notification helper), RPC privilege lockdown (D-2)
-- Scope:  ONLY the approved Phase 3C.2 surface per PHASE_3C_MIGRATION_EXECUTION_PLAN.md
--         (S1–S12). No other table/column/index/policy is touched. No DML on
--         existing rows. Data-preserving: no DELETE/UPDATE on existing data.
-- Dependencies (must exist from 001–022): pgcrypto/gen_random_uuid, handle_updated_at(),
--   churches, profiles, servants, roles, user_roles, notifications, audit_logs,
--   attendance_backup_20260730, write_audit_log (019), seed_church_roles (021),
--   get_user_church_id / user_is_platform_owner / user_is_super_admin (022).
-- Transaction:  single BEGIN/COMMIT (matches 022 style). A failure anywhere
--   rolls back the entire batch.
-- ============================================================================

BEGIN;

-- ============================================================================
-- S1 — church_requests table, constraints, trigger, indexes
-- (Dependency: gen_random_uuid via pgcrypto (001), profiles (001),
--  handle_updated_at (001))
-- ============================================================================

CREATE TABLE church_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_name_ar  text NOT NULL,
  church_name_en  text,
  catechist_name  text NOT NULL,
  applicant_name  text NOT NULL,
  email           text NOT NULL,
  phone           text,
  notes           text,
  status          text NOT NULL DEFAULT 'pending',
  reviewed_by     uuid REFERENCES profiles (id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  decision_notes  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- PO review queue: pending requests, newest first (REGISTRATION_DATABASE_CHANGES.md §3)
CREATE INDEX idx_church_requests_status
  ON church_requests (created_at DESC)
  WHERE status = 'pending';

-- Duplicate-request guard: one pending request per email (case-insensitive)
CREATE UNIQUE INDEX idx_church_requests_email_pending
  ON church_requests (lower(email))
  WHERE status = 'pending';

-- History lookups / dedupe against new submissions
CREATE INDEX idx_church_requests_email
  ON church_requests (lower(email));

CREATE TRIGGER trg_church_requests_updated_at
  BEFORE UPDATE ON church_requests
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- S2 — church_requests RLS: enable + 5 policies
-- (Dependency: S1; user_is_platform_owner (022); auth.jwt() (auth schema))
-- ============================================================================

ALTER TABLE church_requests ENABLE ROW LEVEL SECURITY;

-- Platform owner: full review lifecycle (approve/reject/update). The only
-- legitimate writer of status transitions (RPCs are the audited path).
CREATE POLICY platform_owner_all ON church_requests
  FOR ALL USING (user_is_platform_owner());

-- Applicant: own-request visibility only (email from the auth JWT).
-- LOWER() both sides so the case-normalized email stored by the submit RPC
-- always matches the JWT claim.
CREATE POLICY applicant_read ON church_requests
  FOR SELECT USING (lower(email) = lower(auth.jwt()->>'email'));

-- Public submission surface: anonymous rows in status='pending' only.
-- The status CHECK + this WITH CHECK prevent a spoofed non-pending INSERT.
CREATE POLICY public_insert ON church_requests
  FOR INSERT WITH CHECK (status = 'pending');

-- PERMISSIVE deny (A2) — must NOT be RESTRICTIVE: RLS ORs permissive policies,
-- so platform_owner_all still passes for the PO while every other role is
-- denied. WITH CHECK (false) also rejects the NEW row, so a spoofed
-- UPDATE ... SET status='approved' cannot pass.
CREATE POLICY immutable_review ON church_requests
  AS PERMISSIVE FOR UPDATE USING (false) WITH CHECK (false);

CREATE POLICY immutable_delete ON church_requests
  AS PERMISSIVE FOR DELETE USING (false);

-- ============================================================================
-- S3 — notifications.church_id → NULLABLE
-- (Dependency: notifications (001/018); FK notifications_church_id_fkey KEPT)
-- Why: platform-owner recipients have church_id = NULL; approval_required
--      alerts require NULL church_id. Precedent: audit_logs.church_id nullable.
-- A9: migration 018 left column old_metadata jsonb; send_notification
--     references the canonical `data` column ONLY, never old_metadata.
-- ============================================================================

ALTER TABLE notifications ALTER COLUMN church_id DROP NOT NULL;

-- ============================================================================
-- S4 — user_roles.tenant_isolation → SELECT-only (C-1, CRITICAL)
-- (Dependency: 022 baseline; get_user_church_id (001/022))
-- Closes same-church self-escalation to super_admin via direct user_roles
-- INSERT. Same-church reads preserved (own_read / admin_read / super_admin_all
-- SELECT paths unchanged). Writes now flow only through super_admin_all,
-- the SECURITY DEFINER RPCs (S11), or the service-role admin client.
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON user_roles;
CREATE POLICY tenant_isolation ON user_roles
  FOR SELECT USING (church_id = get_user_church_id());

-- ============================================================================
-- S5 — servants.tenant_isolation → SELECT-only (C-2, HIGH)
-- (Dependency: 022 baseline)
-- Closes self-approval / same-church servant-row mutation. Own-row read is
-- preserved via the existing admin_read policy (id = auth.uid() OR ...).
-- Writes limited to super_admin_all + approve_servant/reject_servant RPCs.
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON servants;
CREATE POLICY tenant_isolation ON servants
  FOR SELECT USING (church_id = get_user_church_id());

-- ============================================================================
-- S6 — notifications.tenant_isolation → SELECT-only (C-3, MEDIUM)
-- (Dependency: 022 baseline)
-- Closes same-church cross-recipient notification INSERT (spoofing). Own-row
-- access is fully preserved by recipient_scope (recipient_id = auth.uid()).
-- All notification writes funnel through send_notification (S11, SECURITY
-- DEFINER, no client EXECUTE grant in S12).
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON notifications;
CREATE POLICY tenant_isolation ON notifications
  FOR SELECT USING (church_id = get_user_church_id());

-- ============================================================================
-- S7 — profiles.own_profile_insert hardening (defense in depth)
-- (Dependency: 022 baseline; churches (001/009))
-- WITH CHECK now requires a real, active, non-deleted church. Note (D-5):
-- the EXISTS subquery is evaluated under the caller's RLS context, so a
-- brand-new authenticated user (no profile yet, get_user_church_id() = NULL)
-- cannot claim an arbitrary church — fail-closed. The signup path is the
-- service-role admin client (RLS-bypassed), so the primary flow is unaffected.
-- ============================================================================

DROP POLICY IF EXISTS own_profile_insert ON profiles;
CREATE POLICY own_profile_insert ON profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM churches c
      WHERE c.id = church_id AND c.is_active AND c.deleted_at IS NULL
    )
  );

-- ============================================================================
-- S8 — user_roles temporal re-grant DDL (A3)
-- (Dependency: 001 UNIQUE constraint user_roles_church_id_user_id_role_id_key,
--  020 end_date column; pre-flight P0.4 guarantees no duplicate active grants)
-- The non-partial UNIQUE is replaced by a partial UNIQUE index over ACTIVE
-- grants only (end_date IS NULL), making the temporal model canonical: archive
-- (end_date) + re-insert never collides with a historical row, and
-- reactivation-first re-approval (approve_servant) is safe.
-- A10: idx_user_roles_user_active (020) is RETAINED.
-- Order: drop the constraint, then create the index — both inside this single
-- transaction, so uniqueness is never momentarily lost at COMMIT.
-- ============================================================================

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_church_id_user_id_role_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_active
  ON user_roles (church_id, user_id, role_id)
  WHERE end_date IS NULL;

-- ============================================================================
-- S9 — audit_trigger_fn recreation (A4) + dead-trigger drop
-- (Dependency: audit_logs with actor_id/action text/entity_id NOT NULL (019),
--  attendance_backup_20260730 (015))
-- Root cause: 019's DROP TYPE audit_action CASCADE dropped audit_trigger_fn
-- and all 5 dependent triggers → silent audit gap. This recreation restores
-- the stream: actor_id (not user_id), action TEXT (no enum), entity_type :=
-- TG_TABLE_NAME, entity_id := COALESCE(NEW.id, OLD.id) (satisfies NOT NULL).
-- SECURITY DEFINER so audit rows are written for all DML incl. RPC-driven
-- writes (defense-in-depth; the RPCs also audit explicitly).
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_action text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new := to_jsonb(NEW);
    v_church_id := NEW.church_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_church_id := NEW.church_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old := to_jsonb(OLD);
    v_church_id := OLD.church_id;
  END IF;

  INSERT INTO audit_logs (church_id, actor_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (v_church_id, auth.uid(), v_action, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Dead trigger from 015's rename (attendance → attendance_backup_20260730);
-- harmless but dropped for fidelity. M-2: NO audit_children trigger is created
-- — children was renamed to beneficiaries in 013; coverage is via
-- audit_beneficiaries (legacy rows keep entity_type='children').
DROP TRIGGER IF EXISTS audit_attendance ON attendance_backup_20260730;

-- ============================================================================
-- S10 — Audit triggers (A4, M-2) — 6 recreations
-- (Dependency: S9; the six target tables all have church_id + id)
-- DROP TRIGGER IF EXISTS before each CREATE for idempotence.
-- ============================================================================

DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_user_roles ON user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_followups ON followups;
CREATE TRIGGER audit_followups
  AFTER INSERT OR UPDATE OR DELETE ON followups
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_attendance_sessions ON attendance_sessions;
CREATE TRIGGER audit_attendance_sessions
  AFTER INSERT OR UPDATE OR DELETE ON attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_attendance_records ON attendance_records;
CREATE TRIGGER audit_attendance_records
  AFTER INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_beneficiaries ON beneficiaries;
CREATE TRIGGER audit_beneficiaries
  AFTER INSERT OR UPDATE OR DELETE ON beneficiaries
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- ============================================================================
-- S11 — RPC creation (8 SECURITY DEFINER functions, dependency order)
-- (Dependency: S1–S8; write_audit_log (019); seed_church_roles (021);
--  user_is_platform_owner / user_is_super_admin / get_user_church_id (022))
-- All functions SET search_path = public, auth (D-3) so the nested 019/021/022
-- helpers (which use unqualified public tables and auth.uid()) resolve safely,
-- while no attacker-writable schema is ever searched. All own references are
-- schema-qualified. Every function enforces actor guards internally.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- S11-1  send_notification(...) — SECURITY DEFINER INSERT wrapper.
-- Sole notification write path. NOT exposed to clients (privileges in S12).
-- References the canonical `data` column ONLY (A9); never old_metadata.
-- body_ar/body_en are COALESCE'd because notifications.body_ar is NOT NULL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION send_notification(
  p_church_id uuid,
  p_recipient_id uuid,
  p_notification_type text,
  p_title_ar text,
  p_title_en text DEFAULT NULL,
  p_body_ar text DEFAULT NULL,
  p_body_en text DEFAULT NULL,
  p_data jsonb DEFAULT NULL,
  p_channel text DEFAULT 'in_app'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO notifications
    (church_id, recipient_id, notification_type, title_ar, title_en,
     body_ar, body_en, data, channel, sent_at)
  VALUES
    (p_church_id, p_recipient_id, p_notification_type, p_title_ar, p_title_en,
     COALESCE(p_body_ar, ''), p_body_en, p_data, p_channel, now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- S11-2  list_churches_for_signup() — public, projection-limited.
-- The ONLY public read surface for churches (RLS hides churches from anon).
-- Exposes identity fields only (no contact/subscription data).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_churches_for_signup()
RETURNS TABLE (id uuid, name_ar text, name_en text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id, name_ar, name_en, slug
  FROM churches
  WHERE is_active = true AND deleted_at IS NULL
  ORDER BY name_ar;
$$;

-- ----------------------------------------------------------------------------
-- S11-3  get_my_access_state() — single round-trip for middleware and the
-- /pending-approval page. Reads OWN profile + servant + active role grants
-- (hardcoded to auth.uid()), joins church name. Returns empty set when the
-- caller has no profile (anon / no account).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_access_state()
RETURNS TABLE (
  church_id uuid,
  church_name_ar text,
  servant_approval_status text,
  role_types text[],
  is_active boolean,
  has_roles boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    p.church_id,
    c.name_ar,
    s.approval_status,
    COALESCE(ARRAY_AGG(r.role_type::text) FILTER (WHERE r.role_type IS NOT NULL), ARRAY[]::text[]),
    p.is_active,
    bool_or(ur.id IS NOT NULL)
  FROM profiles p
  LEFT JOIN churches c ON c.id = p.church_id
  LEFT JOIN servants s ON s.id = p.id AND s.deleted_at IS NULL
  LEFT JOIN user_roles ur
    ON ur.user_id = p.id AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  LEFT JOIN roles r ON r.id = ur.role_id
  WHERE p.id = auth.uid()
  GROUP BY p.id, p.church_id, p.is_active, c.name_ar, s.approval_status;
$$;

-- ----------------------------------------------------------------------------
-- S11-4  submit_church_request(...) — public new-church request submission.
-- Dedupes against profiles.email (unique, 010), pending church_requests.email
-- (partial unique index S1), and existing churches names. Writes an explicit
-- audit row (D-6, entity_type='church_request'). No auth required (anon).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_church_request(
  p_church_name_ar text,
  p_church_name_en text,
  p_catechist_name text,
  p_applicant_name text,
  p_email text,
  p_phone text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_request_id uuid;
BEGIN
  IF p_church_name_ar IS NULL OR BTRIM(p_church_name_ar) = '' THEN
    RAISE EXCEPTION 'church_name_required';
  END IF;
  IF p_catechist_name IS NULL OR BTRIM(p_catechist_name) = '' THEN
    RAISE EXCEPTION 'catechist_name_required';
  END IF;
  IF p_applicant_name IS NULL OR BTRIM(p_applicant_name) = '' THEN
    RAISE EXCEPTION 'applicant_name_required';
  END IF;
  IF p_email IS NULL OR BTRIM(p_email) = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  v_email := LOWER(BTRIM(p_email));

  -- Dedupe 1: no existing profile (auth account) with this email
  IF EXISTS (SELECT 1 FROM profiles WHERE email = v_email) THEN
    RAISE EXCEPTION 'email_already_registered';
  END IF;

  -- Dedupe 2: no pending request already open for this email
  IF EXISTS (SELECT 1 FROM church_requests WHERE lower(email) = v_email AND status = 'pending') THEN
    RAISE EXCEPTION 'request_already_pending';
  END IF;

  -- Dedupe 3: no existing church with the same normalized name
  IF EXISTS (
    SELECT 1 FROM churches
    WHERE deleted_at IS NULL
      AND (name_ar = BTRIM(p_church_name_ar)
           OR (p_church_name_en IS NOT NULL AND name_en = BTRIM(p_church_name_en)))
  ) THEN
    RAISE EXCEPTION 'church_name_exists';
  END IF;

  INSERT INTO church_requests
    (church_name_ar, church_name_en, catechist_name, applicant_name, email, phone, notes)
  VALUES
    (BTRIM(p_church_name_ar), NULLIF(BTRIM(p_church_name_en), ''), BTRIM(p_catechist_name),
     BTRIM(p_applicant_name), v_email, p_phone, p_notes)
  RETURNING id INTO v_request_id;

  -- D-6: explicit audit in the same transaction (church_requests has no table
  -- trigger; entity_id always passed per D-4). church_id is NULL (the church
  -- does not exist yet).
  PERFORM write_audit_log(
    NULL,
    'create',
    'church_request',
    v_request_id,
    NULL,
    jsonb_build_object('status', 'pending')
  );

  RETURN v_request_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- S11-5  approve_servant(p_servant_id) — super_admin approval (existing church).
-- Guards (defense in depth, REGISTRATION_DATABASE_CHANGES.md §4.4):
--   auth.uid() IS NOT NULL; auth.uid() <> p_servant_id (no self-approval);
--   user_is_super_admin(servant's church) (no cross-church);
--   approval_status = 'pending' (idempotency).
-- Role grant: reactivation-first (A3) — reactivates an archived grant, else
-- inserts a fresh row. NO ON CONFLICT DO NOTHING: a missing grant must never
-- be silently skipped (an approved servant with no active role).
-- Side effects: notification to applicant + explicit audit, same transaction.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_servant(p_servant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_status text;
  v_role_id uuid;
  v_active_exists boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_servant_id IS NULL OR p_servant_id = auth.uid() THEN
    RAISE EXCEPTION 'self_approval_not_allowed';
  END IF;

  SELECT s.church_id, s.approval_status INTO v_church_id, v_status
  FROM servants s
  WHERE s.id = p_servant_id AND s.deleted_at IS NULL
  FOR UPDATE;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'servant_not_found';
  END IF;

  IF NOT user_is_super_admin(v_church_id) THEN
    RAISE EXCEPTION 'not_super_admin';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'servant_not_pending';
  END IF;

  UPDATE servants
  SET approval_status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_servant_id;

  -- Canonical 'servant' role for the church (UNIQUE (church_id, role_type), 001)
  SELECT r.id INTO v_role_id
  FROM roles r
  WHERE r.church_id = v_church_id AND r.role_type = 'servant';

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'servant_role_not_found';
  END IF;

  -- A3 reactivation-first re-grant
  UPDATE user_roles
  SET end_date = NULL
  WHERE church_id = v_church_id AND user_id = p_servant_id
    AND role_id = v_role_id AND end_date IS NOT NULL;

  IF NOT FOUND THEN
    SELECT EXISTS (
      SELECT 1 FROM user_roles
      WHERE church_id = v_church_id AND user_id = p_servant_id
        AND role_id = v_role_id AND end_date IS NULL
    ) INTO v_active_exists;

    IF NOT v_active_exists THEN
      INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)
      VALUES (v_church_id, p_servant_id, v_role_id, auth.uid(), CURRENT_DATE);
    END IF;
  END IF;

  -- Approval notification to the applicant
  PERFORM send_notification(
    v_church_id,
    p_servant_id,
    'approval_result',
    'تمت الموافقة على طلبك',
    'Your request was approved',
    'تم تفعيل حسابك، يمكنك الآن الدخول للتطبيق',
    'Your account is now active, you can sign in',
    jsonb_build_object('decision', 'approved', 'servant_id', p_servant_id, 'church_id', v_church_id)
  );

  -- Audit (trusted path; entity_id NOT NULL per D-4)
  PERFORM write_audit_log(
    v_church_id,
    'approve',
    'servant',
    p_servant_id,
    jsonb_build_object('approval_status', 'pending'),
    jsonb_build_object('approval_status', 'approved', 'role_id', v_role_id)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- S11-6  reject_servant(p_servant_id, p_reason) — same guards as approve.
-- No role change; notification carries the optional reason; audited.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_servant(p_servant_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_church_id uuid;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_servant_id IS NULL OR p_servant_id = auth.uid() THEN
    RAISE EXCEPTION 'self_approval_not_allowed';
  END IF;

  SELECT s.church_id, s.approval_status INTO v_church_id, v_status
  FROM servants s
  WHERE s.id = p_servant_id AND s.deleted_at IS NULL
  FOR UPDATE;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'servant_not_found';
  END IF;

  IF NOT user_is_super_admin(v_church_id) THEN
    RAISE EXCEPTION 'not_super_admin';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'servant_not_pending';
  END IF;

  UPDATE servants
  SET approval_status = 'rejected', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_servant_id;

  PERFORM send_notification(
    v_church_id,
    p_servant_id,
    'approval_result',
    'تم رفض طلبك',
    'Your request was rejected',
    'يرجى التواصل مع إدارة الكنيسة للمزيد من التفاصيل',
    'Please contact the church administration for more details',
    jsonb_build_object('decision', 'rejected', 'servant_id', p_servant_id, 'church_id', v_church_id)
      || CASE WHEN p_reason IS NOT NULL THEN jsonb_build_object('reason', p_reason) ELSE '{}'::jsonb END
  );

  PERFORM write_audit_log(
    v_church_id,
    'reject',
    'servant',
    p_servant_id,
    jsonb_build_object('approval_status', 'pending'),
    jsonb_build_object('approval_status', 'rejected')
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- S11-7  approve_church_request(p_request_id, p_auth_user_id, p_slug) — PO
-- provisioning, single atomic transaction (CHURCH_PROVISIONING_SPEC §4.2).
-- Guards: PO-only (user_is_platform_owner); request pending; D-8 email-match
-- (p_auth_user_id must exist in auth.users AND its email must equal the
-- request's email). Creates church (trial baseline §9) + seed_church_roles +
-- profile + approved servant + initial super_admin grant; marks the request
-- approved; notifies the applicant; writes 3 audit rows. Any failure aborts
-- the whole transaction (church/profile/servant/role roll back together).
-- Slug: validated format; app layer does slugify + ensureUniqueSlug, and
-- churches.slug UNIQUE (001) is the final defense.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_church_request(
  p_request_id uuid,
  p_auth_user_id uuid,
  p_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status text;
  v_church_name_ar text;
  v_church_name_en text;
  v_applicant_name text;
  v_email text;
  v_phone text;
  v_auth_email text;
  v_church_id uuid;
  v_role_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT user_is_platform_owner() THEN
    RAISE EXCEPTION 'not_platform_owner';
  END IF;

  -- Lock the request row to serialize review decisions
  SELECT cr.status, cr.church_name_ar, cr.church_name_en, cr.applicant_name,
         cr.email, cr.phone
    INTO v_status, v_church_name_ar, v_church_name_en, v_applicant_name,
         v_email, v_phone
  FROM church_requests cr
  WHERE cr.id = p_request_id
  FOR UPDATE;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  -- D-8: provisioned auth user must exist and match the request's email
  SELECT au.email INTO v_auth_email
  FROM auth.users au
  WHERE au.id = p_auth_user_id;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'auth_user_not_found';
  END IF;

  IF lower(v_auth_email) <> lower(v_email) THEN
    RAISE EXCEPTION 'auth_user_email_mismatch';
  END IF;

  -- Dedupe: no existing church with the same normalized name
  IF EXISTS (
    SELECT 1 FROM churches
    WHERE deleted_at IS NULL
      AND (name_ar = v_church_name_ar
           OR (v_church_name_en IS NOT NULL AND name_en = v_church_name_en))
  ) THEN
    RAISE EXCEPTION 'church_name_exists';
  END IF;

  -- Slug format guard (final uniqueness defense = churches.slug UNIQUE, 001)
  IF p_slug IS NULL OR p_slug <> lower(p_slug)
     OR p_slug !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'invalid_slug';
  END IF;

  -- Create the church (provisioning baseline: trial/active, +30d, locale ar)
  INSERT INTO churches
    (name_ar, name_en, slug, contact_email, contact_phone,
     subscription_tier, subscription_status, trial_ends_at, feature_flags, locale)
  VALUES
    (v_church_name_ar, v_church_name_en, p_slug, v_email, v_phone,
     'trial', 'active', now() + interval '30 days', '{}', 'ar')
  RETURNING id INTO v_church_id;

  -- Seed canonical roles (021)
  PERFORM seed_church_roles(v_church_id);

  -- Applicant profile (id = auth user id; canonical: first user is super_admin)
  INSERT INTO profiles (id, church_id, email, full_name_ar, full_name_en, phone, preferred_locale)
  VALUES (p_auth_user_id, v_church_id, v_email, v_applicant_name, NULL, v_phone, 'ar');

  -- Approved servant row for the new super_admin (canonical role model)
  INSERT INTO servants (id, church_id, approval_status, approved_by, approved_at)
  VALUES (p_auth_user_id, v_church_id, 'approved', auth.uid(), now());

  -- Initial super_admin grant (platform-owner only writer of super_admin)
  SELECT r.id INTO v_role_id
  FROM roles r
  WHERE r.church_id = v_church_id AND r.role_type = 'super_admin';

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'super_admin_role_not_found';
  END IF;

  INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date)
  VALUES (v_church_id, p_auth_user_id, v_role_id, auth.uid(), CURRENT_DATE);

  -- Mark the request approved
  UPDATE church_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_request_id;

  -- Notification to the applicant (approval_result / approved; §8.1)
  PERFORM send_notification(
    v_church_id,
    p_auth_user_id,
    'approval_result',
    'تم إنشاء كنيسة ' || v_church_name_ar,
    CASE WHEN v_church_name_en IS NOT NULL THEN v_church_name_en || ' is ready'
         ELSE 'Your church is ready' END,
    'تم تفعيل حسابك كمدير للكنيسة',
    'Your account is now the church administrator',
    jsonb_build_object('decision', 'approved', 'church_id', v_church_id,
                       'church_request_id', p_request_id, 'role', 'super_admin')
  );

  -- Audit trail: request approve + church create + servant create (D-4)
  PERFORM write_audit_log(
    v_church_id, 'approve', 'church_request', p_request_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'approved', 'church_id', v_church_id)
  );
  PERFORM write_audit_log(
    v_church_id, 'create', 'church', v_church_id, NULL,
    jsonb_build_object('name_ar', v_church_name_ar, 'slug', p_slug, 'subscription_tier', 'trial')
  );
  PERFORM write_audit_log(
    v_church_id, 'create', 'servant', p_auth_user_id, NULL,
    jsonb_build_object('approval_status', 'approved')
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- S11-8  reject_church_request(p_request_id, p_reason) — PO rejection.
-- Nothing is created. No in-app notification (applicant has no account —
-- CHURCH_PROVISIONING_SPEC §4.3). Status transition + decision_notes + audit.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_church_request(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT user_is_platform_owner() THEN
    RAISE EXCEPTION 'not_platform_owner';
  END IF;

  SELECT status INTO v_status
  FROM church_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  UPDATE church_requests
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      decision_notes = p_reason
  WHERE id = p_request_id;

  PERFORM write_audit_log(
    NULL, 'reject', 'church_request', p_request_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'rejected')
  );
END;
$$;

-- ============================================================================
-- S12 — RPC privilege lockdown (D-2)
-- (Dependency: S11)
-- Supabase default privileges grant EXECUTE to PUBLIC/anon/authenticated on
-- every new function, so each function is fully revoked first, then granted
-- only to its intended PostgREST surface (matching plan §1.3). send_notification
-- is revoked from every role: the RPCs call it internally as the function
-- owner (no grant needed); the admin client / server actions may use it only
-- if explicitly granted later.
-- ============================================================================

-- send_notification: NO client exposure (helper only)
REVOKE ALL ON FUNCTION send_notification(uuid, uuid, text, text, text, text, text, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- list_churches_for_signup: public signup dropdown
REVOKE ALL ON FUNCTION list_churches_for_signup() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION list_churches_for_signup() TO anon, authenticated;

-- submit_church_request: public new-church request form
REVOKE ALL ON FUNCTION submit_church_request(text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION submit_church_request(text, text, text, text, text, text, text)
  TO anon, authenticated;

-- get_my_access_state: authenticated sessions (middleware / pending page)
REVOKE ALL ON FUNCTION get_my_access_state() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_my_access_state() TO authenticated;

-- approve_servant / reject_servant: super_admin approval queue (guards inside)
REVOKE ALL ON FUNCTION approve_servant(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION approve_servant(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION reject_servant(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION reject_servant(uuid, text) TO authenticated, service_role;

-- approve_church_request / reject_church_request: PO provisioning queue
REVOKE ALL ON FUNCTION approve_church_request(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION approve_church_request(uuid, uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION reject_church_request(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION reject_church_request(uuid, text) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB — NOT part of the batch)
-- V1 — Schema
--   SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='church_requests';
--   SELECT column_name FROM information_schema.columns WHERE table_name='church_requests';
--   SELECT is_nullable FROM information_schema.columns
--     WHERE table_name='notifications' AND column_name='church_id';   -- YES
--   SELECT indexname FROM pg_indexes WHERE tablename='church_requests'; -- 3 indexes
--   SELECT indexname FROM pg_indexes WHERE tablename='user_roles';      -- uq_user_roles_active present
--   SELECT conname FROM pg_constraint WHERE conrelid='user_roles'::regclass AND contype='u';
--       -- uq_user_roles_active via index; user_roles_church_id_user_id_role_id_key ABSENT
-- V2 — Policies
--   SELECT tablename, policyname, cmd, permissive
--   FROM pg_policies WHERE schemaname='public'
--   ORDER BY tablename, policyname;
--       -- church_requests: 5 policies (platform_owner_all ALL, applicant_read SELECT,
--       --   public_insert INSERT, immutable_review UPDATE permissive, immutable_delete DELETE permissive)
--       -- user_roles/servants/notifications tenant_isolation: cmd = 'SELECT' only
--       -- profiles.own_profile_insert: cmd = 'INSERT', qual contains 'churches'
-- V3 — Functions & privileges
--   SELECT p.proname, p.prosecdef, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.proname IN
--     ('send_notification','list_churches_for_signup','get_my_access_state',
--      'submit_church_request','approve_servant','reject_servant',
--      'approve_church_request','reject_church_request','audit_trigger_fn');
--   -- prosecdef = true for all 9; proconfig contains search_path
--   SELECT has_function_privilege('anon', 'send_notification(uuid,uuid,text,text,text,text,text,jsonb,text)', 'EXECUTE');        -- false
--   SELECT has_function_privilege('anon', 'list_churches_for_signup()', 'EXECUTE');        -- true
--   SELECT has_function_privilege('authenticated', 'get_my_access_state()', 'EXECUTE');    -- true
--   SELECT has_function_privilege('anon', 'get_my_access_state()', 'EXECUTE');             -- false
--   SELECT has_function_privilege('anon', 'approve_church_request(uuid,uuid,text)', 'EXECUTE'); -- false
-- V4 — Audit continuity
--   SELECT pg_get_functiondef('audit_trigger_fn()'::regprocedure) LIKE '%actor_id%' AS uses_actor_id;  -- true
--   SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
--   WHERE t.tgname LIKE 'audit\_%' AND NOT t.tgisinternal ORDER BY c.relname;
--       -- audit_profiles, audit_user_roles, audit_followups, audit_attendance_sessions,
--       -- audit_attendance_records, audit_beneficiaries (6). audit_attendance ABSENT.
--   -- Smoke: DML on each audited table, then
--   SELECT COUNT(*) >= 3 FROM audit_logs
--   WHERE entity_type IN ('profiles','user_roles','followups','attendance_sessions',
--                         'attendance_records','beneficiaries')
--     AND action IN ('create','update','delete');
-- V5 — RLS regression (scratch project, real sessions, no service role)
--   Matrix R-1…R-16 of PHASE_3C_SECURITY_REMEDIATION.md §5
--   (R-1/R-2 user_roles self-insert DENIED; R-3/R-4 servants self-approval/mutation
--    DENIED; R-8A user_roles/servants/notifications writes DENIED; R-9 notification
--    spoof DENIED; R-11 applicant UPDATE/DELETE own request DENIED; R-12 PO update
--    allowed; R-16 profiles self-insert fail-closed DENIED, service-role allowed)
-- V6 — Flow smoke (scratch)
--   Existing church: service-role signup → pending → get_my_access_state →
--   super_admin approve_servant → servant role granted + audit + notification → login.
--   New church: anon submit_church_request → PO approve_church_request(
--   request_id, auth_user_id, slug) → church/roles/profile/servant/super_admin
--   created atomically; reject_church_request path.

-- ============================================================================
-- ROLLBACK NOTES (in-place reverse DDL; primary rollback = restore the P0.6
-- backup snapshot, since the batch is non-destructive)
-- R1  DROP TABLE church_requests;                                  -- S1+S2
-- R2  ALTER TABLE notifications ALTER COLUMN church_id SET NOT NULL;  -- S3
--     -- BLOCKED if any church_id IS NULL row exists (PO alerts); clear/reassign first
-- R3  Restore 022 policies exactly:
--     DROP POLICY tenant_isolation ON user_roles;      CREATE POLICY tenant_isolation
--       ON user_roles FOR ALL USING (church_id = get_user_church_id());
--     DROP POLICY tenant_isolation ON servants;        CREATE ... FOR ALL ...
--     DROP POLICY tenant_isolation ON notifications;   CREATE ... FOR ALL ...
--     DROP POLICY own_profile_insert ON profiles;      CREATE POLICY own_profile_insert
--       ON profiles FOR INSERT WITH CHECK (id = auth.uid());
-- R4  DROP INDEX uq_user_roles_active;
--     ALTER TABLE user_roles ADD CONSTRAINT user_roles_church_id_user_id_role_id_key
--       UNIQUE (church_id, user_id, role_id);
--     -- BLOCKED if archived+active duplicate grants exist (reactivation-first
--     -- RPCs prevent this; verify count before rollback)
-- R5  DROP FUNCTION reject_church_request(uuid, text), approve_church_request(uuid,uuid,text),
--       reject_servant(uuid,text), approve_servant(uuid), submit_church_request(text,text,text,text,text,text,text),
--       get_my_access_state(), list_churches_for_signup(), send_notification(uuid,uuid,text,text,text,text,text,jsonb,text);
--     DROP TRIGGER audit_beneficiaries ON beneficiaries;  ...  ×6
--     DROP FUNCTION audit_trigger_fn();
--     -- Restores the pre-batch (silently broken) audit state — exact-state fidelity only
-- ============================================================================
