-- ============================================================================
-- Church Ministry CRM — RLS Implementation
-- Migration: 022_rls_implementation.sql
-- Action: Create 8 canonical helper functions, drop old policies,
--         enable RLS on all tables, create 89 policies per RLS_SPEC,
--         in single transaction
-- ============================================================================

-- ============================================================================
-- PHASE 1: HELPER FUNCTIONS per CANONICAL_RLS_SPEC.md §1
-- ============================================================================

-- Auth context
CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS uuid AS $$
  SELECT church_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_servant_id()
RETURNS uuid AS $$
  SELECT id FROM servants WHERE id = auth.uid() AND deleted_at IS NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Role checks
CREATE OR REPLACE FUNCTION user_is_platform_owner()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type = 'platform_owner'
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_is_super_admin(p_church_id uuid DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := COALESCE(p_church_id, get_user_church_id());
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type = 'super_admin'
      AND ur.church_id = v_church_id
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_is_admin(p_church_id uuid DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := COALESCE(p_church_id, get_user_church_id());
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type IN ('super_admin', 'admin')
      AND ur.church_id = v_church_id
      AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Scope resolution
CREATE OR REPLACE FUNCTION get_user_service_ids()
RETURNS uuid[] AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_super_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM services WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.service_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND ssa.end_date IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_stage_ids()
RETURNS uuid[] AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_super_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM stages WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.stage_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND ssa.end_date IS NULL
      AND ssa.stage_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_class_ids()
RETURNS uuid[] AS $$
DECLARE
  v_church_id uuid;
BEGIN
  v_church_id := get_user_church_id();
  IF v_church_id IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  IF user_is_super_admin(v_church_id) THEN
    RETURN ARRAY(SELECT id FROM classes WHERE church_id = v_church_id AND deleted_at IS NULL);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT ssa.class_id
    FROM servant_stage_assignments ssa
    WHERE ssa.servant_id = auth.uid()
      AND ssa.is_active = true
      AND ssa.end_date IS NULL
      AND ssa.class_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_assigned_beneficiary_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY(
    SELECT ba.beneficiary_id
    FROM beneficiary_assignments ba
    WHERE ba.servant_id = auth.uid()
      AND ba.is_current = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- PHASE 2: RLS POLICIES per CANONICAL_RLS_SPEC.md §2
-- ============================================================================

BEGIN;

-- Drop all existing policies first
DO $$ DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT schemaname, tablename, policyname
    FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END $$;

-- Enable RLS on all tables (idempotent)
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE servants ENABLE ROW LEVEL SECURITY;
ALTER TABLE servant_stage_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiary_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE spiritual_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- churches (3 policies)
CREATE POLICY tenant_read ON churches FOR SELECT USING (id = get_user_church_id());
CREATE POLICY platform_owner_all ON churches FOR ALL USING (user_is_platform_owner());
CREATE POLICY super_admin_update ON churches FOR UPDATE USING (id = get_user_church_id() AND user_is_super_admin(id));

-- services (4 policies)
CREATE POLICY tenant_isolation ON services FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON services FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON services FOR SELECT USING (id = ANY(get_user_service_ids()));
CREATE POLICY admin_write ON services FOR ALL USING (church_id = get_user_church_id() AND user_is_admin(church_id));

-- stages (4 policies)
CREATE POLICY tenant_isolation ON stages FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON stages FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON stages FOR SELECT USING (service_id = ANY(get_user_service_ids()));
CREATE POLICY admin_write ON stages FOR ALL USING (church_id = get_user_church_id() AND user_is_admin(church_id));

-- classes (4 policies)
CREATE POLICY tenant_isolation ON classes FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON classes FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON classes FOR SELECT USING (stage_id = ANY(get_user_stage_ids()));
CREATE POLICY admin_write ON classes FOR ALL USING (church_id = get_user_church_id() AND user_is_admin(church_id));

-- profiles (4 policies)
CREATE POLICY tenant_isolation ON profiles FOR SELECT USING (church_id = get_user_church_id());
CREATE POLICY own_profile_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY own_profile_update ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY super_admin_all ON profiles FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_scoped ON profiles FOR SELECT USING (user_is_admin(church_id) AND church_id = get_user_church_id());

-- servants (3 policies)
CREATE POLICY tenant_isolation ON servants FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON servants FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON servants FOR SELECT USING (
  church_id = get_user_church_id()
  AND (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM servant_stage_assignments ssa
      WHERE ssa.servant_id = servants.id
        AND ssa.service_id = ANY(get_user_service_ids())
        AND ssa.is_active = true
        AND ssa.end_date IS NULL
    )
  )
);

-- servant_stage_assignments (5 policies)
CREATE POLICY tenant_isolation ON servant_stage_assignments FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON servant_stage_assignments FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON servant_stage_assignments FOR SELECT USING (user_is_admin(church_id) OR service_id = ANY(get_user_service_ids()));
CREATE POLICY admin_write ON servant_stage_assignments FOR ALL USING (user_is_admin(church_id));
CREATE POLICY own_read ON servant_stage_assignments FOR SELECT USING (servant_id = auth.uid());

-- beneficiaries (5 policies)
CREATE POLICY tenant_isolation ON beneficiaries FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON beneficiaries FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON beneficiaries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM beneficiary_assignments ba
    WHERE ba.beneficiary_id = beneficiaries.id
      AND ba.service_id = ANY(get_user_service_ids())
      AND ba.is_current = true
  )
);
CREATE POLICY servant_read ON beneficiaries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM beneficiary_assignments ba
    WHERE ba.beneficiary_id = beneficiaries.id
      AND ba.is_current = true
      AND (
        ba.servant_id = auth.uid()
        OR (
          ba.stage_id = ANY(get_user_stage_ids())
          AND EXISTS (
            SELECT 1 FROM servant_stage_assignments ssa
            WHERE ssa.servant_id = auth.uid()
              AND ssa.stage_id = ba.stage_id
              AND ssa.role IN ('stage_leader', 'class_leader')
              AND ssa.is_active = true
              AND ssa.end_date IS NULL
          )
        )
        OR (
          ba.class_id = ANY(get_user_class_ids())
          AND EXISTS (
            SELECT 1 FROM servant_stage_assignments ssa
            WHERE ssa.servant_id = auth.uid()
              AND ssa.class_id = ba.class_id
              AND ssa.is_active = true
              AND ssa.end_date IS NULL
          )
        )
      )
  )
);
CREATE POLICY admin_write ON beneficiaries FOR ALL USING (user_is_admin(church_id));

