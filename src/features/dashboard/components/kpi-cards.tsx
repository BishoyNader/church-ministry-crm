"use client";

import { useTranslations } from "next-intl";
import { Users, Phone, ClipboardCheck, Layers, UserPlus, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import type { DashboardData } from "../types/dashboard.types";

type KpiCardsProps = {
  data?: DashboardData;
  isLoading: boolean;
};

const KPI_ITEMS = [
  { key: "activeChildren", icon: Users, getValue: (d: DashboardData) => d.kpis.totalActiveChildren },
  { key: "newChildren", icon: UserPlus, getValue: (d: DashboardData) => d.kpis.newChildrenThisMonth },
  { key: "openFollowups", icon: Phone, getValue: (d: DashboardData) => d.kpis.openFollowups },
  { key: "overdueFollowups", icon: AlertCircle, getValue: (d: DashboardData) => d.followupAnalytics.overdue },
  { key: "attendanceThisMonth", icon: ClipboardCheck, getValue: (d: DashboardData) => d.kpis.attendanceThisMonth },
  { key: "activeStages", icon: Layers, getValue: (d: DashboardData) => d.kpis.activeStages },
] as const;

const KPI_TONES = ["default", "primary", "primary", "danger", "success", "primary"] as const;

export function KpiCards({ data, isLoading }: KpiCardsProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {KPI_ITEMS.map(({ key, icon, getValue }, i) => (
        <StatCard
          key={key}
          label={t(`${key}.label`)}
          value={data ? getValue(data) : undefined}
          icon={icon}
          isLoading={isLoading}
          tone={KPI_TONES[i]}
        />
      ))}
    </div>
  );
}
