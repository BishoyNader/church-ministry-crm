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
  isLoading?: boolean;
};

export function AttendanceTable({
  children_,
  records,
  onRecordChange,
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
              <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
            <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-4 py-3">{t("childName")}</th>
              <th scope="col" className="px-4 py-3">{t("status")}</th>
              <th scope="col" className="px-4 py-3">{t("notes")}</th>
            </tr>
          </thead>
          <tbody>
            {children_.map((child) => {
              const current = records[child.id];
              return (
                <tr key={child.id} className="border-b transition hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {child.full_name_ar[0]}
                        </div>
                        <div>
                          <p className="font-medium">{child.full_name_ar}</p>
                          {child.full_name_en ? (
                            <p className="text-xs text-muted-foreground">{child.full_name_en}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {STATUS_OPTIONS.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          variant={current?.status === option ? "default" : "outline"}
                          size="sm"
                          onClick={() => onRecordChange(child.id, option, current?.notes ?? "")}
                        >
                          {t(option)}
                        </Button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
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
