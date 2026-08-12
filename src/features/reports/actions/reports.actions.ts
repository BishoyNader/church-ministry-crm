"use server";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { getActorStageScope } from "@/features/rbac/utils/stage-scope";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import * as reportsService from "../services/reports.service";
import type {
  DailyAttendanceRow,
  ReportsActionResult,
  ReportsData,
  ReportsFilters,
  ReportsFilterOptions,
} from "../types/reports.types";

export async function getReportsFilterOptionsAction(): Promise<ReportsActionResult<ReportsFilterOptions>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.REPORTS_READ))) {
    return { success: false, message: "You do not have permission to view reports." };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const { scope, error } = await getActorStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await reportsService.getReportsFilterOptions(
    supabase,
    profile.church_id,
    scope.churchWide ? undefined : scope.stageIds,
  );
  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function getReportsDataAction(filters: ReportsFilters = {}): Promise<ReportsActionResult<ReportsData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.REPORTS_READ))) {
    return { success: false, message: "You do not have permission to view reports." };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const { scope, error } = await getActorStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await reportsService.getReportsData(
    supabase,
    profile.church_id,
    filters,
    scope.churchWide ? undefined : scope.stageIds,
  );
  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function getDailyAttendanceBreakdownAction(
  filters: ReportsFilters = {},
): Promise<ReportsActionResult<DailyAttendanceRow[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.REPORTS_READ))) {
    return { success: false, message: "You do not have permission to view reports." };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const { scope, error } = await getActorStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await reportsService.getDailyAttendanceBreakdown(
    supabase,
    profile.church_id,
    filters,
    scope.churchWide ? undefined : scope.stageIds,
  );
  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? [] };
}

export async function exportReportsCsvAction(filters: ReportsFilters = {}): Promise<ReportsActionResult<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.REPORTS_EXPORT))) {
    return { success: false, message: "You do not have permission to export reports." };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const { scope, error } = await getActorStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await reportsService.getReportsData(
    supabase,
    profile.church_id,
    filters,
    scope.churchWide ? undefined : scope.stageIds,
  );
  if (result.error || !result.data) {
    return { success: false, message: result.error ?? "Failed to load reports data." };
  }

  const csv = reportsService.toCsv(result.data);
  return { success: true, data: csv };
}
