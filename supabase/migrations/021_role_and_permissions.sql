-- ============================================================================
-- Church Ministry CRM — Role & Permission Catalog Update
-- Migration: 021_role_and_permissions.sql
-- Action: Update user_role_type enum, fix permission catalog to 52 codes,
--         add 10 missing PO codes + service-level codes, drop old RLS
--         functions before CASCADE, re-seed seed_church_roles()
-- ============================================================================

-- ============================================================================
-- PART 1: UPDATE user_role_type ENUM
-- ============================================================================

-- Pre-drop old RLS helper functions that depend on the old enum
-- to prevent CASCADE from dropping them unexpectedly
DROP FUNCTION IF EXISTS get_user_role_types() CASCADE;
DROP FUNCTION IF EXISTS user_has_role(user_role_type) CASCADE;
DROP FUNCTION IF EXISTS user_has_any_role(user_role_type[]) CASCADE;
DROP FUNCTION IF EXISTS user_has_stage_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS user_is_church_admin_or_above() CASCADE;

-- Create new enum with canonical values
CREATE TYPE user_role_type_new AS ENUM ('platform_owner', 'super_admin', 'admin', 'servant');

-- Migrate roles table
ALTER TABLE roles ALTER COLUMN role_type TYPE text;
DROP TYPE user_role_type CASCADE;

-- Map old values to new
UPDATE roles SET role_type = 'admin' WHERE role_type = 'church_admin';
UPDATE roles SET role_type = 'servant' WHERE role_type IN ('stage_leader', 'servant', 'viewer');

-- Rename new type to canonical name
ALTER TYPE user_role_type_new RENAME TO user_role_type;
ALTER TABLE roles ALTER COLUMN role_type TYPE user_role_type USING role_type::user_role_type;

-- ============================================================================
-- PART 2: FIX PERMISSION CATALOG — exactly 52 codes
-- ============================================================================

-- Remove 7 extra codes not in canonical catalog
DELETE FROM permissions WHERE code IN (
  'users.create',
  'users.delete',
  'users.manage',
  'attendance.update',
  'attendance.delete',
  'notifications.create',
  'churches.manage'
);

-- Add 10 missing codes (including 9 platform_owner codes)
INSERT INTO permissions (code, name_ar, name_en, module) VALUES
  ('beneficiaries.transfer', 'نقل مخدوم', 'Transfer Beneficiary', 'beneficiaries'),
  ('tenants.create', 'إنشاء كنيسة', 'Create Tenant', 'tenants'),
  ('tenants.read', 'عرض الكنائس', 'Read Tenants', 'tenants'),
  ('tenants.update', 'تعديل كنيسة', 'Update Tenant', 'tenants'),
  ('tenants.delete', 'حذف كنيسة', 'Delete Tenant', 'tenants'),
  ('subscriptions.manage', 'إدارة الاشتراكات', 'Manage Subscriptions', 'system'),
  ('billing.read', 'عرض الفواتير', 'Read Billing', 'system'),
  ('system.metrics', 'مقاييس النظام', 'System Metrics', 'system'),
  ('system.audit', 'سجل النظام', 'System Audit', 'system'),
  ('support.manage', 'إدارة الدعم', 'Manage Support', 'system')
ON CONFLICT (code) DO NOTHING;

-- Add new service-level codes from canonical catalog
INSERT INTO permissions (code, name_ar, name_en, module) VALUES
  ('services.create', 'إنشاء خدمة', 'Create Service', 'services'),
  ('services.read', 'عرض الخدمات', 'Read Services', 'services'),
  ('services.update', 'تعديل خدمة', 'Update Service', 'services'),
  ('services.delete', 'حذف خدمة', 'Delete Service', 'services'),
  ('classes.create', 'إنشاء فصل', 'Create Class', 'classes'),
  ('classes.read', 'عرض الفصول', 'Read Classes', 'classes'),
  ('classes.update', 'تعديل فصل', 'Update Class', 'classes'),
  ('classes.delete', 'حذف فصل', 'Delete Class', 'classes'),
  ('servants.create', 'إنشاء خادم', 'Create Servant', 'servants'),
  ('servants.read', 'عرض الخدام', 'Read Servants', 'servants'),
  ('servants.update', 'تعديل خادم', 'Update Servant', 'servants'),
  ('servants.delete', 'حذف خادم', 'Delete Servant', 'servants'),
  ('servants.approve', 'الموافقة على الخدام', 'Approve Servants', 'servants'),
  ('servants.assign', 'تعيين الخدام', 'Assign Servants', 'servants'),
  ('spiritual.create', 'تسجيل يوميات روحية', 'Create Spiritual Entry', 'spiritual'),
  ('spiritual.read', 'عرض اليوميات الروحية', 'Read Spiritual Entries', 'spiritual'),
  ('import.execute', 'استيراد بيانات', 'Import Data', 'import_export'),
  ('export.execute', 'تصدير بيانات', 'Export Data', 'import_export')
ON CONFLICT (code) DO NOTHING;

-- Rename children → beneficiaries codes
UPDATE permissions SET code = 'beneficiaries.read',    name_ar = 'عرض المخدومين',  name_en = 'Read Beneficiaries'  WHERE code = 'children.read';
UPDATE permissions SET code = 'beneficiaries.create',  name_ar = 'إضافة مخدوم',     name_en = 'Create Beneficiary'  WHERE code = 'children.create';
UPDATE permissions SET code = 'beneficiaries.update',  name_ar = 'تعديل مخدوم',     name_en = 'Update Beneficiary'  WHERE code = 'children.update';
UPDATE permissions SET code = 'beneficiaries.delete',  name_ar = 'حذف مخدوم',       name_en = 'Delete Beneficiary'  WHERE code = 'children.delete';

-- Remove deprecated codes
DELETE FROM permissions WHERE code IN (
  'children.export',
  'events.read', 'events.create', 'events.update', 'events.delete',
  'documents.read', 'documents.create', 'documents.delete',
  'ai.use', 'ai.manage',
  'auth.login', 'auth.manage',
  'churches.read', 'churches.update'
);

-- ============================================================================
-- PART 3: UPDATE seed_church_roles FUNCTION
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
