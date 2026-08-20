import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BILLING_CONFIG } from "@/features/billing/types/billing.types";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const log = createLogger("cron.subscription-lifecycle");

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
 * GET /api/cron/subscription-lifecycle
 *
 * Daily subscription lifecycle automation:
 * 1. Expire → Grace: active paid subscriptions past expiry → set status='grace'
 * 2. Grace → Free: grace churches past grace window → downgrade to free
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    await log.warn("cron_unauthorized");
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const graceDays = BILLING_CONFIG.gracePeriodDays;
    const graceCutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000).toISOString();

    // Step 1: Expire → Grace
    // Active paid subscriptions whose expiry has passed get status='grace'
    const { data: expiredChurches, error: expireError } = await supabase
      .from("churches")
      .select("id, name_ar, subscription_tier, subscription_expires_at")
      .eq("subscription_status", "active")
      .in("subscription_tier", ["monthly", "yearly"])
      .lt("subscription_expires_at", now)
      .is("deleted_at", null);

    if (expireError) {
      throw new Error(`Failed to query expired churches: ${expireError.message}`);
    }

    let expiredCount = 0;
    for (const church of expiredChurches ?? []) {
      const { error: updateError } = await supabase
        .from("churches")
        .update({ subscription_status: "grace" })
        .eq("id", church.id)
        .eq("subscription_status", "active");

      if (!updateError) {
        expiredCount++;
        await log.info("church_entered_grace", {
          churchId: church.id,
          tier: church.subscription_tier,
        });
      }
    }

    // Step 2: Grace → Free
    // Churches in grace period past the grace window get downgraded to free
    const { data: graceChurches, error: graceError } = await supabase
      .from("churches")
      .select("id, name_ar, subscription_tier")
      .eq("subscription_status", "grace")
      .lt("subscription_expires_at", graceCutoff)
      .is("deleted_at", null);

    if (graceError) {
      throw new Error(`Failed to query grace churches: ${graceError.message}`);
    }

    let downgradedCount = 0;
    for (const church of graceChurches ?? []) {
      const { error: updateError } = await supabase
        .from("churches")
        .update({
          subscription_tier: "free",
          subscription_status: "active",
          subscription_expires_at: null,
        })
        .eq("id", church.id)
        .eq("subscription_status", "grace");

      if (!updateError) {
        downgradedCount++;
        await log.info("church_downgraded_to_free", {
          churchId: church.id,
          previousTier: church.subscription_tier,
        });
      }
    }

    const durationMs = Date.now() - startedAt;
    await log.info("cron_run_completed", {
      expiredToGrace: expiredCount,
      graceToFree: downgradedCount,
      durationMs,
    });

    return NextResponse.json({
      ok: true,
      expiredToGrace: expiredCount,
      graceToFree: downgradedCount,
      durationMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Subscription lifecycle run failed.";
    await log.error("cron_run_failed", { err: error });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
