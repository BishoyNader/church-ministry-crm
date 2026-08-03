import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalCenterStats } from "../types/approval.types";

type ServiceResult<T> = { data: T | null; error: string | null };

export async function getApprovalStats(
  supabase: SupabaseClient,
  churchId: string,
): Promise<ServiceResult<ApprovalCenterStats>> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: pendingServants }, { count: approvedServantsLast30d }, { count: rejectedServants }] =
      await Promise.all([
        supabase
          .from("servants")
          .select("id", { count: "exact", head: true })
          .eq("church_id", churchId)
          .eq("approval_status", "pending")
          .is("deleted_at", null),
        supabase
          .from("servants")
          .select("id", { count: "exact", head: true })
          .eq("church_id", churchId)
          .eq("approval_status", "approved")
          .gte("approved_at", thirtyDaysAgo)
          .is("deleted_at", null),
        supabase
          .from("servants")
          .select("id", { count: "exact", head: true })
          .eq("church_id", churchId)
          .eq("approval_status", "rejected")
          .is("deleted_at", null),
      ]);

    return {
      data: {
        pendingServants: pendingServants ?? 0,
        approvedServantsLast30d: approvedServantsLast30d ?? 0,
        rejectedServants: rejectedServants ?? 0,
        pendingChurchRequests: 0,
        canReviewChurchRequests: false,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load approval statistics." };
  }
}
