"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";
import { createServiceSchema, updateServiceSchema } from "../schemas/services.schema";
import type {
  CreateServiceFormValues,
  UpdateServiceFormValues,
} from "../schemas/services.schema";
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

  const result = await servicesService.listServices(supabase, profile.church_id, filters);
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
  });

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "services" });
    return { success: false, message: t("errors.createFailed") };
  }

  if (result.data) {
    await writeAuditLog(supabase, "create", "service", result.data.id, undefined, {
      name_ar: values.name_ar,
    });
  }

  return {
    success: true,
    message: "Service created successfully.",
    data: result.data ?? undefined,
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
