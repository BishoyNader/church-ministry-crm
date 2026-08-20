"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { getActorStageScope, isStageInScope } from "@/features/rbac/utils/stage-scope";
import type { ActorStageScope } from "@/features/rbac/utils/stage-scope";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import {
  createChildSchema,
  updateChildSchema,
  transferChildSchema,
  createAttendanceSchema,
  batchAttendanceSchema,
  toggleAttendanceSchema,
  createFollowupSchema,
  updateFollowupSchema,
  uuidParamSchema,
} from "../schemas/child.schema";
import type {
  CreateChildFormValues,
  UpdateChildFormValues,
  TransferChildFormValues,
  CreateAttendanceFormValues,
  BatchAttendanceFormValues,
  ToggleAttendanceFormValues,
  CreateFollowupFormValues,
  UpdateFollowupFormValues,
} from "../schemas/child.schema";
import type {
  ChildListItem,
  ChildDetail,
  AttendanceListItem,
  FollowupListItem,
  PaginationInput,
  PaginatedResult,
} from "../types/child.types";
import { checkEntitlementLimit } from "@/features/billing/lib/entitlement-guard";
import * as childService from "../services/child.service";
import { sendNotification } from "@/features/notifications/services/notification.service";
import { ZodError } from "zod";
import { getTranslations } from "next-intl/server";
import { mapChildErrorKey } from "../utils/error-mapper";

export type ChildActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  data?: T;
};

function handleZodError(error: unknown): ChildActionResult<never> {
  if (error instanceof ZodError) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    };
  }
  return {
    success: false,
    message: "An unexpected validation error occurred.",
  };
}

function validateId(id: string, label: string): ChildActionResult<never> | null {
  const result = uuidParamSchema.safeParse(id);
  if (!result.success) {
    return {
      success: false,
      message: `Invalid ${label}.`,
    };
  }
  return null;
}

async function getStageScope(
  supabase: SupabaseClient,
  churchId: string,
  userId: string,
): Promise<{ scope: ActorStageScope | null; message: string | null }> {
  const result = await getActorStageScope(supabase, churchId, userId);
  if (result.error || !result.scope) {
    return { scope: null, message: result.error ?? "Failed to resolve stage scope." };
  }
  return { scope: result.scope, message: null };
}

// ─── Locale-aware error mapping ─────────────────────────────
//
// Server actions resolve the requester's locale (the next-intl client provider
// forwards it on every server action request) and translate known failure
// codes/keys into user-facing messages via `children.errors`. Everything else
// passes through unchanged, preserving the previous raw-message behavior.

async function translateChildErrorKey(key: string): Promise<string> {
  try {
    const t = await getTranslations("children.errors");
    return t(key);
  } catch {
    return key;
  }
}

async function translateChildError(message: string): Promise<string> {
  const key = mapChildErrorKey(message);
  if (!key) {
    return message;
  }
  return translateChildErrorKey(key);
}

// ─── Child Actions ──────────────────────────────────────────

