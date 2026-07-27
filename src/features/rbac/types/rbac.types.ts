import type { PermissionCode } from "../constants/permissions";

export type Role = {
  id: string;
  church_id: string;
  role_type: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type Permission = {
  id: string;
  code: PermissionCode;
  name_ar: string;
  name_en: string | null;
  module: string;
  description_ar: string | null;
  created_at: string;
};

export type RolePermission = {
  id?: string;
  role_id: string;
  permission_id: string;
  created_at?: string;
};

export type UserRole = {
  id?: string;
  church_id: string;
  user_id: string;
  role_id: string;
  assigned_by?: string | null;
  created_at?: string;
};

export type UserPermissionsResult = {
  permissions: Permission[];
  roles: Role[];
};

export type PermissionCheckResult = {
  hasPermission: boolean;
  permissions: Permission[];
  roles: Role[];
};

export type RbacErrorCode = "unauthorized" | "forbidden" | "not-found" | "service-error";

export type RbacError = {
  message: string;
  code: RbacErrorCode;
};

export type NormalizedRbacState = {
  roles: Role[];
  permissions: Permission[];
  userRoles: UserRole[];
  rolePermissions: RolePermission[];
};
