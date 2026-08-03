import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PermissionCode } from "../constants/permissions";
import type { PermissionCheckResult, RbacError } from "../types/rbac.types";
import { loadCurrentUserRbac, toRbacError } from "./rbac-queries";

// Memoizes the full RBAC load for the current request so that repeated
// hasPermission / checkUserPermission calls inside one server action chain
// reuse a single database round trip instead of re-fetching user_roles,
// roles, role_permissions and permissions on every call.
const loadServerRbac = cache(async (churchId?: string) => {
  const supabase = await createClient();
  return loadCurrentUserRbac(supabase, churchId);
});

export async function checkUserPermission(permissionCode: PermissionCode, churchId?: string): Promise<{ data: PermissionCheckResult | null; error: RbacError | null }> {
  try {
    const result = await loadServerRbac(churchId);
    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    const permissionSet = new Set(result.data.permissions.map((permission) => permission.code));

    return {
      data: {
        hasPermission: permissionSet.has(permissionCode),
        permissions: result.data.permissions,
        roles: result.data.roles,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: toRbacError("service-error", error instanceof Error ? error.message : undefined) };
  }
}

export async function checkUserPermissions(permissionCodes: readonly PermissionCode[], churchId?: string): Promise<{ data: PermissionCheckResult | null; error: RbacError | null }> {
  try {
    const result = await loadServerRbac(churchId);
    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    const permissionSet = new Set(result.data.permissions.map((permission) => permission.code));
    const granted = permissionCodes.filter((permissionCode) => permissionSet.has(permissionCode));

    return {
      data: {
        hasPermission: granted.length === permissionCodes.length,
        permissions: result.data.permissions,
        roles: result.data.roles,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: toRbacError("service-error", error instanceof Error ? error.message : undefined) };
  }
}
