import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

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
  const intlResponse = intlMiddleware(request);
  const { response, user, supabase } = await updateSession(request, intlResponse);

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
      return response;
    }
    const redirectResponse = redirectTo(request, locale, "/login");
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (isResetPassword) {
    return response;
  }

  // The pending page always renders its own state; the church-request page is
  // public. No access-state resolution is needed for these.
  if (isAlwaysAllowedForAuth(pathname)) {
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
      return redirectResponse;
    }
    return response;
  }

  // Pending / rejected / no-profile: keep them on the allowed surface.
  if (isPublicPath(pathname)) {
    return response;
  }

  const redirectResponse = redirectTo(request, locale, "/pending-approval");
  copyCookies(response, redirectResponse);
  return redirectResponse;
}

export const config = {
  matcher: ["/", "/(ar|en)/:path*", "/((?!_next|.*\\..*).*)"],
};
