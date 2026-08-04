import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
      console.error("Health check DB read failed:", error.message);
    } else {
      database = "ok";
    }
  } catch (err) {
    database = "unconfigured";
    const message = err instanceof Error ? err.message : "Health check failed.";
    console.error("Health check client error:", message);
  }

  const latencyMs = Date.now() - startedAt;
  const uptimeSeconds = Math.floor((Date.now() - PROCESS_START_TIME) / 1000);
  const ok =
    database === "ok" &&
    checks.supabaseUrlConfigured &&
    checks.supabaseAnonConfigured;

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
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
