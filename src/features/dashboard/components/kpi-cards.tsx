"use client";

import { useTranslations } from "next-intl";
import { Baby, Phone, ClipboardCheck, Layers, UserPlus, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardData } from "../types/dashboard.types";

type KpiCardsProps = {
  data?: DashboardData;
  isLoading: boolean;
};

const KPI_ITEMS = [
  { key: "activeChildren", icon: Baby, getValue: (d: DashboardData) => d.kpis.totalActiveChildren },
  { key: "newChildren", icon: UserPlus, getValue: (d: DashboardData) => d.kpis.newChildrenThisMonth },
  { key: "openFollowups", icon: Phone, getValue: (d: DashboardData) => d.kpis.openFollowups },
  { key: "overdueFollowups", icon: AlertCircle, getValue: (d: DashboardData) => d.followupAnalytics.overdue },
  { key: "attendanceThisMonth", icon: ClipboardCheck, getValue: (d: DashboardData) => d.kpis.attendanceThisMonth },
  { key: "activeStages", icon: Layers, getValue: (d: DashboardData) => d.kpis.activeStages },
] as const;

export function KpiCards({ data, isLoading }: KpiCardsProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {KPI_ITEMS.map(({ key, icon: Icon, getValue }) => (
        <Card key={key}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-muted p-3">
              <Icon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
                {t(`${key}.label`)}
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">
                  {data ? getValue(data) : "\u2014"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
