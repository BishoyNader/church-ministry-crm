"use client";

import { useEffect, useSyncExternalStore } from "react";
import { reportClientError } from "@/lib/client-error";

const COPY = {
  en: {
    title: "Application Error",
    message: "An unexpected error occurred. You can retry or refresh the page.",
    retry: "Try again",
  },
  ar: {
    title: "خطأ في التطبيق",
    message: "حدث خطأ غير متوقع. يمكنك إعادة المحاولة أو تحديث الصفحة.",
    retry: "إعادة المحاولة",
  },
} as const;

function getDocLang(): "en" | "ar" {
  return typeof document !== "undefined" && document.documentElement.lang === "ar"
    ? "ar"
    : "en";
}

const docLangServerSnapshot: "en" | "ar" = "en";

/**
 * Root error boundary. Renders above the NextIntlClientProvider, so it cannot
 * use next-intl; instead it derives the language from the document `lang`
 * attribute set by the layout, giving Arabic users a fully localized fatal
 * screen (Phase 9 translation audit requirement).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Read the current document language synchronously without triggering a
  // cascading re-render (avoids setState-in-effect lint + hydration issues).
  const lang = useSyncExternalStore(
    () => () => {},
    getDocLang,
    () => docLangServerSnapshot,
  );

  const copy = COPY[lang];

  // Keep the AR copy available for the RTL direction pass below.

  useEffect(() => {
    // Report to the monitoring endpoint (rate-limited server side).
    void reportClientError(error, { digest: error.digest });
    // Keep a console breadcrumb as a fallback for local debugging.
    console.error("Global error boundary captured an error:", error);

    if (getDocLang() === "ar") {
      document.documentElement.dir = "rtl";
    }
  }, [error]);

  return (
    <html lang={lang}>
      <body>
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center"
        >
          <h2 className="text-xl font-semibold">{copy.title}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {copy.message}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
