"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useAccessState, PERMISSION_CODES } from "@/features/rbac";
import { useReportsData, useReportsFilterOptions } from "../hooks/use-reports";
import { exportReportsCsv } from "../hooks/use-reports";
import type { ReportsFilters } from "../types/reports.types";

export function ReportsPage() {
  const t = useTranslations("reports");
  const [filters, setFilters] = useState<ReportsFilters>({});
  const { data: reports, isLoading, error } = useReportsData(filters);
  const { data: filterOptions } = useReportsFilterOptions();
  const { data: accessState } = useAccessState();

  const permissions = new Set((accessState?.permissions ?? []).map((permission) => permission.code));
  const canExport = permissions.has(PERMISSION_CODES.REPORTS_EXPORT);
  const options = filterOptions?.data;
  const response = reports?.data;

  const total = response?.attendanceRate.total ?? 0;
  const completionRate = response?.followupCompletion.completionRate ?? 0;
  const attendanceRate = response?.attendanceRate.rate ?? 0;

  const [exportError, setExportError] = useState<string | null>(null);

  const exportCsv = async () => {
    setExportError(null);
    const result = await exportReportsCsv(filters);
    if (!result.success || !result.data) {
      setExportError(result.message ?? t("exportError"));
      return;
    }

    const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "reports.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(
    () => [
      { label: t("attendanceRate"), value: `${attendanceRate.toFixed(1)}%` },
      { label: t("servantsTracked"), value: `${response?.servantAttendance.length ?? 0}` },
      { label: t("beneficiariesTracked"), value: `${response?.beneficiaryAttendance.length ?? 0}` },
      { label: t("followupCompletion"), value: `${completionRate.toFixed(1)}%` },
    ],
    [attendanceRate, completionRate, response, t],
  );

  if (error) {
    return <ErrorState title={t("loadError")} message={error.message} />;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {canExport ? (
          <Button onClick={exportCsv} variant="outline" className="gap-2">
            <Download className="size-4" />
            {t("exportCsv")}
          </Button>
        ) : null}
      </div>

      {exportError ? (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {exportError}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("filters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label htmlFor="reports-from-date" className="text-xs font-medium text-muted-foreground">
              {t("fromDate")}
            </label>
            <Input
              id="reports-from-date"
              type="date"
              value={filters.fromDate ?? ""}
              onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value || undefined }))}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reports-to-date" className="text-xs font-medium text-muted-foreground">
              {t("toDate")}
            </label>
            <Input
              id="reports-to-date"
              type="date"
              value={filters.toDate ?? ""}
              onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value || undefined }))}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reports-service" className="text-xs font-medium text-muted-foreground">
              {t("service")}
            </label>
            <Select
              value={filters.serviceId ?? "all"}
              onValueChange={(value) => {
                setFilters((prev) => ({
                  ...prev,
                  serviceId: value === "all" ? undefined : String(value),
                }));
              }}
            >
              <SelectTrigger id="reports-service">
                <SelectValue placeholder={t("service")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allServices")}</SelectItem>
                {(options?.services ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reports-stage" className="text-xs font-medium text-muted-foreground">
              {t("stage")}
            </label>
            <Select
              value={filters.stageId ?? "all"}
              onValueChange={(value) => {
                setFilters((prev) => ({
                  ...prev,
                  stageId: value === "all" ? undefined : String(value),
                }));
              }}
            >
              <SelectTrigger id="reports-stage">
                <SelectValue placeholder={t("stage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStages")}</SelectItem>
                {(options?.stages ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reports-servant" className="text-xs font-medium text-muted-foreground">
              {t("servant")}
            </label>
            <Select
              value={filters.servantId ?? "all"}
              onValueChange={(value) => {
                setFilters((prev) => ({
                  ...prev,
                  servantId: value === "all" ? undefined : String(value),
                }));
              }}
            >
              <SelectTrigger id="reports-servant">
                <SelectValue placeholder={t("servant")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allServants")}</SelectItem>
                {(options?.servants ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
          <span className="sr-only">{t("loadError")}</span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("attendanceSummary")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>{t("present")}: {response?.attendanceRate.present ?? 0}</div>
              <div>{t("absent")}: {response?.attendanceRate.absent ?? 0}</div>
              <div>{t("excused")}: {response?.attendanceRate.excused ?? 0}</div>
              <div>{t("totalRecords")}: {total}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("followupCompletionTitle")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>{t("completed")}: {response?.followupCompletion.completed ?? 0}</div>
              <div>{t("open")}: {response?.followupCompletion.open ?? 0}</div>
              <div>{t("overdue")}: {response?.followupCompletion.overdue ?? 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("stageComparison")}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(response?.stageComparison ?? []).map((row) => (
            <div key={row.stageId} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>{row.stageName}</span>
              <span>{row.attendanceRate.toFixed(1)}% ({row.total})</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
