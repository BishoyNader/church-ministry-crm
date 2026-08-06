"use client";

import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { SectionCard } from "@/components/layout/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useChurchReports } from "../hooks/use-churches";

type ChurchReportsTabProps = {
  churchId: string;
};

export function ChurchReportsTab({ churchId }: ChurchReportsTabProps) {
  const t = useTranslations("churches");
  const { data, isLoading, error } = useChurchReports(churchId);

  if (error) {
    return <div className="py-10 text-center text-destructive">{error.message}</div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const reports = data?.data;

  if (!reports || reports.attendanceRate.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <SearchX className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("reports.emptyState")}</p>
      </div>
    );
  }

  const attendance = reports.attendanceRate;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SectionCard className="p-4">
          <p className="text-sm text-muted-foreground">{t("reports.attendanceRate")}</p>
          <p className="text-2xl font-semibold">{attendance.rate}%</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-sm text-muted-foreground">{t("reports.present")}</p>
          <p className="text-2xl font-semibold">{attendance.present}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-sm text-muted-foreground">{t("reports.absent")}</p>
          <p className="text-2xl font-semibold">{attendance.absent}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-sm text-muted-foreground">{t("reports.total")}</p>
          <p className="text-2xl font-semibold">{attendance.total}</p>
        </SectionCard>
      </div>

      <SectionCard className="p-4">
        <p className="mb-3 font-medium">{t("reports.stageComparison")}</p>
        {reports.stageComparison.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("reports.emptyState")}</p>
        ) : (
          <div className="divide-y">
            {reports.stageComparison.map((stage) => (
              <div key={stage.stageId} className="flex items-center justify-between py-2 text-sm">
                <span>{stage.stageName}</span>
                <span className="text-muted-foreground">{stage.attendanceRate}%</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
