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
import type {
  ChurchFilters,
  ChurchPageData,
  ChurchDetail,
  ChurchStats,
  ChurchSummary,
  ChurchStatus,
  ChurchUsersPageData,
  ChurchAuditPageData,
  ChurchAdminListRow,
} from "../types/church.types";
import { CHURCH_STATUSES } from "../services/church-admin.service";
import * as churchAdminService from "../services/church-admin.service";
import { getReportsData } from "@/features/reports/services/reports.service";
import type { ReportsData } from "@/features/reports/types/reports.types";

type ChurchActionResult<T> = {
  success: boolean;
  message: string;
  data?: T;
};

const ZERO_STATS: ChurchStats = {
  memberCount: 0,
  servantCount: 0,
  childCount: 0,
  serviceCount: 0,
  stageCount: 0,
  classCount: 0,
  attendanceRate: null,
  attendancePresent: 0,
  attendanceTotal: 0,
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

async function ensureAuthenticated(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listChurchesAction(
  filters: ChurchFilters = {},
  locale: string,
): Promise<ChurchActionResult<ChurchPageData>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
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

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const total = result.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    success: true,
    message: "Churches loaded successfully.",
    data: {
      rows: result.data?.rows ?? [],
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

  if (!(await ensureAuthenticated(supabase))) {
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

  if (!(await ensureAuthenticated(supabase))) {
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

  if (!(await ensureAuthenticated(supabase))) {
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
        status: existingData.status,
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
    status: values.status,
    subscription_tier: values.subscription_tier,
    subscription_status: values.subscription_status,
  });

  return { success: true, message: "Church updated successfully." };
}

export async function activateChurchAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  return setChurchStatusAction(churchId, "active", locale, "Church activated successfully.");
}

export async function deactivateChurchAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  return setChurchStatusAction(churchId, "inactive", locale, "Church deactivated successfully.");
}

export async function suspendChurchAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  return setChurchStatusAction(churchId, "suspended", locale, "Church suspended successfully.");
}

export async function disableChurchAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  return setChurchStatusAction(churchId, "disabled", locale, "Church disabled successfully.");
}

export async function reactivateChurchAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  return setChurchStatusAction(churchId, "active", locale, "Church reactivated successfully.");
}

async function setChurchStatusAction(
  churchId: string,
  status: ChurchStatus,
  locale: string,
  successMessage: string,
): Promise<ChurchActionResult<boolean>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateDenied") };
  }

  if (!CHURCH_STATUSES.includes(status)) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateFailed") };
  }

  const adminSupabase = createAdminClient();
  const existing = await churchAdminService.getChurchById(adminSupabase, churchId);
  const existingData = existing.data;

  if (!existingData) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.notFound") };
  }

  if (existingData.status === status) {
    return { success: true, message: successMessage };
  }

  const result = await churchAdminService.setChurchStatus(adminSupabase, churchId, status);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateFailed") };
  }

  await writeAuditLog(
    supabase,
    "update",
    "church",
    churchId,
    { status: existingData.status, is_active: existingData.is_active },
    { status, is_active: status === "active" },
  );

  return { success: true, message: successMessage };
}

export async function getChurchStatsAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<ChurchStats>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
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
    data: result.data ?? ZERO_STATS,
  };
}

export async function getChurchesSummaryAction(
  locale: string,
): Promise<ChurchActionResult<ChurchSummary>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_READ))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.readDenied") };
  }

  const adminSupabase = createAdminClient();
  const result = await churchAdminService.getChurchSummary(adminSupabase);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.listFailed") };
  }

  return {
    success: true,
    message: "Churches summary loaded successfully.",
    data: result.data ?? { total: 0, active: 0, inactive: 0, suspended: 0, disabled: 0 },
  };
}

export async function getChurchUsersAction(
  churchId: string,
  filters: ChurchFilters = {},
  locale: string,
): Promise<ChurchActionResult<ChurchUsersPageData>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_READ))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.readDenied") };
  }

  const adminSupabase = createAdminClient();
  const result = await churchAdminService.listChurchUsers(adminSupabase, churchId, filters);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.listFailed") };
  }

  return {
    success: true,
    message: "Church users loaded successfully.",
    data: result.data ?? { rows: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
  };
}

