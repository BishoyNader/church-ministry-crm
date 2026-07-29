"use client";

import { useTranslations, useLocale } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChildEmptyState } from "./child-empty-state";
import type { ChildDetail } from "../types/child.types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "destructive",
  transferred: "secondary",
  graduated: "outline",
};

const PIPELINE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new_visitor: "outline",
  first_followup: "secondary",
  regular_attendee: "default",
  active_member: "default",
  leader_candidate: "secondary",
};

const ATTENDANCE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  present: "default",
  absent: "destructive",
  excused: "secondary",
};

const FOLLOWUP_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "outline",
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
  const tPipeline = useTranslations("children.pipeline");
  const locale = useLocale();

  const childName = `${child.first_name_ar} ${child.last_name_ar}`;

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
            {child.first_name_ar[0]}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{childName}</h2>
            {child.first_name_en ? (
              <p className="text-sm text-muted-foreground">
                {child.first_name_en} {child.last_name_en ?? ""}
              </p>
            ) : null}
          </div>
          <Badge variant={STATUS_VARIANT[child.status] ?? "secondary"}>
            {tStatus(child.status)}
          </Badge>
          <Badge variant={PIPELINE_VARIANT[child.pipeline_stage] ?? "secondary"}>
            {tPipeline(child.pipeline_stage)}
          </Badge>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("personalInfo")}</h3>
          <InfoRow label={t("firstNameAr")} value={child.first_name_ar} />
          <InfoRow label={t("firstNameEn")} value={child.first_name_en} />
          <InfoRow label={t("lastNameAr")} value={child.last_name_ar} />
          <InfoRow label={t("lastNameEn")} value={child.last_name_en} />
          <InfoRow label={t("dateOfBirth")} value={child.date_of_birth} />
          <InfoRow label={t("gender")} value={child.gender} />
          <InfoRow label={t("ministry")} value={child.ministryNameAr} />
          <InfoRow label={t("stage")} value={child.stageNameAr} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("parentInfo")}</h3>
          <InfoRow label={t("father")} value={child.father_name_ar} />
          <InfoRow label={t("mother")} value={child.mother_name_ar} />
          <InfoRow label={t("parentPhone")} value={child.parent_phone} />
          <InfoRow label={t("parentEmail")} value={child.parent_email} />
          <InfoRow label={t("address")} value={child.parent_address_ar} />
          <InfoRow label={t("emergencyContact")} value={child.emergency_contact_name} />
          <InfoRow label={t("emergencyPhone")} value={child.emergency_contact_phone} />
          <InfoRow label={t("mobile")} value={child.mobile} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("medicalInfo")}</h3>
          <InfoRow label={t("allergies")} value={child.allergies} />
          <InfoRow label={t("medicalConditions")} value={child.medical_conditions} />
          <InfoRow label={t("medications")} value={child.medications} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("spiritualInfo")}</h3>
          <InfoRow label={t("baptismDate")} value={child.baptism_date} />
          <InfoRow label={t("confessionFrequency")} value={child.confession_frequency} />
          <InfoRow label={t("spiritualNotes")} value={child.spiritual_notes} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("educationInfo")}</h3>
          <InfoRow label={t("school")} value={child.school_name_ar} />
          <InfoRow label={t("gradeLevel")} value={child.grade_level} />
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
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">{t("attendanceTable.date")}</th>
                    <th className="px-4 py-3">{t("attendanceTable.status")}</th>
                    <th className="px-4 py-3">{t("attendanceTable.notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {child.attendance.map((record) => (
                    <tr key={record.id} className="border-b transition hover:bg-muted/30">
                      <td className="px-4 py-3">
                        {new Date(record.attendance_date).toLocaleDateString(locale)}
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
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                        {t(`followupType.${record.type}`)}
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
