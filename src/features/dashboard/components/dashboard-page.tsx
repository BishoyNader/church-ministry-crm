"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useDashboardData } from "../hooks/use-dashboard";
import { KpiCards } from "./kpi-cards";
import { AttendanceTrendChart } from "./attendance-trend-chart";
import { FollowupStatusChart } from "./followup-status-chart";
import { PipelineChart } from "./pipeline-chart";
import { StageAnalyticsTable } from "./stage-analytics-table";
import { OverdueFollowupsHero } from "./overdue-followups-hero";
import { QuickActions } from "./quick-actions";
import { NextFollowupsDue } from "./next-followups-due";
import { RecentChildren } from "./recent-children";
import { DashboardHero } from "@/components/layout/dashboard-hero";
import { ErrorState } from "@/components/feedback/error-state";
import { isFeatureEnabled } from "@/lib/features";
import { useAccessState } from "@/features/rbac";
import { AnnouncementWidget } from "@/components/widgets/announcement-widget";
import { SponsorWidget } from "@/components/widgets/sponsor-widget";
import { CommunityBanner } from "@/components/widgets/community-banner";

export function DashboardPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { data, isLoading, error } = useDashboardData();
  const dashboardData = data?.data;
  const { data: accessState } = useAccessState();

  const roles = accessState?.roles ?? [];
  // Servants and stage managers are stage-scoped by RLS (servant_stage_assignments);
  // the scope notice explains why the dashboard shows their assigned stages only.
  const isScopedServant =
    roles.length > 0 &&
    roles.every(
      (role) =>
        role.role_type === "servant" || role.role_type === "stage_manager",
    );

  if (error) {
    return (
      <section className="space-y-6">
        <DashboardHero title={t("title")} description={t("description")} />
        <ErrorState title={t("loadError")} message={data?.message ?? error.message} />
      </section>
    );
  }

  return (
    <section className="space-y-4 md:space-y-6">
      <DashboardHero title={t("title")} description={t("description")} />

      {isFeatureEnabled("communityBanner") ? <CommunityBanner /> : null}

      {isScopedServant ? (
        <div
          role="status"
          className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
        >
          <span className="font-semibold">{t("scopeNotice.title")}</span>{" "}
          <span className="text-muted-foreground">{t("scopeNotice.description")}</span>
        </div>
      ) : null}

      <KpiCards data={dashboardData} isLoading={isLoading} />

      <OverdueFollowupsHero
        overdue={dashboardData?.followupAnalytics.overdue ?? 0}
        isLoading={isLoading}
      />

      <QuickActions />

      {isFeatureEnabled("announcements") ? <AnnouncementWidget /> : null}

      <AttendanceTrendChart
        title={t("attendanceTrend")}
        data={dashboardData?.attendanceMonthlyTrend}
        isLoading={isLoading}
        dominant
      />

      <div className="grid gap-3 sm:gap-4 md:gap-6 lg:grid-cols-2">
        <FollowupStatusChart
          data={dashboardData?.followupAnalytics.statusCounts}
          isLoading={isLoading}
        />
        <PipelineChart
          data={dashboardData?.pipelineAnalytics}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-3 sm:gap-4 md:gap-6 lg:grid-cols-2">
        <NextFollowupsDue
          data={dashboardData?.nextFollowupsDue}
          isLoading={isLoading}
        />
        <RecentChildren
          data={dashboardData?.recentChildren}
          isLoading={isLoading}
        />
      </div>

      {isFeatureEnabled("sponsors") ? <SponsorWidget /> : null}

      <div>
        <Link
          href={`/${locale}/stages`}
          className="group mb-4 inline-flex items-center gap-2 text-lg font-semibold tracking-tight hover:text-primary"
        >
          {t("stageAnalytics.title")}
          <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {locale === "ar" ? "\u2190" : "\u2192"}
          </span>
        </Link>
        <StageAnalyticsTable
          data={dashboardData?.stageAnalytics}
          isLoading={isLoading}
        />
      </div>
    </section>
  );
}
