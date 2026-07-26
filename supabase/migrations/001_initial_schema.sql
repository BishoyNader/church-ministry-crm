-- ============================================================================
-- Church Ministry CRM — Initial Schema Migration
-- Migration: 001_initial_schema.sql
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE user_role_type AS ENUM (
  'super_admin',
  'church_admin',
  'stage_leader',
  'servant',
  'viewer'
);

CREATE TYPE gender_type AS ENUM ('male', 'female');

CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused');

CREATE TYPE followup_type AS ENUM (
  'phone_call',
  'home_visit',
  'whatsapp',
  'church_meeting',
  'other'
);

CREATE TYPE followup_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE child_status AS ENUM (
  'active',
  'inactive',
  'transferred',
  'graduated'
);

CREATE TYPE event_type AS ENUM (
  'meeting',
  'camp',
  'conference',
  'trip',
  'other'
);

CREATE TYPE event_registration_status AS ENUM (
  'registered',
  'confirmed',
  'cancelled',
  'attended'
);

CREATE TYPE notification_type AS ENUM ('in_app', 'email');

CREATE TYPE notification_channel AS ENUM (
  'absence_alert',
  'followup_reminder',
  'birthday',
  'event_reminder',
  'system'
);

CREATE TYPE pipeline_stage_type AS ENUM (
  'new_visitor',
  'first_followup',
  'regular_attendee',
  'active_member',
  'leader_candidate'
);

CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'export',
  'ai_action'
);

CREATE TYPE document_entity_type AS ENUM (
  'child',
  'event',
  'church',
  'user'
);

CREATE TYPE spiritual_record_type AS ENUM (
  'baptism',
  'confession',
  'communion',
  'prayer',
  'other'
);

CREATE TYPE ai_message_role AS ENUM (
  'user',
  'assistant',
  'system',
  'tool'
);

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GLOBAL TABLES
-- ============================================================================

CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name_ar     text NOT NULL,
  name_en     text,
  module      text NOT NULL,
  description_ar text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- TENANT ROOT
-- ============================================================================

