import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * TEST 10 — Subscription lifecycle cron must operate ONLY on church
 * subscriptions. The Platform Owner is not a church and holds no subscription
 * row, so every job here queries/updates `churches` exclusively; no user,
 * profile, or role table is ever evaluated by the lifecycle.
 */

const holders: { adminDb: unknown } = { adminDb: null };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => holders.adminDb,
}));

function createMockSupabase(opts: {
  expiredRows?: unknown[];
  graceRows?: unknown[];
} = {}) {
  const fromTables: string[] = [];
  const updateCalls: Array<{ table: string; payload: unknown }> = [];

  const makeChain = (table: string) => {
    const state = { op: "select", statusFilter: null as string | null };
    const promise = Promise.resolve().then(() => {
      if (state.op === "update") return { data: null, error: null };
      // Step-2 query filters .eq("subscription_status", "grace")
      const isGraceQuery = state.statusFilter === "grace";
      const rows = isGraceQuery ? (opts.graceRows ?? []) : (opts.expiredRows ?? []);
      return { data: rows, count: rows.length, error: null };
    });

    const chain: unknown = new Proxy({}, {
      get(_target, prop: string) {
        if (prop === "then") return promise.then.bind(promise);
        if (prop === "catch") return promise.catch.bind(promise);
        if (prop === "finally") return promise.finally.bind(promise);
        if (prop === "select") return () => chain;
        if (prop === "eq") {
          return (col: string, val: unknown) => {
            if (col === "subscription_status" && typeof val === "string") {
              state.statusFilter = val;
            }
            return chain;
          };
        }
        if (prop === "update") {
          return (_payload: unknown) => {
            state.op = "update";
            updateCalls.push({ table, payload: _payload });
            return chain;
          };
        }
        // in / lt / gte / is / not …
        return () => chain;
      },
    });
    return chain;
  };

  return {
    __fromTables: fromTables,
    __updateCalls: updateCalls,
    from: (table: string) => {
      fromTables.push(table);
      return makeChain(table);
    },
  };
}

process.env.CRON_SECRET = "test-cron-secret";
const { GET } = await import("@/app/api/cron/subscription-lifecycle/route");

function makeRequest(bearer: string | null): NextRequest {
  return {
    headers: { get: () => (bearer ? `Bearer ${bearer}` : null) },
  } as unknown as NextRequest;
}

describe("subscription lifecycle cron isolation", () => {
  it("transitions only CHURCH subscriptions (expire → grace, grace → free)", async () => {
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const adminDb = createMockSupabase({
      // Step-1 (expired paid, active) picks up one church; step-2 (grace past
      // window) finds none.
      expiredRows: [
        { id: "ch-expired", name_ar: "كنيسة منتهية", subscription_tier: "monthly", subscription_expires_at: past },
      ],
      graceRows: [],
    });
    holders.adminDb = adminDb;

    const response = await GET(makeRequest("test-cron-secret"));
    const json = (await response.json()) as { ok: boolean; expiredToGrace: number; graceToFree: number };

    expect(json.ok).toBe(true);
    expect(json.expiredToGrace).toBe(1);
    expect(json.graceToFree).toBe(0);

    // Lifecycle touches ONLY church subscription records.
    expect(adminDb.__fromTables.every((t: string) => t === "churches")).toBe(true);
    expect(adminDb.__updateCalls).toHaveLength(1);
    expect(adminDb.__updateCalls[0].table).toBe("churches");
    expect(adminDb.__updateCalls[0].payload).toMatchObject({ subscription_status: "grace" });
    expect(adminDb.__fromTables).not.toContain("profiles");
    expect(adminDb.__fromTables).not.toContain("user_roles");
  });

  it("rejects unauthorized runs without touching any data", async () => {
    holders.adminDb = createMockSupabase({});
    const response = await GET(makeRequest("wrong-secret"));
    expect(response.status).toBe(401);
    expect((holders.adminDb as { __fromTables: string[] }).__fromTables).toHaveLength(0);
  });
});
