"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type {
  ServantAttendanceAttendee,
  ServantAttendanceRecordValue,
  ServantAttendanceStatus,
} from "../types/servant-attendance.types";

type ServantAttendanceTableProps = {
  servants: ServantAttendanceAttendee[];
  records: Record<string, ServantAttendanceRecordValue>;
  onRecordChange: (servantId: string, status: ServantAttendanceStatus, notes: string) => void;
  isLoading?: boolean;
};

const STATUS_OPTIONS: ServantAttendanceStatus[] = ["present", "absent", "excused"];

export function ServantAttendanceTable({
  servants,
  records,
  onRecordChange,
  isLoading,
}: ServantAttendanceTableProps) {
  const t = useTranslations("servantAttendance");

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("caption")}</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3">{t("servantName")}</th>
                <th scope="col" className="px-4 py-3">{t("status")}</th>
                <th scope="col" className="px-4 py-3">{t("notes")}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
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

  if (servants.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">{t("servantName")}</th>
              <th scope="col" className="px-4 py-3">{t("status")}</th>
              <th scope="col" className="px-4 py-3">{t("notes")}</th>
            </tr>
          </thead>
          <tbody>
            {servants.map((servant) => {
              const current = records[servant.id];
              return (
                <tr key={servant.id} className="border-b transition hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {servant.full_name_ar[0] ?? "?"}
                      </div>
                      <div>
                        <p className="font-medium">{servant.full_name_ar}</p>
                        <div className="flex items-center gap-2">
                          {servant.full_name_en ? (
                            <p className="text-xs text-muted-foreground">{servant.full_name_en}</p>
                          ) : null}
                          {servant.roleNameAr ? (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              {servant.roleNameAr}
                            </Badge>
                          ) : null}
                        </div>
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
                          onClick={() =>
                            onRecordChange(
                              servant.id,
                              option,
                              current?.notes ?? "",
                            )
                          }
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
                      onChange={(event) =>
                        onRecordChange(
                          servant.id,
                          current?.status ?? "present",
                          event.target.value,
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
