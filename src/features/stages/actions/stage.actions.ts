"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { getActorStageScope } from "@/features/rbac/utils/stage-scope";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import {
  createMinistrySchema,
  updateMinistrySchema,
  createStageSchema,
  updateStageSchema,
  assignUsersToStageSchema,
} from "../schemas/stage.schema";
import type {
  CreateMinistryFormValues,
  UpdateMinistryFormValues,
  CreateStageFormValues,
  UpdateStageFormValues,
  AssignUsersToStageFormValues,
} from "../schemas/stage.schema";
import type {
  MinistryListItem,
  MinistryDetail,
  StageListItem,
  StageUser,
} from "../types/stage.types";
import * as stageService from "../services/stage.service";
import { ZodError } from "zod";

export type StageActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  data?: T;
};

function handleZodError(error: unknown): StageActionResult<never> {
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

// ─── Ministry Actions ───────────────────────────────────────

export async function listMinistriesAction(): Promise<
  StageActionResult<MinistryListItem[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_READ))) {
    return { success: false, message: "You do not have permission to view ministries." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, error } = await getActorStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await stageService.listMinistries(
    supabase,
    profile.church_id,
    scope.churchWide ? undefined : scope.stageIds,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}

export async function getMinistryByIdAction(
  ministryId: string,
): Promise<StageActionResult<MinistryDetail>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_READ))) {
    return { success: false, message: "You do not have permission to view ministries." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const result = await stageService.getMinistryById(supabase, ministryId, profile.church_id);

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function createMinistryAction(
  values: CreateMinistryFormValues,
): Promise<StageActionResult<{ id: string }>> {
  try {
    createMinistrySchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_CREATE))) {
    return { success: false, message: "You do not have permission to create ministries." };
  }

  const result = await stageService.createMinistry(supabase, {
    name_ar: values.name_ar,
    name_en: values.name_en,
    description_ar: values.description_ar,
    description_en: values.description_en,
    sort_order: values.sort_order,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (result.data) {
    await writeAuditLog(supabase, "create", "ministry", result.data.id, undefined, {
      name_ar: values.name_ar,
    });
  }

  return {
    success: true,
    message: "Ministry created successfully.",
    data: result.data ?? undefined,
  };
}

export async function updateMinistryAction(
  ministryId: string,
  values: UpdateMinistryFormValues,
): Promise<StageActionResult> {
  try {
    updateMinistrySchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_UPDATE))) {
    return { success: false, message: "You do not have permission to update ministries." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const existing = await stageService.getMinistryById(supabase, ministryId, profile.church_id);
  const oldValues = existing.data
    ? { name_ar: existing.data.name_ar, is_active: existing.data.is_active }
    : undefined;

  const result = await stageService.updateMinistry(supabase, ministryId, profile.church_id, {
    name_ar: values.name_ar,
    name_en: values.name_en,
    description_ar: values.description_ar,
    description_en: values.description_en,
    sort_order: values.sort_order,
    is_active: values.is_active,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, "update", "ministry", ministryId, oldValues, {
    name_ar: values.name_ar,
    is_active: values.is_active,
  });

  return { success: true, message: "Ministry updated successfully." };
}

export async function deactivateMinistryAction(
  ministryId: string,
): Promise<StageActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_DELETE))) {
    return { success: false, message: "You do not have permission to delete ministries." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const existing = await stageService.getMinistryById(supabase, ministryId, profile.church_id);
  const oldValues = existing.data
    ? { name_ar: existing.data.name_ar, is_active: existing.data.is_active }
    : undefined;

  const result = await stageService.deactivateMinistry(supabase, ministryId, profile.church_id);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, "delete", "ministry", ministryId, oldValues, {
    deleted_at: new Date().toISOString(),
  });

  return { success: true, message: "Ministry deactivated successfully." };
}

// ─── Stage Actions ──────────────────────────────────────────

