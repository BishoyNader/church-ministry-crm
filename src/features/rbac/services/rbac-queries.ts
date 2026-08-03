import type { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionCode } from "../constants/permissions";
import type { NormalizedRbacState, Permission, PermissionCheckResult, RbacError, Role, UserRole } from "../types/rbac.types";

const RBAC_ERROR_MESSAGES = {
  unauthorized: "You are not authorized to view this content.",
  forbidden: "You do not have the required permission.",
  "not-found": "The requested RBAC data could not be found.",
  "service-error": "Unable to load RBAC information right now.",
} as const;

export function toRbacError(code: keyof typeof RBAC_ERROR_MESSAGES, message?: string): RbacError {
  return {
    code,
    message: message ?? RBAC_ERROR_MESSAGES[code],
  };
}

export async function loadCurrentUserRbac(
  supabase: SupabaseClient,
  churchId?: string,
): Promise<{ data: NormalizedRbacState | null; error: RbacError | null }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: null, error: toRbacError("unauthorized") };
    }

    let query = supabase.from("user_roles").select("id, church_id, user_id, role_id, assigned_by, created_at").eq("user_id", user.id).is("end_date", null);

    if (churchId) {
      query = query.eq("church_id", churchId);
    }

    const { data: userRolesData, error: userRolesError } = await query;

    if (userRolesError) {
      return { data: null, error: toRbacError("service-error", userRolesError.message) };
    }

    const userRoles = (userRolesData ?? []) as UserRole[];

    if (userRoles.length === 0) {
      return {
        data: {
          roles: [],
          permissions: [],
          userRoles: [],
          rolePermissions: [],
        },
        error: null,
      };
    }

    const roleIds = userRoles.map((item) => item.role_id);
    const { data: rolesData, error: rolesError } = await supabase
      .from("roles")
      .select("id, church_id, role_type, name_ar, name_en, description_ar, is_system, created_at, updated_at")
      .in("id", roleIds);

    if (rolesError) {
      return { data: null, error: toRbacError("service-error", rolesError.message) };
    }

    const roles = (rolesData ?? []) as Role[];

    const { data: rolePermissionsData, error: rolePermissionsError } = await supabase
      .from("role_permissions")
      .select("id, role_id, permission_id, created_at")
      .in("role_id", roleIds);

    if (rolePermissionsError) {
      return { data: null, error: toRbacError("service-error", rolePermissionsError.message) };
    }

    const rolePermissions = (rolePermissionsData ?? []) as Array<{ id: string; role_id: string; permission_id: string; created_at: string }>;

    const permissionIds = Array.from(new Set(rolePermissions.map((item) => item.permission_id).filter(Boolean)));

    const { data: permissionsData, error: permissionsError } = permissionIds.length
      ? await supabase.from("permissions").select("id, code, name_ar, name_en, module, description_ar, created_at").in("id", permissionIds)
      : { data: [], error: null };

    if (permissionsError) {
      return { data: null, error: toRbacError("service-error", permissionsError.message) };
    }

    const permissions = (permissionsData ?? []) as Permission[];

    return {
      data: {
        roles,
        permissions,
        userRoles,
        rolePermissions,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: toRbacError("service-error", error instanceof Error ? error.message : undefined) };
  }
}

export async function getPermissionsByRole(supabase: SupabaseClient, roleId: string): Promise<{ data: Permission[] | null; error: RbacError | null }> {
  try {
    const { data: rolePermissionsData, error: rolePermissionsError } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);

    if (rolePermissionsError) {
      return { data: null, error: toRbacError("service-error", rolePermissionsError.message) };
    }

    const permissionIds = Array.from(new Set((rolePermissionsData ?? []).map((item) => item.permission_id).filter(Boolean)));

    if (permissionIds.length === 0) {
      return { data: [], error: null };
    }

    const { data: permissionsData, error: permissionsError } = await supabase
      .from("permissions")
      .select("id, code, name_ar, name_en, module, description_ar, created_at")
      .in("id", permissionIds);

    if (permissionsError) {
      return { data: null, error: toRbacError("service-error", permissionsError.message) };
    }

    return { data: (permissionsData ?? []) as Permission[], error: null };
  } catch (error) {
    return { data: null, error: toRbacError("service-error", error instanceof Error ? error.message : undefined) };
  }
}

export async function checkUserPermission(
  supabase: SupabaseClient,
  permissionCode: PermissionCode,
  churchId?: string,
): Promise<{ data: PermissionCheckResult | null; error: RbacError | null }> {
  const result = await loadCurrentUserRbac(supabase, churchId);
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
}

export async function checkUserPermissions(
  supabase: SupabaseClient,
  permissionCodes: readonly PermissionCode[],
  churchId?: string,
): Promise<{ data: PermissionCheckResult | null; error: RbacError | null }> {
  const result = await loadCurrentUserRbac(supabase, churchId);
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  const permissionSet = new Set(result.data.permissions.map((permission) => permission.code));
  const permissions = permissionCodes.filter((permissionCode) => permissionSet.has(permissionCode));

  return {
    data: {
      hasPermission: permissions.length === permissionCodes.length,
      permissions: result.data.permissions,
      roles: result.data.roles,
    },
    error: null,
  };
}

export async function getRolesByUser(supabase: SupabaseClient, userId: string, churchId?: string): Promise<{ data: Role[] | null; error: RbacError | null }> {
  try {
    let query = supabase.from("user_roles").select("role_id").eq("user_id", userId).is("end_date", null);

    if (churchId) {
      query = query.eq("church_id", churchId);
    }

    const { data: userRolesData, error } = await query;

    if (error) {
      return { data: null, error: toRbacError("service-error", error.message) };
    }

    const roleIds = Array.from(new Set((userRolesData ?? []).map((item) => item.role_id).filter(Boolean)));

    if (roleIds.length === 0) {
      return { data: [], error: null };
    }

    const { data: rolesData, error: rolesError } = await supabase
      .from("roles")
      .select("id, church_id, role_type, name_ar, name_en, description_ar, is_system, created_at, updated_at")
      .in("id", roleIds);

    if (rolesError) {
      return { data: null, error: toRbacError("service-error", rolesError.message) };
    }

    return { data: (rolesData ?? []) as Role[], error: null };
  } catch (error) {
    return { data: null, error: toRbacError("service-error", error instanceof Error ? error.message : undefined) };
  }
}
