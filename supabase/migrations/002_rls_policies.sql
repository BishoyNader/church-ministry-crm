-- ============================================================================
-- Church Ministry CRM — Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- ============================================================================

ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stage_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE spiritual_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PERMISSIONS (Global — read only)
-- ============================================================================

CREATE POLICY "permissions_select_authenticated"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- CHURCHES
-- ============================================================================

CREATE POLICY "churches_select_own"
  ON churches FOR SELECT
  TO authenticated
  USING (id = get_user_church_id());

CREATE POLICY "churches_update_admin"
  ON churches FOR UPDATE
  TO authenticated
  USING (id = get_user_church_id() AND user_is_church_admin_or_above())
  WITH CHECK (id = get_user_church_id() AND user_is_church_admin_or_above());

CREATE POLICY "churches_insert_signup"
  ON churches FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- MINISTRIES
-- ============================================================================

CREATE POLICY "ministries_select"
  ON ministries FOR SELECT TO authenticated
  USING (church_id = get_user_church_id() AND deleted_at IS NULL);

CREATE POLICY "ministries_insert"
  ON ministries FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('stages.create'));

CREATE POLICY "ministries_update"
  ON ministries FOR UPDATE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('stages.update'))
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('stages.update'));

CREATE POLICY "ministries_delete"
  ON ministries FOR DELETE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('stages.delete'));

-- ============================================================================
-- STAGES
-- ============================================================================

CREATE POLICY "stages_select"
  ON stages FOR SELECT TO authenticated
  USING (church_id = get_user_church_id() AND deleted_at IS NULL);

CREATE POLICY "stages_insert"
  ON stages FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('stages.create'));

CREATE POLICY "stages_update"
  ON stages FOR UPDATE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('stages.update'))
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('stages.update'));

CREATE POLICY "stages_delete"
  ON stages FOR DELETE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('stages.delete'));

-- ============================================================================
-- PROFILES
-- ============================================================================

CREATE POLICY "profiles_select"
  ON profiles FOR SELECT TO authenticated
  USING (church_id = get_user_church_id() AND deleted_at IS NULL);

CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('users.create'));

CREATE POLICY "profiles_update_self"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('users.update'))
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('users.update'));

CREATE POLICY "profiles_delete"
  ON profiles FOR DELETE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('users.delete') AND id != auth.uid());

-- ============================================================================
-- ROLES
-- ============================================================================

CREATE POLICY "roles_select"
  ON roles FOR SELECT TO authenticated
  USING (church_id = get_user_church_id());

CREATE POLICY "roles_insert"
  ON roles FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_is_church_admin_or_above() AND is_system = false);

CREATE POLICY "roles_update"
  ON roles FOR UPDATE TO authenticated
  USING (church_id = get_user_church_id() AND user_is_church_admin_or_above() AND is_system = false)
  WITH CHECK (church_id = get_user_church_id() AND is_system = false);

CREATE POLICY "roles_delete"
  ON roles FOR DELETE TO authenticated
  USING (church_id = get_user_church_id() AND user_is_church_admin_or_above() AND is_system = false);

-- ============================================================================
-- ROLE PERMISSIONS
-- ============================================================================

CREATE POLICY "role_permissions_select"
  ON role_permissions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM roles r WHERE r.id = role_permissions.role_id AND r.church_id = get_user_church_id()
  ));

CREATE POLICY "role_permissions_insert"
  ON role_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM roles r WHERE r.id = role_permissions.role_id
      AND r.church_id = get_user_church_id() AND user_is_church_admin_or_above()
  ));

CREATE POLICY "role_permissions_delete"
  ON role_permissions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM roles r WHERE r.id = role_permissions.role_id
      AND r.church_id = get_user_church_id() AND user_is_church_admin_or_above()
  ));

-- ============================================================================
-- USER ROLES
-- ============================================================================

CREATE POLICY "user_roles_select"
  ON user_roles FOR SELECT TO authenticated
  USING (church_id = get_user_church_id());

CREATE POLICY "user_roles_insert"
  ON user_roles FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('users.manage'));

CREATE POLICY "user_roles_delete"
  ON user_roles FOR DELETE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('users.manage'));

