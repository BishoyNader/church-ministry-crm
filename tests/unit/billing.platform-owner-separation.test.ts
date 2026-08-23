import { describe, expect, it, vi } from "vitest";

/**
 * Platform Owner ↔ Church subscription separation.
 *
 * Conceptual model under test:
 *   Church Manager → church → church subscription → effective plan → entitlements
 *   Platform Owner → platform administrator → NO subscription → NO customer plan
 *
 * The Platform Owner is OUTSIDE the church subscription model:
 *  - no subscription is ever resolved for them (never Free/Trial),
 *  - they are rejected by every customer billing action,
 *  - entitlement guards never restrict them with a church plan limit,
 *  - admin billing actions remain gated behind user_is_platform_owner().
 */

// ---------------------------------------------------------------------------
// Mocks for server-only modules used by the actions/routes under test
// ---------------------------------------------------------------------------

const holders: { authDb: ReturnType<typeof createMockSupabase>; adminDb: ReturnType<typeof createMockSupabase> } =
  {} as { authDb: ReturnType<typeof createMockSupabase>; adminDb: ReturnType<typeof createMockSupabase> };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => holders.authDb,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => holders.adminDb,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

vi.mock("@/features/notifications", () => ({
  sendNotification: vi.fn(async () => {}),
}));

import {
  getBillingSummaryAction,
  submitPaymentRequestAction,
  cancelPaymentRequestAction,
  requestRefundAction,
  getPlatformBillingStatsAction,
  approvePaymentAction,
} from "@/features/billing/actions/billing.actions";
import { checkEntitlementLimit, checkFeatureEntitlement } from "@/features/billing/lib/entitlement-guard";
import { getEffectivePlan, getEntitlements } from "@/features/billing/lib/entitlements";
import { navItems, visibleNavItems } from "@/components/layout/nav-config";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";

// ---------------------------------------------------------------------------
// Chainable Supabase mock (same style as dashboard.service.test.ts)
// ---------------------------------------------------------------------------

type MockOptions = {
  /** auth.getUser() result */
  user?: string | null;
  /** rpc("user_is_platform_owner") result */
  platformOwner?: boolean;
  /** profiles single-row result */
  profile?: { church_id: string | null } | null;
  /** per-table `.single()` results */
  singles?: Record<string, unknown>;
  /** per-table list results */
  lists?: Record<string, unknown[]>;
  /** per-table head-count results */
  counts?: Record<string, number>;
};

function createMockSupabase(opts: MockOptions = {}) {
  const fromTables: string[] = [];
  const insertCalls: Array<{ table: string; payload: unknown }> = [];
  const updateCalls: Array<{ table: string; payload: unknown }> = [];

  const makeChain = (table: string) => {
    const state = { op: "select", head: false, single: false };

    const resolve = () => {
      if (state.op === "insert") {
        return { data: { id: "generated-id" }, error: null };
      }
      if (state.op === "update" || state.op === "delete") {
        return { data: null, error: null };
      }
      if (state.single) {
        if (table === "profiles") {
          return { data: opts.profile ?? null, error: opts.profile ? null : { message: "row not found" } };
        }
        const row = opts.singles?.[table];
        return row !== undefined
          ? { data: row, error: null }
          : { data: null, error: { message: "PGRST116: row not found" } };
      }
      if (state.head) {
        return { data: [], count: opts.counts?.[table] ?? 0, error: null };
      }
      const rows = opts.lists?.[table];
      return rows !== undefined
        ? { data: rows, count: rows.length, error: null }
        : { data: [], count: 0, error: null };
    };

    const promise = Promise.resolve().then(resolve);

    const chain: unknown = new Proxy({}, {
      get(_target, prop: string) {
        if (prop === "then") return promise.then.bind(promise);
        if (prop === "catch") return promise.catch.bind(promise);
        if (prop === "finally") return promise.finally.bind(promise);
        if (prop === "select") {
          return (_cols?: string, queryOpts?: { head?: boolean }) => {
            if (queryOpts?.head) state.head = true;
            return chain;
          };
        }
        if (prop === "single") {
          return () => {
            state.single = true;
            return chain;
          };
        }
        if (prop === "insert") {
          return (payload: unknown) => {
            state.op = "insert";
            insertCalls.push({ table, payload });
            void payload;
            return chain;
          };
        }
        if (prop === "update") {
          return (payload: unknown) => {
            state.op = "update";
            updateCalls.push({ table, payload });
            void payload;
            return chain;
          };
        }
        if (prop === "delete") {
          return () => {
            state.op = "delete";
            return chain;
          };
        }
        // eq / is / in / lt / gte / neq / not / order / range …
        return () => chain;
      },
    });

    return chain;
  };

  const client = {
    __fromTables: fromTables,
    __insertCalls: insertCalls,
    __updateCalls: updateCalls,
    auth: {
      getUser: async () => ({ data: { user: opts.user ? { id: opts.user } : null }, error: null }),
    },
    rpc: async (name: string) => {
      if (name === "user_is_platform_owner") return { data: opts.platformOwner ?? false };
      if (name === "generate_invoice_number") return { data: "INV-2026-000042" };
      return { data: null };
    },
    from: (table: string) => {
      fromTables.push(table);
      return makeChain(table);
    },
  };

  return client;
}

