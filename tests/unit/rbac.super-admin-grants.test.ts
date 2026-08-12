import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import type { PermissionCode } from "@/features/rbac/constants/permissions";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATION_054 = path.join(
  ROOT,
  "supabase/migrations/054_reconcile_super_admin_permissions.sql",
);

/**
 * Regression guard for the staging blocker where the system super_admin
 * (مدير الكنيسة) role was missing 13 canonical permission codes. Because the
 * frontend loads permissions strictly from role_permissions (loadCurrentUserRbac),
 * a missing code hides the corresponding nav tab AND fails the page's server
 * action — so الخدمات (services.read), الجدول الروحي (spiritual.read) and the
 * attendance service dropdown (services.read via listServicesAction) all broke
 * for the real Church Manager, while الترقية (settings.update) kept working.
 *
 * Migration 054 replicates the canonical seed_church_roles() grant:
 *   INSERT INTO role_permissions (role_id, permission_id)
 *   SELECT r.id, p.id FROM roles r
 *   JOIN permissions p ON p.module NOT IN ('tenants', 'system')
 *   WHERE r.role_type = 'super_admin' AND r.is_system = true
 *   ON CONFLICT DO NOTHING;
 *
 * These tests fail if:
 *   - migration 054 is deleted or stops granting super_admin every non-platform
 *     module, OR
 *   - a new nav-gate permission is added to the app without being part of the
 *     canonical super_admin surface.
 */
describe("super_admin (مدير الكنيسة) canonical permission surface", () => {
  const migrationSql = readFileSync(MIGRATION_054, "utf8");

  it("migration 054 exists and grants super_admin all non-platform modules", () => {
    expect(migrationSql).toContain("role_type = 'super_admin'");
    expect(migrationSql).toContain("is_system = true");
    expect(migrationSql).toContain("ON CONFLICT DO NOTHING");
    // The grant must come from the permissions catalog (module-based), never a
    // hand-maintained inline list that can silently drift from seed_church_roles.
    expect(migrationSql).toMatch(/p\.module NOT IN \('tenants', 'system'\)/);
  });

  it("every nav-gate permission resolves to a real catalog code", () => {
    // Permission codes that the app-shell nav renders only when the actor holds
    // them. Any one of these missing from super_admin would hide a tab.
    const navGateCodes: PermissionCode[] = [
      PERMISSION_CODES.SERVICES_READ,
      PERMISSION_CODES.STAGES_READ,
      PERMISSION_CODES.SPIRITUAL_READ,
      PERMISSION_CODES.SPIRITUAL_CREATE,
      PERMISSION_CODES.ATTENDANCE_READ,
      PERMISSION_CODES.ATTENDANCE_CREATE,
      PERMISSION_CODES.BENEFICIARIES_READ,
      PERMISSION_CODES.SERVANTS_READ,
      PERMISSION_CODES.CLASSES_READ,
      PERMISSION_CODES.EVENTS_READ,
      PERMISSION_CODES.NOTIFICATIONS_READ,
      PERMISSION_CODES.REPORTS_READ,
      PERMISSION_CODES.SETTINGS_READ,
      PERMISSION_CODES.SETTINGS_UPDATE,
      PERMISSION_CODES.USERS_READ,
    ];

    // Structural sanity: every nav gate resolves to a real catalog code.
    for (const code of navGateCodes) {
      expect(
        Object.values(PERMISSION_CODES),
        `nav gate '${code}' must exist in PERMISSION_CODES`,
      ).toContain(code);
    }
  });

  it("migration 054 keeps the module-based grant (no inline code drift)", () => {
    // The module-based grant (all codes except tenants/system) is the canonical
    // definition and matches seed_church_roles(). A hand-maintained inline
    // `WHERE code IN (...)` list is how the gap first appeared — guard against
    // it silently reappearing.
    expect(migrationSql).toMatch(/JOIN permissions p\s+ON p\.module NOT IN \('tenants', 'system'\)/);
    // A hand-maintained inline code list (the JOIN form used by migration 052
    // for admin/stage_manager) is exactly how the super_admin gap slipped
    // through — the super_admin grant must stay module-based.
    expect(migrationSql).not.toMatch(/JOIN permissions p\s+ON p\.code IN \('/);

    // The codes that regressed on staging must resolve in the catalog.
    const regressionCodes: PermissionCode[] = [
      PERMISSION_CODES.SERVICES_READ,
      PERMISSION_CODES.SERVICES_CREATE,
      PERMISSION_CODES.SERVICES_UPDATE,
      PERMISSION_CODES.SERVICES_DELETE,
      PERMISSION_CODES.SPIRITUAL_READ,
      PERMISSION_CODES.SPIRITUAL_CREATE,
      PERMISSION_CODES.SERVANTS_READ,
      PERMISSION_CODES.SERVANTS_ASSIGN,
      PERMISSION_CODES.SERVANTS_CREATE,
      PERMISSION_CODES.BENEFICIARIES_TRANSFER,
      PERMISSION_CODES.CLASSES_READ,
      PERMISSION_CODES.IMPORT_EXECUTE,
      PERMISSION_CODES.EXPORT_EXECUTE,
    ];
    for (const code of regressionCodes) {
      expect(
        Object.values(PERMISSION_CODES),
        `regression-guard code '${code}' must exist in PERMISSION_CODES`,
      ).toContain(code);
    }
  });
});
