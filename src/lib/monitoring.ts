/**
 * Runtime diagnostics — server-only introspection of the running process.
 * Used by the health endpoint and the runtime diagnostics API. Never exposes
 * secrets or request data; only environment booleans and process metrics.
 */

export interface RuntimeDiagnostics {
  appVersion: string;
  nodeVersion: string;
  platform: string;
  runtime: string;
  uptimeSeconds: number;
  memoryMb: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  } | null;
  loadAvg: number[] | null;
  env: {
    nodeEnv: string;
    nextPublicSupabaseUrl: boolean;
    nextPublicSupabaseAnonKey: boolean;
    supabaseServiceRoleKey: boolean;
    cronSecret: boolean;
    logFormat: string;
  };
  buildTime: string | null;
  pid: number;
}

export function getRuntimeDiagnostics(): RuntimeDiagnostics {
  const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
  const memory = (() => {
    try {
      const usage = process.memoryUsage();
      return {
        rss: mb(usage.rss),
        heapUsed: mb(usage.heapUsed),
        heapTotal: mb(usage.heapTotal),
        external: mb(usage.external),
      };
    } catch {
      return null;
    }
  })();

  const loadAvg = (() => {
    try {
      // process.loadavg is not in every @types/node minor; guard at runtime.
      const maybeLoadavg = (process as unknown as {
        loadavg?: () => number[];
      }).loadavg;
      if (!maybeLoadavg) return null;
      return maybeLoadavg().map((v: number) => Math.round(v * 100) / 100);
    } catch {
      return null;
    }
  })();

  return {
    appVersion: process.env.npm_package_version ?? "0.1.0",
    nodeVersion: process.version,
    platform: process.platform,
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMb: memory,
    loadAvg,
    env: {
      nodeEnv: process.env.NODE_ENV ?? "development",
      nextPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      nextPublicSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      cronSecret: Boolean(process.env.CRON_SECRET),
      logFormat: process.env.LOG_FORMAT ?? "auto",
    },
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
    pid: process.pid,
  };
}

// Build metadata (NEXT_PUBLIC_BUILD_TIME) is injected at build/deploy time and
// surfaced through the health endpoint's `runtime.buildTime` field.