const PO_USER_ID = "po-user-id";
const CHURCH_ID = "church-1";

// ===========================================================================
// Pure entitlement logic regression (Church Manager behavior unchanged)
// ===========================================================================

describe("getEffectivePlan (church resolution unchanged)", () => {
  it("resolves trial → free once expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(getEffectivePlan("trial", past, null)).toBe("free");
  });

  it("keeps paid plan during grace period after expiry", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(getEffectivePlan("yearly", null, past, new Date(), "grace")).toBe("yearly");
  });

  it("drops expired paid subscription to free without grace", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(getEffectivePlan("monthly", null, past, new Date(), "active")).toBe("free");
  });

  it("maps a missing tier to free for churches only — never used for the Platform Owner", () => {
    expect(getEffectivePlan(null, null, null)).toBe("free");
  });
});

// ===========================================================================
// Entitlement guards — Platform Owner bypass (TEST 11)
// ===========================================================================

describe("entitlement guards and the Platform Owner", () => {
  it("does NOT restrict the platform owner with a church Free-plan limit", async () => {
    holders.authDb = createMockSupabase({ user: PO_USER_ID, platformOwner: true });
    const result = await checkEntitlementLimit(
      holders.authDb as never,
      null as unknown as string, // PO has no church (profiles.church_id IS NULL)
      "maxBeneficiaries",
    );
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe("platform");
    expect(result.limit).toBe(Number.MAX_SAFE_INTEGER);
    // No church subscription lookup was performed for the PO
    expect((holders.authDb as { __fromTables: string[] }).__fromTables).not.toContain("churches");
  });

  it("enables all features for the platform owner without resolving a plan tier", async () => {
    holders.authDb = createMockSupabase({ user: PO_USER_ID, platformOwner: true });
    const result = await checkFeatureEntitlement(
      holders.authDb as never,
      null as unknown as string,
      "canSpiritualJournal",
    );
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe("platform");
  });

  it("still enforces the Free-plan limit for a real church (regression)", async () => {
    holders.authDb = createMockSupabase({
      user: "manager-1",
      platformOwner: false,
      singles: {
        churches: {
          subscription_tier: "free",
          trial_ends_at: null,
          subscription_expires_at: null,
          subscription_status: "active",
        },
      },
      counts: { beneficiary_assignments: 30 },
    });
    const result = await checkEntitlementLimit(holders.authDb as never, CHURCH_ID, "maxBeneficiaries");
    expect(result.allowed).toBe(false);
    expect(result.plan).toBe("free");
    if (!result.allowed) {
      expect(result.reason).toMatch(/upgrade/i);
    }
  });

  it("keeps feature gating intact for a real free-tier church (regression)", async () => {
    holders.authDb = createMockSupabase({
      user: "manager-1",
      platformOwner: false,
      singles: {
        churches: {
          subscription_tier: "free",
          trial_ends_at: null,
          subscription_expires_at: null,
          subscription_status: "active",
        },
      },
    });
    const result = await checkFeatureEntitlement(holders.authDb as never, CHURCH_ID, "canSpiritualJournal");
    expect(result.allowed).toBe(false);
    expect(result.plan).toBe("free");
  });

  it("exposes unlimited entitlements distinct from any purchasable plan", () => {
    const po = getEntitlements("trial"); // FULL_ENTITLEMENTS shape
    expect(Object.values(po).every((v) => v === true || v === Number.MAX_SAFE_INTEGER)).toBe(true);
  });
});

