"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";
import { createClassSchema, updateClassSchema } from "../schemas/classes.schema";
import type {
  CreateClassFormValues,
  UpdateClassFormValues,
} from "../schemas/classes.schema";
import * as classesService from "../services/classes.service";
import type {
  ClassActionResult,
  ClassFilters,
  ClassPageData,
  StageOption,
} from "../types/classes.types";

function handleZodError(error: unknown): ClassActionResult<never> {
  if (error instanceof ZodError) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
    };
  }
  return {
    success: false,
    message: "An unexpected validation error occurred.",
  };
}

async function getUserChurchId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", userId)
    .single();

  return profile?.church_id ?? null;
}

export async function listClassesAction(
  filters: ClassFilters = {},
  locale: string,
): Promise<ClassActionResult<ClassPageData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.CLASSES_READ))) {
    return { success: false, message: "You do not have permission to view classes." };
  }

  const churchId = await getUserChurchId(supabase, user.id);
  if (!churchId) {
    return { success: false, message: "Profile not found." };
  }

  const result = await classesService.listClasses(supabase, churchId, filters);
  if (result.error) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.listFailed"), data: undefined };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function listStageOptionsAction(
  locale: string,
): Promise<ClassActionResult<StageOption[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.CLASSES_READ))) {
    return { success: false, message: "You do not have permission to view classes." };
  }

  const churchId = await getUserChurchId(supabase, user.id);
  if (!churchId) {
    return { success: false, message: "Profile not found." };
  }

  const result = await classesService.listStageOptions(supabase, churchId);
  if (result.error) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.stageOptionsFailed"), data: undefined };
  }

  return { success: true, data: result.data ?? [] };
}

export async function createClassAction(
  values: CreateClassFormValues,
  locale: string,
): Promise<ClassActionResult<{ id: string }>> {
  try {
    createClassSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.CLASSES_CREATE))) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.createDenied") };
  }

  const result = await classesService.createClass(supabase, {
    stage_id: values.stage_id,
    name_ar: values.name_ar,
    name_en: values.name_en,
    sort_order: values.sort_order,
  });

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.createFailed") };
  }

  if (result.data) {
    await writeAuditLog(supabase, "create", "class", result.data.id, undefined, {
      name_ar: values.name_ar,
      stage_id: values.stage_id,
    });
  }

  return {
    success: true,
    message: "Class created successfully.",
    data: result.data ?? undefined,
  };
}

export async function updateClassAction(
  classId: string,
  values: UpdateClassFormValues,
  locale: string,
): Promise<ClassActionResult> {
  try {
    updateClassSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.CLASSES_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.updateDenied") };
  }

  const churchId = await getUserChurchId(supabase, user.id);
  if (!churchId) {
    return { success: false, message: "Profile not found." };
  }

  const existing = await classesService.getClassById(supabase, classId, churchId);
  const oldValues = existing.data
    ? { name_ar: existing.data.name_ar, stage_id: existing.data.stage_id, is_active: existing.data.is_active }
    : undefined;

  const result = await classesService.updateClass(supabase, classId, churchId, {
    stage_id: values.stage_id,
    name_ar: values.name_ar,
    name_en: values.name_en,
    sort_order: values.sort_order,
    is_active: values.is_active,
  });

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.updateFailed") };
  }

  await writeAuditLog(supabase, "update", "class", classId, oldValues, {
    name_ar: values.name_ar,
    stage_id: values.stage_id,
    is_active: values.is_active,
  });

  return { success: true, message: "Class updated successfully." };
}

export async function archiveClassAction(
  classId: string,
  locale: string,
): Promise<ClassActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.CLASSES_DELETE))) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.archiveDenied") };
  }

  const churchId = await getUserChurchId(supabase, user.id);
  if (!churchId) {
    return { success: false, message: "Profile not found." };
  }

  const existing = await classesService.getClassById(supabase, classId, churchId);
  if (!existing.data) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.notFound") };
  }

  const result = await classesService.setClassActive(supabase, classId, churchId, false);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.archiveFailed") };
  }

  await writeAuditLog(
    supabase,
    "update",
    "class",
    classId,
    { is_active: existing.data.is_active },
    { is_active: false },
  );

  return { success: true, message: "Class archived successfully." };
}

export async function restoreClassAction(
  classId: string,
  locale: string,
): Promise<ClassActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.CLASSES_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.restoreDenied") };
  }

  const churchId = await getUserChurchId(supabase, user.id);
  if (!churchId) {
    return { success: false, message: "Profile not found." };
  }

  const existing = await classesService.getClassById(supabase, classId, churchId);
  if (!existing.data) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.notFound") };
  }

  const result = await classesService.setClassActive(supabase, classId, churchId, true);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "classes" });
    return { success: false, message: t("errors.restoreFailed") };
  }

  await writeAuditLog(
    supabase,
    "update",
    "class",
    classId,
    { is_active: existing.data.is_active },
    { is_active: true },
  );

  return { success: true, message: "Class restored successfully." };
}
