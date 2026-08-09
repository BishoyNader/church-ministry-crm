import { headers } from "next/headers";

/**
 * Structured server logger.
 *
 * - Server-only (imports next/headers). Never import from client components.
 * - Emits one JSON line per entry when NODE_ENV=production or LOG_FORMAT=json,
 *   otherwise pretty-prints for local development.
 * - Every entry carries a `requestId` (from the x-request-id header when the
 *   proxy stamped one, otherwise a fresh UUID) so logs can be correlated
 *   across middleware, server actions, route handlers and services.
 * - Sensitive fields (passwords, tokens, keys) are redacted before output.
 *
 * Usage:
 *   import { createLogger } from "@/lib/logger";
 *   const log = createLogger("church.service");
 *   await log.info("church_created", { churchId, byUserId });
 *   await log.error("church_create_failed", { err, churchId });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  err?: unknown;
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN =
  /password|passwd|pwd|token|secret|authorization|cookie|apikey|api[_-]?key|credential|session|refresh/i;

const MAX_STRING_LENGTH = 2000;

function redact(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) return "[REDACTED]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]`
      : value;
  }
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redact(v, k);
    }
    return out;
  }
  return value;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 8).join("\n"),
      cause: err.cause ? serializeError(err.cause) : undefined,
    };
  }
  if (typeof err === "object" && err !== null) {
    return { message: String(err) };
  }
  return { message: String(err) };
}

const isJsonOutput =
  process.env.LOG_FORMAT === "json" || process.env.NODE_ENV === "production";

// Per-request request-id cache. Serverless isolates (Vercel) execute one
// request at a time, so a module-level cache correlates every log line within
// that request. Whenever the incoming request carries an x-request-id header
// (stamped by the proxy), we adopt it — which also re-bases the cache for the
// next request. Without this cache, two log lines from the same server action
// would carry different UUIDs and defeat correlation entirely.
let cachedRequestId: string | null = null;

/**
 * Returns the current request id: the x-request-id header when the proxy
 * propagated one, otherwise a request-scoped UUID shared by all log calls
 * within the same request. Safe to call from server actions, route handlers
 * and services.
 */
export async function getRequestId(): Promise<string> {
  try {
    const h = await headers();
    const stamped = h.get("x-request-id");
    if (stamped) {
      cachedRequestId = stamped;
      return stamped;
    }
  } catch {
    // headers() is not available in this context (e.g. cron); fall through.
  }
  if (!cachedRequestId) {
    cachedRequestId = crypto.randomUUID();
  }
  return cachedRequestId;
}

export class StructuredLogger {
  constructor(private readonly scope: string) {}

  private async write(
    level: LogLevel,
    message: string,
    fields: LogFields = {},
  ): Promise<void> {
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      scope: this.scope,
      msg: message,
      requestId: await getRequestId(),
    };

    if (fields.err !== undefined) {
      entry.error = serializeError(fields.err);
    }
    for (const [k, v] of Object.entries(fields)) {
      if (k === "err") continue;
      entry[k] = redact(v, k);
    }

    if (isJsonOutput) {
      // JSON lines are the standard ingestion format for log pipelines.
      console[level === "debug" ? "log" : level](JSON.stringify(entry));
    } else {
      const extra = JSON.stringify(
        Object.fromEntries(
          Object.entries(entry).filter(
            ([k]) => !["ts", "level", "scope", "msg", "requestId"].includes(k),
          ),
        ),
      );
      console[level === "debug" ? "log" : level](
        `[${entry.ts}] ${level.toUpperCase()} [${this.scope}] ${message}${entry.requestId ? ` (req=${entry.requestId})` : ""}${extra !== "{}" ? ` ${extra}` : ""}`,
      );
    }
  }

  debug(message: string, fields?: LogFields): Promise<void> {
    return this.write("debug", message, fields);
  }
  info(message: string, fields?: LogFields): Promise<void> {
    return this.write("info", message, fields);
  }
  warn(message: string, fields?: LogFields): Promise<void> {
    return this.write("warn", message, fields);
  }
  error(message: string, fields?: LogFields): Promise<void> {
    return this.write("error", message, fields);
  }
}

export function createLogger(scope: string): StructuredLogger {
  return new StructuredLogger(scope);
}

/** Shared app logger for cross-cutting infrastructure code. */
export const appLogger = createLogger("app");
