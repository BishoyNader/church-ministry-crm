"use server";

import { createClient } from "@/lib/supabase/server";
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

async function auditLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  await supabase.from("audit_logs").insert({
    church_id: profile.church_id,
    user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues ?? null,
    new_values: newValues ?? null,
  });
}

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

  const result = await userService.listUsers({
    page,
    pageSize,
    search,
    roleFilter: roleFilter as
      | "super_admin"
      | "church_admin"
      | "stage_leader"
      | "servant"
      | "viewer"
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
  const result = await userService.getUserById(userId);

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
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (result.data) {
    await auditLog(supabase, "create", "user", result.data.id, undefined, {
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

  const existing = await userService.getUserById(userId);
  const oldValues = existing.data
    ? {
        full_name_ar: existing.data.full_name_ar,
        full_name_en: existing.data.full_name_en,
        phone: existing.data.phone,
        is_active: existing.data.is_active,
      }
    : undefined;

  const result = await userService.updateUser(userId, {
    full_name_ar: values.full_name_ar,
    full_name_en: values.full_name_en,
    phone: values.phone,
    preferred_locale: values.preferred_locale,
    is_active: values.is_active,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await auditLog(supabase, "update", "user", userId, oldValues, {
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

  if (user.id === userId) {
    return { success: false, message: "You cannot deactivate your own account." };
  }

  const existing = await userService.getUserById(userId);
  if (!existing.data) {
    return { success: false, message: "User not found." };
  }

  if (existing.data.roles.some((r) => r.role_type === "super_admin")) {
    const { data: superAdminCount } = await supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("church_id", existing.data.church_id)
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

  const result = await userService.deactivateUser(userId);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await auditLog(
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

  const existing = await userService.getUserById(userId);
  const oldRoleIds = existing.data?.roles.map((r) => r.id) ?? [];

  const result = await userService.assignRoles(
    { userId, roleIds },
    user.id,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  await auditLog(supabase, "update", "user", userId, { roleIds: oldRoleIds }, { roleIds });

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

  const existing = await userService.getUserById(userId);
  const oldStageIds =
    existing.data?.stageAssignments.map((s) => s.stage_id) ?? [];

  const result = await userService.assignStages(
    { userId, stageIds },
    user.id,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  await auditLog(
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
  const result = await userService.listRoles(churchId);
  if (result.error) {
    return { success: false, message: result.error };
  }
  return { success: true, data: result.data ?? undefined };
}

export async function getStagesAction(
  churchId: string,
): Promise<UserActionResult<StageRow[]>> {
  const result = await userService.listStages(churchId);
  if (result.error) {
    return { success: false, message: result.error };
  }
  return { success: true, data: result.data ?? undefined };
}
