"use client";

import { useTranslations } from "next-intl";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { chartTooltipStyle } from "@/components/charts/chart-tooltip";
import { EmptyState } from "@/components/feedback/empty-state";
import { PieChart as PieChartIcon } from "lucide-react";
import type { FollowupStatusCount } from "../types/dashboard.types";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const STATUS_ORDER = ["scheduled", "in_progress", "completed", "cancelled"];

type FollowupStatusChartProps = {
  data?: FollowupStatusCount[];
  isLoading: boolean;
};

export function FollowupStatusChart({ data, isLoading }: FollowupStatusChartProps) {
  const t = useTranslations("dashboard");

  const ordered = STATUS_ORDER
    .map((status) => {
      const found = data?.find((d) => d.status === status);
      return found ?? { status, count: 0 };
    })
    .filter((d) => d.count > 0);

  const chartData = ordered.map((d, i) => ({
    ...d,
    fill: COLORS[i % COLORS.length],
    label: t(`status.${d.status}`),
  }));

  return (
    <ChartCard
      title={t("followupStatus.title")}
      isLoading={isLoading}
      isEmpty={!data || data.length === 0}
      emptyState={
        <EmptyState
          icon={<PieChartIcon className="size-8 text-muted-foreground" />}
          title={t("noData")}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
            {chartData.map((entry) => (
              <Cell key={entry.status} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={chartTooltipStyle} />
          <Legend formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
