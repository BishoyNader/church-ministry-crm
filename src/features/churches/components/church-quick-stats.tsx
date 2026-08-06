"use client";

import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { SectionCard } from "@/components/layout/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChurchStatusFilter, ChurchSummary } from "../types/church.types";

type ChurchQuickStatsProps = {
  summary: ChurchSummary | undefined;
  isLoading: boolean;
  activeFilter: ChurchStatusFilter;
  onSelectStatus: (status: ChurchStatusFilter) => void;
};

export function ChurchQuickStats({
  summary,
  isLoading,
  activeFilter,
  onSelectStatus,
}: ChurchQuickStatsProps) {
  const t = useTranslations("churches");

  const cards: { key: ChurchStatusFilter; count: number; labelKey: string }[] = [
    { key: "all", count: summary?.total ?? 0, labelKey: "statusAll" },
    { key: "active", count: summary?.active ?? 0, labelKey: "statusActive" },
    { key: "inactive", count: summary?.inactive ?? 0, labelKey: "statusInactive" },
    { key: "suspended", count: summary?.suspended ?? 0, labelKey: "statusSuspended" },
    { key: "disabled", count: summary?.disabled ?? 0, labelKey: "statusDisabled" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          onClick={() => onSelectStatus(card.key)}
          className={`text-left transition-colors ${
            activeFilter === card.key ? "rounded-xl ring-2 ring-ring/40" : ""
          }`}
        >
          <SectionCard className="h-full p-4">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t(card.labelKey)}</p>
            </div>
            {isLoading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="mt-1 text-2xl font-semibold">{card.count}</p>
            )}
          </SectionCard>
        </button>
      ))}
    </div>
  );
}
