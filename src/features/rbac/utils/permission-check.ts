import type { PermissionCode } from "../constants/permissions";
import { checkUserPermissions } from "../services/rbac.service";

export async function hasPermission(permission: PermissionCode): Promise<boolean> {
  const { data, error } = await checkUserPermissions([permission]);
  if (error) {
    return false;
  }

  return data?.hasPermission ?? false;
}

export async function hasAnyPermission(permissions: readonly PermissionCode[]): Promise<boolean> {
  if (permissions.length === 0) {
    return false;
  }

  const { data, error } = await checkUserPermissions(permissions);
  if (error) {
    return false;
  }

  const permissionSet = new Set(data?.permissions.map((permission) => permission.code) ?? []);
  return permissions.some((permission) => permissionSet.has(permission));
}

export async function hasAllPermissions(permissions: readonly PermissionCode[]): Promise<boolean> {
  if (permissions.length === 0) {
    return true;
  }

  const { data, error } = await checkUserPermissions(permissions);
  if (error) {
    return false;
  }

  const permissionSet = new Set(data?.permissions.map((permission) => permission.code) ?? []);
  return permissions.every((permission) => permissionSet.has(permission));
}
