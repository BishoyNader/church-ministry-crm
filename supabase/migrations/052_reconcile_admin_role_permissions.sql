-- ============================================================================
-- Church Ministry CRM — Reconcile System-Role Permissions to Canonical Seed
-- Migration: 052_reconcile_admin_role_permissions.sql
-- Action:
--   The canonical permission lists for the system admin role (الكاهن المسؤول /
--   أمين القطاع) and stage_manager role (أمين المرحلة) live in
--   seed_church_roles() (045/050/051). Roles provisioned BEFORE those lists
--   were finalized keep a legacy permission set: on the staging database the
--   admin role was missing 'services.read' (the الخدمات nav/route gate),
--   'servants.read', 'servants.update', 'servants.assign',
--   'beneficiaries.transfer', 'classes.read', 'import.execute' and
--   'export.execute'; the spiritual.* codes were granted later by 051. This
--   migration reconciles EVERY existing system admin/stage_manager role to the
--   canonical lists — additive only (INSERT ... ON CONFLICT DO NOTHING), so no
--   existing grants are removed and legacy extras (e.g. audit.read) are
--   preserved.
-- Dependencies: 021 (permissions), 045/050/051 (seed_church_roles canonical
--   lists), role_permissions PK (role_id, permission_id).
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — Admin role (matches the 051 seed_church_roles admin list)
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.code IN (
    'users.read', 'users.update',
    'beneficiaries.read', 'beneficiaries.create', 'beneficiaries.update', 'beneficiaries.transfer',
    'services.read', 'services.update', 'services.delete',
    'stages.read', 'stages.create', 'stages.update',
    'classes.read', 'classes.create', 'classes.update', 'classes.delete',
    'servants.read', 'servants.create', 'servants.update', 'servants.assign',
    'attendance.read', 'attendance.create', 'attendance.export',
    'followups.read', 'followups.create', 'followups.update', 'followups.delete',
    'spiritual.read', 'spiritual.create',
    'reports.read', 'reports.export',
    'notifications.read',
    'settings.read', 'settings.update',
    'import.execute', 'export.execute',
    'events.read', 'events.create', 'events.update', 'events.delete'
  )
WHERE r.role_type = 'admin'
  AND r.is_system = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 2 — Stage Manager role (matches the 051 seed_church_roles stage_manager
--   list — note spiritual.* is intentionally NOT part of the stage manager
--   surface; stage managers only see their own journal unless explicitly
--   granted by the church)
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.code IN (
    'beneficiaries.read', 'beneficiaries.create', 'beneficiaries.update', 'beneficiaries.transfer',
    'attendance.read', 'attendance.create', 'attendance.export',
    'followups.read', 'followups.create', 'followups.update', 'followups.delete',
    'services.read', 'stages.read', 'classes.read',
    'servants.read',
    'notifications.read',
    'reports.read',
    'events.read'
  )
WHERE r.role_type = 'stage_manager'
  AND r.is_system = true
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB)
-- V1 — Every system admin role holds the full canonical set:
--   SELECT r.role_type, count(*) AS granted
--   FROM role_permissions rp
--   JOIN roles r ON r.id = rp.role_id
--   WHERE r.is_system = true AND r.role_type IN ('admin', 'stage_manager')
--   GROUP BY r.role_type;
--   -- admin → 40, stage_manager → 17 (any surplus = preserved legacy extras).
-- V2 — The specific staging gap is closed:
--   SELECT p.code FROM role_permissions rp
--   JOIN roles r ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id
--   WHERE r.role_type = 'admin' AND r.is_system = true
--     AND p.code IN ('services.read', 'servants.read', 'beneficiaries.transfer',
--                    'import.execute', 'export.execute');
--   -- All five rows present per admin role.
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   (No-op: this migration is purely additive. Reverting means manually
--   deleting the grants it added, which is not recommended.)
-- ============================================================================
