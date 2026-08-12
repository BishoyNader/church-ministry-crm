"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import {
  getActorStageScope,
  isStageInScope,
} from "@/features/rbac/utils/stage-scope";
import type { ActorStageScope } from "@/features/rbac/utils/stage-scope";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import {
  batchServantAttendanceSchema,
  servantAttendanceHistorySchema,
  servantAttendanceListSchema,
} from "../schemas/servant-attendance.schema";
import type {
  BatchServantAttendanceFormValues,
  ServantAttendanceListFormValues,
} from "../schemas/servant-attendance.schema";
import type {
  ServantAttendanceData,
  ServantAttendanceHistoryItem,
} from "../types/servant-attendance.types";
import * as servantAttendanceService from "../services/servant-attendance.service";
import { ZodError } from "zod";

export type ServantAttendanceActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  data?: T;
};

function handleZodError(error: unknown): ServantAttendanceActionResult<never> {
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

type ScopeContext =
  | { churchId: string; scope: ActorStageScope; userId: string }
  | { error: string };

async function getChurchScope(
  supabase: SupabaseClient,
): Promise<ScopeContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: "User profile not found." };
  }

  const result = await getActorStageScope(supabase, profile.church_id, user.id);
  if (result.error || !result.scope) {
    return { error: result.error ?? "Failed to resolve stage scope." };
  }

  return { churchId: profile.church_id, scope: result.scope, userId: user.id };
}

/**
 * Servant attendance has exactly two authorized levels:
 *   - Church Manager / sector admin (super_admin / admin → church-wide scope)
 *   - Stage Manager (أمين مرحلة) — within their authorized scope
 * A plain servant holds attendance.create for BENEFICIARY attendance, but must
 * never record SERVANT attendance.
 */
async function isAttendanceKeeper(
  supabase: SupabaseClient,
  ctx: Extract<ScopeContext, { churchId: string }>,
): Promise<boolean> {
  if (ctx.scope.churchWide) {
    return true;
  }
  const { data: grants } = await supabase
    .from("user_roles")
    .select("roles(role_type)")
    .eq("user_id", ctx.userId)
    .eq("church_id", ctx.churchId)
    .is("end_date", null);

  return (grants ?? []).some(
    (grant) =>
      (grant as { roles?: { role_type?: string } | null })?.roles?.role_type ===
      "stage_manager",
  );
}

/**
 * Server-side relationship validation: the stage must exist inside the actor's
 * church AND belong to the selected service. Never trust client ids alone.
 */
async function validateStage(
  supabase: SupabaseClient,
  churchId: string,
  stageId: string,
  serviceId?: string,
): Promise<string | null> {
  const { data: stage } = await supabase
    .from("stages")
    .select("id, service_id")
    .eq("id", stageId)
    .eq("church_id", churchId)
    .maybeSingle();

  if (!stage) {
    return "Stage not found.";
  }
  if (serviceId && stage.service_id !== serviceId) {
    return "Stage does not belong to the selected service.";
  }
  return null;
}

export async function listServantAttendanceAction(
  values: ServantAttendanceListFormValues,
): Promise<ServantAttendanceActionResult<ServantAttendanceData & { attendanceDate: string }>> {
  try {
    servantAttendanceListSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const ctx = await getChurchScope(supabase);
  if ("error" in ctx) {
    return { success: false, message: ctx.error };
  }

  if (!(await hasPermission(PERMISSION_CODES.ATTENDANCE_READ))) {
    return {
      success: false,
      message: "You do not have permission to view attendance.",
    };
  }
  if (!(await isAttendanceKeeper(supabase, ctx))) {
    return {
      success: false,
      message: "You do not have permission to view servant attendance.",
    };
  }

  const { service_id, stage_id, attendance_date } = values;
  if (!stage_id || !service_id || !attendance_date) {
    return {
      success: true,
      data: { attendees: [], records: {}, attendanceDate: "" },
    };
  }

  if (!isStageInScope(ctx.scope, stage_id)) {
    return {
      success: false,
      message:
        "You do not have permission to view servant attendance for this stage.",
    };
  }

  const stageError = await validateStage(supabase, ctx.churchId, stage_id, service_id);
  if (stageError) {
    return { success: false, message: stageError };
  }

  const result = await servantAttendanceService.listServantAttendance(supabase, {
    churchId: ctx.churchId,
    serviceId: service_id,
    stageId: stage_id,
    attendanceDate: attendance_date,
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  return {
    success: true,
    data: { ...result.data!, attendanceDate: attendance_date },
  };
}

export async function batchServantAttendanceAction(
  values: BatchServantAttendanceFormValues,
): Promise<ServantAttendanceActionResult<{ created: number; updated: number }>> {
  try {
    batchServantAttendanceSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const ctx = await getChurchScope(supabase);
  if ("error" in ctx) {
    return { success: false, message: ctx.error };
  }

  if (!(await hasPermission(PERMISSION_CODES.ATTENDANCE_CREATE))) {
    return {
      success: false,
      message: "You do not have permission to record attendance.",
    };
  }
  if (!(await isAttendanceKeeper(supabase, ctx))) {
    return {
      success: false,
      message: "You do not have permission to record servant attendance.",
    };
  }

  if (!isStageInScope(ctx.scope, values.stage_id)) {
    return {
      success: false,
      message: "You do not have permission to record servant attendance for this stage.",
    };
  }

  const stageError = await validateStage(
    supabase,
    ctx.churchId,
    values.stage_id,
    values.service_id,
  );
  if (stageError) {
    return { success: false, message: stageError };
  }

  const result = await servantAttendanceService.batchServantAttendance(supabase, {
    churchId: ctx.churchId,
    serviceId: values.service_id,
    stageId: values.stage_id,
    attendanceDate: values.attendance_date,
    records: values.records.map((record) => ({
      servant_id: record.servant_id,
      status: record.status,
      notes: record.notes,
    })),
  });

  if (result.error) {
    return { success: false, message: result.error };
  }

  await writeAuditLog(supabase, "create", "attendance", values.stage_id, undefined, {
    subject: "servant",
    stage_id: values.stage_id,
    date: values.attendance_date,
    count: values.records.length,
  });

  return {
    success: true,
    message: "Servant attendance saved.",
    data: result.data ?? undefined,
  };
}

export async function listServantAttendanceHistoryAction(
  stageId: string,
): Promise<ServantAttendanceActionResult<ServantAttendanceHistoryItem[]>> {
  try {
    servantAttendanceHistorySchema.parse({ stage_id: stageId });
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const ctx = await getChurchScope(supabase);
  if ("error" in ctx) {
    return { success: false, message: ctx.error };
  }

  if (!(await hasPermission(PERMISSION_CODES.ATTENDANCE_READ))) {
    return {
      success: false,
      message: "You do not have permission to view attendance.",
    };
  }
  if (!(await isAttendanceKeeper(supabase, ctx))) {
    return {
      success: false,
      message: "You do not have permission to view servant attendance.",
    };
  }

  if (!isStageInScope(ctx.scope, stageId)) {
    return {
      success: false,
      message:
        "You do not have permission to view servant attendance for this stage.",
    };
  }

  const result = await servantAttendanceService.listServantAttendanceHistory(
    supabase,
    { churchId: ctx.churchId, stageId },
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}
