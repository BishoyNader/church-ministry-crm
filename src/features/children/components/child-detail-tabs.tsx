"use client";

import { useTranslations, useLocale } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChildEmptyState } from "./child-empty-state";
import type {
  ChildDetail,
  AttendanceRecordWithSession,
} from "../types/child.types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "destructive",
  transferred: "secondary",
  graduated: "outline",
};



const ATTENDANCE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  present: "default",
  absent: "destructive",
  excused: "secondary",
};

const FOLLOWUP_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "outline",
  in_progress: "secondary",
  completed: "default",
  cancelled: "destructive",
};

type ChildDetailTabsProps = {
  child: ChildDetail;
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "\u2014"}</span>
    </div>
  );
}

export function ChildDetailTabs({ child }: ChildDetailTabsProps) {
  const t = useTranslations("children.detail");
  const tStatus = useTranslations("children.status");
  const locale = useLocale();

  const childName = child.full_name_ar;

  return (
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">{t("tabs.details")}</TabsTrigger>
        <TabsTrigger value="attendance">{t("tabs.attendance")}</TabsTrigger>
        <TabsTrigger value="followups">{t("tabs.followups")}</TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-lg font-medium">
            {child.full_name_ar[0]}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{childName}</h2>
            {child.full_name_en ? (
              <p className="text-sm text-muted-foreground">{child.full_name_en}</p>
            ) : null}
          </div>
          <Badge variant={STATUS_VARIANT[child.status] ?? "secondary"}>
            {tStatus(child.status)}
          </Badge>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("personalInfo")}</h3>
          <InfoRow label={t("fullNameAr")} value={child.full_name_ar} />
          <InfoRow label={t("fullNameEn")} value={child.full_name_en} />
          <InfoRow label={t("dateOfBirth")} value={child.date_of_birth} />
          <InfoRow label={t("gender")} value={child.gender} />
          <InfoRow label={t("service")} value={child.serviceNameAr} />
          <InfoRow label={t("stage")} value={child.stageNameAr} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("contactInfo")}</h3>
          <InfoRow label={t("fatherMobile")} value={child.father_mobile} />
          <InfoRow label={t("motherMobile")} value={child.mother_mobile} />
          <InfoRow label={t("mobile")} value={child.mobile} />
          <InfoRow label={t("whatsapp")} value={child.whatsapp} />
          <InfoRow label={t("address")} value={child.address} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("otherInfo")}</h3>
          <InfoRow label={t("school")} value={child.school} />
          <InfoRow label={t("confessionFather")} value={child.confession_father} />
          <InfoRow label={t("notes")} value={child.notes} />
        </div>
      </TabsContent>

      <TabsContent value="attendance">
        {child.attendance.length === 0 ? (
          <ChildEmptyState
            title={t("attendanceTable.noRecords")}
            description=""
          />
        ) : (
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">{t("attendanceTable.date")}</th>
                    <th className="px-4 py-3">{t("attendanceTable.status")}</th>
                    <th className="px-4 py-3">{t("attendanceTable.notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {child.attendance.map((record) => (
                    <tr key={record.id} className="border-b transition hover:bg-muted/30">
                      <td className="px-4 py-3">
                        {new Date((record as AttendanceRecordWithSession).attendance_sessions?.session_date ?? record.created_at).toLocaleDateString(locale)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={ATTENDANCE_STATUS_VARIANT[record.status] ?? "secondary"}
                        >
                          {t(`attendanceStatus.${record.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.notes ?? "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="followups">
        {child.followups.length === 0 ? (
          <ChildEmptyState
            title={t("followupsTable.noRecords")}
            description=""
          />
        ) : (
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">{t("followupsTable.type")}</th>
                    <th className="px-4 py-3">{t("followupsTable.status")}</th>
                    <th className="px-4 py-3">{t("followupsTable.scheduledAt")}</th>
                    <th className="px-4 py-3">{t("followupsTable.assignedTo")}</th>
                    <th className="px-4 py-3">{t("followupsTable.outcome")}</th>
                    <th className="px-4 py-3">{t("followupsTable.notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {child.followups.map((record) => (
                    <tr key={record.id} className="border-b transition hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        {record.type ? t(`followupType.${record.type}`) : "\u2014"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={FOLLOWUP_STATUS_VARIANT[record.status] ?? "secondary"}
                        >
                          {t(`followupStatus.${record.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.scheduled_at
                          ? new Date(record.scheduled_at).toLocaleDateString(locale)
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.profiles?.full_name_ar ?? "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.outcome ?? "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.notes ?? "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
