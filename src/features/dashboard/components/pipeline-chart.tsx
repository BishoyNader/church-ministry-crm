"use client";

import { useTranslations, useLocale } from "next-intl";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { chartTooltipStyle, chartMargin, chartMarginRtl, chartAxisTick } from "@/components/charts/chart-tooltip";
import { EmptyState } from "@/components/feedback/empty-state";
import { GitBranch } from "lucide-react";
import type { PipelineStageCount } from "../types/dashboard.types";

type PipelineChartProps = {
  data?: PipelineStageCount[];
  isLoading: boolean;
};

export function PipelineChart({ data, isLoading }: PipelineChartProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const margin = locale === "ar" ? chartMarginRtl : chartMargin;

  const chartData = data?.map((d) => ({
    ...d,
    label: locale === "ar" ? d.stageNameAr : (d.stageNameEn ?? d.stageNameAr),
  }));

  return (
    <ChartCard
      title={t("pipelineDistribution")}
      isLoading={isLoading}
      isEmpty={!data || data.length === 0}
      emptyState={
        <EmptyState
          icon={<GitBranch className="size-8 text-muted-foreground" />}
          title={t("noData")}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tick={chartAxisTick} className="text-muted-foreground" />
          <YAxis allowDecimals={false} tick={chartAxisTick} className="text-muted-foreground" />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