export async function listStagesAction(
  ministryId?: string,
): Promise<StageActionResult<StageListItem[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_READ))) {
    return { success: false, message: "You do not have permission to view stages." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, error } = await getActorStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await stageService.listStages(
    supabase,
    profile.church_id,
    ministryId,
    scope.churchWide ? undefined : scope.stageIds,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}

export async function createStageAction(
  values: CreateStageFormValues,
): Promise<StageActionResult<{ id: string }>> {
  try {
    createStageSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_CREATE))) {
    return { success: false, message: "You do not have permission to create stages." };
  }

  const result = await stageService.createStage(supabase, {
    service_id: values.service_id,
    name_ar: values.name_ar,
    name_en: values.name_en,
    description_ar: values.description_ar,
    description_en: values.description_en,
    age_min: values.age_min,
    age_max: values.age_max,
    sort_order: values.sort_order,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (result.data) {
    await writeAuditLog(supabase, "create", "stage", result.data.id, undefined, {
      name_ar: values.name_ar,
      service_id: values.service_id,
    });
  }

  return {
    success: true,
    message: "Stage created successfully.",
    data: result.data ?? undefined,
  };
}

export async function updateStageAction(
  stageId: string,
  values: UpdateStageFormValues,
): Promise<StageActionResult> {
  try {
    updateStageSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_UPDATE))) {
    return { success: false, message: "You do not have permission to update stages." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const existing = await stageService.getStageById(supabase, stageId, profile.church_id);
  const oldValues = existing.data
    ? { name_ar: existing.data.name_ar, is_active: existing.data.is_active }
    : undefined;

  const result = await stageService.updateStage(supabase, stageId, profile.church_id, {
    name_ar: values.name_ar,
    name_en: values.name_en,
    description_ar: values.description_ar,
    description_en: values.description_en,
    age_min: values.age_min,
    age_max: values.age_max,
    sort_order: values.sort_order,
    is_active: values.is_active,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, "update", "stage", stageId, oldValues, {
    name_ar: values.name_ar,
    is_active: values.is_active,
  });

  return { success: true, message: "Stage updated successfully." };
}

export async function deactivateStageAction(
  stageId: string,
): Promise<StageActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_DELETE))) {
    return { success: false, message: "You do not have permission to delete stages." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const existing = await stageService.getStageById(supabase, stageId, profile.church_id);
  const oldValues = existing.data
    ? { name_ar: existing.data.name_ar, is_active: existing.data.is_active }
    : undefined;

  const result = await stageService.deactivateStage(supabase, stageId, profile.church_id);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, "delete", "stage", stageId, oldValues, {
    deleted_at: new Date().toISOString(),
  });

  return { success: true, message: "Stage deactivated successfully." };
}

// ─── User Stage Assignment Actions ──────────────────────────

export async function getStageUsersAction(
  stageId: string,
): Promise<StageActionResult<StageUser[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_READ))) {
    return { success: false, message: "You do not have permission to view stage assignments." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const result = await stageService.getStageUsers(supabase, stageId, profile.church_id);

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}

export async function assignUsersToStageAction(
  values: AssignUsersToStageFormValues,
): Promise<StageActionResult> {
  try {
    assignUsersToStageSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_ASSIGN))) {
    return { success: false, message: "You do not have permission to manage stage assignments." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const existing = await stageService.getStageUsers(supabase, values.stageId, profile.church_id);
  const oldUserIds = existing.data?.map((u) => u.id) ?? [];

  const result = await stageService.assignUsersToStage(
    supabase,
    values.stageId,
    values.userIds,
    user.id,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(
    supabase,
    "update",
    "stage",
    values.stageId,
    { userIds: oldUserIds },
    { userIds: values.userIds },
  );

  return { success: true, message: "Stage assignments updated." };
}

export async function listAllUsersAction(): Promise<
  StageActionResult<StageUser[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_READ))) {
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

  const result = await stageService.listAllUsers(supabase, profile.church_id);

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}
