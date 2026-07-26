-- ============================================================================
-- Church Ministry CRM — Permission Catalog Seed
-- Migration: 003_seed_permissions.sql
-- ============================================================================

INSERT INTO permissions (code, name_ar, name_en, module) VALUES
  -- Auth
  ('auth.login', 'تسجيل الدخول', 'Login', 'auth'),
  ('auth.manage', 'إدارة المصادقة', 'Manage Auth', 'auth'),

  -- Churches
  ('churches.read', 'عرض الكنيسة', 'View Church', 'churches'),
  ('churches.update', 'تعديل الكنيسة', 'Update Church', 'churches'),
  ('churches.manage', 'إدارة الكنيسة', 'Manage Church', 'churches'),

  -- Users
  ('users.read', 'عرض المستخدمين', 'View Users', 'users'),
  ('users.create', 'إضافة مستخدم', 'Create User', 'users'),
  ('users.update', 'تعديل مستخدم', 'Update User', 'users'),
  ('users.delete', 'حذف مستخدم', 'Delete User', 'users'),
  ('users.manage', 'إدارة الأدوار والتعيينات', 'Manage Roles & Assignments', 'users'),

  -- Stages
  ('stages.read', 'عرض المراحل', 'View Stages', 'stages'),
  ('stages.create', 'إضافة مرحلة', 'Create Stage', 'stages'),
  ('stages.update', 'تعديل مرحلة', 'Update Stage', 'stages'),
  ('stages.delete', 'حذف مرحلة', 'Delete Stage', 'stages'),

  -- Children
  ('children.read', 'عرض الأطفال', 'View Children', 'children'),
  ('children.create', 'إضافة طفل', 'Create Child', 'children'),
  ('children.update', 'تعديل طفل', 'Update Child', 'children'),
  ('children.delete', 'حذف طفل', 'Delete Child', 'children'),
  ('children.export', 'تصدير بيانات الأطفال', 'Export Children', 'children'),

  -- Attendance
  ('attendance.read', 'عرض الحضور', 'View Attendance', 'attendance'),
  ('attendance.create', 'تسجيل حضور', 'Record Attendance', 'attendance'),
  ('attendance.update', 'تعديل حضور', 'Update Attendance', 'attendance'),
  ('attendance.delete', 'حذف حضور', 'Delete Attendance', 'attendance'),
  ('attendance.export', 'تصدير الحضور', 'Export Attendance', 'attendance'),

  -- Follow-ups
  ('followups.read', 'عرض المتابعات', 'View Follow-ups', 'followups'),
  ('followups.create', 'إضافة متابعة', 'Create Follow-up', 'followups'),
  ('followups.update', 'تعديل متابعة', 'Update Follow-up', 'followups'),
  ('followups.delete', 'حذف متابعة', 'Delete Follow-up', 'followups'),

  -- Events
  ('events.read', 'عرض الفعاليات', 'View Events', 'events'),
  ('events.create', 'إضافة فعالية', 'Create Event', 'events'),
  ('events.update', 'تعديل فعالية', 'Update Event', 'events'),
  ('events.delete', 'حذف فعالية', 'Delete Event', 'events'),

  -- Notifications
  ('notifications.read', 'عرض الإشعارات', 'View Notifications', 'notifications'),
  ('notifications.create', 'إرسال إشعار', 'Send Notification', 'notifications'),
  ('notifications.manage', 'إدارة الإشعارات', 'Manage Notifications', 'notifications'),

  -- Reports
  ('reports.read', 'عرض التقارير', 'View Reports', 'reports'),
  ('reports.export', 'تصدير التقارير', 'Export Reports', 'reports'),

  -- Documents
  ('documents.read', 'عرض المستندات', 'View Documents', 'documents'),
  ('documents.create', 'رفع مستند', 'Upload Document', 'documents'),
  ('documents.delete', 'حذف مستند', 'Delete Document', 'documents'),

  -- AI
  ('ai.use', 'استخدام المساعد الذكي', 'Use AI Copilot', 'ai'),
  ('ai.manage', 'إدارة المساعد الذكي', 'Manage AI', 'ai'),

  -- Audit
  ('audit.read', 'عرض سجل المراجعة', 'View Audit Log', 'audit'),

  -- Settings
  ('settings.read', 'عرض الإعدادات', 'View Settings', 'settings'),
  ('settings.update', 'تعديل الإعدادات', 'Update Settings', 'settings')

ON CONFLICT (code) DO NOTHING;
