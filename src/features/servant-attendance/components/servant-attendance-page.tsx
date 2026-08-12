"use client";

import { useMemo, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, CheckCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { PermissionGuard, useAccessState } from "@/features/rbac";
import { useChildServices, useChildStages } from "@/features/children/hooks/use-children";
import { useServantAttendanceList, useBatchServantAttendance, useServantAttendanceHistory } from "../hooks/use-servant-attendance";
import { ServantAttendanceTable } from "./servant-attendance-table";
import type { ServantAttendanceRecordValue, ServantAttendanceStatus } from "../types/servant-attendance.types";

export function ServantAttendancePage() {
  const t = useTranslations("servantAttendance");
  const tChildren = useTranslations("children");

  const [stageId, setStageId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [serviceFilter, setServiceFilter] = useState("all");
  const [userRecords, setUserRecords] = useState<Record<string, ServantAttendanceRecordValue>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: accessState } = useAccessState();
  const roles = accessState?.roles ?? [];
  const isKeeper =
    roles.some((role) => role.role_type === "super_admin" || role.role_type === "admin") ||
    roles.some((role) => role.role_type === "stage_manager");

  const servicesQuery = useChildServices();
  const services = servicesQuery.data?.data ?? [];

  const serviceId = serviceFilter !== "all" ? serviceFilter : undefined;
  const stagesQuery = useChildStages(serviceId);
  const stages = stagesQuery.data?.data ?? [];

  const listEnabled = !!stageId && !!date && !!serviceId;
  const listFilters = useMemo(
    () => ({
      service_id: serviceId ?? "",
      stage_id: stageId ?? "",
      attendance_date: date,
    }),
    [serviceId, stageId, date],
  );

  const attendanceQuery = useServantAttendanceList(
    listEnabled ? listFilters : undefined,
    listEnabled,
  );
  const batchMutation = useBatchServantAttendance();
  const historyQuery = useServantAttendanceHistory(stageId);

  const attendees = attendanceQuery.data?.data?.attendees ?? [];
  const isLoadingAttendees = attendanceQuery.isLoading;
  const loadError = attendanceQuery.error;

  const records = useMemo(() => {
    const merged = { ...userRecords };
    const existing = attendanceQuery.data?.data?.records ?? {};
    for (const [servantId, record] of Object.entries(existing)) {
      if (!merged[servantId]) {
        merged[servantId] = record;
      }
    }
    return merged;
  }, [userRecords, attendanceQuery.data?.data?.records]);

  const hasRecords = Object.keys(records).length > 0;

  const handleStageChange = (value: unknown) => {
    setStageId((value as string) || null);
    setUserRecords({});
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setUserRecords({});
  };

  const handleServiceChange = (value: unknown) => {
    setServiceFilter(value as string);
    setStageId(null);
    setUserRecords({});
  };

  const handleRecordChange = useCallback(
    (servantId: string, status: ServantAttendanceStatus, notes: string) => {
      setUserRecords((prev) => ({ ...prev, [servantId]: { status, notes } }));
    },
    [],
  );

  const markAll = useCallback(
    (status: ServantAttendanceStatus) => {
      setUserRecords((prev) => {
        const next = { ...prev };
        for (const servant of attendees) {
          next[servant.id] = { status, notes: next[servant.id]?.notes ?? "" };
        }
        return next;
      });
    },
    [attendees],
  );

  const handleSave = async () => {
    if (!stageId || !serviceId || !hasRecords) return;
    setSaveError(null);

    const result = await batchMutation.mutateAsync({
      stage_id: stageId,
      service_id: serviceId,
      attendance_date: date,
      records: Object.entries(records).map(([servantId, record]) => ({
        servant_id: servantId,
        status: record.status,
        notes: record.notes || undefined,
      })),
    });

    if (!result.success) {
      setSaveError(result.message ?? t("saveError"));
      return;
    }
    setUserRecords({});
  };

  const loadHistoryDate = (sessionDate: string) => {
    setDate(sessionDate);
    setUserRecords({});
  };

  if (loadError) {
    return <ErrorState title={t("loadError")} message={loadError.message} />;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />

      {!isKeeper ? (
        <EmptyState
          icon={<XCircle className="size-8 text-muted-foreground" />}
          title={t("accessDeniedTitle")}
          description={t("accessDeniedDescription")}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("selectDate")}
              </label>
              <Input
                type="date"
                value={date}
                onChange={(event) => handleDateChange(event.target.value)}
                className="w-full sm:w-44"
              />
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {tChildren("filters.allServices")}
              </label>
              <Select value={serviceFilter} onValueChange={handleServiceChange}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder={tChildren("filters.allServices")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tChildren("filters.allServices")}</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("selectStage")}
              </label>
              <Select value={stageId ?? ""} onValueChange={handleStageChange}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder={t("selectStage")} />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {saveError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}

          {!stageId || !serviceId ? (
            <EmptyState
              icon={<CalendarClock className="size-8 text-muted-foreground" />}
              title={t("noStageSelected")}
              description=""
            />
          ) : isLoadingAttendees ? (
            <ServantAttendanceTable
              servants={[]}
              records={{}}
              onRecordChange={handleRecordChange}
              isLoading
            />
          ) : attendees.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-8 text-muted-foreground" />}
              title={t("noServantsInStage")}
              description=""
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {t("attendeesCount", { count: attendees.length })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => markAll("present")}
                  >
                    <CheckCheck className="size-4" />
                    {t("markAllPresent")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => markAll("absent")}
                  >
                    <XCircle className="size-4" />
                    {t("markAllAbsent")}
                  </Button>
                </div>
              </div>

              <ServantAttendanceTable
                servants={attendees}
                records={records}
                onRecordChange={handleRecordChange}
              />

              <div className="flex items-center justify-end">
                <PermissionGuard permission="attendance.create">
                  <Button
                    onClick={handleSave}
                    disabled={!hasRecords || batchMutation.isPending}
                  >
                    {batchMutation.isPending
                      ? t("saving")
                      : t("saveAttendance")}
                  </Button>
                </PermissionGuard>
              </div>
            </>
          )}

          {stageId && serviceId ? (
            <SectionCard className="p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="size-4 text-muted-foreground" />
                {t("historyTitle")}
              </h2>
              {historyQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("historyLoading")}</p>
              ) : historyQuery.error ? (
                <p className="text-sm text-destructive">{t("historyError")}</p>
              ) : (historyQuery.data?.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {(historyQuery.data?.data ?? []).map((item) => (
                    <li key={item.sessionId}>
                      <button
                        type="button"
                        onClick={() => loadHistoryDate(item.sessionDate)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm transition hover:bg-accent"
                      >
                        <span className="font-medium">{item.sessionDate}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("historySummary", {
                            total: item.total,
                            present: item.present,
                            absent: item.absent,
                          })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          ) : null}
        </>
      )}
    </section>
  );
}
