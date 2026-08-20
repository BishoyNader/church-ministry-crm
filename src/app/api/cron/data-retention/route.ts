import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BILLING_CONFIG } from "@/features/billing/types/billing.types";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const log = createLogger("cron.data-retention");

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;

  return safeEqual(expected, authorization.slice("Bearer ".length));
}

/**
 * GET /api/cron/data-retention
 *
 * Enforces the 6-month data retention policy for soft-deleted churches.
 * Any church deleted more than 180 days ago has its child data (beneficiaries,
 * attendance, followups) permanently removed.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    await log.warn("cron_unauthorized");
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const retentionDays = BILLING_CONFIG.dataRetentionDays;
    const retentionCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    // Find churches that were soft-deleted more than 180 days ago
    const { data: expiredChurches, error: queryError } = await supabase
      .from("churches")
      .select("id, name_ar")
      .not("deleted_at", "is", null)
      .lt("deleted_at", retentionCutoff);

    if (queryError) {
      throw new Error(`Failed to query expired churches: ${queryError.message}`);
    }

    let processedCount = 0;
    let totalRowsDeleted = 0;

    for (const church of expiredChurches ?? []) {
      // Delete data in FK-safe order: tables that reference other tables
      // must be cleaned before the tables they reference.
      const tables = [
        "event_registrations",
        "attendance_records",
        "followups",
        "beneficiary_assignments",
        "beneficiaries",
      ];

      let churchRowsDeleted = 0;

      for (const table of tables) {
        // Only delete rows belonging to this church
        // Most tables have church_id; beneficiary_assignments has church_id too
        const { count, error: deleteError } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .eq("church_id", church.id);

        if (!deleteError && count) {
          churchRowsDeleted += count;
        }
      }

      // Delete other church-scoped data that has passed retention
      const additionalTables = [
        "notifications",
        "audit_logs",
        "attendance_sessions",
        "user_roles",
      ];

      for (const table of additionalTables) {
        const { count, error: deleteError } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .eq("church_id", church.id);

        if (!deleteError && count) {
          churchRowsDeleted += count;
        }
      }

      // Finally, permanently delete the church record itself
      const { error: churchDeleteError } = await supabase
        .from("churches")
        .delete()
        .eq("id", church.id);

      if (!churchDeleteError) {
        processedCount++;
        totalRowsDeleted += churchRowsDeleted;
      }
    }

    const durationMs = Date.now() - startedAt;
    await log.info("cron_run_completed", {
      churchesProcessed: processedCount,
      totalRowsDeleted,
      durationMs,
    });

    return NextResponse.json({
      ok: true,
      churchesProcessed: processedCount,
      totalRowsDeleted,
      durationMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data retention run failed.";
    await log.error("cron_run_failed", { err: error });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
