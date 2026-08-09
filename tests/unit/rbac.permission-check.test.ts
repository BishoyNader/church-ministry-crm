import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from "@/features/rbac/utils/permission-check";
import type { Permission } from "@/features/rbac/types/rbac.types";

vi.mock("@/features/rbac/services/rbac.server", () => ({
  checkUserPermissions: vi.fn(),
}));

import { checkUserPermissions } from "@/features/rbac/services/rbac.server";

const mockedCheck = vi.mocked(checkUserPermissions);

beforeEach(() => {
  mockedCheck.mockReset();
});

const permission = (code: string): Permission =>
  ({
    id: `id-${code}`,
    code,
    name_ar: code,
    name_en: code,
    module: "test",
    description_ar: null,
    created_at: "2026-01-01T00:00:00Z",
  }) as Permission;

describe("hasPermission", () => {
  it("returns true when the permission is granted", async () => {
    mockedCheck.mockResolvedValue({
      data: {
        hasPermission: true,
        permissions: [permission("beneficiaries.read")],
        roles: [],
      },
      error: null,
    });

    await expect(hasPermission("beneficiaries.read")).resolves.toBe(true);
  });

  it("returns false when the permission is not granted", async () => {
    mockedCheck.mockResolvedValue({
      data: {
        hasPermission: false,
        permissions: [permission("beneficiaries.read")],
        roles: [],
      },
      error: null,
    });

    await expect(hasPermission("beneficiaries.update")).resolves.toBe(false);
  });

  it("returns false when the RBAC service reports an error", async () => {
    mockedCheck.mockResolvedValue({
      data: null,
      error: { code: "service-error", message: "boom" },
    });

    await expect(hasPermission("beneficiaries.read")).resolves.toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns true when at least one permission is held", async () => {
    mockedCheck.mockResolvedValue({
      data: {
        hasPermission: false,
        permissions: [permission("attendance.read")],
        roles: [],
      },
      error: null,
    });

    await expect(
      hasAnyPermission(["reports.read", "attendance.read"]),
    ).resolves.toBe(true);
  });

  it("returns false when none of the permissions are held", async () => {
    mockedCheck.mockResolvedValue({
      data: {
        hasPermission: false,
        permissions: [permission("attendance.read")],
        roles: [],
      },
      error: null,
    });

    await expect(hasAnyPermission(["reports.read", "settings.read"])).resolves.toBe(
      false,
    );
  });

  it("returns false for an empty permission list without a service call", async () => {
    await expect(hasAnyPermission([])).resolves.toBe(false);
    expect(mockedCheck).not.toHaveBeenCalled();
  });
});

describe("hasAllPermissions", () => {
  it("returns true when every permission is held", async () => {
    mockedCheck.mockResolvedValue({
      data: {
        hasPermission: false,
        permissions: [permission("reports.read"), permission("settings.read")],
        roles: [],
      },
      error: null,
    });

    await expect(
      hasAllPermissions(["reports.read", "settings.read"]),
    ).resolves.toBe(true);
  });

  it("returns false when any permission is missing", async () => {
    mockedCheck.mockResolvedValue({
      data: {
        hasPermission: false,
        permissions: [permission("reports.read")],
        roles: [],
      },
      error: null,
    });

    await expect(
      hasAllPermissions(["reports.read", "settings.read"]),
    ).resolves.toBe(false);
  });

  it("returns true for an empty list without a service call", async () => {
    await expect(hasAllPermissions([])).resolves.toBe(true);
    expect(mockedCheck).not.toHaveBeenCalled();
  });
});
