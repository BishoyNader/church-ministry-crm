"use server";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import {
  createChildSchema,
  updateChildSchema,
  transferChildSchema,
  createAttendanceSchema,
  batchAttendanceSchema,
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
import * as childService from "../services/child.service";
import { ZodError } from "zod";

export type ChildActionResult<T = unknown> = {
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
  try {
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

    const { error } = await supabase.from("audit_logs").insert({
      church_id: profile.church_id,
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
    });

    if (error) {
      console.error(`[audit] Failed to write audit log for ${entityType}:${entityId}:`, error.message);
    }
  } catch (err) {
    console.error(`[audit] Unexpected error writing audit log for ${entityType}:${entityId}:`, err);
  }
}

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

// ─── Child Actions ──────────────────────────────────────────

export async function listChildrenAction(
  filters?: {
    search?: string;
    ministry_id?: string;
    stage_id?: string;
    status?: string;
    pipeline_stage?: string;
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

  if (!(await hasPermission(PERMISSION_CODES.CHILDREN_READ))) {
    return { success: false, message: "You do not have permission to view children." };
  }

  const result = await childService.listChildren(supabase, filters, pagination);

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

  if (!(await hasPermission(PERMISSION_CODES.CHILDREN_READ))) {
    return { success: false, message: "You do not have permission to view children." };
  }

  const result = await childService.getChildById(supabase, childId);

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

  if (!(await hasPermission(PERMISSION_CODES.CHILDREN_CREATE))) {
    return { success: false, message: "You do not have permission to create children." };
  }

  const result = await childService.createChild(supabase, {
    first_name_ar: values.first_name_ar,
    first_name_en: values.first_name_en,
    last_name_ar: values.last_name_ar,
    last_name_en: values.last_name_en,
    date_of_birth: values.date_of_birth,
    gender: values.gender,
    ministry_id: values.ministry_id,
    stage_id: values.stage_id,
    pipeline_stage: values.pipeline_stage,
    parent_phone: values.parent_phone,
    parent_email: values.parent_email,
    parent_address_ar: values.parent_address_ar,
    father_name_ar: values.father_name_ar,
    mother_name_ar: values.mother_name_ar,
    emergency_contact_name: values.emergency_contact_name,
    emergency_contact_phone: values.emergency_contact_phone,
    mobile: values.mobile,
    allergies: values.allergies,
    medical_conditions: values.medical_conditions,
    medications: values.medications,
    baptism_date: values.baptism_date,
    confession_frequency: values.confession_frequency,
    spiritual_notes: values.spiritual_notes,
    school_name_ar: values.school_name_ar,
    grade_level: values.grade_level,
    notes: values.notes,
    photo_url: values.photo_url,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (result.data) {
    await auditLog(supabase, "create", "child", result.data.id, undefined, {
      first_name_ar: values.first_name_ar,
      last_name_ar: values.last_name_ar,
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

  if (!(await hasPermission(PERMISSION_CODES.CHILDREN_UPDATE))) {
    return { success: false, message: "You do not have permission to update children." };
  }

  const existing = await childService.getChildById(supabase, childId);
  const oldValues = existing.data
    ? {
        first_name_ar: existing.data.first_name_ar,
        status: existing.data.status,
        pipeline_stage: existing.data.pipeline_stage,
      }
    : undefined;

  const result = await childService.updateChild(supabase, childId, {
    first_name_ar: values.first_name_ar,
    first_name_en: values.first_name_en,
    last_name_ar: values.last_name_ar,
    last_name_en: values.last_name_en,
    date_of_birth: values.date_of_birth,
    gender: values.gender,
    ministry_id: values.ministry_id,
    stage_id: values.stage_id,
    pipeline_stage: values.pipeline_stage,
    status: values.status,
    parent_phone: values.parent_phone,
    parent_email: values.parent_email,
    parent_address_ar: values.parent_address_ar,
    father_name_ar: values.father_name_ar,
    mother_name_ar: values.mother_name_ar,
    emergency_contact_name: values.emergency_contact_name,
    emergency_contact_phone: values.emergency_contact_phone,
    mobile: values.mobile,
    allergies: values.allergies,
    medical_conditions: values.medical_conditions,
    medications: values.medications,
    baptism_date: values.baptism_date,
    confession_frequency: values.confession_frequency,
    spiritual_notes: values.spiritual_notes,
    school_name_ar: values.school_name_ar,
    grade_level: values.grade_level,
    notes: values.notes,
    photo_url: values.photo_url,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await auditLog(supabase, "update", "child", childId, oldValues, {
    first_name_ar: values.first_name_ar,
    status: values.status,
    pipeline_stage: values.pipeline_stage,
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

  if (!(await hasPermission(PERMISSION_CODES.CHILDREN_UPDATE))) {
    return { success: false, message: "You do not have permission to update children." };
  }

  const existing = await childService.getChildById(supabase, childId);
  const oldValues = existing.data
    ? { ministry_id: existing.data.ministry_id, stage_id: existing.data.stage_id }
    : undefined;

  const result = await childService.transferChild(supabase, childId, {
    ministry_id: values.ministry_id,
    stage_id: values.stage_id,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await auditLog(supabase, "update", "child", childId, oldValues, {
    ministry_id: values.ministry_id,
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

  if (!(await hasPermission(PERMISSION_CODES.CHILDREN_DELETE))) {
    return { success: false, message: "You do not have permission to delete children." };
  }

  const existing = await childService.getChildById(supabase, childId);
  const oldValues = existing.data
    ? { first_name_ar: existing.data.first_name_ar, status: existing.data.status }
    : undefined;

  const result = await childService.deactivateChild(supabase, childId);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await auditLog(supabase, "delete", "child", childId, oldValues, {
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

  const result = await childService.createAttendance(supabase, {
    child_id: values.child_id,
    stage_id: values.stage_id,
    attendance_date: values.attendance_date,
    status: values.status,
    notes: values.notes,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (result.data) {
    await auditLog(supabase, "create", "attendance", result.data.id, undefined, {
      child_id: values.child_id,
      status: values.status,
    });
  }

  return {
    success: true,
    message: "Attendance recorded.",
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

  if (!(await hasPermission(PERMISSION_CODES.ATTENDANCE_UPDATE))) {
    return { success: false, message: "You do not have permission to update attendance." };
  }

  const result = await childService.batchAttendance(supabase, {
    stage_id: values.stage_id,
    attendance_date: values.attendance_date,
    records: values.records,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await auditLog(supabase, "create", "attendance", values.stage_id, undefined, {
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
    child_id?: string;
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

  const result = await childService.listAttendance(supabase, filters);

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

  const result = await childService.createFollowup(supabase, {
    child_id: values.child_id,
    stage_id: values.stage_id,
    type: values.type,
    scheduled_at: values.scheduled_at,
    assigned_to: values.assigned_to,
    notes: values.notes,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (result.data) {
    await auditLog(supabase, "create", "followup", result.data.id, undefined, {
      child_id: values.child_id,
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

  const existing = await childService.getFollowupById(supabase, followupId);
  const oldValues = existing.data ?? undefined;

  const result = await childService.updateFollowup(supabase, followupId, {
    status: values.status,
    outcome: values.outcome,
    notes: values.notes,
    assigned_to: values.assigned_to,
    scheduled_at: values.scheduled_at,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await auditLog(supabase, "update", "followup", followupId, oldValues, values);

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

  const existing = await childService.getFollowupById(supabase, followupId);
  const oldValues = existing.data ?? undefined;

  const result = await childService.deleteFollowup(supabase, followupId);

  if (result.error) {
    return { success: false, message: result.error };
  }

  await auditLog(supabase, "delete", "followup", followupId, oldValues);

  return { success: true, message: "Followup deleted." };
}

export async function listFollowupsAction(
  filters?: {
    child_id?: string;
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

  const result = await childService.listFollowups(supabase, filters);

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}

// ─── Reference Data Actions ─────────────────────────────────

export async function listStagesAction(
  ministryId?: string,
): Promise<ChildActionResult<Pick<import("../types/child.types").StageRow, "id" | "name_ar" | "ministry_id">[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.CHILDREN_READ))) {
    return { success: false, message: "You do not have permission to view stages." };
  }

  const result = await childService.listStages(supabase, ministryId);

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}

export async function listMinistriesAction(): Promise<
  ChildActionResult<Pick<import("../types/child.types").MinistryRow, "id" | "name_ar">[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.CHILDREN_READ))) {
    return { success: false, message: "You do not have permission to view ministries." };
  }

  const result = await childService.listMinistries(supabase);

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

  if (!(await hasPermission(PERMISSION_CODES.CHILDREN_READ))) {
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
