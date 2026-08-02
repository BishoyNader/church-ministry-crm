"use client";

import { useTranslations } from "next-intl";
import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AnnouncementWidget() {
  const t = useTranslations("widgets.announcements");

  return (
    <section
      aria-label={t("title")}
      className="rounded-card border border-border-whisper bg-surface-elevated p-6 shadow-diffused-sm"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Megaphone className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {t("badge")}
        </Badge>
      </div>
    </section>
  );
}
