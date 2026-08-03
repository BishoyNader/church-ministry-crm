"use client";

import { useMemo, useState } from "react";
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

  const exportCsv = async () => {
    const result = await exportReportsCsv(filters);
    if (!result.success || !result.data) {
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
      { label: "Attendance Rate", value: `${attendanceRate.toFixed(1)}%` },
      { label: "Servants Tracked", value: `${response?.servantAttendance.length ?? 0}` },
      { label: "Beneficiaries Tracked", value: `${response?.beneficiaryAttendance.length ?? 0}` },
      { label: "Followup Completion", value: `${completionRate.toFixed(1)}%` },
    ],
    [attendanceRate, completionRate, response],
  );

  if (error) {
    return <ErrorState title="Reports failed to load" message={error.message} />;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Church-scoped analytics across attendance and followups.</p>
        </div>
        {canExport ? (
          <Button onClick={exportCsv} variant="outline" className="gap-2">
            <Download className="size-4" />
            Export CSV
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <Input
            type="date"
            value={filters.fromDate ?? ""}
            onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value || undefined }))}
            placeholder="From date"
          />
          <Input
            type="date"
            value={filters.toDate ?? ""}
            onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value || undefined }))}
            placeholder="To date"
          />
          <Select
            value={filters.serviceId ?? "all"}
            onValueChange={(value) => {
              setFilters((prev) => ({
                ...prev,
                serviceId: value === "all" ? undefined : String(value),
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {(options?.services ?? []).map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.stageId ?? "all"}
            onValueChange={(value) => {
              setFilters((prev) => ({
                ...prev,
                stageId: value === "all" ? undefined : String(value),
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {(options?.stages ?? []).map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.servantId ?? "all"}
            onValueChange={(value) => {
              setFilters((prev) => ({
                ...prev,
                servantId: value === "all" ? undefined : String(value),
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Servant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All servants</SelectItem>
              {(options?.servants ?? []).map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
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
          <CardHeader><CardTitle>Attendance Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>Present: {response?.attendanceRate.present ?? 0}</div>
              <div>Absent: {response?.attendanceRate.absent ?? 0}</div>
              <div>Excused: {response?.attendanceRate.excused ?? 0}</div>
              <div>Total records: {total}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Followup Completion</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>Completed: {response?.followupCompletion.completed ?? 0}</div>
              <div>Open: {response?.followupCompletion.open ?? 0}</div>
              <div>Overdue: {response?.followupCompletion.overdue ?? 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Stage Comparison</CardTitle></CardHeader>
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