// ===========================================================================
// Customer billing actions — Platform Owner rejection (TESTS 1, 4, 5, 6)
// ===========================================================================

describe("customer billing actions reject the Platform Owner", () => {
  it("TEST 1: resolves NO subscription summary for the platform owner", async () => {
    const db = createMockSupabase({
      user: PO_USER_ID,
      platformOwner: true,
      profile: { church_id: null }, // PO profile is church-less by design
    });
    holders.authDb = db;

    const result = await getBillingSummaryAction();

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.message).toMatch(/platform owners do not have a church subscription/i);
    // Never resolved a church / subscription for the PO
    expect(db.__fromTables).not.toContain("churches");
  });

  it("TEST 5: rejects subscribe/payment submission without inserting a payment request", async () => {
    const db = createMockSupabase({ user: PO_USER_ID, platformOwner: true, profile: { church_id: null } });
    holders.authDb = db;

    const result = await submitPaymentRequestAction({ plan: "monthly" });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/platform owners/i);
    expect(db.__insertCalls.filter((c) => c.table === "payment_requests")).toHaveLength(0);
  });

  it("TEST 4: has no trial to start — trial-shaped flows (payment request) are rejected", async () => {
    const db = createMockSupabase({ user: PO_USER_ID, platformOwner: true, profile: { church_id: null } });
    holders.authDb = db;

    // The application has no self-serve "start trial" action: trials are only
    // created when a church is provisioned. The closest customer flow a PO
    // could try to invoke is rejected server-side:
    const result = await submitPaymentRequestAction({ plan: "yearly" });
    expect(result.success).toBe(false);

    // And no subscription record of any kind can be created for them:
    expect(db.__insertCalls.filter((c) => c.table === "churches")).toHaveLength(0);
  });

  it("TEST 6a: rejects submitting a church payment request as a customer", async () => {
    const db = createMockSupabase({ user: PO_USER_ID, platformOwner: true, profile: { church_id: null } });
    holders.authDb = db;

    const result = await requestRefundAction({
      paymentRequestId: "pr-1",
      reason: "test",
    });

    expect(result.success).toBe(false);
    expect(db.__insertCalls.filter((c) => c.table === "refunds")).toHaveLength(0);
  });

  it("TEST 6b: rejects cancelling payment requests outside the customer model", async () => {
    const db = createMockSupabase({ user: PO_USER_ID, platformOwner: true, profile: { church_id: null } });
    holders.authDb = db;

    const result = await cancelPaymentRequestAction("pr-1");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/platform owners/i);
    expect(db.__updateCalls).toHaveLength(0);
  });
});

// ===========================================================================
// Customer billing actions — Church Manager behavior unchanged (TESTS 3, 12)
// ===========================================================================

describe("customer billing actions keep working for the Church Manager", () => {
  const managerDb = (countOverrides: Record<string, number> = {}) =>
    createMockSupabase({
      user: "manager-1",
      platformOwner: false,
      profile: { church_id: CHURCH_ID },
      lists: { roles: [] },
      counts: { payment_requests: 1, invoices: 2, ...countOverrides },
      singles: {
        churches: {
          id: CHURCH_ID,
          name_ar: "كنيسة",
          subscription_tier: "trial",
          subscription_status: "active",
          trial_ends_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_expires_at: null,
          trial_used: true,
        },
        payment_requests: { id: "pr-1", status: "pending", church_id: CHURCH_ID },
      },
    });

  it("TEST 3/12a: resolves the church billing summary", async () => {
    holders.authDb = managerDb();
    const result = await getBillingSummaryAction();
    expect(result.success).toBe(true);
    expect(result.data?.churchId).toBe(CHURCH_ID);
    expect(result.data?.plan).toBe("trial");
  });

  it("TEST 3/12b: submits a payment request", async () => {
    holders.authDb = managerDb({ payment_requests: 0 }); // no pending duplicate
    const result = await submitPaymentRequestAction({ plan: "monthly", note: "paid via instapay" });
    expect(result.success).toBe(true);
    expect(holders.authDb.__insertCalls.some((c) => c.table === "payment_requests")).toBe(true);
  });

  it("TEST 3/12c: cancels own pending payment request", async () => {
    holders.authDb = managerDb();
    const result = await cancelPaymentRequestAction("pr-1");
    expect(result.success).toBe(true);
  });

  it("TEST 3/12d: requests a refund", async () => {
    holders.authDb = managerDb();
    const result = await requestRefundAction({ paymentRequestId: "pr-1", reason: "duplicate charge" });
    expect(result.success).toBe(true);
  });
});

