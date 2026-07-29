"use client";

import { useTranslations } from "next-intl";
import { useDashboardData } from "../hooks/use-dashboard";
import { KpiCards } from "./kpi-cards";
import { AttendanceTrendChart } from "./attendance-trend-chart";
import { FollowupStatusChart } from "./followup-status-chart";
import { PipelineChart } from "./pipeline-chart";
import { StageAnalyticsTable } from "./stage-analytics-table";

export function DashboardPage() {
  const t = useTranslations("dashboard");
  const { data, isLoading, error } = useDashboardData();
  const dashboardData = data?.data;

  if (error) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <h3 className="text-lg font-semibold text-destructive">
            {t("loadError")}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {data?.message ?? error.message}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <KpiCards data={dashboardData} isLoading={isLoading} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AttendanceTrendChart
          title={t("attendanceTrend")}
          data={dashboardData?.attendanceMonthlyTrend}
          isLoading={isLoading}
        />
        <FollowupStatusChart
          data={dashboardData?.followupAnalytics.statusCounts}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PipelineChart
          data={dashboardData?.pipelineAnalytics}
          isLoading={isLoading}
        />
        <AttendanceTrendChart
          title={t("attendanceWeekly")}
          data={dashboardData?.attendanceWeeklyTrend}
          isLoading={isLoading}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          {t("stageAnalytics.title")}
        </h2>
        <StageAnalyticsTable
          data={dashboardData?.stageAnalytics}
          isLoading={isLoading}
        />
      </div>
    </section>
  );
}
