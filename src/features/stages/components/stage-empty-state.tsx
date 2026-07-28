"use client";

import { useTranslations } from "next-intl";
import { FolderOpen } from "lucide-react";

export function StageEmptyState() {
  const t = useTranslations("stages.emptyState");

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <div className="rounded-2xl bg-muted p-4">
        <FolderOpen className="size-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{t("title")}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {t("description")}
      </p>
    </div>
  );
}
