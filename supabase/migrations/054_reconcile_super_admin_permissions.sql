-- ============================================================================
-- Church Ministry CRM — Reconcile System super_admin (مدير الكنيسة) Permissions
-- Migration: 054_reconcile_super_admin_permissions.sql
-- Action:
--   seed_church_roles() (044/045/050/051) grants the system super_admin role
--   (مدير الكنيسة / Church Manager) EVERY permission whose module is not
--   platform-only:
--
--       INSERT INTO role_permissions (role_id, permission_id)
--       SELECT v_role_id, id FROM permissions
--       WHERE module NOT IN ('tenants', 'system');
--
--   Roles provisioned BEFORE that definition was finalized keep a legacy
--   permission list. On the staging database the system super_admin role had
--   only 28 codes and was MISSING 13 canonical ones, including:
--     services.read | services.create | services.update | services.delete
--     spiritual.read | spiritual.create
--     servants.read | servants.assign | servants.create
--     beneficiaries.transfer | classes.read | import.execute | export.execute
--   Those exact codes gate the الخدمات nav + /services route (services.read),
--   the الجدول الروحي nav + route (spiritual.read) AND the attendance page's
--   service/stage dropdowns (listServicesAction requires services.read) — so
--   the real Church Manager account could not see الخدمات / الجدول الروحي and
--   could not record attendance, while الترقية worked (its gate is
--   settings.update, which was already granted). Migration 052 reconciled
--   admin and stage_manager roles but omitted super_admin — this migration
--   closes that gap.
--
--   Semantics: additive-only (INSERT ... ON CONFLICT DO NOTHING). No existing
--   grants are removed; tenant/platform RLS, RPC guards and the permission
--   model are untouched.
-- Dependencies: 021 (permissions), 045/050/051 (seed_church_roles canonical
--   definition), role_permissions PK (role_id, permission_id).
-- ============================================================================

BEGIN;

-- Match the canonical super_admin grant from seed_church_roles exactly:
-- all permissions except platform-only modules.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.module NOT IN ('tenants', 'system')
WHERE r.role_type = 'super_admin'
  AND r.is_system = true
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply; run against the live DB)
-- V1 — No canonical gaps remain for ANY system super_admin role:
--   SELECT r.role_type, r.name_ar, count(*) AS granted
--   FROM role_permissions rp
--   JOIN roles r ON r.id = rp.role_id
--   WHERE r.is_system = true AND r.role_type = 'super_admin'
--   GROUP BY r.role_type, r.name_ar;
--   -- granted should equal the count of permissions with module NOT IN
--   -- ('tenants','system') in the same database.
-- V2 — The specific staging gaps are closed:
--   SELECT p.code FROM role_permissions rp
--   JOIN roles r ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id
--   WHERE r.role_type = 'super_admin' AND r.is_system = true
--     AND p.code IN ('services.read', 'spiritual.read', 'spiritual.create',
--                    'servants.read', 'servants.assign', 'classes.read',
--                    'import.execute', 'export.execute')
--   ORDER BY p.code;
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   No-op: purely additive. Reverting requires manually deleting the grants
--   added here, which is not recommended.
-- ============================================================================
