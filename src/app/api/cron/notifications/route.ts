import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runNotificationScheduler } from "@/features/notifications/cron/notification-scheduler.service";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
// Cron scans iterate all churches and several tables; allow Vercel's long
// non-streaming execution window instead of the default 10s / 300s Hobby cap.
export const maxDuration = 300;

const log = createLogger("cron.notifications");

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Authorization guard for the Vercel Cron invocation.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` for every scheduled run.
 * The same header is used for manual/self-test calls. No secret is ever
 * accepted via query string (URLs can leak through logs/proxies).
 */
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;

  return safeEqual(expected, authorization.slice("Bearer ".length));
}

/**
 * GET /api/cron/notifications
 *
 * Scheduled Notification Automation — see
 * src/features/notifications/cron/notification-scheduler.service.ts for the
 * scan implementations. Server-only: never mounted as a client route, uses the
 * privileged service-role client with explicit church-scoped queries, dedupes
 * per recipient/entity/day, and audits every run.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    await log.warn("cron_unauthorized");
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runNotificationScheduler();
    await log.info("cron_run_completed", {
      ok: result.ok,
      runId: result.runId ?? null,
      durationMs: Date.now() - startedAt,
      scans: Array.isArray(result.scans) ? result.scans.length : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification automation run failed.";
    await log.error("cron_run_failed", { err: error });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
