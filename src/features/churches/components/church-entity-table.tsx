"use client";

import { useLocale, useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/layout/section-card";
import { formatLocalizedDate, formatLocalizedDateTime } from "@/lib/dates";
import {
  useChurchServices,
  useChurchStages,
  useChurchClasses,
} from "../hooks/use-churches";

type ChurchEntityKind = "services" | "stages" | "classes";

type ChurchEntityTableProps = {
  churchId: string;
  kind: ChurchEntityKind;
};

export function ChurchEntityTable({ churchId, kind }: ChurchEntityTableProps) {
  const t = useTranslations("churches");
  const locale = useLocale();
  const hook = kind === "services" ? useChurchServices : kind === "stages" ? useChurchStages : useChurchClasses;
  const { data, isLoading, error } = hook(churchId);

  const rows = data?.data ?? [];

  if (error) {
    return <div className="py-10 text-center text-destructive">{error.message}</div>;
  }

  return (
    <SectionCard>
      {isLoading ? (
        <div className="divide-y">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <SearchX className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t(`${kind}.emptyState`)}</p>
        </div>
      ) : (
        <div className="divide-y">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium">{row.nameAr}</p>
                <p className="text-xs text-muted-foreground">
                  {formatLocalizedDate(row.createdAt, locale)}
                </p>
              </div>
              <Badge variant={row.isActive ? "default" : "secondary"}>
                {row.isActive ? t("statusActive") : t("statusInactive")}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
