import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    const { name, value, ...options } = cookie;
    target.cookies.set(name, value, options);
  });
}

export async function proxy(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  const { response, user } = await updateSession(request, intlResponse);

  const pathname = request.nextUrl.pathname;
  const pathParts = pathname.split("/").filter(Boolean);
  const locale =
    pathParts[0] === "ar" || pathParts[0] === "en"
      ? pathParts[0]
      : routing.defaultLocale;

  const isAuthPage = AUTH_PAGES.some((page) => pathname.endsWith(page));
  const isResetPassword = pathname.endsWith("/reset-password");

  if (user && isAuthPage && !isResetPassword) {
    const redirectResponse = NextResponse.redirect(
      new URL(`/${locale}`, request.url),
    );
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (!user && !isAuthPage) {
    const redirectResponse = NextResponse.redirect(
      new URL(`/${locale}/login`, request.url),
    );
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/", "/(ar|en)/:path*", "/((?!_next|.*\\..*).*)"],
};
