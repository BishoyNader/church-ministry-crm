"use client";

import { useTranslations } from "next-intl";
import { UserRoundCheck, CheckCircle2, XCircle, Church as ChurchIcon } from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import type { ApprovalCenterStats } from "../types/approval.types";

type ApprovalStatsCardsProps = {
  data: ApprovalCenterStats | null | undefined;
  isLoading: boolean;
};

export function ApprovalStatsCards({ data, isLoading }: ApprovalStatsCardsProps) {
  const t = useTranslations("approvals.stats");

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("pendingServants.label")}
        value={data?.pendingServants ?? 0}
        icon={UserRoundCheck}
        accent
        isLoading={isLoading}
      />
      <StatCard
        label={t("approved30d.label")}
        value={data?.approvedServantsLast30d ?? 0}
        icon={CheckCircle2}
        isLoading={isLoading}
      />
      <StatCard
        label={t("rejected.label")}
        value={data?.rejectedServants ?? 0}
        icon={XCircle}
        isLoading={isLoading}
      />
      {data?.canReviewChurchRequests ? (
        <StatCard
          label={t("pendingChurchRequests.label")}
          value={data?.pendingChurchRequests ?? 0}
          icon={ChurchIcon}
          isLoading={isLoading}
        />
      ) : null}
    </div>
  );
}