async function getChurchEntityListAction(
  churchId: string,
  locale: string,
  kind: "services" | "stages" | "classes",
): Promise<ChurchActionResult<ChurchAdminListRow[]>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_READ))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.readDenied") };
  }

  const adminSupabase = createAdminClient();
  const result =
    kind === "services"
      ? await churchAdminService.listChurchServices(adminSupabase, churchId)
      : kind === "stages"
        ? await churchAdminService.listChurchStages(adminSupabase, churchId)
        : await churchAdminService.listChurchClasses(adminSupabase, churchId);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.listFailed") };
  }

  return {
    success: true,
    message: "Church data loaded successfully.",
    data: result.data ?? [],
  };
}

export async function getChurchServicesAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<ChurchAdminListRow[]>> {
  return getChurchEntityListAction(churchId, locale, "services");
}

export async function getChurchStagesAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<ChurchAdminListRow[]>> {
  return getChurchEntityListAction(churchId, locale, "stages");
}

export async function getChurchClassesAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<ChurchAdminListRow[]>> {
  return getChurchEntityListAction(churchId, locale, "classes");
}

export async function getChurchReportsAction(
  churchId: string,
  locale: string,
): Promise<ChurchActionResult<ReportsData>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_READ))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.readDenied") };
  }

  const adminSupabase = createAdminClient();
  const result = await getReportsData(adminSupabase, churchId);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.listFailed") };
  }

  return {
    success: true,
    message: "Church reports loaded successfully.",
    data: result.data ?? undefined,
  };
}

export async function getChurchAuditAction(
  churchId: string,
  page: number = 1,
  pageSize: number = 20,
  locale: string,
): Promise<ChurchActionResult<ChurchAuditPageData>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_READ))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.readDenied") };
  }

  const adminSupabase = createAdminClient();
  const result = await churchAdminService.getChurchAuditPage(adminSupabase, churchId, page, pageSize);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.listFailed") };
  }

  return {
    success: true,
    message: "Audit log loaded successfully.",
    data: result.data ?? { rows: [], total: 0, page, pageSize, totalPages: 1 },
  };
}

export async function changeChurchManagerAction(
  churchId: string,
  newUserId: string,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateDenied") };
  }

  const adminSupabase = createAdminClient();
  const result = await churchAdminService.changeChurchManager(adminSupabase, churchId, newUserId);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.changeManagerFailed") };
  }

  return { success: true, message: "Church manager changed successfully." };
}

export async function deactivateChurchUserAction(
  churchId: string,
  userId: string,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateDenied") };
  }

  const adminSupabase = createAdminClient();
  const result = await churchAdminService.deactivateChurchUser(adminSupabase, churchId, userId);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.deactivateUserFailed") };
  }

  return { success: true, message: "User deactivated successfully." };
}

export async function resetChurchManagerPasswordAction(
  churchId: string,
  newPassword: string,
  locale: string,
): Promise<ChurchActionResult<boolean>> {
  const supabase = await createClient();

  if (!(await ensureAuthenticated(supabase))) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.updateDenied") };
  }

  if (!newPassword || newPassword.length < 8) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.passwordTooShort") };
  }

  const adminSupabase = createAdminClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  const church = await churchAdminService.getChurchById(adminSupabase, churchId);

  if (church.error || !church.data) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.notFound") };
  }

  const manager = church.data.manager;
  if (!manager) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.managerNotFound") };
  }

  const { error } = await adminSupabase.auth.admin.updateUserById(manager.userId, {
    password: newPassword,
  });

  if (error) {
    const t = await getTranslations({ locale, namespace: "churches" });
    return { success: false, message: t("errors.resetPasswordFailed") };
  }

  const { error: auditError } = await adminSupabase
    .from("audit_logs")
    .insert({
      church_id: churchId,
      actor_id: actor?.id ?? null,
      action: "update",
      entity_type: "user",
      entity_id: manager.userId,
      old_values: null,
      new_values: { password_reset: true },
      metadata: {},
    });

  if (auditError) {
    console.error("[churches] Failed to write password-reset audit:", auditError.message);
  }

  return { success: true, message: "Manager password reset successfully." };
}