export async function listChildrenAction(
  filters?: {
    search?: string;
    service_id?: string;
    stage_id?: string;
    status?: string;
  },
  pagination?: PaginationInput,
): Promise<ChildActionResult<PaginatedResult<ChildListItem>>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.BENEFICIARIES_READ))) {
    return { success: false, message: "You do not have permission to view children." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  const stageIds = scope.churchWide ? undefined : scope.stageIds;
  const result = await childService.listChildren(
    supabase,
    profile.church_id,
    { ...filters, stageIds },
    pagination,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function getChildByIdAction(
  childId: string,
): Promise<ChildActionResult<ChildDetail>> {
  const idError = validateId(childId, "child ID");
  if (idError) return idError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.BENEFICIARIES_READ))) {
    return { success: false, message: "You do not have permission to view children." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  const result = await childService.getChildById(
    supabase,
    childId,
    profile.church_id,
    scope.churchWide ? undefined : scope.stageIds,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function createChildAction(
  values: CreateChildFormValues,
): Promise<ChildActionResult<{ id: string }>> {
  try {
    createChildSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.BENEFICIARIES_CREATE))) {
    return { success: false, message: "You do not have permission to create children." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  if (!isStageInScope(scope, values.stage_id)) {
    return { success: false, message: await translateChildErrorKey("createStageDenied") };
  }

  const entitlement = await checkEntitlementLimit(supabase, profile.church_id, "maxBeneficiaries");
  if (!entitlement.allowed) {
    return { success: false, message: entitlement.reason };
  }

  const result = await childService.createChild(supabase, {
    full_name_ar: values.full_name_ar,
    full_name_en: values.full_name_en,
    date_of_birth: values.date_of_birth,
    gender: values.gender,
    service_id: values.service_id,
    stage_id: values.stage_id,
    father_mobile: values.father_mobile,
    mother_mobile: values.mother_mobile,
    mobile: values.mobile,
    whatsapp: values.whatsapp,
    address: values.address,
    school: values.school,
    confession_father: values.confession_father,
    notes: values.notes,
    photo_url: values.photo_url,
  });

  if (result.error) {
    return { success: false, message: await translateChildError(result.error) };
  }

  if (result.data) {
    const birthdayToday = typeof values.date_of_birth === "string" && values.date_of_birth.length >= 10
      ? (() => {
          const [year, month, day] = values.date_of_birth.split("-").map(Number);
          const now = new Date();
          return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
            ? now.getMonth() + 1 === month && now.getDate() === day
            : false;
        })()
      : false;

    if (birthdayToday) {
      await sendNotification({
        churchId: null,
        recipientId: user.id,
        notificationType: "birthday",
        titleAr: "عيد ميلاد اليوم",
        titleEn: "Birthday today",
        bodyAr: `نتمنى لك عيد ميلاد سعيد، ${values.full_name_ar}`,
        bodyEn: `Happy birthday, ${values.full_name_ar}`,
        data: {
          type: "birthday",
          beneficiary_id: result.data.id,
          beneficiary_name: values.full_name_ar,
        },
      });
    }

    await writeAuditLog(supabase, "create", "child", result.data.id, undefined, {
      full_name_ar: values.full_name_ar,
    });
  }

  return {
    success: true,
    message: "Child created successfully.",
    data: result.data ?? undefined,
  };
}

export async function updateChildAction(
  childId: string,
  values: UpdateChildFormValues,
): Promise<ChildActionResult> {
  const idError = validateId(childId, "child ID");
  if (idError) return idError;

  try {
    updateChildSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.BENEFICIARIES_UPDATE))) {
    return { success: false, message: "You do not have permission to update children." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  const existing = await childService.getChildById(
    supabase,
    childId,
    profile.church_id,
    scope.churchWide ? undefined : scope.stageIds,
  );
  if (!existing.data) {
    return { success: false, message: existing.error ?? "Child not found." };
  }
  const oldValues = {
    full_name_ar: existing.data.full_name_ar,
    status: existing.data.status,
  };

  // Service/stage live on beneficiary_assignments, not beneficiaries. When the
  // edit form changed them, close the old current assignment and open a new one
  // through the transfer RPC (the table is RLS-immutable for direct writes).
  const movedStage =
    existing.data &&
    values.service_id &&
    values.stage_id &&
    (existing.data.serviceId !== values.service_id ||
      existing.data.stageId !== values.stage_id);

  // Moving a beneficiary between stages is a transfer: the dedicated
  // 'beneficiaries.transfer' permission and BOTH source + destination stage
  // scopes are required. Checks run before the UPDATE so a blocked move never
  // triggers a partial write.
  if (movedStage) {
    if (!(await hasPermission(PERMISSION_CODES.BENEFICIARIES_TRANSFER))) {
      return { success: false, message: await translateChildErrorKey("transferPermissionDenied") };
    }
    if (!isStageInScope(scope, existing.data.stageId)) {
      return { success: false, message: await translateChildErrorKey("transferFromStageDenied") };
    }
    if (!isStageInScope(scope, values.stage_id)) {
      return { success: false, message: await translateChildErrorKey("transferToStageDenied") };
    }
  }

  const result = await childService.updateChild(supabase, childId, profile.church_id, {
    full_name_ar: values.full_name_ar,
    full_name_en: values.full_name_en,
    date_of_birth: values.date_of_birth,
    gender: values.gender,
    service_id: values.service_id,
    stage_id: values.stage_id,
    status: values.status,
    father_mobile: values.father_mobile,
    mother_mobile: values.mother_mobile,
    mobile: values.mobile,
    whatsapp: values.whatsapp,
    address: values.address,
    school: values.school,
    confession_father: values.confession_father,
    notes: values.notes,
    photo_url: values.photo_url,
  });

  if (result.error) {
    return { success: false, message: await translateChildError(result.error) };
  }

  if (movedStage) {
    const transferResult = await childService.transferChild(supabase, childId, profile.church_id, {
      service_id: values.service_id,
      stage_id: values.stage_id,
    });
    if (transferResult.error) {
      return { success: false, message: await translateChildError(transferResult.error) };
    }
  }

  await writeAuditLog(supabase, "update", "child", childId, oldValues, {
    full_name_ar: values.full_name_ar,
    status: values.status,
    ...(movedStage ? { service_id: values.service_id, stage_id: values.stage_id } : {}),
  });

  return { success: true, message: "Child updated successfully." };
}

export async function transferChildAction(
  childId: string,
  values: TransferChildFormValues,
): Promise<ChildActionResult> {
  const idError = validateId(childId, "child ID");
  if (idError) return idError;

  try {
    transferChildSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.BENEFICIARIES_TRANSFER))) {
    return { success: false, message: await translateChildErrorKey("transferPermissionDenied") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  // Transfers need BOTH scopes: the source (the beneficiary's current stage)
  // and the destination. A transfer out of a stage the actor does not manage
  // would otherwise let a stage manager reassign church-wide beneficiaries.
  const currentStage = await childService.getBeneficiaryCurrentStage(
    supabase,
    profile.church_id,
    childId,
  );
  if (currentStage.error) {
    return { success: false, message: currentStage.error };
  }
  if (!currentStage.data) {
    return { success: false, message: await translateChildErrorKey("beneficiaryNotFound") };
  }
  if (!isStageInScope(scope, currentStage.data)) {
    return { success: false, message: await translateChildErrorKey("transferFromStageDenied") };
  }
  if (!isStageInScope(scope, values.stage_id)) {
    return { success: false, message: await translateChildErrorKey("transferToStageDenied") };
  }

  const result = await childService.transferChild(supabase, childId, profile.church_id, {
    service_id: values.service_id,
    stage_id: values.stage_id,
  });

  if (result.error) {
    return { success: false, message: await translateChildError(result.error) };
  }

  await writeAuditLog(supabase, "update", "child", childId, undefined, {
    service_id: values.service_id,
    stage_id: values.stage_id,
  });

  return { success: true, message: "Child transferred successfully." };
}

export async function deactivateChildAction(
  childId: string,
): Promise<ChildActionResult> {
  const idError = validateId(childId, "child ID");
  if (idError) return idError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.BENEFICIARIES_DELETE))) {
    return { success: false, message: "You do not have permission to delete children." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  const existing = await childService.getChildById(
    supabase,
    childId,
    profile.church_id,
    scope.churchWide ? undefined : scope.stageIds,
  );
  if (!existing.data) {
    return { success: false, message: existing.error ?? "Child not found." };
  }
  const oldValues = { full_name_ar: existing.data.full_name_ar, status: existing.data.status };

  const result = await childService.deactivateChild(supabase, childId, profile.church_id);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, "delete", "child", childId, oldValues, {
    deleted_at: new Date().toISOString(),
  });

  return { success: true, message: "Child deactivated successfully." };
}

// ─── Attendance Actions ─────────────────────────────────────

export async function createAttendanceAction(
  values: CreateAttendanceFormValues,
): Promise<ChildActionResult<{ id: string }>> {
  try {
    createAttendanceSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.ATTENDANCE_CREATE))) {
    return { success: false, message: "You do not have permission to record attendance." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  if (!isStageInScope(scope, values.stage_id)) {
    return { success: false, message: "You do not have permission to record attendance for this stage." };
  }

  const result = await childService.createAttendance(supabase, {
    beneficiary_id: values.beneficiary_id,
    stage_id: values.stage_id,
    service_id: values.service_id,
    attendance_date: values.attendance_date,
    status: values.status,
    notes: values.notes,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (result.data) {
    await writeAuditLog(supabase, "create", "attendance", result.data.id, undefined, {
      beneficiary_id: values.beneficiary_id,
      status: values.status,
    });
  }

  return {
    success: true,
    message: "Attendance recorded.",
    data: result.data ?? undefined,
  };
}

export async function toggleAttendanceAction(
  values: ToggleAttendanceFormValues,
): Promise<ChildActionResult<boolean>> {
  try {
    toggleAttendanceSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.ATTENDANCE_CREATE))) {
    return { success: false, message: "You do not have permission to record attendance." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  if (!isStageInScope(scope, values.stage_id)) {
    return { success: false, message: "You do not have permission to record attendance for this stage." };
  }

  const result = await childService.toggleAttendance(supabase, {
    beneficiary_id: values.beneficiary_id,
    stage_id: values.stage_id,
    service_id: values.service_id,
    attendance_date: values.attendance_date,
    status: values.status,
    notes: values.notes ?? null,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, values.status ? "update" : "delete", "attendance", values.beneficiary_id, undefined, {
    beneficiary_id: values.beneficiary_id,
    stage_id: values.stage_id,
    status: values.status ?? "removed",
  });

  return {
    success: true,
    message: values.status ? "Attendance updated." : "Attendance removed.",
    data: result.data ?? undefined,
  };
}

export async function batchAttendanceAction(
  values: BatchAttendanceFormValues,
): Promise<ChildActionResult<{ created: number; updated: number }>> {
  try {
    batchAttendanceSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.ATTENDANCE_CREATE))) {
    return { success: false, message: "You do not have permission to record attendance." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  if (!isStageInScope(scope, values.stage_id)) {
    return { success: false, message: "You do not have permission to record attendance for this stage." };
  }

  const result = await childService.batchAttendance(supabase, {
    stage_id: values.stage_id,
    service_id: values.service_id,
    attendance_date: values.attendance_date,
    records: values.records,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (values.records.some((record) => record.status === "absent")) {
    await sendNotification({
      churchId: null,
      recipientId: user.id,
      notificationType: "attendance_absence",
      titleAr: "غياب تم تسجيله",
      titleEn: "Absence recorded",
      bodyAr: `تم تسجيل ${values.records.filter((record) => record.status === "absent").length} غياب في الحضور اليومي.`,
      bodyEn: `${values.records.filter((record) => record.status === "absent").length} absences were recorded during the attendance session.`,
      data: {
        type: "attendance_absence",
        stage_id: values.stage_id,
        service_id: values.service_id,
        attendance_date: values.attendance_date,
      },
    });
  }

  await writeAuditLog(supabase, "create", "attendance", values.stage_id, undefined, {
    stage_id: values.stage_id,
    date: values.attendance_date,
    count: values.records.length,
  });

  return {
    success: true,
    message: "Attendance saved.",
    data: result.data ?? undefined,
  };
}

export async function listAttendanceAction(
  filters?: {
    beneficiary_id?: string;
    stage_id?: string;
    from_date?: string;
    to_date?: string;
  },
): Promise<ChildActionResult<AttendanceListItem[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.ATTENDANCE_READ))) {
    return { success: false, message: "You do not have permission to view attendance." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  const stageIds = scope.churchWide ? undefined : scope.stageIds;
  const result = await childService.listAttendance(supabase, profile.church_id, {
    ...filters,
    stageIds,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}

// ─── Followup Actions ───────────────────────────────────────

export async function createFollowupAction(
  values: CreateFollowupFormValues,
): Promise<ChildActionResult<{ id: string }>> {
  try {
    createFollowupSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.FOLLOWUPS_CREATE))) {
    return { success: false, message: "You do not have permission to create followups." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  const currentStage = await childService.getBeneficiaryCurrentStage(
    supabase,
    profile.church_id,
    values.beneficiary_id,
  );
  if (currentStage.error) {
    return { success: false, message: currentStage.error };
  }
  if (!isStageInScope(scope, currentStage.data)) {
    return { success: false, message: "You do not have permission to create followups for children outside your stages." };
  }

  const result = await childService.createFollowup(supabase, {
    beneficiary_id: values.beneficiary_id,
    type: values.type,
    scheduled_at: values.scheduled_at,
    assigned_to: values.assigned_to,
    notes: values.notes,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (result.data) {
    if (values.assigned_to) {
      await sendNotification({
        churchId: null,
        recipientId: values.assigned_to,
        notificationType: "followup_reminder",
        titleAr: "تذكير بمتابعة جديدة",
        titleEn: "New follow-up reminder",
        bodyAr: `تم تخصيص متابعة جديدة لك.`,
        bodyEn: `A new follow-up has been assigned to you.`,
        data: {
          type: "followup_reminder",
          followup_id: result.data.id,
          beneficiary_id: values.beneficiary_id,
          scheduled_at: values.scheduled_at ?? null,
        },
      });
    }

    await writeAuditLog(supabase, "create", "followup", result.data.id, undefined, {
      beneficiary_id: values.beneficiary_id,
      type: values.type,
    });
  }

  return {
    success: true,
    message: "Followup created.",
    data: result.data ?? undefined,
  };
}

export async function updateFollowupAction(
  followupId: string,
  values: UpdateFollowupFormValues,
): Promise<ChildActionResult> {
  const idError = validateId(followupId, "followup ID");
  if (idError) return idError;

  try {
    updateFollowupSchema.parse(values);
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

  if (!(await hasPermission(PERMISSION_CODES.FOLLOWUPS_UPDATE))) {
    return { success: false, message: "You do not have permission to update followups." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  const existing = await childService.getFollowupById(supabase, followupId, profile.church_id);
  if (!existing.data) {
    return { success: false, message: existing.error ?? "Followup not found." };
  }
  const oldValues = existing.data;

  const beneficiaryId = (existing.data as { beneficiary_id?: string }).beneficiary_id;
  if (!beneficiaryId) {
    return { success: false, message: "Followup has no beneficiary." };
  }

  const currentStage = await childService.getBeneficiaryCurrentStage(
    supabase,
    profile.church_id,
    beneficiaryId,
  );
  if (currentStage.error) {
    return { success: false, message: currentStage.error };
  }
  if (!isStageInScope(scope, currentStage.data)) {
    return { success: false, message: "You do not have permission to update followups for children outside your stages." };
  }

  const result = await childService.updateFollowup(supabase, followupId, profile.church_id, {
    status: values.status,
    outcome: values.outcome,
    notes: values.notes,
    assigned_to: values.assigned_to,
    scheduled_at: values.scheduled_at,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, "update", "followup", followupId, oldValues, values);

  return { success: true, message: "Followup updated." };
}

export async function deleteFollowupAction(
  followupId: string,
): Promise<ChildActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.FOLLOWUPS_DELETE))) {
    return { success: false, message: "You do not have permission to delete followups." };
  }

  const idError = validateId(followupId, "followup ID");
  if (idError) return idError;

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  const existing = await childService.getFollowupById(supabase, followupId, profile.church_id);
  if (!existing.data) {
    return { success: false, message: existing.error ?? "Followup not found." };
  }
  const oldValues = existing.data;

  const beneficiaryId = (existing.data as { beneficiary_id?: string }).beneficiary_id;
  if (!beneficiaryId) {
    return { success: false, message: "Followup has no beneficiary." };
  }

  const currentStage = await childService.getBeneficiaryCurrentStage(
    supabase,
    profile.church_id,
    beneficiaryId,
  );
  if (currentStage.error) {
    return { success: false, message: currentStage.error };
  }
  if (!isStageInScope(scope, currentStage.data)) {
    return { success: false, message: "You do not have permission to delete followups for children outside your stages." };
  }

  const result = await childService.deleteFollowup(supabase, followupId, profile.church_id);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, "delete", "followup", followupId, oldValues);

  return { success: true, message: "Followup deleted." };
}

export async function listFollowupsAction(
  filters?: {
    beneficiary_id?: string;
    status?: string;
    assigned_to?: string;
  },
): Promise<ChildActionResult<FollowupListItem[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.FOLLOWUPS_READ))) {
    return { success: false, message: "You do not have permission to view followups." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "User profile not found." };
  }

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  const stageIds = scope.churchWide ? undefined : scope.stageIds;
  const result = await childService.listFollowups(supabase, profile.church_id, {
    ...filters,
    stageIds,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}

// ─── Reference Data Actions ─────────────────────────────────

export async function listStagesAction(
  serviceId?: string,
): Promise<ChildActionResult<Pick<import("../types/child.types").StageRow, "id" | "name_ar" | "service_id">[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.BENEFICIARIES_READ))) {
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

  const { scope, message } = await getStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: message ?? "Failed to resolve stage scope." };
  }

  const result = await childService.listStages(
    supabase,
    profile.church_id,
    serviceId,
    scope.churchWide ? undefined : scope.stageIds,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}

export async function listServicesAction(): Promise<
  ChildActionResult<Pick<import("../types/child.types").MinistryRow, "id" | "name_ar">[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.BENEFICIARIES_READ))) {
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

  const result = await childService.listServices(supabase, profile.church_id);

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}

export async function listUsersAction(): Promise<
  ChildActionResult<Pick<import("../types/child.types").ProfileRow, "id" | "full_name_ar" | "full_name_en" | "email">[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.BENEFICIARIES_READ))) {
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

  const result = await childService.listUsers(supabase, profile.church_id);

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}
