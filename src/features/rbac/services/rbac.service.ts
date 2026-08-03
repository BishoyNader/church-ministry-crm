import { createClient } from "@/lib/supabase/client";
import type { Permission, PermissionCheckResult, Role, RbacError, UserPermissionsResult } from "../types/rbac.types";
import type { PermissionCode } from "../constants/permissions";
import {
  checkUserPermission as checkUserPermissionWithClient,
  checkUserPermissions as checkUserPermissionsWithClient,
  getPermissionsByRole as getPermissionsByRoleWithClient,
  getRolesByUser as getRolesByUserWithClient,
  loadCurrentUserRbac,
} from "./rbac-queries";

export async function getCurrentUserRoles(churchId?: string): Promise<{ data: Role[] | null; error: RbacError | null }> {
  const result = await loadCurrentUserRbac(createClient(), churchId);
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  return { data: result.data.roles, error: null };
}

export async function getCurrentUserPermissions(churchId?: string): Promise<{ data: UserPermissionsResult | null; error: RbacError | null }> {
  return getCurrentUserAccessState(churchId);
}

export async function getCurrentUserAccessState(churchId?: string): Promise<{ data: UserPermissionsResult | null; error: RbacError | null }> {
  const result = await loadCurrentUserRbac(createClient(), churchId);
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  return {
    data: {
      permissions: result.data.permissions,
      roles: result.data.roles,
    },
    error: null,
  };
}

export async function getPermissionsByRole(roleId: string): Promise<{ data: Permission[] | null; error: RbacError | null }> {
  return getPermissionsByRoleWithClient(createClient(), roleId);
}

export async function checkUserPermission(permissionCode: PermissionCode, churchId?: string): Promise<{ data: PermissionCheckResult | null; error: RbacError | null }> {
  return checkUserPermissionWithClient(createClient(), permissionCode, churchId);
}

export async function checkUserPermissions(permissionCodes: readonly PermissionCode[], churchId?: string): Promise<{ data: PermissionCheckResult | null; error: RbacError | null }> {
  return checkUserPermissionsWithClient(createClient(), permissionCodes, churchId);
}

export async function getRolesByUser(userId: string, churchId?: string): Promise<{ data: Role[] | null; error: RbacError | null }> {
  return getRolesByUserWithClient(createClient(), userId, churchId);
}
