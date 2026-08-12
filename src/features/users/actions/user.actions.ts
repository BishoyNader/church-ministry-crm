"use server";

import { hasPermission, hasAnyPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import {
  createUserSchema,
  updateUserSchema,
  assignRolesSchema,
  assignStagesSchema,
  assignServicesSchema,
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
import * as userExportService from "../services/user-export.service";
import type { UserRoleType } from "../types/user.types";
import { ZodError } from "zod";
import {
  resolveActorContext,
  dataClientFor,
  writeUserAudit,
  assertUserAdminPermission,
  resolveUserManagementChurch,
} from "./context";
import type { ActorContext } from "./context";

export type UserActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  data?: T;
};

const CREATE_USER_ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "You are not allowed to create users for this church.",
  church_not_found: "The selected church is not available.",
  roles_required: "At least one role is required.",
  role_not_in_church: "A selected role does not belong to this church.",
  stage_not_in_church: "A selected stage does not belong to this church.",
  service_not_in_church: "A selected service does not belong to this church.",
  auth_user_not_found: "The user account could not be provisioned.",
  auth_user_email_mismatch: "The account email does not match the request.",
  email_already_registered: "An account already exists for this email.",
  cannot_assign_manager_role:
    "You cannot assign the Church Manager role. Contact the Platform Owner to change the Church Manager.",
  service_required: "A service assignment is required for this role.",
  stage_manager_single_service: "A stage manager must be assigned to exactly one service.",
  servant_single_service: "A servant must be assigned to exactly one service.",
  servant_stage_required: "A servant must be assigned to exactly one stage.",
  stage_service_mismatch: "The selected stage does not belong to the selected service.",
  manager_replacement_required:
    "This church already has a Church Manager. Confirm that you want to replace the current manager to assign this role.",
  manager_swap_failed:
    "The user was created but the Church Manager role could not be assigned. The account has been removed.",
};

function mapCreateUserError(raw: string): string {
  return CREATE_USER_ERROR_MESSAGES[raw] ?? raw;
}

/**
 * Removes every artifact of a user created mid-operation when a later step
 * fails (e.g. the manager swap): role grants, stage assignments, the servants
 * row, the profile, and finally the auth account.
 */
async function rollbackCreatedUser(
  ctx: ActorContext,
  userId: string,
  churchId: string,
): Promise<void> {
  try {
    await ctx.admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("church_id", churchId);
    await ctx.admin
      .from("servant_stage_assignments")
      .delete()
      .eq("servant_id", userId);
    await ctx.admin.from("servants").delete().eq("id", userId);
    await ctx.admin.from("profiles").delete().eq("id", userId);
    await ctx.admin.auth.admin.deleteUser(userId).catch(() => undefined);
  } catch (error) {
    console.error("[users] Failed to roll back created user:", error);
  }
}

export async function listUsersAction(
  page: number,
  pageSize: number,
  search?: string,
  roleFilter?: string,
  churchId?: string,
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

  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_READ))) {
    return { success: false, message: "You do not have permission to view users." };
  }

  const targetChurchId = ctx.churchId ?? churchId;
  if (!targetChurchId) {
    return { success: false, message: "A church must be selected." };
  }

  if (ctx.churchId && targetChurchId !== ctx.churchId) {
    return { success: false, message: "You cannot view users from another church." };
  }

  const result = await userService.listUsers(dataClientFor(ctx), targetChurchId, {
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
  churchId?: string,
): Promise<UserActionResult<UserDetail>> {
  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_READ))) {
    return { success: false, message: "You do not have permission to view users." };
  }

  const targetChurchId = ctx.churchId ?? churchId;
  if (!targetChurchId) {
    return { success: false, message: "A church must be selected." };
  }

  if (ctx.churchId && targetChurchId !== ctx.churchId) {
    return { success: false, message: "You cannot view users from another church." };
  }

  const result = await userService.getUserById(dataClientFor(ctx), targetChurchId, userId);

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function getActorChurchAction(): Promise<
  UserActionResult<{ churchId: string | null; isPlatformOwner: boolean }>
> {
  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  return {
    success: true,
    data: { churchId: ctx.churchId, isPlatformOwner: ctx.churchId === null },
  };
}

