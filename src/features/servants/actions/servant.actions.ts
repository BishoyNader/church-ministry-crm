"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { getActorStageScope, allStagesInScope } from "@/features/rbac/utils/stage-scope";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import {
  assignServantStagesSchema,
  servantIdSchema,
  servantListSchema,
  updateServantSchema,
} from "../schemas/servant.schema";
import type { UpdateServantFormValues } from "../schemas/servant.schema";
import type {
  ServantDetail,
  ServantListResult,
  ServantStage,
} from "../types/servant.types";
import * as servantService from "../services/servant.service";
import { ZodError } from "zod";

export type ServantActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  data?: T;
};

type ActorContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  churchId: string;
};

async function getActorContext(): Promise<ActorContext | { message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { message: "User profile not found." };
  }

  return { supabase, userId: user.id, churchId: profile.church_id };
}

function isActorContext(value: ActorContext | { message: string }): value is ActorContext {
  return "supabase" in value;
}

async function isActorSuperAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  churchId: string,
): Promise<boolean> {
  const { data: grants } = await supabase
    .from("user_roles")
    .select("roles(role_type)")
    .eq("user_id", userId)
    .eq("church_id", churchId)
    .is("end_date", null);

  return (grants ?? []).some(
    (grant) => (grant as { roles?: { role_type?: string } | null })?.roles?.role_type === "super_admin",
  );
}

function parseError<T>(error: ZodError): ServantActionResult<T> {
  return {
    success: false,
    message: "Please fix the highlighted fields.",
    fieldErrors: Object.fromEntries(
      error.issues.map((issue) => [issue.path.join("."), issue.message]),
    ),
  };
}

export async function listServantsAction(
  page: number,
  pageSize: number,
  search?: string,
  approvalStatus?: string,
  stageId?: string,
): Promise<ServantActionResult<ServantListResult>> {
  let parsed;
  try {
    parsed = servantListSchema.parse({ page, pageSize, search, approvalStatus, stageId });
  } catch (error) {
    if (error instanceof ZodError) return parseError(error);
    throw error;
  }

  const ctx = await getActorContext();
  if (!isActorContext(ctx)) {
    return { success: false, message: ctx.message };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_READ))) {
    return { success: false, message: "You do not have permission to view servants." };
  }

  const { scope, error } = await getActorStageScope(ctx.supabase, ctx.churchId, ctx.userId);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await servantService.listServants(
    ctx.supabase,
    ctx.churchId,
    parsed,
    scope.churchWide ? undefined : scope.stageIds,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function getServantAction(servantId: string): Promise<ServantActionResult<ServantDetail>> {
  let parsed;
  try {
    parsed = servantIdSchema.parse({ servantId });
  } catch (error) {
    if (error instanceof ZodError) return parseError(error);
    throw error;
  }

  const ctx = await getActorContext();
  if (!isActorContext(ctx)) {
    return { success: false, message: ctx.message };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_READ))) {
    return { success: false, message: "You do not have permission to view servants." };
  }

  const { scope, error } = await getActorStageScope(ctx.supabase, ctx.churchId, ctx.userId);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await servantService.getServantById(
    ctx.supabase,
    ctx.churchId,
    parsed.servantId,
    scope.churchWide ? undefined : scope.stageIds,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function updateServantAction(
  servantId: string,
  values: UpdateServantFormValues,
): Promise<ServantActionResult> {
  let parsed;
  try {
    parsed = updateServantSchema.parse(values);
  } catch (error) {
    if (error instanceof ZodError) return parseError(error);
    throw error;
  }

  const ctx = await getActorContext();
  if (!isActorContext(ctx)) {
    return { success: false, message: ctx.message };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_UPDATE))) {
    return { success: false, message: "You do not have permission to update servants." };
  }

  if (!(await isActorSuperAdmin(ctx.supabase, ctx.userId, ctx.churchId))) {
    return { success: false, message: "Only a super admin can edit servant records." };
  }

  const existing = await servantService.getServantById(ctx.supabase, ctx.churchId, servantId);
  if (!existing.data) {
    return { success: false, message: existing.error ?? "Servant not found." };
  }

  const result = await servantService.updateServant(ctx.supabase, servantId, parsed);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(
    ctx.supabase,
    "update",
    "servant",
    servantId,
    {
      confession_father_name: existing.data.confession_father_name,
      join_date: existing.data.join_date,
      notes: existing.data.notes,
    },
    {
      confession_father_name: parsed.confession_father_name?.trim() || null,
      join_date: parsed.join_date?.trim() || null,
      notes: parsed.notes?.trim() || null,
    },
  );

  return { success: true, message: "Servant updated successfully." };
}

