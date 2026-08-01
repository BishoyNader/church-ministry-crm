"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import {
  createUserSchema,
  updateUserSchema,
  assignRolesSchema,
  assignStagesSchema,
  userListSchema,
} from "../schemas/user.schema";
import type {
  CreateUserFormValues,
  UpdateUserFormValues,
} from "../schemas/user.schema";
import type {
  RoleRow,
  StageRow,
  UserDetail,
  UserListResult,
} from "../types/user.types";
import * as userService from "../services/user.service";
import { ZodError } from "zod";

export type UserActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  data?: T;
};

export async function listUsersAction(
  page: number,
  pageSize: number,
  search?: string,
  roleFilter?: string,
): Promise<UserActionResult<UserListResult>> {
  try {
    userListSchema.parse({ page, pageSize, search, roleFilter });
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Invalid parameters.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      };
    }
    throw error;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_READ))) {
    return { success: false, message: "You do not have permission to view users." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const result = await userService.listUsers(supabase, profile.church_id, {
    page,
    pageSize,
    search,
    roleFilter: roleFilter as
      | "platform_owner"
      | "super_admin"
      | "admin"
      | "servant"
      | undefined,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function getUserAction(
  userId: string,
): Promise<UserActionResult<UserDetail>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_READ))) {
    return { success: false, message: "You do not have permission to view users." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const result = await userService.getUserById(supabase, profile.church_id, userId);

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function createUserAction(
  values: CreateUserFormValues,
): Promise<UserActionResult> {
  try {
    createUserSchema.parse(values);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      };
    }
    throw error;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_CREATE))) {
    return { success: false, message: "You do not have permission to create users." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const actorDetail = await userService.getUserById(supabase, profile.church_id, user.id);
  if (!(actorDetail.data?.roles.some((r) => r.role_type === "super_admin") ?? false)) {
    return { success: false, message: "Only a super admin can create users." };
  }

  const result = await userService.createUser(
    {
      email: values.email,
      password: values.password,
      full_name_ar: values.full_name_ar,
      full_name_en: values.full_name_en,
      phone: values.phone,
      preferred_locale: values.preferred_locale,
      roleIds: values.roleIds,
      stageIds: values.stageIds ?? [],
    },
    user.id,
    profile.church_id,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (result.data) {
    await writeAuditLog(supabase, "create", "user", result.data.id, undefined, {
      email: values.email,
      full_name_ar: values.full_name_ar,
      roleIds: values.roleIds,
    });
  }

  return {
    success: true,
    message: "User created successfully.",
    data: result.data,
  };
}

export async function updateUserAction(
  userId: string,
  values: UpdateUserFormValues,
): Promise<UserActionResult> {
  try {
    updateUserSchema.parse(values);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      };
    }
    throw error;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_UPDATE))) {
    return { success: false, message: "You do not have permission to update users." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const existing = await userService.getUserById(supabase, profile.church_id, userId);
  const oldValues = existing.data
    ? {
        full_name_ar: existing.data.full_name_ar,
        full_name_en: existing.data.full_name_en,
        phone: existing.data.phone,
        is_active: existing.data.is_active,
      }
    : undefined;

  const result = await userService.updateUser(supabase, userId, {
    full_name_ar: values.full_name_ar,
    full_name_en: values.full_name_en,
    phone: values.phone,
    preferred_locale: values.preferred_locale,
    is_active: values.is_active,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, "update", "user", userId, oldValues, {
    full_name_ar: values.full_name_ar,
    is_active: values.is_active,
  });

  return { success: true, message: "User updated successfully." };
}

export async function deactivateUserAction(
  userId: string,
): Promise<UserActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_DELETE))) {
    return { success: false, message: "You do not have permission to deactivate users." };
  }

  if (user.id === userId) {
    return { success: false, message: "You cannot deactivate your own account." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const existing = await userService.getUserById(supabase, profile.church_id, userId);
  if (!existing.data) {
    return { success: false, message: "User not found." };
  }

  if (existing.data.roles.some((r) => r.role_type === "super_admin")) {
    const { data: superAdminCount } = await supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("church_id", existing.data.church_id)
      .is("end_date", null)
      .eq("role_id", (
        await supabase
          .from("roles")
          .select("id")
          .eq("church_id", existing.data.church_id)
          .eq("role_type", "super_admin")
          .single()
      )?.data?.id ?? "");

    if (Number(superAdminCount ?? 0) <= 1) {
      return {
        success: false,
        message: "Cannot deactivate the last super admin.",
      };
    }
  }

  const result = await userService.deactivateUser(supabase, userId);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(
    supabase,
    "update",
    "user",
    userId,
    { is_active: true },
    { is_active: false },
  );

  return { success: true, message: "User deactivated successfully." };
}

export async function assignRolesAction(
  userId: string,
  roleIds: string[],
): Promise<UserActionResult> {
  try {
    assignRolesSchema.parse({ userId, roleIds });
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      };
    }
    throw error;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_ASSIGN))) {
    return { success: false, message: "You do not have permission to assign roles." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const actorDetail = await userService.getUserById(supabase, profile.church_id, user.id);
  if (!(actorDetail.data?.roles.some((r) => r.role_type === "super_admin") ?? false)) {
    return { success: false, message: "Only a super admin can assign roles." };
  }

  const existing = await userService.getUserById(supabase, profile.church_id, userId);
  const oldRoleIds = existing.data?.roles.map((r) => r.id) ?? [];

  const result = await userService.assignRoles(
    supabase,
    { userId, roleIds },
    user.id,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, "update", "user", userId, { roleIds: oldRoleIds }, { roleIds });

  return { success: true, message: "Roles updated successfully." };
}

export async function assignStagesAction(
  userId: string,
  stageIds: string[],
): Promise<UserActionResult> {
  try {
    assignStagesSchema.parse({ userId, stageIds });
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      };
    }
    throw error;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_ASSIGN))) {
    return { success: false, message: "You do not have permission to assign stages." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const existing = await userService.getUserById(supabase, profile.church_id, userId);
  const oldStageIds =
    existing.data?.stageAssignments.map((s) => s.stage_id) ?? [];

  const result = await userService.assignStages(
    supabase,
    { userId, stageIds },
    user.id,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(
    supabase,
    "update",
    "user",
    userId,
    { stageIds: oldStageIds },
    { stageIds },
  );

  return { success: true, message: "Stage assignments updated." };
}

export async function getRolesAction(
  churchId: string,
): Promise<UserActionResult<RoleRow[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_READ))) {
    return { success: false, message: "You do not have permission to view roles." };
  }

  const result = await userService.listRoles(supabase, churchId);
  if (result.error) {
    return { success: false, message: result.error };
  }
  return { success: true, data: result.data ?? undefined };
}

export async function getStagesAction(
  churchId: string,
): Promise<UserActionResult<StageRow[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_READ))) {
    return { success: false, message: "You do not have permission to view stages." };
  }

  const result = await userService.listStages(supabase, churchId);
  if (result.error) {
    return { success: false, message: result.error };
  }
  return { success: true, data: result.data ?? undefined };
}
