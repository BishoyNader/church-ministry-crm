"use client";

import { useTranslations, useLocale } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import type { StageAnalyticsItem } from "../types/dashboard.types";

type StageAnalyticsTableProps = {
  data?: StageAnalyticsItem[];
  isLoading: boolean;
};

function progressColor(pct: number): string {
  if (pct >= 80) return "bg-success";
  if (pct >= 50) return "bg-warning";
  return "bg-danger";
}

export function StageAnalyticsTable({ data, isLoading }: StageAnalyticsTableProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const isArabic = locale === "ar";

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{t("stageAnalytics.stage")}</th>
              <th className="px-4 py-3">{t("stageAnalytics.children")}</th>
              <th className="px-4 py-3">{t("stageAnalytics.followups")}</th>
              <th className="px-4 py-3">{t("stageAnalytics.attendance")}</th>
              <th className="px-4 py-3">{t("stageAnalytics.attendanceRate")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  </tr>
                ))
              : data?.map((stage) => (
                  <tr key={stage.stageId} className="border-b transition hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {isArabic ? stage.stageNameAr : (stage.stageNameEn ?? stage.stageNameAr)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{stage.totalChildren}</td>
                    <td className="px-4 py-3 tabular-nums">{stage.followupCount}</td>
                    <td className="px-4 py-3 tabular-nums">{stage.attendanceCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={"h-full rounded-full transition-all " + progressColor(stage.attendancePercentage)}
                            style={{ width: `${Math.min(stage.attendancePercentage, 100)}%` }}
                          />
                        </div>
                        <span className="w-10 text-end text-xs font-medium tabular-nums text-muted-foreground">
                          {stage.attendancePercentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
            {!isLoading && (!data || data.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  {t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
