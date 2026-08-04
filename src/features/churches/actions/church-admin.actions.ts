"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";
import { createChurchSchema, updateChurchSchema } from "../schemas/church.schema";
import type { CreateChurchFormValues, UpdateChurchFormValues } from "../schemas/church.schema";
import type { ChurchFilters, ChurchPageData, ChurchDetail, ChurchStats } from "../types/church.types";
import * as churchAdminService from "../services/church-admin.service";

type ChurchActionResult<T> = {
  success: boolean;
  message: string;
  data?: T;
};

function handleZodError(error: unknown): ChurchActionResult<never> {
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

export async function listChurchesAction(
  filters: ChurchFilters = {},
  locale: string,
): Promise<ChurchActionResult<ChurchPageData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_READ))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.readDenied") };
  }

  const adminSupabase = createAdminClient();
  const result = await churchAdminService.listChurches(adminSupabase, filters);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.listFailed") };
  }

  const total = result.data?.length ?? 0;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const totalPages = Math.ceil(total / pageSize);

  return {
    success: true,
    message: "Churches loaded successfully.",
    data: {
      rows: result.data ?? [],
      total,
      page,
      pageSize,
      totalPages,
    },
  };
}

export async function getChurchAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<ChurchDetail>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_READ))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.readDenied") };
  }

  const adminSupabase = createAdminClient();
  const result = await churchAdminService.getChurchById(adminSupabase, churchId);

  if (result.error || !result.data) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.notFound") };
  }

  return {
    success: true,
    message: "Church loaded successfully.",
    data: result.data,
  };
}

export async function createChurchAction(
  values: CreateChurchFormValues,
  locale: string,
): Promise<ChurchActionResult<{ id: string }>> {
  try {
    createChurchSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_CREATE))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.createDenied") };
  }

  const adminSupabase = createAdminClient();
  const result = await churchAdminService.createChurch(adminSupabase, {
    name_ar: values.name_ar,
    name_en: values.name_en,
    slug: values.slug,
    contact_email: values.contact_email,
    contact_phone: values.contact_phone,
    address_ar: values.address_ar,
    address_en: values.address_en,
    subscription_tier: values.subscription_tier,
    subscription_status: values.subscription_status,
    locale: values.locale,
  });

  if (result.error || !result.data) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.createFailed") };
  }

  await writeAuditLog(supabase, "create", "church", result.data.id, undefined, {
    name_ar: values.name_ar,
    slug: values.slug,
  });

  return {
    success: true,
    message: "Church created successfully.",
    data: result.data,
  };
}

export async function updateChurchAction(
  churchId: string,
  values: UpdateChurchFormValues,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  try {
    updateChurchSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateDenied") };
  }

  const adminSupabase = createAdminClient();
  const existing = await churchAdminService.getChurchById(adminSupabase, churchId);
  const existingData = existing.data;
  const oldValues = existingData
    ? {
        name_ar: existingData.name_ar,
        is_active: existingData.is_active,
        subscription_tier: existingData.subscription_tier,
        subscription_status: existingData.subscription_status,
      }
    : undefined;

  const result = await churchAdminService.updateChurch(adminSupabase, churchId, values);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateFailed") };
  }

  await writeAuditLog(supabase, "update", "church", churchId, oldValues, {
    name_ar: values.name_ar,
    is_active: values.is_active,
    subscription_tier: values.subscription_tier,
    subscription_status: values.subscription_status,
  });

  return { success: true, message: "Church updated successfully." };
}

export async function activateChurchAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateDenied") };
  }

  const adminSupabase = createAdminClient();
  const existing = await churchAdminService.getChurchById(adminSupabase, churchId);
  const existingData = existing.data;

  if (!existingData) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.notFound") };
  }

  const result = await churchAdminService.setChurchActive(adminSupabase, churchId, true);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateFailed") };
  }

  await writeAuditLog(
    supabase,
    "update",
    "church",
    churchId,
    { is_active: existingData.is_active },
    { is_active: true },
  );

  return { success: true, message: "Church activated successfully." };
}

export async function deactivateChurchAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateDenied") };
  }

  const adminSupabase = createAdminClient();
  const existing = await churchAdminService.getChurchById(adminSupabase, churchId);
  const existingData = existing.data;

  if (!existingData) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.notFound") };
  }

  const result = await churchAdminService.setChurchActive(adminSupabase, churchId, false);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateFailed") };
  }

  await writeAuditLog(
    supabase,
    "update",
    "church",
    churchId,
    { is_active: existingData.is_active },
    { is_active: false },
  );

  return { success: true, message: "Church deactivated successfully." };
}

export async function getChurchStatsAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<ChurchStats>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_READ))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.readDenied") };
  }

  const adminSupabase = createAdminClient();
  const result = await churchAdminService.getChurchStats(adminSupabase, churchId);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.statsFailed") };
  }

  return {
    success: true,
    message: "Stats loaded successfully.",
    data: result.data ?? { memberCount: 0, servantCount: 0, serviceCount: 0, stageCount: 0 },
  };
}