CREATE TABLE churches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     text NOT NULL,
  name_en     text,
  slug        text NOT NULL UNIQUE,
  logo_url    text,
  settings    jsonb NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_churches_slug ON churches (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_churches_active ON churches (is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_churches_updated_at
  BEFORE UPDATE ON churches
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- ORGANIZATION STRUCTURE
-- ============================================================================

CREATE TABLE ministries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  name_ar         text NOT NULL,
  name_en         text,
  description_ar  text,
  description_en  text,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_ministries_church ON ministries (church_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ministries_church_active ON ministries (church_id, is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_ministries_updated_at
  BEFORE UPDATE ON ministries
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TABLE stages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  ministry_id     uuid NOT NULL REFERENCES ministries (id) ON DELETE CASCADE,
  name_ar         text NOT NULL,
  name_en         text,
  description_ar  text,
  description_en  text,
  age_min         integer,
  age_max         integer,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_stages_church ON stages (church_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stages_church_ministry ON stages (church_id, ministry_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stages_church_active ON stages (church_id, is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_stages_updated_at
  BEFORE UPDATE ON stages
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- USERS & AUTHORIZATION
-- ============================================================================

CREATE TABLE profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  church_id         uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  email             text,
  phone             text,
  full_name_ar      text NOT NULL,
  full_name_en      text,
  avatar_url        text,
  preferred_locale  text NOT NULL DEFAULT 'ar',
  is_active         boolean NOT NULL DEFAULT true,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX idx_profiles_church ON profiles (church_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_church_email ON profiles (church_id, email) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_church_phone ON profiles (church_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_church_active ON profiles (church_id, is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TABLE roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  role_type       user_role_type NOT NULL,
  name_ar         text NOT NULL,
  name_en         text,
  description_ar  text,
  is_system       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (church_id, role_type)
);

CREATE INDEX idx_roles_church ON roles (church_id);

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TABLE role_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_id   uuid NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions (role_id);

CREATE TABLE user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (church_id, user_id, role_id)
);

CREATE INDEX idx_user_roles_church_user ON user_roles (church_id, user_id);
CREATE INDEX idx_user_roles_user ON user_roles (user_id);

CREATE TABLE user_stage_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  stage_id    uuid NOT NULL REFERENCES stages (id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (church_id, user_id, stage_id)
);

CREATE INDEX idx_user_stage_assignments_church_user ON user_stage_assignments (church_id, user_id);
CREATE INDEX idx_user_stage_assignments_church_stage ON user_stage_assignments (church_id, stage_id);

-- ============================================================================
-- CHILDREN
-- ============================================================================

CREATE TABLE children (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id               uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  ministry_id             uuid NOT NULL REFERENCES ministries (id),
  stage_id                uuid NOT NULL REFERENCES stages (id),
  pipeline_stage          pipeline_stage_type NOT NULL DEFAULT 'new_visitor',
  first_name_ar           text NOT NULL,
  last_name_ar            text NOT NULL,
  first_name_en           text,
  last_name_en            text,
  date_of_birth           date,
  gender                  gender_type,
  photo_url               text,
  father_name_ar          text,
  mother_name_ar          text,
  parent_phone            text,
  parent_email            text,
  parent_address_ar       text,
  mobile                  text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  baptism_date            date,
  confession_frequency    text,
  spiritual_notes         text,
  medical_conditions      text,
  allergies               text,
  medications             text,
  school_name_ar          text,
  grade_level             text,
  status                  child_status NOT NULL DEFAULT 'active',
  enrolled_at             date NOT NULL DEFAULT CURRENT_DATE,
  notes                   text,
  created_by              uuid REFERENCES profiles (id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

CREATE INDEX idx_children_church ON children (church_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_children_church_stage ON children (church_id, stage_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_children_church_ministry ON children (church_id, ministry_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_children_church_status ON children (church_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_children_name ON children (church_id, last_name_ar, first_name_ar) WHERE deleted_at IS NULL;
CREATE INDEX idx_children_mobile ON children (church_id, mobile) WHERE deleted_at IS NULL AND mobile IS NOT NULL;
CREATE INDEX idx_children_parent_phone ON children (church_id, parent_phone) WHERE deleted_at IS NULL AND parent_phone IS NOT NULL;
CREATE INDEX idx_children_pipeline ON children (church_id, pipeline_stage) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_children_updated_at
  BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- ATTENDANCE
-- ============================================================================

CREATE TABLE attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  child_id        uuid NOT NULL REFERENCES children (id) ON DELETE CASCADE,
  stage_id        uuid NOT NULL REFERENCES stages (id),
  attendance_date date NOT NULL,
  status          attendance_status NOT NULL,
  notes           text,
  recorded_by     uuid NOT NULL REFERENCES profiles (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (church_id, child_id, attendance_date)
);

CREATE INDEX idx_attendance_church_date ON attendance (church_id, attendance_date);
CREATE INDEX idx_attendance_church_stage_date ON attendance (church_id, stage_id, attendance_date);
CREATE INDEX idx_attendance_child_date ON attendance (child_id, attendance_date DESC);

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- FOLLOW-UPS (Phase 2)
-- ============================================================================

CREATE TABLE followups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  child_id      uuid NOT NULL REFERENCES children (id) ON DELETE CASCADE,
  stage_id      uuid NOT NULL REFERENCES stages (id),
  type          followup_type NOT NULL,
  status        followup_status NOT NULL DEFAULT 'scheduled',
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  assigned_to   uuid REFERENCES profiles (id),
  notes         text,
  outcome       text,
  created_by    uuid NOT NULL REFERENCES profiles (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_followups_church_child ON followups (church_id, child_id);
CREATE INDEX idx_followups_church_assigned ON followups (church_id, assigned_to, status);
CREATE INDEX idx_followups_church_scheduled ON followups (church_id, scheduled_at);

CREATE TRIGGER trg_followups_updated_at
  BEFORE UPDATE ON followups
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- SPIRITUAL RECORDS
-- ============================================================================

CREATE TABLE spiritual_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  child_id      uuid NOT NULL REFERENCES children (id) ON DELETE CASCADE,
  record_type   spiritual_record_type NOT NULL,
  record_date   date NOT NULL,
  notes         text,
  recorded_by   uuid NOT NULL REFERENCES profiles (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_spiritual_records_church_child ON spiritual_records (church_id, child_id);
CREATE INDEX idx_spiritual_records_child_date ON spiritual_records (child_id, record_date DESC);

CREATE TRIGGER trg_spiritual_records_updated_at
  BEFORE UPDATE ON spiritual_records
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- EVENTS (Phase 2)
-- ============================================================================

CREATE TABLE events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  ministry_id     uuid REFERENCES ministries (id),
  stage_id        uuid REFERENCES stages (id),
  title_ar        text NOT NULL,
  title_en        text,
  description_ar  text,
  description_en  text,
  event_type      event_type NOT NULL,
  location_ar     text,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz,
  capacity        integer,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid NOT NULL REFERENCES profiles (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_events_church_start ON events (church_id, start_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_church_type ON events (church_id, event_type) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TABLE event_registrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  event_id        uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  child_id        uuid NOT NULL REFERENCES children (id) ON DELETE CASCADE,
  status          event_registration_status NOT NULL DEFAULT 'registered',
  registered_by   uuid REFERENCES profiles (id),
  registered_at   timestamptz NOT NULL DEFAULT now(),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, child_id)
);

CREATE INDEX idx_event_registrations_church_event ON event_registrations (church_id, event_id);
CREATE INDEX idx_event_registrations_child ON event_registrations (child_id);

CREATE TRIGGER trg_event_registrations_updated_at
  BEFORE UPDATE ON event_registrations
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- NOTIFICATIONS (Phase 2)
-- ============================================================================

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  channel     notification_channel NOT NULL,
  title_ar    text NOT NULL,
  title_en    text,
  body_ar     text NOT NULL,
  body_en     text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  read_at     timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_church_user_read ON notifications (church_id, user_id, read_at);
CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid REFERENCES churches (id) ON DELETE SET NULL,
  user_id     uuid REFERENCES profiles (id) ON DELETE SET NULL,
  action      audit_action NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  old_values  jsonb,
  new_values  jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_church_created ON audit_logs (church_id, created_at DESC);
CREATE INDEX idx_audit_logs_church_entity ON audit_logs (church_id, entity_type, entity_id);
CREATE INDEX idx_audit_logs_user_created ON audit_logs (user_id, created_at DESC);

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  entity_type document_entity_type NOT NULL,
  entity_id   uuid NOT NULL,
  file_name   text NOT NULL,
  file_path   text NOT NULL,
  mime_type   text NOT NULL,
  file_size   bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_documents_church_entity ON documents (church_id, entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_church_uploader ON documents (church_id, uploaded_by) WHERE deleted_at IS NULL;

-- ============================================================================
-- AI (Phase 3)
-- ============================================================================

CREATE TABLE ai_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_conversations_church_user ON ai_conversations (church_id, user_id, updated_at DESC);

CREATE TRIGGER trg_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TABLE ai_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES ai_conversations (id) ON DELETE CASCADE,
  church_id         uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  role              ai_message_role NOT NULL,
  content           text NOT NULL,
  citations         jsonb NOT NULL DEFAULT '[]',
  tool_calls        jsonb NOT NULL DEFAULT '[]',
  tokens_used       integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages (conversation_id, created_at);

CREATE TABLE document_embeddings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     uuid NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  document_id   uuid REFERENCES documents (id) ON DELETE SET NULL,
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  chunk_index   integer NOT NULL,
  content       text NOT NULL,
  embedding     vector(1536) NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_embeddings_church_entity ON document_embeddings (church_id, entity_type, entity_id);

-- IVFFlat index for vector similarity search (create after seeding data in production)
-- CREATE INDEX idx_document_embeddings_vector ON document_embeddings
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS uuid AS $$
  SELECT church_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role_types()
RETURNS user_role_type[] AS $$
  SELECT ARRAY_AGG(r.role_type)
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_role(required_role user_role_type)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type = required_role
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_any_role(required_roles user_role_type[])
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.role_type = ANY(required_roles)
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_permission(permission_code text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.code = permission_code
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_stage_access(target_stage_id uuid)
RETURNS boolean AS $$
  SELECT
    user_has_any_role(ARRAY['super_admin', 'church_admin']::user_role_type[])
    OR EXISTS (
      SELECT 1
      FROM user_stage_assignments usa
      WHERE usa.user_id = auth.uid()
        AND usa.stage_id = target_stage_id
    )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_is_church_admin_or_above()
RETURNS boolean AS $$
  SELECT user_has_any_role(ARRAY['super_admin', 'church_admin']::user_role_type[])
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- AUDIT LOG FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION write_audit_log(
  p_church_id uuid,
  p_action audit_action,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO audit_logs (church_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (p_church_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_old_values, p_new_values)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CHURCH BOOTSTRAP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_church_roles(p_church_id uuid)
RETURNS void AS $$
DECLARE
  v_role_id uuid;
BEGIN
  -- Super Admin role (all permissions)
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'super_admin', 'مدير النظام', 'Super Admin', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions;

  -- Church Admin role
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'church_admin', 'مدير الكنيسة', 'Church Admin', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code NOT LIKE 'churches.%';

  -- Stage Leader role
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'stage_leader', 'قائد المرحلة', 'Stage Leader', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code IN (
    'children.read', 'children.create', 'children.update',
    'attendance.read', 'attendance.create', 'attendance.update',
    'followups.read', 'followups.create', 'followups.update',
    'stages.read', 'users.read',
    'events.read', 'events.create', 'events.update',
    'reports.read', 'reports.export',
    'documents.read', 'documents.create'
  );

  -- Servant role
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'servant', 'خادم', 'Servant', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code IN (
    'children.read', 'children.update',
    'attendance.read', 'attendance.create', 'attendance.update',
    'followups.read', 'followups.create',
    'stages.read', 'events.read',
    'documents.read'
  );

  -- Viewer role
  INSERT INTO roles (church_id, role_type, name_ar, name_en, is_system)
  VALUES (p_church_id, 'viewer', 'مشاهد', 'Viewer', true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM permissions
  WHERE code LIKE '%.read';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUTH TRIGGER: Create profile on signup
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Profile creation is handled by the signup Server Action
  -- which also creates the church and assigns super_admin role.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- AUDIT TRIGGERS (Phase 1 entities)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_church_id uuid;
  v_action audit_action;
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

  INSERT INTO audit_logs (church_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (
    v_church_id,
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_old,
    v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_children
  AFTER INSERT OR UPDATE OR DELETE ON children
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_attendance
  AFTER INSERT OR UPDATE OR DELETE ON attendance
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
