import { NextResponse, NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";
import { rateLimitStore } from "./lib/rate-limit";

// Per-request correlation: every response carries an x-request-id header and
// the request is rebased with the same header so server actions, route
// handlers and server components surface it through src/lib/logger.ts
// (getRequestId). Timing is recorded via x-response-time-ms.

/**
 * Rebases the request with an x-request-id header so the value reaches server
 * actions, route handlers and server components (request-header mutation in
 * middleware does not reliably propagate downstream otherwise). Cloning the
 * request preserves method/body/url while replacing headers.
 */
function withRequestId(request: NextRequest, requestId: string): NextRequest {
  if (request.headers.get("x-request-id") === requestId) return request;
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  return new NextRequest(request, { headers });
}

// In-memory per-isolate rate limiting for anonymous callers on public
// surfaces (auth pages, church-request). See src/lib/rate-limit.ts for the
// documented distributed-store limitation. This is a first line of defense;
// RLS and server-action authorization remain the enforcement layer.

const intlMiddleware = createMiddleware(routing);

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];
// Public pages reachable without a session.
const PUBLIC_PAGES = ["/login", "/signup", "/church-request", "/forgot-password", "/reset-password"];
// Pages reachable by an authenticated user in ANY onboarding state.
const ALWAYS_ALLOWED_AUTH_PAGES = ["/church-request", "/pending-approval"];

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    const { name, value, ...options } = cookie;
    target.cookies.set(name, value, options);
  });
}

// Strips the leading locale segment so routing checks are locale-agnostic.
// The landing page lives at the locale root (e.g. "/ar", "/en") under
// localePrefix: "always", so both bare "/" and the locale root must be public.
function stripLocale(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "ar" || parts[0] === "en") {
    return "/" + parts.slice(1).join("/");
  }
  return pathname;
}

function isPublicPath(pathname: string) {
  const stripped = stripLocale(pathname);
  return (
    stripped === "/" ||
    PUBLIC_PAGES.some((page) => stripped.endsWith(page))
  );
}

function isAlwaysAllowedForAuth(pathname: string) {
  return ALWAYS_ALLOWED_AUTH_PAGES.some((page) => pathname.endsWith(page));
}

function redirectTo(request: NextRequest, locale: string, path: string) {
  return NextResponse.redirect(new URL(`/${locale}${path}`, request.url));
}

export async function proxy(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const rebasedRequest = withRequestId(request, requestId);
  const intlResponse = intlMiddleware(rebasedRequest);
  intlResponse.headers.set("x-request-id", requestId);
  const { response, user, supabase } = await updateSession(rebasedRequest, intlResponse);

  const pathname = request.nextUrl.pathname;
  const pathParts = pathname.split("/").filter(Boolean);
  const locale =
    pathParts[0] === "ar" || pathParts[0] === "en"
      ? pathParts[0]
      : routing.defaultLocale;

  const isAuthPage = AUTH_PAGES.some((page) => pathname.endsWith(page));
  const isResetPassword = pathname.endsWith("/reset-password");

  if (!user) {
    if (isPublicPath(pathname)) {
      // Rate-limit anonymous traffic on public surfaces. Server actions are
      // throttled harder than plain page views.
      const forwarded = request.headers.get("x-forwarded-for");
      const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
      const stripped = stripLocale(pathname);
      const isAction = request.headers.has("next-action");
      const key = `proxy:anon:${ip}:${stripped}${isAction ? ":action" : ""}`;
      const decision = rateLimitStore.check(key, isAction ? 10 : 120, 60_000);

      if (!decision.allowed) {
        const tooMany = NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 },
        );
        tooMany.headers.set("Retry-After", String(decision.retryAfterSec));
        copyCookies(response, tooMany);
        stampResponse(tooMany, startedAt);
        return tooMany;
      }

      stampResponse(response, startedAt);
      return response;
    }
    const redirectResponse = redirectTo(request, locale, "/login");
    copyCookies(response, redirectResponse);
    stampResponse(redirectResponse, startedAt);
    return redirectResponse;
  }

  if (isResetPassword) {
    stampResponse(response, startedAt);
    return response;
  }

  // The pending page always renders its own state; the church-request page is
  // public. No access-state resolution is needed for these.
  if (isAlwaysAllowedForAuth(pathname)) {
    stampResponse(response, startedAt);
    return response;
  }

  // Resolve the caller's onboarding/access state once for the redirect decision.
  // UX-only routing — RLS remains the enforcement layer.
  const { data: accessData } = await supabase.rpc("get_my_access_state");
  const state = accessData?.[0] ?? null;
  const hasAccess =
    !!state &&
    state.is_active &&
    state.servant_approval_status === "approved" &&
    state.has_roles;

  if (hasAccess) {
    if (isAuthPage) {
      const redirectResponse = redirectTo(request, locale, "/dashboard");
      copyCookies(response, redirectResponse);
      stampResponse(redirectResponse, startedAt);
      return redirectResponse;
    }
    stampResponse(response, startedAt);
    return response;
  }

  // Pending / rejected / no-profile: keep them on the allowed surface.
  if (isPublicPath(pathname)) {
    stampResponse(response, startedAt);
    return response;
  }

  const redirectResponse = redirectTo(request, locale, "/pending-approval");
  copyCookies(response, redirectResponse);
  stampResponse(redirectResponse, startedAt);
  return redirectResponse;
}

function stampResponse(response: NextResponse, startedAt: number) {
  response.headers.set("x-response-time-ms", String(Date.now() - startedAt));
}

export const config = {
  matcher: ["/", "/(ar|en)/:path*", "/((?!_next|api|.*\\..*).*)"],
};
