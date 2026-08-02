import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./src/i18n/routing";

const handleIntl = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. First run next-intl to get the localized response
  const response = handleIntl(request);

  // 2. Initialize Supabase and refresh auth tokens on the same response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Match only internationalized pathnames, skipping internal assets
  matcher: ["/", "/(ar|en)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};