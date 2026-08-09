"use client";

import { useTranslations } from "next-intl";
import {
  Building2,
  CheckCircle2,
  Inbox,
  Percent,
  Users,
  HandHeart,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import { StaggerItem, StaggerList } from "@/components/motion/motion-primitives";
import type { PlatformDashboardStats } from "../types/platform-dashboard.types";

type PlatformKpiCardsProps = {
  stats: PlatformDashboardStats | undefined;
  isLoading: boolean;
};

export function PlatformKpiCards({ stats, isLoading }: PlatformKpiCardsProps) {
  const t = useTranslations("admin.dashboard.kpis");

  const cards: {
    key: string;
    value: number | null;
    display: React.ReactNode;
    icon: LucideIcon;
    accent?: boolean;
  }[] = [
    { key: "totalChurches", value: stats?.churches.total ?? null, display: stats?.churches.total ?? null, icon: Building2, accent: true },
    { key: "activeChurches", value: stats?.churches.active ?? null, display: stats?.churches.active ?? null, icon: CheckCircle2 },
    { key: "pendingRequests", value: stats?.requests.pending ?? null, display: stats?.requests.pending ?? null, icon: Inbox },
    { key: "approvalRate", value: stats?.approvalRate ?? null, display: stats?.approvalRate != null ? `${stats.approvalRate}%` : null, icon: Percent },
    { key: "totalUsers", value: stats?.users ?? null, display: stats?.users ?? null, icon: Users },
    { key: "totalServants", value: stats?.servants ?? null, display: stats?.servants ?? null, icon: HandHeart },
    { key: "totalBeneficiaries", value: stats?.beneficiaries ?? null, display: stats?.beneficiaries ?? null, icon: UserRound },
  ];

  return (
    <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <StaggerItem key={card.key}>
          <StatCard
            label={t(card.key)}
            value={card.display}
            icon={card.icon}
            isLoading={isLoading}
            accent={card.accent}
            className="h-full"
          />
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