-- ============================================================================
-- USER STAGE ASSIGNMENTS
-- ============================================================================

CREATE POLICY "user_stage_assignments_select"
  ON user_stage_assignments FOR SELECT TO authenticated
  USING (church_id = get_user_church_id());

CREATE POLICY "user_stage_assignments_insert"
  ON user_stage_assignments FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('users.manage'));

CREATE POLICY "user_stage_assignments_delete"
  ON user_stage_assignments FOR DELETE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('users.manage'));

-- ============================================================================
-- CHILDREN
-- ============================================================================

CREATE POLICY "children_select"
  ON children FOR SELECT TO authenticated
  USING (
    church_id = get_user_church_id() AND deleted_at IS NULL
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id))
  );

CREATE POLICY "children_insert"
  ON children FOR INSERT TO authenticated
  WITH CHECK (
    church_id = get_user_church_id() AND user_has_permission('children.create')
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id))
  );

CREATE POLICY "children_update"
  ON children FOR UPDATE TO authenticated
  USING (
    church_id = get_user_church_id() AND user_has_permission('children.update')
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id))
  )
  WITH CHECK (
    church_id = get_user_church_id()
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id))
  );

CREATE POLICY "children_delete"
  ON children FOR DELETE TO authenticated
  USING (
    church_id = get_user_church_id() AND user_has_permission('children.delete')
    AND user_is_church_admin_or_above()
  );

-- ============================================================================
-- ATTENDANCE
-- ============================================================================

CREATE POLICY "attendance_select"
  ON attendance FOR SELECT TO authenticated
  USING (
    church_id = get_user_church_id()
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id))
  );

CREATE POLICY "attendance_insert"
  ON attendance FOR INSERT TO authenticated
  WITH CHECK (
    church_id = get_user_church_id() AND user_has_permission('attendance.create')
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id))
  );

CREATE POLICY "attendance_update"
  ON attendance FOR UPDATE TO authenticated
  USING (
    church_id = get_user_church_id() AND user_has_permission('attendance.update')
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id))
  )
  WITH CHECK (
    church_id = get_user_church_id()
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id))
  );

CREATE POLICY "attendance_delete"
  ON attendance FOR DELETE TO authenticated
  USING (
    church_id = get_user_church_id() AND user_has_permission('attendance.delete')
    AND user_is_church_admin_or_above()
  );

-- ============================================================================
-- FOLLOW-UPS (Phase 2)
-- ============================================================================

CREATE POLICY "followups_select"
  ON followups FOR SELECT TO authenticated
  USING (
    church_id = get_user_church_id()
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id))
  );

CREATE POLICY "followups_insert"
  ON followups FOR INSERT TO authenticated
  WITH CHECK (
    church_id = get_user_church_id() AND user_has_permission('followups.create')
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id))
  );

CREATE POLICY "followups_update"
  ON followups FOR UPDATE TO authenticated
  USING (
    church_id = get_user_church_id() AND user_has_permission('followups.update')
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id) OR assigned_to = auth.uid())
  )
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "followups_delete"
  ON followups FOR DELETE TO authenticated
  USING (
    church_id = get_user_church_id() AND user_has_permission('followups.delete')
    AND user_is_church_admin_or_above()
  );

-- ============================================================================
-- SPIRITUAL RECORDS
-- ============================================================================

CREATE POLICY "spiritual_records_select"
  ON spiritual_records FOR SELECT TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('children.read'));

CREATE POLICY "spiritual_records_insert"
  ON spiritual_records FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('children.update'));

CREATE POLICY "spiritual_records_update"
  ON spiritual_records FOR UPDATE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('children.update'))
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "spiritual_records_delete"
  ON spiritual_records FOR DELETE TO authenticated
  USING (
    church_id = get_user_church_id() AND user_has_permission('children.delete')
    AND user_is_church_admin_or_above()
  );

-- ============================================================================
-- EVENTS (Phase 2)
-- ============================================================================

CREATE POLICY "events_select"
  ON events FOR SELECT TO authenticated
  USING (church_id = get_user_church_id() AND deleted_at IS NULL);

