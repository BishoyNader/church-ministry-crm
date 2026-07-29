"use server";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import type { DashboardData } from "../types/dashboard.types";
import * as dashboardService from "../services/dashboard.service";

export type DashboardActionResult = {
  success: boolean;
  message?: string;
  data?: DashboardData;
};

export async function getDashboardDataAction(): Promise<DashboardActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.REPORTS_READ))) {
    return {
      success: false,
      message: "You do not have permission to view reports.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const result = await dashboardService.getDashboardData(
    supabase,
    profile.church_id,
  );

  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: result.data ?? undefined };
}
