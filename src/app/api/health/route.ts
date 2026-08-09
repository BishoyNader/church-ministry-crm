import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRuntimeDiagnostics } from "@/lib/monitoring";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("health");

// Track process start time for uptime reporting
const PROCESS_START_TIME = Date.now();

/**
 * GET /api/health
 *
 * Lightweight uptime probe for infrastructure monitoring. Verifies:
 *  - The Supabase environment is configured (admin client resolves).
 *  - A read against the database succeeds.
 *  - Critical environment variables are present.
 *
 * Exposes only booleans and latency — never schema, counts, or data.
 * Uses the server-side service-role client (bypasses RLS, read-only probe);
 * the service-role key never leaves the server and no rows are returned.
 * Includes coarse runtime diagnostics for operator dashboards.
 */
export async function GET() {
  const startedAt = Date.now();
  let database = "unavailable";
  const checks = {
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleConfigured: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
  };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (error) {
      database = "error";
      await log.error("health_check_db_failed", { message: error.message });
    } else {
      database = "ok";
    }
  } catch (err) {
    database = "unconfigured";
    await log.error("health_check_client_failed", { err });
  }

  const latencyMs = Date.now() - startedAt;
  const uptimeSeconds = Math.floor((Date.now() - PROCESS_START_TIME) / 1000);
  const ok =
    database === "ok" &&
    checks.supabaseUrlConfigured &&
    checks.supabaseAnonConfigured;

  const runtime = getRuntimeDiagnostics();

  return NextResponse.json(
    {
      ok,
      status: ok ? "healthy" : "degraded",
      database,
      checks,
      latencyMs,
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
      runtime: {
        nodeVersion: runtime.nodeVersion,
        runtime: runtime.runtime,
        memoryMb: runtime.memoryMb,
        loadAvg: runtime.loadAvg,
      },
      buildTime: runtime.buildTime,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