CREATE POLICY "events_insert"
  ON events FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('events.create'));

CREATE POLICY "events_update"
  ON events FOR UPDATE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('events.update'))
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "events_delete"
  ON events FOR DELETE TO authenticated
  USING (
    church_id = get_user_church_id() AND user_has_permission('events.delete')
    AND user_is_church_admin_or_above()
  );

-- ============================================================================
-- EVENT REGISTRATIONS (Phase 2)
-- ============================================================================

CREATE POLICY "event_registrations_select"
  ON event_registrations FOR SELECT TO authenticated
  USING (church_id = get_user_church_id());

CREATE POLICY "event_registrations_insert"
  ON event_registrations FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('events.create'));

CREATE POLICY "event_registrations_update"
  ON event_registrations FOR UPDATE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('events.update'))
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "event_registrations_delete"
  ON event_registrations FOR DELETE TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('events.delete'));

-- ============================================================================
-- NOTIFICATIONS (Phase 2)
-- ============================================================================

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT TO authenticated
  USING (church_id = get_user_church_id() AND user_id = auth.uid());

CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('notifications.create'));

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (church_id = get_user_church_id() AND user_id = auth.uid())
  WITH CHECK (church_id = get_user_church_id() AND user_id = auth.uid());

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE POLICY "audit_logs_select"
  ON audit_logs FOR SELECT TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('audit.read'));

CREATE POLICY "audit_logs_insert"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id());

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

CREATE POLICY "documents_select"
  ON documents FOR SELECT TO authenticated
  USING (
    church_id = get_user_church_id() AND deleted_at IS NULL
    AND user_has_permission('documents.read')
  );

CREATE POLICY "documents_insert"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('documents.create'));

CREATE POLICY "documents_delete"
  ON documents FOR DELETE TO authenticated
  USING (
    church_id = get_user_church_id() AND user_has_permission('documents.delete')
    AND user_is_church_admin_or_above()
  );

-- ============================================================================
-- AI CONVERSATIONS (Phase 3)
-- ============================================================================

CREATE POLICY "ai_conversations_select_own"
  ON ai_conversations FOR SELECT TO authenticated
  USING (church_id = get_user_church_id() AND user_id = auth.uid());

CREATE POLICY "ai_conversations_insert"
  ON ai_conversations FOR INSERT TO authenticated
  WITH CHECK (
    church_id = get_user_church_id() AND user_id = auth.uid()
    AND user_has_permission('ai.use')
  );

CREATE POLICY "ai_conversations_update_own"
  ON ai_conversations FOR UPDATE TO authenticated
  USING (church_id = get_user_church_id() AND user_id = auth.uid())
  WITH CHECK (church_id = get_user_church_id() AND user_id = auth.uid());

CREATE POLICY "ai_conversations_delete_own"
  ON ai_conversations FOR DELETE TO authenticated
  USING (church_id = get_user_church_id() AND user_id = auth.uid());

-- ============================================================================
-- AI MESSAGES (Phase 3)
-- ============================================================================

CREATE POLICY "ai_messages_select"
  ON ai_messages FOR SELECT TO authenticated
  USING (
    church_id = get_user_church_id()
    AND EXISTS (
      SELECT 1 FROM ai_conversations ac
      WHERE ac.id = ai_messages.conversation_id AND ac.user_id = auth.uid()
    )
  );

CREATE POLICY "ai_messages_insert"
  ON ai_messages FOR INSERT TO authenticated
  WITH CHECK (
    church_id = get_user_church_id()
    AND EXISTS (
      SELECT 1 FROM ai_conversations ac
      WHERE ac.id = ai_messages.conversation_id AND ac.user_id = auth.uid()
    )
  );

-- ============================================================================
-- DOCUMENT EMBEDDINGS (Phase 3)
-- ============================================================================

CREATE POLICY "document_embeddings_select"
  ON document_embeddings FOR SELECT TO authenticated
  USING (church_id = get_user_church_id() AND user_has_permission('ai.use'));

CREATE POLICY "document_embeddings_insert"
  ON document_embeddings FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id() AND user_has_permission('ai.manage'));
