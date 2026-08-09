"use client";

/**
 * Client-side error reporter. Best-effort: never throws, never blocks the UI.
 * Sends structured error payloads to the server-side monitoring endpoint
 * which persists/logs them with rate limiting and audit context.
 */

export interface ClientErrorReport {
  name: string;
  message: string;
  stack?: string;
  digest?: string;
  url: string;
  userAgent?: string;
  locale?: string;
}

export async function reportClientError(
  error: unknown,
  extra?: Partial<ClientErrorReport>,
): Promise<void> {
  try {
    const normalized =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unknown client error");

    const payload: ClientErrorReport = {
      name: normalized.name,
      message: normalized.message,
      stack: normalized.stack,
      digest: extra?.digest ?? (error as { digest?: string } | null)?.digest,
      url: typeof window !== "undefined" ? window.location.href : "n/a",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      locale:
        typeof document !== "undefined"
          ? document.documentElement.lang
          : undefined,
      ...extra,
    };

    await fetch("/api/monitoring/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Fire-and-forget: do not block the error UI on the network.
      keepalive: true,
    });
  } catch {
    // Reporters must never break the page.
  }
}