export async function exportUsersAction(values: {
  format: "csv" | "xlsx";
  search?: string;
  roleFilter?: string;
  churchId?: string;
}): Promise<UserActionResult<{ fileName: string; content: string; mimeType: string }>> {
  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_READ))) {
    return { success: false, message: "You do not have permission to export users." };
  }

  const targetChurchId = ctx.churchId ?? values.churchId;
  if (!targetChurchId) {
    return { success: false, message: "A church must be selected." };
  }

  if (ctx.churchId && targetChurchId !== ctx.churchId) {
    return { success: false, message: "You cannot export users from another church." };
  }

  const result = await userExportService.exportUsers(
    dataClientFor(ctx),
    targetChurchId,
    {
      format: values.format,
      search: values.search,
      roleFilter: values.roleFilter as UserRoleType | undefined,
    },
  );

  if (result.error || !result.data) {
    return { success: false, message: result.error ?? "Failed to export users." };
  }

  await writeUserAudit(ctx, targetChurchId, "export", "user", "batch", {
    format: values.format,
    search: values.search ?? null,
    roleFilter: values.roleFilter ?? null,
  });

  return { success: true, data: result.data };
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

  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  const isPlatformOwner = ctx.churchId === null;

  if (isPlatformOwner) {
    if (
      !(await hasAnyPermission([
        PERMISSION_CODES.USERS_READ,
        PERMISSION_CODES.TENANTS_READ,
      ]))
    ) {
      return { success: false, message: "You do not have permission to create users." };
    }
    if (!values.churchId) {
      return { success: false, message: "A church must be selected." };
    }
  } else {
    // Same boundary as the import gate: the create_church_user RPC only accepts
    // the church's super_admin, so a manager (even with a legacy role missing
    // servants.create) must be able to create users. servants.create stays as a
    // compatibility path; the RPC remains the hard enforcement boundary.
    const { data: isSuperAdmin } = await ctx.supabase.rpc("user_is_super_admin", {
      p_church_id: ctx.churchId,
    });
    const allowed = isSuperAdmin || (await hasPermission(PERMISSION_CODES.SERVANTS_CREATE));
    if (!allowed) {
      return { success: false, message: "You do not have permission to create users." };
    }
    if (values.churchId && values.churchId !== ctx.churchId) {
      return { success: false, message: "You cannot create users in another church." };
    }
  }

  const targetChurchId = ctx.churchId ?? values.churchId!;

  // Church Manager safety (every authorized actor): a church keeps a single
  // active manager. When the requested role set includes super_admin and the
  // church already has an active manager, require explicit confirmation; on
  // confirmation the existing change_church_manager RPC (035) ends the previous
  // manager's grant and activates the new one, so the whole flow feels like one
  // operation. Church-scoped actors are hard-locked to their own church by the
  // scope checks above; the PO may manage any church.
  let managerReplacementNeeded = false;
  let superAdminRoleId: string | null = null;
  const { data: superAdminRole } = await ctx.admin
    .from("roles")
    .select("id")
    .eq("church_id", targetChurchId)
    .eq("role_type", "super_admin")
    .maybeSingle();
  superAdminRoleId = superAdminRole?.id ?? null;

  // Church Manager guard (050): a church-scoped actor (Church Manager) can
  // NEVER grant the super_admin role — changing the Church Manager is a
  // Platform Owner operation only (change_church_manager, 035).
  if (
    !isPlatformOwner &&
    superAdminRoleId &&
    values.roleIds.includes(superAdminRoleId)
  ) {
    return { success: false, message: mapCreateUserError("cannot_assign_manager_role") };
  }

  if (superAdminRoleId && values.roleIds.includes(superAdminRoleId)) {
    const { data: activeManager } = await ctx.admin
      .from("user_roles")
      .select("user_id")
      .eq("church_id", targetChurchId)
      .eq("role_id", superAdminRoleId)
      .is("end_date", null)
      .limit(1)
      .maybeSingle();
    managerReplacementNeeded = !!activeManager;
  }

  if (managerReplacementNeeded && !values.confirmReplaceManager) {
    return {
      success: false,
      message: mapCreateUserError("manager_replacement_required"),
    };
  }

  // Manager-replacement invariant: the new user must NEVER hold an active
  // super_admin grant before change_church_manager runs. Otherwise that RPC's
  // `SELECT ... LIMIT 1` "current manager" lookup (035) can select the new
  // user's own just-created grant and early-return, leaving the real manager's
  // grant active — two active Church Managers (reproduced on staging).
  //
  // So super_admin is excluded from the initial grant and change_church_manager
  // is the ONLY operation that assigns the manager role. Because
  // create_church_user requires at least one role, when the only requested role
  // is super_admin the church's servant role is used as a temporary membership
  // placeholder and revoked immediately after the swap, so the final grants
  // equal exactly the requested role set.
  let initialRoleIds = values.roleIds;
  let placeholderServantRoleId: string | null = null;
  if (managerReplacementNeeded && superAdminRoleId) {
    const { data: servantRole } = await ctx.admin
      .from("roles")
      .select("id")
      .eq("church_id", targetChurchId)
      .eq("role_type", "servant")
      .maybeSingle();

    const split = userService.splitManagerReplacementRoles(
      values.roleIds,
      superAdminRoleId,
      servantRole?.id ?? null,
    );

    if (split.initialRoleIds.length === 0) {
      return {
        success: false,
        message: "This church has no roles available for user creation.",
      };
    }

    initialRoleIds = split.initialRoleIds;
    placeholderServantRoleId = split.placeholderRoleId;
  }

  const result = await userService.createUser(
    ctx.supabase,
    {
      email: values.email,
      password: values.password,
      full_name_ar: values.full_name_ar,
      full_name_en: values.full_name_en,
      phone: values.phone,
      preferred_locale: values.preferred_locale,
      roleIds: initialRoleIds,
      stageIds: values.stageIds ?? [],
      serviceIds: values.serviceIds ?? [],
    },
    targetChurchId,
  );

  if (result.error) {
    return { success: false, message: mapCreateUserError(result.error) };
  }

  // Swap the active manager grant through the existing secure RPC when the new
  // user replaces an existing Church Manager. At this point the new user holds
  // NO super_admin grant, so the RPC's current-manager lookup can only match the
  // real (old) manager and the swap is deterministic.
  if (managerReplacementNeeded && result.data) {
    const { error: swapError } = await ctx.supabase.rpc("change_church_manager", {
      p_church_id: targetChurchId,
      p_new_user_id: result.data.id,
    });

    if (swapError) {
      await rollbackCreatedUser(ctx, result.data.id, targetChurchId);
      return { success: false, message: mapCreateUserError("manager_swap_failed") };
    }

    // Revoke the temporary membership placeholder (used only when the manager
    // role was the sole requested role), keeping the final grants exactly equal
    // to the requested role set.
    if (placeholderServantRoleId) {
      const { error: revokeError } = await ctx.admin
        .from("user_roles")
        .update({ end_date: new Date().toISOString().split("T")[0] })
        .eq("user_id", result.data.id)
        .eq("church_id", targetChurchId)
        .eq("role_id", placeholderServantRoleId)
        .is("end_date", null);

      if (revokeError) {
        console.error("[users] Failed to revoke manager placeholder role:", revokeError);
      }

      await writeUserAudit(
        ctx,
        targetChurchId,
        "update",
        "user",
        result.data.id,
        { roleIds: values.roleIds, placeholderRevocationFailed: !!revokeError },
        { roleIds: initialRoleIds },
      );
    }
  }

  if (result.data) {
    await writeUserAudit(ctx, targetChurchId, "create", "user", result.data.id, {
      email: values.email,
      full_name_ar: values.full_name_ar,
      roleIds: values.roleIds,
      confirmReplaceManager: managerReplacementNeeded,
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
  churchId?: string,
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

  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  const gate = await assertUserAdminPermission(ctx, "update");
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const target = await resolveUserManagementChurch(ctx, churchId);
  if (!target.churchId) {
    return { success: false, message: target.message ?? "Invalid church scope." };
  }

  const db = dataClientFor(ctx);
  const existing = await userService.getUserById(db, target.churchId, userId);
  if (!existing.data) {
    return { success: false, message: "User not found." };
  }

  const oldValues = {
    full_name_ar: existing.data.full_name_ar,
    full_name_en: existing.data.full_name_en ?? null,
    phone: existing.data.phone ?? null,
    is_active: existing.data.is_active,
  };

  const result = await userService.updateUser(db, userId, {
    full_name_ar: values.full_name_ar,
    full_name_en: values.full_name_en,
    phone: values.phone,
    preferred_locale: values.preferred_locale,
    is_active: values.is_active,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeUserAudit(
    ctx,
    target.churchId,
    "update",
    "user",
    userId,
    {
      full_name_ar: values.full_name_ar,
      full_name_en: values.full_name_en ?? null,
      phone: values.phone ?? null,
      is_active: values.is_active,
    },
    oldValues,
  );

  return { success: true, message: "User updated successfully." };
}

export async function deactivateUserAction(
  userId: string,
  churchId?: string,
): Promise<UserActionResult> {
  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  const gate = await assertUserAdminPermission(ctx, "deactivate");
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  if (ctx.userId === userId) {
    return { success: false, message: "You cannot deactivate your own account." };
  }

  const target = await resolveUserManagementChurch(ctx, churchId);
  if (!target.churchId) {
    return { success: false, message: target.message ?? "Invalid church scope." };
  }

  const db = dataClientFor(ctx);
  const existing = await userService.getUserById(db, target.churchId, userId);
  if (!existing.data) {
    return { success: false, message: "User not found." };
  }

  // A church must keep a manager: refuse to deactivate the last active one.
  if (existing.data.roles.some((r) => r.role_type === "super_admin")) {
    const { data: superAdminRole } = await db
      .from("roles")
      .select("id")
      .eq("church_id", target.churchId)
      .eq("role_type", "super_admin")
      .maybeSingle();

    if (superAdminRole) {
      const { count } = await db
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("church_id", target.churchId)
        .eq("role_id", superAdminRole.id)
        .is("end_date", null);

      if (Number(count ?? 0) <= 1) {
        return {
          success: false,
          message: "Cannot deactivate the last super admin.",
        };
      }
    }
  }

  const result = await userService.deactivateUser(db, userId);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeUserAudit(
    ctx,
    target.churchId,
    "update",
    "user",
    userId,
    { is_active: false },
    { is_active: true },
  );

  return { success: true, message: "User deactivated successfully." };
}

export async function assignRolesAction(
  userId: string,
  roleIds: string[],
  churchId?: string,
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

  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  const gate = await assertUserAdminPermission(ctx, "assign");
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const target = await resolveUserManagementChurch(ctx, churchId);
  if (!target.churchId) {
    return { success: false, message: target.message ?? "Invalid church scope." };
  }

  const db = dataClientFor(ctx);

  // Church actors keep the existing super-admin-only guard; the PO is gated by
  // the platform tenants bundle above (the RPC boundary is not involved here).
  if (ctx.churchId !== null) {
    const actorDetail = await userService.getUserById(db, target.churchId, ctx.userId);
    if (!(actorDetail.data?.roles.some((r) => r.role_type === "super_admin") ?? false)) {
      return { success: false, message: "Only a super admin can assign roles." };
    }
  }

  const existing = await userService.getUserById(db, target.churchId, userId);
  const oldRoleIds = existing.data?.roles.map((r) => r.id) ?? [];

  // Role assignment rules (050): the target user's service/stage assignments
  // must satisfy the new role set (admin -> services; stage_manager -> one
  // service; servant -> one service + one stage).
  const { data: newRoles } = await db
    .from("roles")
    .select("role_type")
    .in("id", roleIds);
  const roleTypes = ((newRoles ?? []) as { role_type: string }[]).map(
    (role) => role.role_type,
  );
  const ruleError = await userService.validateRoleAssignmentRules(
    db,
    target.churchId,
    userId,
    roleTypes,
  );
  if (ruleError) {
    return { success: false, message: ruleError };
  }

  const result = await userService.assignRoles(
    db,
    { userId, roleIds },
    ctx.userId,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeUserAudit(
    ctx,
    target.churchId,
    "update",
    "user",
    userId,
    { roleIds },
    { roleIds: oldRoleIds },
  );

  return { success: true, message: "Roles updated successfully." };
}

export async function assignStagesAction(
  userId: string,
  stageIds: string[],
  churchId?: string,
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

  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  const gate = await assertUserAdminPermission(ctx, "assign");
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const target = await resolveUserManagementChurch(ctx, churchId);
  if (!target.churchId) {
    return { success: false, message: target.message ?? "Invalid church scope." };
  }

  const db = dataClientFor(ctx);
  const existing = await userService.getUserById(db, target.churchId, userId);
  const oldStageIds =
    existing.data?.stageAssignments.map((s) => s.stage_id) ?? [];

  // Servant role rules (050): a servant is scoped to exactly ONE stage that
  // must belong to their single assigned service.
  const isServant =
    existing.data?.roles.some((role) => role.role_type === "servant") ?? false;
  if (isServant) {
    if (stageIds.length !== 1) {
      return {
        success: false,
        message: "A servant must be assigned to exactly one stage.",
      };
    }
    const { data: serviceAssignments } = await db
      .from("servant_service_assignments")
      .select("service_id")
      .eq("servant_id", userId)
      .eq("church_id", target.churchId)
      .eq("is_active", true)
      .is("end_date", null);
    const serviceId =
      (serviceAssignments?.[0] as { service_id?: string } | undefined)?.service_id ?? null;
    if (!serviceId) {
      return {
        success: false,
        message: "A servant must be assigned to a service before choosing a stage.",
      };
    }
    const { data: stage } = await db
      .from("stages")
      .select("id")
      .eq("id", stageIds[0])
      .eq("church_id", target.churchId)
      .eq("service_id", serviceId)
      .maybeSingle();
    if (!stage) {
      return {
        success: false,
        message: "The selected stage must belong to the servant's assigned service.",
      };
    }
  }

  const result = await userService.assignStages(
    db,
    { userId, stageIds },
    ctx.userId,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeUserAudit(
    ctx,
    target.churchId,
    "update",
    "user",
    userId,
    { stageIds },
    { stageIds: oldStageIds },
  );

  return { success: true, message: "Stage assignments updated." };
}

export async function assignServicesAction(
  userId: string,
  serviceIds: string[],
  churchId?: string,
): Promise<UserActionResult> {
  try {
    assignServicesSchema.parse({ userId, serviceIds });
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

  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  const gate = await assertUserAdminPermission(ctx, "assign");
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const target = await resolveUserManagementChurch(ctx, churchId);
  if (!target.churchId) {
    return { success: false, message: target.message ?? "Invalid church scope." };
  }

  const db = dataClientFor(ctx);
  const existing = await userService.getUserById(db, target.churchId, userId);
  const oldServiceIds =
    existing.data?.serviceAssignments.map((s) => s.service_id) ?? [];

  // Servant role rules (050): exactly one service; when the user is a servant
  // their stage (if any) must belong to the chosen service.
  const isServant =
    existing.data?.roles.some((role) => role.role_type === "servant") ?? false;
  const isStageManager =
    existing.data?.roles.some((role) => role.role_type === "stage_manager") ?? false;
  if (isServant || isStageManager) {
    if (serviceIds.length !== 1) {
      return {
        success: false,
        message: isServant
          ? "A servant must be assigned to exactly one service."
          : "A stage manager must be assigned to exactly one service.",
      };
    }
  }

  const result = await userService.assignServices(
    db,
    { userId, serviceIds },
    ctx.userId,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeUserAudit(
    ctx,
    target.churchId,
    "update",
    "user",
    userId,
    { serviceIds },
    { serviceIds: oldServiceIds },
  );

  return { success: true, message: "Service assignments updated." };
}

export async function getRolesAction(
  churchId: string,
): Promise<UserActionResult<RoleRow[]>> {
  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_READ))) {
    return { success: false, message: "You do not have permission to view roles." };
  }

  const targetChurchId = ctx.churchId ?? churchId;
  if (!targetChurchId) {
    return { success: false, message: "A church must be selected." };
  }

  if (ctx.churchId && targetChurchId !== ctx.churchId) {
    return { success: false, message: "You cannot view roles from another church." };
  }

  const result = await userService.listRoles(dataClientFor(ctx), targetChurchId);
  if (result.error) {
    return { success: false, message: result.error };
  }
  return { success: true, data: result.data ?? undefined };
}

export async function getServicesAction(
  churchId: string,
): Promise<UserActionResult<import("../types/user.types").ServiceRow[]>> {
  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_READ))) {
    return { success: false, message: "You do not have permission to view services." };
  }

  const targetChurchId = ctx.churchId ?? churchId;
  if (!targetChurchId) {
    return { success: false, message: "A church must be selected." };
  }

  if (ctx.churchId && targetChurchId !== ctx.churchId) {
    return { success: false, message: "You cannot view services from another church." };
  }

  const result = await userService.listServices(dataClientFor(ctx), targetChurchId);
  if (result.error) {
    return { success: false, message: result.error };
  }
  return { success: true, data: result.data ?? undefined };
}

export async function getStagesAction(
  churchId: string,
): Promise<UserActionResult<StageRow[]>> {
  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.USERS_READ))) {
    return { success: false, message: "You do not have permission to view stages." };
  }

  const targetChurchId = ctx.churchId ?? churchId;
  if (!targetChurchId) {
    return { success: false, message: "A church must be selected." };
  }

  if (ctx.churchId && targetChurchId !== ctx.churchId) {
    return { success: false, message: "You cannot view stages from another church." };
  }

  const result = await userService.listStages(dataClientFor(ctx), targetChurchId);
  if (result.error) {
    return { success: false, message: result.error };
  }
  return { success: true, data: result.data ?? undefined };
}