-- beneficiary_assignments (6 policies)
CREATE POLICY tenant_isolation ON beneficiary_assignments FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON beneficiary_assignments FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON beneficiary_assignments FOR SELECT USING (service_id = ANY(get_user_service_ids()));
CREATE POLICY admin_write ON beneficiary_assignments FOR INSERT WITH CHECK (user_is_admin(church_id));
CREATE POLICY own_read ON beneficiary_assignments FOR SELECT USING (servant_id = auth.uid() AND is_current = true);
CREATE POLICY immutable_update ON beneficiary_assignments FOR UPDATE USING (false);
CREATE POLICY immutable_delete ON beneficiary_assignments FOR DELETE USING (false);

-- attendance_sessions (4 policies)
CREATE POLICY tenant_isolation ON attendance_sessions FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON attendance_sessions FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON attendance_sessions FOR SELECT USING (service_id = ANY(get_user_service_ids()));
CREATE POLICY stage_scope_insert ON attendance_sessions FOR INSERT WITH CHECK (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()));
CREATE POLICY stage_scope_select ON attendance_sessions FOR SELECT USING (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()));

-- attendance_records (4 policies)
CREATE POLICY tenant_isolation ON attendance_records FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON attendance_records FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY session_scope ON attendance_records FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM attendance_sessions WHERE id = session_id
    AND (stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()))
  )
);
CREATE POLICY record_attendance ON attendance_records FOR INSERT WITH CHECK (church_id = get_user_church_id() AND recorded_by = auth.uid());

-- followups (4 policies)
CREATE POLICY tenant_isolation ON followups FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON followups FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY admin_read ON followups FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM beneficiary_assignments ba
    WHERE ba.beneficiary_id = followups.beneficiary_id
      AND ba.service_id = ANY(get_user_service_ids())
      AND ba.is_current = true
  )
);
CREATE POLICY own_all ON followups FOR ALL USING (servant_id = auth.uid());

