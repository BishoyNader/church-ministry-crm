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
import { PermissionGuard } from "@/features/rbac";
import { useChildList, useChildMinistries, useChildStages } from "../hooks/use-children";
import { useAttendanceList, useBatchAttendance } from "../hooks/use-attendance";
import { AttendanceTable, type AttendanceRecord } from "./attendance-table";
import { ChildEmptyState } from "./child-empty-state";

export function AttendancePage() {
  const t = useTranslations("children");
  const tAttendance = useTranslations("children.attendance");

  const [stageId, setStageId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [userRecords, setUserRecords] = useState<Record<string, AttendanceRecord>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const ministriesQuery = useChildMinistries();
  const ministries = ministriesQuery.data?.data ?? [];

  const ministryId = ministryFilter !== "all" ? ministryFilter : undefined;
  const stagesQuery = useChildStages(ministryId);
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

  const records = useMemo(() => {
    const merged = { ...userRecords };
    const existing = attendanceQuery.data?.data ?? [];
    for (const record of existing) {
      if (!merged[record.child_id]) {
        merged[record.child_id] = {
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

  const handleMinistryChange = (value: unknown) => {
    setMinistryFilter(value as string);
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

  const handleSave = async () => {
    if (!stageId || !hasRecords) return;
    setSaveError(null);

    const result = await batchMutation.mutateAsync({
      stage_id: stageId,
      attendance_date: date,
      records: Object.entries(records).map(([childId, record]) => ({
        child_id: childId,
        status: record.status,
        notes: record.notes || undefined,
      })),
    });

    if (!result.success) {
      setSaveError(result.message ?? tAttendance("saveError"));
    }
  };

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
            {t("filters.allMinistries")}
          </label>
          <Select value={ministryFilter} onValueChange={handleMinistryChange}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("filters.allMinistries")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allMinistries")}</SelectItem>
              {ministries.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name_ar}
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
          <AttendanceTable
            children_={children}
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
                  ? tAttendance("saving")
                  : tAttendance("saveAttendance")}
              </Button>
            </PermissionGuard>
          </div>
        </>
      )}
    </section>
  );
}
