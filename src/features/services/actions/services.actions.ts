"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { getActorStageScope } from "@/features/rbac/utils/stage-scope";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";
import {
  createServiceSchema,
  createServiceWithStagesSchema,
  updateServiceSchema,
} from "../schemas/services.schema";
import type {
  CreateServiceFormValues,
  CreateServiceWithStagesFormValues,
  CreateServiceWithStagesParsedValues,
  UpdateServiceFormValues,
} from "../schemas/services.schema";
import { createStage } from "@/features/stages/services/stage.service";
import * as servicesService from "../services/services.service";
import type {
  ServiceActionResult,
  ServiceFilters,
  ServicePageData,
} from "../types/services.types";

function handleZodError(error: unknown): ServiceActionResult<never> {
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

export async function listServicesAction(
  filters: ServiceFilters = {},
  locale: string,
): Promise<ServiceActionResult<ServicePageData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVICES_READ))) {
    return { success: false, message: "You do not have permission to view services." };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const { scope, error } = await getActorStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await servicesService.listServices(
    supabase,
    profile.church_id,
    filters,
    scope.churchWide ? undefined : scope.stageIds,
  );
  if (result.error) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.listFailed"), data: undefined };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function createServiceAction(
  values: CreateServiceFormValues,
  locale: string,
): Promise<ServiceActionResult<{ id: string }>> {
  try {
    createServiceSchema.parse(values);
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
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.createDenied") };
  }

  const result = await servicesService.createService(supabase, {
    name_ar: values.name_ar,
    name_en: values.name_en,
    description_ar: values.description_ar,
    description_en: values.description_en,
    sort_order: values.sort_order,
    service_type: values.service_type ?? null,
    next_service_id: values.next_service_id ?? null,
  });

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.createFailed") };
  }

  if (result.data) {
    await writeAuditLog(supabase, "create", "service", result.data.id, undefined, {
      name_ar: values.name_ar,
      service_type: values.service_type ?? null,
    });
  }

  return {
    success: true,
    message: "Service created successfully.",
    data: result.data ?? undefined,
  };
}

/**
 * Creates a service together with its stages (المراحل) in one logical user
 * action. The service must exist first because stages require service_id, so
 * the service is created, then every submitted stage is created with the
 * returned service id. If any stage fails the whole operation is rolled back
 * (created stages and the service are soft-deleted) so no inconsistent data
 * is left behind.
 */
export async function createServiceWithStagesAction(
  values: CreateServiceWithStagesFormValues,
  locale: string,
): Promise<ServiceActionResult<{ id: string }>> {
  let parsed: CreateServiceWithStagesParsedValues;
  try {
    parsed = createServiceWithStagesSchema.parse(values);
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
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.createDenied") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const serviceResult = await servicesService.createService(supabase, {
    name_ar: parsed.name_ar,
    name_en: parsed.name_en,
    description_ar: parsed.description_ar,
    description_en: parsed.description_en,
    sort_order: parsed.sort_order,
    service_type: parsed.service_type ?? null,
    next_service_id: parsed.next_service_id ?? null,
  });

  if (serviceResult.error || !serviceResult.data) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.createFailed") };
  }

  const serviceId = serviceResult.data.id;
  const createdStageIds: string[] = [];

  for (const stage of parsed.stages ?? []) {
    // createStage validates (never trusts the client) that the target service
    // belongs to the actor's church before inserting the stage.
    const stageResult = await createStage(supabase, {
      service_id: serviceId,
      name_ar: stage.name_ar,
      name_en: stage.name_en,
      description_ar: stage.description_ar,
      description_en: stage.description_en,
      age_min: stage.age_min,
      age_max: stage.age_max,
      stage_code: stage.stage_code ?? null,
      sort_order: 0,
    });

    if (stageResult.error || !stageResult.data) {
      // Roll back the whole logical action so the failed creation leaves no
      // orphaned service or partially attached stages.
      await servicesService.compensateServiceWithStages(
        supabase,
        serviceId,
        createdStageIds,
        profile.church_id,
      );
      const t = await getTranslations({ locale, namespace: "services" });
      return { success: false, message: t("errors.stageCreateFailed") };
    }

    createdStageIds.push(stageResult.data.id);
  }

  // Assign the sort_order after creation (the create path ignores the numeric
  // field and the submitted list order is authoritative).
  for (let index = 0; index < createdStageIds.length; index += 1) {
    await supabase
      .from("stages")
      .update({ sort_order: index })
      .eq("id", createdStageIds[index]);
  }

  await writeAuditLog(supabase, "create", "service", serviceId, undefined, {
    name_ar: parsed.name_ar,
    stage_count: createdStageIds.length,
  });

  return {
    success: true,
    message: "Service created successfully.",
    data: { id: serviceId },
  };
}

export async function updateServiceAction(
  serviceId: string,
  values: UpdateServiceFormValues,
  locale: string,
): Promise<ServiceActionResult> {
  try {
    updateServiceSchema.parse(values);
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
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.updateDenied") };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const existing = await servicesService.getServiceById(supabase, serviceId, profile.church_id);
  const oldValues = existing.data
    ? { name_ar: existing.data.name_ar, is_active: existing.data.is_active }
    : undefined;

  const result = await servicesService.updateService(supabase, serviceId, profile.church_id, {
    name_ar: values.name_ar,
    name_en: values.name_en,
    description_ar: values.description_ar,
    description_en: values.description_en,
    sort_order: values.sort_order,
    is_active: values.is_active,
    next_service_id: values.next_service_id ?? null,
  });

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.updateFailed") };
  }

  await writeAuditLog(supabase, "update", "service", serviceId, oldValues, {
    name_ar: values.name_ar,
    is_active: values.is_active,
  });

  return { success: true, message: "Service updated successfully." };
}

export async function archiveServiceAction(
  serviceId: string,
  locale: string,
): Promise<ServiceActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.archiveDenied") };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const existing = await servicesService.getServiceById(supabase, serviceId, profile.church_id);
  if (!existing.data) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.notFound") };
  }

  const result = await servicesService.setServiceActive(supabase, serviceId, profile.church_id, false);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.archiveFailed") };
  }

  await writeAuditLog(
    supabase,
    "update",
    "service",
    serviceId,
    { is_active: existing.data.is_active },
    { is_active: false },
  );

  return { success: true, message: "Service archived successfully." };
}

export async function restoreServiceAction(
  serviceId: string,
  locale: string,
): Promise<ServiceActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.STAGES_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.restoreDenied") };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const existing = await servicesService.getServiceById(supabase, serviceId, profile.church_id);
  if (!existing.data) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.notFound") };
  }

  const result = await servicesService.setServiceActive(supabase, serviceId, profile.church_id, true);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.restoreFailed") };
  }

  await writeAuditLog(
    supabase,
    "update",
    "service",
    serviceId,
    { is_active: existing.data.is_active },
    { is_active: true },
  );

  return { success: true, message: "Service restored successfully." };
}
