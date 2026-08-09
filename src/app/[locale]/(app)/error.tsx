"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { reportClientError } from "@/lib/client-error";

export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorBoundary");

  useEffect(() => {
    // Report to the monitoring endpoint (rate-limited server side).
    void reportClientError(error, { digest: error.digest });
    console.error("App route error boundary captured an error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-4">
        <ErrorState
          title={t("title")}
          message={t("message")}
        />
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>
            {t("tryAgain")}
          </Button>
          <Button variant="outline" onClick={() => window.location.assign("/dashboard")}>
            {t("goToDashboard")}
          </Button>
        </div>
      </div>
    </div>
  );
}
