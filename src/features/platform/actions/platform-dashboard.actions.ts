"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { getChurchSummary } from "@/features/churches/services/church-admin.service";
import type { Database } from "@/types/database.types";
import type {
  PlatformDashboardActionResult,
  PlatformDashboardStats,
  PlatformRecentAuditEntry,
} from "../types/platform-dashboard.types";

const EMPTY_SUMMARY = { total: 0, active: 0, inactive: 0, suspended: 0, disabled: 0 };

type DbClient = SupabaseClient<Database>;

async function authorize(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return hasPermission(PERMISSION_CODES.TENANTS_READ);
}

export async function getPlatformDashboardStatsAction(): Promise<
  PlatformDashboardActionResult<PlatformDashboardStats>
> {
  if (!(await authorize())) {
    return { success: false, message: "Only a platform owner can view the dashboard." };
  }

  const admin = createAdminClient();

  const { data: churches } = await getChurchSummary(admin);

  const requests = { pending: 0, approved: 0, rejected: 0 };
  for (const status of ["pending", "approved", "rejected"] as const) {
    const { count } = await admin
      .from("church_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    requests[status] = count ?? 0;
  }

  const { count: users } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  const { count: servants } = await admin
    .from("servants")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  const { count: beneficiaries } = await admin
    .from("beneficiaries")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  const reviewed = requests.approved + requests.rejected;
  const approvalRate = reviewed > 0 ? Math.round((requests.approved / reviewed) * 100) : null;

  return {
    success: true,
    message: "Platform dashboard loaded.",
    data: {
      churches: churches ?? EMPTY_SUMMARY,
      requests,
      users: users ?? 0,
      servants: servants ?? 0,
      beneficiaries: beneficiaries ?? 0,
      approvalRate,
    },
  };
}

export async function getPlatformRecentAuditAction(
  limit = 8,
): Promise<PlatformDashboardActionResult<PlatformRecentAuditEntry[]>> {
  if (!(await authorize())) {
    return { success: false, message: "Only a platform owner can view the dashboard." };
  }

  const db = createAdminClient() as DbClient;
  const { data, error } = await db
    .from("audit_logs")
    .select(
      "id, church_id, actor_id, action, entity_type, entity_id, created_at, profiles(full_name_ar, full_name_en, email), churches(name_ar)",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(20, Math.max(1, limit)));

  if (error) {
    return { success: false, message: error.message };
  }

  const rows: PlatformRecentAuditEntry[] = (data ?? []).map((row) => ({
    id: row.id,
    churchId: row.church_id,
    churchNameAr: row.churches?.name_ar ?? null,
    actorName: row.profiles?.full_name_ar ?? row.profiles?.full_name_en ?? null,
    actorEmail: row.profiles?.email ?? null,
    action: row.action,
    entityType: row.entity_type,
    createdAt: row.created_at,
  }));

  return { success: true, message: "Audit feed loaded.", data: rows };
}
