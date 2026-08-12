import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runAnnualPromotionScan } from "@/features/promotions/cron/annual-promotion.service";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const log = createLogger("cron.annual-promotion");

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
 * GET /api/cron/annual-promotion
 *
 * Scheduled Annual Promotion Automation (September 11, see vercel.json) — runs
 * the church-wide annual promotion/graduation for the current year through the
 * service-role RPC run_annual_promotions_auto (migration 047). Idempotent per
 * stage + year; affected servant assignments are only published by
 * confirm_promotion_cycle() (migration 049). Server-only; never mounted as a
 * client route. Guarded by the same CRON_SECRET bearer check as the
 * notification cron.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    await log.warn("cron_unauthorized");
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAnnualPromotionScan();
  await log.info("cron_run_completed", {
    ok: result.ok,
    durationMs: Date.now() - startedAt,
    year: result.year,
    scannedStages: result.scannedStages,
    appliedRuns: result.appliedRuns,
    noOpRuns: result.noOpRuns,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
