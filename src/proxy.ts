import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const intlResponse = intlMiddleware(request);

  return updateSession(request, intlResponse);
}

export const config = {
  matcher: ["/", "/(ar|en)/:path*", "/((?!_next|.*\\..*).*)"],
};
