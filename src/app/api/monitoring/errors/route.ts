import { NextRequest, NextResponse } from "next/server";
import { rateLimitStore } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("monitoring.errors");

/**
 * POST /api/monitoring/errors
 *
 * Client-side error intake (see src/lib/client-error.ts). Rate-limited per IP
 * to prevent log flooding, then emitted as structured error log lines.
 * Returns 204 always so the client reporter is fully side-effect free.
 */
export async function POST(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

  // Tight throttle: 30 reports / minute per IP is far beyond legitimate
  // client error volume and caps the blast radius of a buggy loop.
  const decision = rateLimitStore.check(`errors:${ip}`, 30, 60_000);
  if (!decision.allowed) {
    return new NextResponse(null, { status: 429 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      message?: string;
      stack?: string;
      digest?: string;
      url?: string;
      userAgent?: string;
      locale?: string;
    };

    await log.error("client_error", {
      clientError: {
        name: body.name ?? "Error",
        message: body.message ?? "Unknown client error",
        stack: body.stack ?? null,
        digest: body.digest ?? null,
        url: body.url ?? null,
        locale: body.locale ?? null,
      },
      clientIp: ip,
      userAgent: body.userAgent ?? null,
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    await log.warn("client_error_intake_failed", { err, clientIp: ip });
    return new NextResponse(null, { status: 400 });
  }
}
