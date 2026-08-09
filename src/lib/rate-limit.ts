import { headers } from "next/headers";

/**
 * Sliding-window in-memory rate limiter.
 *
 * Use cases:
 *  - Proxy/middleware: throttling public pages and auth submissions per IP.
 *  - Server actions: first line of defense for login, signup, password reset
 *    and public church-request submission.
 *
 * Known limitation (documented for production): the store is per-runtime-
 * instance. On serverless platforms (e.g. Vercel) each isolate keeps its own
 * window, so this is NOT a global throttle — it is a low-cost first line of
 * defense. For distributed enforcement deploy a DB-backed or edge-network
 * limiter (documented in the security review). It never weakens RLS or
 * business authorization; it only slows abusive callers.
 */

const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;
const PRUNE_INTERVAL_MS = 60_000;

type Bucket = { timestamps: number[] };

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export class SlidingWindowStore {
  private buckets = new Map<string, Bucket>();
  private lastPrune = 0;

  private prune(now: number) {
    if (now - this.lastPrune < PRUNE_INTERVAL_MS) return;
    this.lastPrune = now;

    for (const [key, bucket] of this.buckets) {
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
      if (bucket.timestamps.length === 0) {
        this.buckets.delete(key);
      }
    }

    // Bound memory under attack: drop the oldest keys beyond the cap.
    if (this.buckets.size > MAX_ENTRIES) {
      const overflow = this.buckets.size - MAX_ENTRIES;
      const keys = [...this.buckets.keys()].slice(0, overflow);
      for (const key of keys) {
        this.buckets.delete(key);
      }
    }
  }

  check(key: string, limit: number, windowMs: number = WINDOW_MS): RateLimitDecision {
    const now = Date.now();
    this.prune(now);

    const bucket = this.buckets.get(key) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

    if (bucket.timestamps.length >= limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil((bucket.timestamps[0] + windowMs - now) / 1000),
      );
      return { allowed: false, remaining: 0, retryAfterSec: retryAfter };
    }

    bucket.timestamps.push(now);
    this.buckets.set(key, bucket);

    return {
      allowed: true,
      remaining: limit - bucket.timestamps.length,
      retryAfterSec: 0,
    };
  }
}

/** Shared store for the proxy and server-action guards. */
export const rateLimitStore = new SlidingWindowStore();

/**
 * Resolves the caller IP from the proxy headers. Falls back to "unknown" —
 * the limiter still applies, keyed on the same value for all unknowns.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return h.get("x-real-ip") ?? "unknown";
}

export type RateLimitGate =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * Server-action guard. Call at the top of public, unauthenticated actions
 * (login, signup, forgot-password, church-request submission).
 */
export async function assertRateLimit(opts: {
  scope: string;
  limit?: number;
  windowMs?: number;
}): Promise<RateLimitGate> {
  const ip = await getClientIp();
  const decision = rateLimitStore.check(
    `action:${opts.scope}:${ip}`,
    opts.limit ?? 10,
    opts.windowMs ?? WINDOW_MS,
  );

  return decision.allowed
    ? { ok: true }
    : { ok: false, retryAfterSec: decision.retryAfterSec };
}
