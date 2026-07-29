"use client";

import { useTranslations, useLocale } from "next-intl";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { chartTooltipStyle, chartMargin, chartMarginRtl, chartAxisTick } from "@/components/charts/chart-tooltip";
import { EmptyState } from "@/components/feedback/empty-state";
import { BarChart3 } from "lucide-react";
import type { AttendanceTrendItem } from "../types/dashboard.types";

type AttendanceTrendChartProps = {
  title: string;
  data?: AttendanceTrendItem[];
  isLoading: boolean;
  dominant?: boolean;
};

export function AttendanceTrendChart({ title, data, isLoading, dominant }: AttendanceTrendChartProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const margin = locale === "ar" ? chartMarginRtl : chartMargin;

  return (
    <ChartCard
      title={title}
      isLoading={isLoading}
      isEmpty={!data || data.length === 0}
      emptyState={
        <EmptyState
          icon={<BarChart3 className="size-8 text-muted-foreground" />}
          title={t("noData")}
        />
      }
      contentClassName={dominant ? "min-h-[380px]" : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="period" tick={chartAxisTick} className="text-muted-foreground" />
          <YAxis allowDecimals={false} tick={chartAxisTick} className="text-muted-foreground" />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Line type="monotone" dataKey="present" name={t("attendanceStatus.present")} stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="absent" name={t("attendanceStatus.absent")} stroke="var(--color-chart-2)" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="excused" name={t("attendanceStatus.excused")} stroke="var(--color-chart-3)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
