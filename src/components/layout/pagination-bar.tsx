"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/layout/section-card";

type PaginationLabelMode = "range" | "count" | "page";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  /** Required by "range"/"count" modes; optional for "page". */
  total?: number;
  /** Required by "range" mode; optional for "count"/"page". */
  pageSize?: number;
  onPageChange: (page: number) => void;
  /** "range" → "Showing X–Y of Z" · "count" → "N results — page X of Y" · "page" → "Page X of Y" */
  labelMode?: PaginationLabelMode;
}

/**
 * Shared pagination bar. Consolidates the duplicated prev/next + summary
 * blocks that previously lived in 9 list components (children, audit,
 * services, classes, users, servants, churches, church users, church audit).
 */
export function PaginationBar({
  page,
  totalPages,
  total = 0,
  pageSize = 20,
  onPageChange,
  labelMode = "range",
}: PaginationBarProps) {
  const t = useTranslations("pagination");

  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <SectionCard className="flex items-center justify-between px-4 py-3">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {labelMode === "range"
          ? t("showing", { from, to, total })
          : labelMode === "count"
            ? t("count", { total, page, totalPages })
            : t("page", { page, totalPages })}
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t("prev")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("next")}
        </Button>
      </div>
    </SectionCard>
  );
}
