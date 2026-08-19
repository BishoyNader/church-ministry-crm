"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChildListItem } from "../types/child.types";

type AttendanceStatus = "present" | "absent" | "excused";

export type AttendanceRecord = {
  status: AttendanceStatus;
  notes: string;
};

type AttendanceTableProps = {
  children_: ChildListItem[];
  records: Record<string, AttendanceRecord>;
  onRecordChange: (childId: string, status: AttendanceStatus, notes: string) => void;
  /**
   * When provided (admin one-tap mode), clicking a status button persists that
   * status immediately; clicking the already-active status toggles it off
   * (status = null → record removed). The optional `notes` are persisted with
   * the status, so typed notes are not lost when a status is saved. Overrides
   * onRecordChange for statuses.
   */
  onQuickToggle?: (childId: string, status: AttendanceStatus | null, notes?: string) => void;
  isLoading?: boolean;
};

export function AttendanceTable({
  children_,
  records,
  onRecordChange,
  onQuickToggle,
  isLoading,
}: AttendanceTableProps) {
  const t = useTranslations("children.attendance");

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("caption")}</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3">{t("childName")}</th>
                <th scope="col" className="px-4 py-3">{t("status")}</th>
                <th scope="col" className="px-4 py-3">{t("notes")}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-40" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-8 w-48" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (children_.length === 0) return null;

  const STATUS_OPTIONS: AttendanceStatus[] = ["present", "absent", "excused"];

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 sm:px-4 py-3">{t("childName")}</th>
              <th scope="col" className="px-3 sm:px-4 py-3">{t("status")}</th>
              <th scope="col" className="px-3 sm:px-4 py-3 hidden md:table-cell">{t("notes")}</th>
            </tr>
          </thead>
          <tbody>
            {children_.map((child) => {
              const current = records[child.id];
              return (
                <tr key={child.id} className="border-b transition-colors hover:bg-muted/30">
                    <td className="px-3 sm:px-4 py-3">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {child.full_name_ar[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{child.full_name_ar}</p>
                          {child.full_name_en ? (
                            <p className="text-xs text-muted-foreground truncate">{child.full_name_en}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex gap-1">
                      {STATUS_OPTIONS.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          variant={current?.status === option ? "default" : "outline"}
                          size="sm"
                          className="min-h-9 sm:min-h-8 text-xs sm:text-sm"
                          onClick={() =>
                            onQuickToggle
                              ? onQuickToggle(
                                  child.id,
                                  current?.status === option ? null : option,
                                  current?.notes ?? "",
                                )
                              : onRecordChange(child.id, option, current?.notes ?? "")
                          }
                        >
                          {t(option)}
                        </Button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                    <Input
                      placeholder={t("notes")}
                      value={current?.notes ?? ""}
                      onChange={(e) =>
                        onRecordChange(
                          child.id,
                          current?.status ?? "present",
                          e.target.value,
                        )
                      }
                      onBlur={(e) => {
                        // One-tap mode: persist a note edit once the input
                        // loses focus (when a status already exists).
                        if (onQuickToggle && current?.status) {
                          onQuickToggle(child.id, current.status, e.target.value);
                        }
                      }}
                      className="h-8"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
