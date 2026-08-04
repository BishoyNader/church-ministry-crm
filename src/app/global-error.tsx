"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary captured an error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center"
        >
          <h2 className="text-xl font-semibold">Application Error</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. You can retry or refresh the page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}