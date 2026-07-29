"use client";

import { useTranslations, useLocale } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import type { StageAnalyticsItem } from "../types/dashboard.types";

type StageAnalyticsTableProps = {
  data?: StageAnalyticsItem[];
  isLoading: boolean;
};

export function StageAnalyticsTable({ data, isLoading }: StageAnalyticsTableProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const isArabic = locale === "ar";

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
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
                    <td className="px-4 py-3 tabular-nums">
                      {stage.attendancePercentage}%
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
