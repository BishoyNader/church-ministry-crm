"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { approveServantAction } from "@/features/users/actions/approval.actions";
import { assignRolesAction } from "@/features/users/actions/user.actions";
import { assignServantStagesAction } from "@/features/servants/actions/servant.actions";
import { getApprovalStats } from "../services/approval-center.service";
import type { ApprovalCenterStats } from "../types/approval.types";

export type ApprovalCenterActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

const provisionSchema = z.object({
  servantId: z.string().uuid(),
  roleIds: z.array(z.string().uuid()).max(10),
  stageIds: z.array(z.string().uuid()).max(50),
});

export async function getApprovalCenterStatsAction(): Promise<
  ApprovalCenterActionResult<ApprovalCenterStats>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  const churchId = profile?.church_id ?? null;

  const [canApproveServants, canReviewChurchRequests] = await Promise.all([
    hasPermission(PERMISSION_CODES.SERVANTS_APPROVE),
    hasPermission(PERMISSION_CODES.TENANTS_READ),
  ]);

  const stats: ApprovalCenterStats = {
    pendingServants: 0,
    approvedServantsLast30d: 0,
    rejectedServants: 0,
    pendingChurchRequests: 0,
    canReviewChurchRequests,
  };

  if (canApproveServants && churchId) {
    const servantStats = await getApprovalStats(supabase, churchId);
    if (servantStats.data) {
      stats.pendingServants = servantStats.data.pendingServants;
      stats.approvedServantsLast30d = servantStats.data.approvedServantsLast30d;
      stats.rejectedServants = servantStats.data.rejectedServants;
    }
  }

  if (canReviewChurchRequests) {
    const { count } = await supabase
      .from("church_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    stats.pendingChurchRequests = count ?? 0;
  }

  return { success: true, data: stats };
}

export async function approveServantWithProvisionAction(
  servantId: string,
  roleIds: string[],
  stageIds: string[],
): Promise<ApprovalCenterActionResult> {
  let parsed;
  try {
    parsed = provisionSchema.parse({ servantId, roleIds, stageIds });
  } catch {
    return { success: false, message: "Please fix the highlighted fields." };
  }

  const approve = await approveServantAction(parsed.servantId);
  if (!approve.success) {
    return { success: false, message: approve.message };
  }

  if (parsed.roleIds.length > 0) {
    const roles = await assignRolesAction(parsed.servantId, parsed.roleIds);
    if (!roles.success) {
      return {
        success: false,
        message: `Registration approved but role assignment failed: ${roles.message}`,
      };
    }
  }

  if (parsed.stageIds.length > 0) {
    const stages = await assignServantStagesAction(parsed.servantId, parsed.stageIds);
    if (!stages.success) {
      return {
        success: false,
        message: `Registration approved but stage assignment failed: ${stages.message}`,
      };
    }
  }

  return { success: true, message: "Registration approved and provisioned." };
}
