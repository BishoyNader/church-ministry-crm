import { NextResponse } from "next/server";
import { getRuntimeDiagnostics } from "@/lib/monitoring";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("monitoring.diagnostics");

/**
 * GET /api/monitoring/diagnostics
 *
 * Operator-only runtime introspection. No data or secrets — just process
 * metrics and environment-presence booleans. Access is restricted to the
 * operator bearer token (DIAGNOSTICS_TOKEN) when configured, or the
 * CRON_SECRET as a fallback gate for self-hosted deployments.
 */
export async function GET(request: Request) {
  const expected = process.env.DIAGNOSTICS_TOKEN ?? process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (expected && !authorization.startsWith(`Bearer ${expected}`)) {
    await log.warn("diagnostics_access_denied");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await log.info("diagnostics_requested");
  return NextResponse.json(getRuntimeDiagnostics(), {
    headers: { "Cache-Control": "no-store" },
  });
}
