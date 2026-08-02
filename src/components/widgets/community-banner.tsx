"use client";

import { useTranslations } from "next-intl";
import { Users } from "lucide-react";

export function CommunityBanner() {
  const t = useTranslations("widgets.community");

  return (
    <section
      aria-label={t("title")}
      className="relative overflow-hidden rounded-hero border border-border-whisper bg-gradient-to-br from-primary/10 via-surface-elevated to-ministry/10 p-6 shadow-diffused-sm"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl"
      />
      <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <span className="rounded-full border border-border-whisper bg-surface-elevated px-3 py-1 text-xs font-medium text-muted-foreground">
          {t("badge")}
        </span>
      </div>
    </section>
  );
}
