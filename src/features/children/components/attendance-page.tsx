"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
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
import { ErrorState } from "@/components/feedback/error-state";
import { PermissionGuard, useAccessState } from "@/features/rbac";
import { useChildList, useChildServices, useChildStages } from "../hooks/use-children";
import { useAttendanceList, useBatchAttendance, useToggleAttendance } from "../hooks/use-attendance";
import { AttendanceTable, type AttendanceRecord } from "./attendance-table";
import { ChildEmptyState } from "./child-empty-state";

export function AttendancePage() {
  const t = useTranslations("children");
  const tAttendance = useTranslations("children.attendance");

  const [stageId, setStageId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [serviceFilter, setServiceFilter] = useState("all");
  const [userRecords, setUserRecords] = useState<Record<string, AttendanceRecord>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const servicesQuery = useChildServices();
  const services = servicesQuery.data?.data ?? [];

  const serviceId = serviceFilter !== "all" ? serviceFilter : undefined;
  const stagesQuery = useChildStages(serviceId);
  const stages = stagesQuery.data?.data ?? [];

  const childrenQuery = useChildList(
    stageId ? { stage_id: stageId, status: "active" } : undefined,
  );
  const children = childrenQuery.data?.data?.data ?? [];
  const isLoadingChildren = childrenQuery.isLoading;

  const attendanceQuery = useAttendanceList(
    stageId ? { stage_id: stageId, from_date: date, to_date: date } : undefined,
    !!stageId,
  );
  const batchMutation = useBatchAttendance();
  const toggleMutation = useToggleAttendance();

  const { data: accessState } = useAccessState();
  const isAdmin = (accessState?.roles ?? []).some(
    (role) => role.role_type === "super_admin" || role.role_type === "admin",
  );

  const loadError = attendanceQuery.error ?? childrenQuery.error;

  const records = useMemo(() => {
    const merged = { ...userRecords };
    const existing = attendanceQuery.data?.data ?? [];
    for (const record of existing) {
      const bid = record.beneficiary_id;
      if (bid && !merged[bid]) {
        merged[bid] = {
          status: record.status as AttendanceRecord["status"],
          notes: record.notes ?? "",
        };
      }
    }
    return merged;
  }, [userRecords, attendanceQuery.data?.data]);

  const handleStageChange = (value: unknown) => {
    setStageId(value as string || null);
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
    (childId: string, status: AttendanceRecord["status"], notes: string) => {
      setUserRecords((prev) => ({ ...prev, [childId]: { status, notes } }));
    },
    [],
  );

  const hasRecords = Object.keys(records).length > 0;

  const handleQuickToggle = useCallback(
    (childId: string, status: AttendanceRecord["status"] | null, notes?: string) => {
      if (!stageId) return;
      const stage = stages.find((s) => s.id === stageId);
      const sid = stage?.service_id ?? serviceId;
      if (!sid) {
        // Never fail silently: an unresolved service means the write cannot
        // be attributed to a valid session — surface it instead of doing
        // nothing (which previously forced a page refresh to recover).
        setSaveError(tAttendance("selectServiceFirst"));
        return;
      }
      setSaveError(null);
      toggleMutation.mutate(
        {
          beneficiary_id: childId,
          stage_id: stageId,
          service_id: sid,
          attendance_date: date,
          status,
          notes: notes || null,
        },
        {
          onSuccess: (result) => {
            if (!result.success) {
              setSaveError(result.message ?? tAttendance("saveError"));
              return;
            }
            // Local edits are cleared so the table reflects server truth;
            // the query invalidation below refetches the current (stage,
            // date) session data.
            setUserRecords({});
          },
        },
      );
    },
    [stageId, stages, serviceId, date, toggleMutation, tAttendance],
  );

  const handleSave = async () => {
    if (!stageId || !hasRecords) return;
    setSaveError(null);

    const stage = stages.find((s) => s.id === stageId);
    const sid = stage?.service_id ?? serviceId;
    if (!sid) {
      setSaveError(tAttendance("selectServiceFirst"));
      return;
    }

    const result = await batchMutation.mutateAsync({
      stage_id: stageId,
      service_id: sid,
      attendance_date: date,
      records: Object.entries(records).map(([beneficiaryId, record]) => ({
        beneficiary_id: beneficiaryId,
        status: record.status,
        notes: record.notes || undefined,
      })),
    });

    if (!result.success) {
      setSaveError(result.message ?? tAttendance("saveError"));
      return;
    }
    // Drop local edits so the next date/stage switch starts from a clean
    // slate; the invalidation in the mutation refetches the saved session.
    setUserRecords({});
  };

  if (loadError) {
    return (
      <ErrorState title={t("errors.attendanceFailed")} message={loadError.message} />
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={tAttendance("title")}
        description={tAttendance("description")}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {tAttendance("selectDate")}
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full sm:w-44"
          />
        </div>

        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("filters.allServices")}
          </label>
          <Select value={serviceFilter} onValueChange={handleServiceChange}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("filters.allServices")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allServices")}</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {tAttendance("selectStage")}
          </label>
          <Select value={stageId ?? ""} onValueChange={handleStageChange}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={tAttendance("selectStage")} />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {saveError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {saveError}
        </p>
      )}

      {!stageId ? (
        <ChildEmptyState
          title={tAttendance("noStageSelected")}
          description=""
        />
      ) : isLoadingChildren ? (
        <AttendanceTable
          children_={[]}
          records={{}}
          onRecordChange={handleRecordChange}
          isLoading
        />
      ) : children.length === 0 ? (
        <ChildEmptyState
          title={tAttendance("noChildrenInStage")}
          description=""
        />
      ) : (
        <>
          {isAdmin ? (
            <p className="text-xs text-muted-foreground">{tAttendance("oneTapHint")}</p>
          ) : null}
          {/* key forces a fresh table for every (stage, date) selection so no
              stale row/input state survives a date switch — the screen always
              represents the selected combination without a page refresh. */}
          <AttendanceTable
            key={`${stageId}-${date}`}
            children_={children}
            records={records}
            onRecordChange={handleRecordChange}
            onQuickToggle={isAdmin ? handleQuickToggle : undefined}
          />

          {!isAdmin ? (
            <div className="flex items-center justify-end">
              <PermissionGuard permission="attendance.create">
                <Button
                  onClick={handleSave}
                  disabled={!hasRecords || batchMutation.isPending}
                >
                  {batchMutation.isPending
                    ? tAttendance("saving")
                    : tAttendance("saveAttendance")}
                </Button>
              </PermissionGuard>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
