-- ============================================================================
-- Church Ministry CRM — Billing Permission Seeds
-- Migration: 058_billing_permissions.sql
-- Action: Add billing-related permissions that were defined in TypeScript
--         but not yet seeded in the database.
-- ============================================================================

INSERT INTO permissions (code, name_ar, name_en, module) VALUES
  ('billing.read', 'عرض الفواتير', 'View Billing', 'billing'),
  ('billing.manage', 'إدارة الفواتير', 'Manage Billing', 'billing'),
  ('subscriptions.read', 'عرض الاشتراكات', 'View Subscriptions', 'subscriptions'),
  ('subscriptions.manage', 'إدارة الاشتراكات', 'Manage Subscriptions', 'subscriptions'),
  ('refunds.read', 'عرض طلبات الاسترداد', 'View Refunds', 'refunds'),
  ('refunds.manage', 'إدارة طلبات الاسترداد', 'Manage Refunds', 'refunds')
ON CONFLICT (code) DO NOTHING;

-- Assign billing permissions to platform_owner role (global, church_id IS NULL)
-- and super_admin role (per-church).
DO $$
DECLARE
  v_platform_owner_role_id uuid;
  v_permission_ids uuid[];
BEGIN
  -- Find platform_owner role (global)
  SELECT id INTO v_platform_owner_role_id
  FROM roles
  WHERE role_type = 'platform_owner'
    AND church_id IS NULL
  LIMIT 1;

  IF v_platform_owner_role_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_permission_ids
    FROM permissions
    WHERE code IN ('billing.read', 'billing.manage', 'subscriptions.read', 'subscriptions.manage', 'refunds.read', 'refunds.manage');

    IF v_permission_ids IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT v_platform_owner_role_id, unnest(v_permission_ids)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END IF;
END $$;
