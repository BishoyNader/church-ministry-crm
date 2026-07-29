"use client";

import { useTranslations } from "next-intl";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FollowupStatusCount } from "../types/dashboard.types";

type FollowupStatusChartProps = {
  data?: FollowupStatusCount[];
  isLoading: boolean;
};

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const STATUS_ORDER = ["scheduled", "in_progress", "completed", "cancelled"];

export function FollowupStatusChart({ data, isLoading }: FollowupStatusChartProps) {
  const t = useTranslations("dashboard");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("followupStatus.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("followupStatus.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t("noData")}
          </div>
        </CardContent>
      </Card>
    );
  }

  const ordered = STATUS_ORDER
    .map((status) => {
      const found = data.find((d) => d.status === status);
      return found ?? { status, count: 0 };
    })
    .filter((d) => d.count > 0);

  const chartData = ordered.map((d, i) => ({
    ...d,
    fill: COLORS[i % COLORS.length],
    label: t(`status.${d.status}`),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("followupStatus.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                paddingAngle={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  fontSize: 13,
                }}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-sm text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
