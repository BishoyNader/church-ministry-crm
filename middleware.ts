import type { NextRequest, NextResponse } from "next/server";
import { proxy } from "./src/proxy";

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: ["/", "/(ar|en)/:path*", "/((?!_next|.*\\..*).*)"],
};