-- spiritual_journal_entries (4 policies)
CREATE POLICY tenant_isolation ON spiritual_journal_entries FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY servant_owner ON spiritual_journal_entries FOR ALL USING (servant_id = auth.uid());
CREATE POLICY priest_read ON spiritual_journal_entries FOR SELECT USING (user_is_super_admin(church_id));
CREATE POLICY deny_admin_spiritual ON spiritual_journal_entries AS RESTRICTIVE FOR ALL
  USING (NOT (user_is_admin(church_id) AND NOT user_is_super_admin(church_id)));

-- notifications (3 policies)
CREATE POLICY tenant_isolation ON notifications FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY recipient_scope ON notifications FOR ALL USING (recipient_id = auth.uid());
CREATE POLICY super_admin_read ON notifications FOR SELECT USING (user_is_super_admin(church_id));

-- audit_logs (5 policies)
CREATE POLICY tenant_isolation ON audit_logs FOR SELECT USING (church_id = get_user_church_id());
CREATE POLICY super_admin_read ON audit_logs FOR SELECT USING (user_is_super_admin(church_id));
CREATE POLICY platform_owner_read ON audit_logs FOR SELECT USING (user_is_platform_owner());
CREATE POLICY append_only ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY immutable_update ON audit_logs FOR UPDATE USING (false);
CREATE POLICY immutable_delete ON audit_logs FOR DELETE USING (false);

-- roles (3 policies)
CREATE POLICY tenant_isolation ON roles FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON roles FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY read_all ON roles FOR SELECT USING (church_id = get_user_church_id());

-- permissions (2 policies)
CREATE POLICY read_all ON permissions FOR SELECT USING (true);
CREATE POLICY platform_owner_write ON permissions FOR ALL USING (user_is_platform_owner());

-- role_permissions (3 policies)
CREATE POLICY tenant_isolation ON role_permissions FOR ALL USING (
  role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())
);
CREATE POLICY super_admin_all ON role_permissions FOR ALL USING (user_is_super_admin(get_user_church_id()));
CREATE POLICY read_all ON role_permissions FOR SELECT USING (
  role_id IN (SELECT id FROM roles WHERE church_id = get_user_church_id())
);

-- user_roles (4 policies)
CREATE POLICY tenant_isolation ON user_roles FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON user_roles FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY own_read ON user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY admin_read ON user_roles FOR SELECT USING (user_is_admin(church_id));

-- events (4 policies)
CREATE POLICY tenant_isolation ON events FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON events FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY stage_scope ON events FOR SELECT USING (
  stage_id = ANY(get_user_stage_ids())
  OR service_id = ANY(get_user_service_ids())
);

-- event_registrations (3 policies)
CREATE POLICY tenant_isolation ON event_registrations FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON event_registrations FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY servant_scope ON event_registrations FOR SELECT USING (
  beneficiary_id IN (
    SELECT beneficiary_id FROM beneficiary_assignments
    WHERE servant_id = auth.uid() AND is_current = true
  )
);

-- documents (3 policies)
CREATE POLICY tenant_isolation ON documents FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY super_admin_all ON documents FOR ALL USING (user_is_super_admin(church_id));
CREATE POLICY owner_scope ON documents FOR ALL USING (uploaded_by = auth.uid());

-- ai_conversations (2 policies)
CREATE POLICY tenant_isolation ON ai_conversations FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY owner_scope ON ai_conversations FOR ALL USING (user_id = auth.uid());

-- ai_messages (2 policies)
CREATE POLICY tenant_isolation ON ai_messages FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY owner_scope ON ai_messages FOR ALL USING (
  conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid())
);

-- document_embeddings (2 policies)
CREATE POLICY tenant_isolation ON document_embeddings FOR ALL USING (church_id = get_user_church_id());
CREATE POLICY owner_scope ON document_embeddings FOR ALL USING (
  document_id IN (SELECT id FROM documents WHERE uploaded_by = auth.uid())
);

COMMIT;
