// Regression: a deployment whose Supabase env vars are missing must NOT take
// down every route with an opaque 500. The proxy fails closed with a clear
// 503 maintenance response. This only fires when env is absent — auth/RLS are
// untouched on correctly configured deployments.
import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
  intlMiddleware: vi.fn(),
  rateCheck: vi.fn(),
}));

vi.mock("next-intl/middleware", () => ({
  default: () => mocks.intlMiddleware,
}));

vi.mock("../../src/lib/supabase/middleware", () => ({
  updateSession: (...args: unknown[]) => mocks.updateSession(...args),
}));

vi.mock("../../src/lib/rate-limit", () => ({
  rateLimitStore: {
    check: (...args: unknown[]) => mocks.rateCheck(...args),
  },
}));

import { proxy } from "../../src/proxy";

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`), {
    headers: { "x-forwarded-for": "127.0.0.1" },
  });
}

describe("proxy — missing Supabase environment", () => {
  it("returns a clear 503 instead of throwing/500ing when env vars are missing", async () => {
    mocks.intlMiddleware.mockReturnValue(NextResponse.next());
    mocks.updateSession.mockRejectedValue(
      new Error(
        "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_URL and SUPABASE_ANON_KEY.",
      ),
    );

    const response = await proxy(makeRequest("/en/login"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain("Server configuration error");
    expect(response.headers.get("x-request-id")).not.toBeNull();
  });

  it("propagates non-env middleware errors as before", async () => {
    mocks.intlMiddleware.mockReturnValue(NextResponse.next());
    mocks.updateSession.mockRejectedValue(new Error("some other failure"));

    await expect(proxy(makeRequest("/en/login"))).rejects.toThrow("some other failure");
  });
});
