"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/feedback/error-state";
import { PageTransition } from "@/components/motion/motion-primitives";
import { usePlatformDashboardStats } from "../hooks/use-platform-dashboard";
import { PlatformKpiCards } from "./platform-kpi-cards";
import { PendingRequestsCard } from "./pending-requests-card";
import { PlatformChurchesOverview } from "./platform-churches-overview";
import { RecentAuditCard } from "./recent-audit-card";

export function PlatformDashboardPage() {
  const t = useTranslations("admin.dashboard");
  const { data, isLoading, error } = usePlatformDashboardStats();

  if (error) {
    return <ErrorState title={t("errors.statsFailed")} message={error.message} />;
  }

  return (
    <PageTransition className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <PlatformKpiCards stats={data?.data} isLoading={isLoading} />

      <div className="grid gap-4 lg:grid-cols-3">
        <PendingRequestsCard />
        <div className="lg:col-span-2">
          <PlatformChurchesOverview />
        </div>
      </div>

      <RecentAuditCard />
    </PageTransition>
  );
}