// ===========================================================================
// Platform Owner administrative actions (TESTS 7, 8, 9)
// ===========================================================================

describe("platform billing administration stays allowed for the Platform Owner", () => {
  const statsLists = {
    churches: [
      { subscription_tier: "free", subscription_status: "active", subscription_expires_at: null },
      { subscription_tier: "trial", subscription_status: "active", subscription_expires_at: null },
      {
        subscription_tier: "monthly",
        subscription_status: "active",
        subscription_expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        subscription_tier: "yearly",
        subscription_status: "grace",
        subscription_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    invoices: [{ amount: 499 }],
  };

  it("TEST 7/8: views platform-wide billing statistics", async () => {
    holders.authDb = createMockSupabase({ user: PO_USER_ID, platformOwner: true });
    holders.adminDb = createMockSupabase({ lists: statsLists, counts: { payment_requests: 3 } });

    const result = await getPlatformBillingStatsAction();

    expect(result.success).toBe(true);
    expect(result.data?.totalChurches).toBe(4);
    expect(result.data?.freeChurches).toBe(1);
    expect(result.data?.trialChurches).toBe(1);
    expect(result.data?.monthlySubscriptions).toBe(1);
    expect(result.data?.yearlySubscriptions).toBe(1);
    expect(result.data?.gracePeriodChurches).toBe(1);
  });

  it("rejects platform billing administration for non-platform-owners", async () => {
    holders.authDb = createMockSupabase({ user: "manager-1", platformOwner: false });
    holders.adminDb = createMockSupabase({});

    const result = await getPlatformBillingStatsAction();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/platform owner access required/i);
  });

  it("TEST 9: approves a church payment request (activates the CHURCH subscription)", async () => {
    holders.authDb = createMockSupabase({ user: PO_USER_ID, platformOwner: true });
    const adminDb = createMockSupabase({
      singles: {
        payment_requests: {
          id: "pr-1",
          status: "pending",
          church_id: CHURCH_ID,
          requested_by: "manager-1",
          plan: "monthly",
          amount: 499,
          currency: "EGP",
          payment_method: "instapay",
        },
        refunds: { id: "r-1", status: "pending", church_id: CHURCH_ID },
      },
      lists: { roles: [], user_roles: [] },
    });
    holders.adminDb = adminDb;

    const result = await approvePaymentAction("pr-1");

    expect(result.success).toBe(true);
    const churchUpdate = adminDb.__updateCalls.find((c) => c.table === "churches");
    expect(churchUpdate).toBeDefined();
    expect((churchUpdate!.payload as { subscription_tier: string }).subscription_tier).toBe("monthly");
    expect(adminDb.__insertCalls.some((c) => c.table === "invoices")).toBe(true);
  });
});

// ===========================================================================
// Navigation — role-based separation (TESTS 2 & 3 UI surface)
// ===========================================================================

describe("navigation separates customer billing from platform billing", () => {
  const hrefs = (roleTypes: string[], permissions: string[]) => {
    const items = visibleNavItems(navItems, new Set(permissions), new Set(roleTypes));
    return items.map((i) => i.href);
  };

  it("TEST 2: hides customer Billing from the Platform Owner even with billing.read", () => {
    const links = hrefs(["platform_owner"], [PERMISSION_CODES.BILLING_READ, PERMISSION_CODES.SUBSCRIPTIONS_MANAGE]);
    expect(links).not.toContain("/billing");
    expect(links).toContain("/admin/billing");
  });

  it("TEST 3: shows customer Billing to the Church Manager (super_admin)", () => {
    const links = hrefs(["super_admin"], [PERMISSION_CODES.BILLING_READ]);
    expect(links).toContain("/billing");
  });

  it("keeps platform billing hidden without subscriptions.manage", () => {
    const links = hrefs(["super_admin"], [PERMISSION_CODES.BILLING_READ]);
    expect(links).not.toContain("/admin/billing");
  });
});