export async function assignServantStagesAction(
  servantId: string,
  stageIds: string[],
): Promise<ServantActionResult> {
  let parsed;
  try {
    parsed = assignServantStagesSchema.parse({ servantId, stageIds });
  } catch (error) {
    if (error instanceof ZodError) return parseError(error);
    throw error;
  }

  const ctx = await getActorContext();
  if (!isActorContext(ctx)) {
    return { success: false, message: ctx.message };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_ASSIGN))) {
    return { success: false, message: "You do not have permission to assign stages." };
  }

  const { scope, error } = await getActorStageScope(ctx.supabase, ctx.churchId, ctx.userId);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  if (!allStagesInScope(scope, parsed.stageIds)) {
    return { success: false, message: "You do not have permission to assign these stages." };
  }

  const existing = await servantService.getServantById(ctx.supabase, ctx.churchId, parsed.servantId);
  if (!existing.data) {
    return { success: false, message: existing.error ?? "Servant not found." };
  }

  const oldStageIds = existing.data.stageAssignments
    .map((assignment) => assignment.stage_id)
    .filter((id): id is string => id !== null);

  const result = await servantService.assignStages(
    ctx.supabase,
    ctx.churchId,
    parsed.servantId,
    parsed.stageIds,
    ctx.userId,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(
    ctx.supabase,
    "update",
    "servant",
    parsed.servantId,
    { stageIds: oldStageIds },
    { stageIds: parsed.stageIds },
  );

  return { success: true, message: "Stage assignments updated." };
}

export async function archiveServantAction(servantId: string): Promise<ServantActionResult> {
  let parsed;
  try {
    parsed = servantIdSchema.parse({ servantId });
  } catch (error) {
    if (error instanceof ZodError) return parseError(error);
    throw error;
  }

  const ctx = await getActorContext();
  if (!isActorContext(ctx)) {
    return { success: false, message: ctx.message };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_DELETE))) {
    return { success: false, message: "You do not have permission to archive servants." };
  }

  if (ctx.userId === parsed.servantId) {
    return { success: false, message: "You cannot archive your own account." };
  }

  if (!(await isActorSuperAdmin(ctx.supabase, ctx.userId, ctx.churchId))) {
    return { success: false, message: "Only a super admin can archive servant records." };
  }

  const existing = await servantService.getServantById(ctx.supabase, ctx.churchId, parsed.servantId);
  if (!existing.data) {
    return { success: false, message: existing.error ?? "Servant not found." };
  }

  const result = await servantService.archiveServant(ctx.supabase, ctx.churchId, parsed.servantId);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(
    ctx.supabase,
    "delete",
    "servant",
    parsed.servantId,
    { approval_status: existing.data.approval_status, full_name_ar: existing.data.profile?.full_name_ar ?? null },
    { deleted_at: new Date().toISOString() },
  );

  return { success: true, message: "Servant archived." };
}

export async function getServantStagesAction(): Promise<ServantActionResult<ServantStage[]>> {
  const ctx = await getActorContext();
  if (!isActorContext(ctx)) {
    return { success: false, message: ctx.message };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_ASSIGN))) {
    return { success: false, message: "You do not have permission to assign stages." };
  }

  const { scope, error } = await getActorStageScope(ctx.supabase, ctx.churchId, ctx.userId);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await servantService.listServantStages(
    ctx.supabase,
    ctx.churchId,
    scope.churchWide ? undefined : scope.stageIds,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}
