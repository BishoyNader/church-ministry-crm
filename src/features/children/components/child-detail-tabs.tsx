"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

type ChildDetailTabsProps = {
  child: ChildDetail;
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

export function ChildDetailTabs({ child }: ChildDetailTabsProps) {
  const t = useTranslations("children.detail");
  const tStatus = useTranslations("children.status");
  const tPipeline = useTranslations("children.pipeline");

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
          <InfoRow label="First Name (Arabic)" value={child.first_name_ar} />
          <InfoRow label="First Name (English)" value={child.first_name_en} />
          <InfoRow label="Last Name (Arabic)" value={child.last_name_ar} />
          <InfoRow label="Last Name (English)" value={child.last_name_en} />
          <InfoRow label="Date of Birth" value={child.date_of_birth} />
          <InfoRow label="Gender" value={child.gender} />
          <InfoRow label="Ministry" value={child.ministryNameAr} />
          <InfoRow label="Stage" value={child.stageNameAr} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("parentInfo")}</h3>
          <InfoRow label="Father" value={child.father_name_ar} />
          <InfoRow label="Mother" value={child.mother_name_ar} />
          <InfoRow label="Parent Phone" value={child.parent_phone} />
          <InfoRow label="Parent Email" value={child.parent_email} />
          <InfoRow label="Address" value={child.parent_address_ar} />
          <InfoRow label="Emergency Contact" value={child.emergency_contact_name} />
          <InfoRow label="Emergency Phone" value={child.emergency_contact_phone} />
          <InfoRow label="Mobile" value={child.mobile} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("medicalInfo")}</h3>
          <InfoRow label="Allergies" value={child.allergies} />
          <InfoRow label="Medical Conditions" value={child.medical_conditions} />
          <InfoRow label="Medications" value={child.medications} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("spiritualInfo")}</h3>
          <InfoRow label="Baptism Date" value={child.baptism_date} />
          <InfoRow label="Confession Frequency" value={child.confession_frequency} />
          <InfoRow label="Spiritual Notes" value={child.spiritual_notes} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t("educationInfo")}</h3>
          <InfoRow label="School" value={child.school_name_ar} />
          <InfoRow label="Grade Level" value={child.grade_level} />
          <InfoRow label="Notes" value={child.notes} />
        </div>
      </TabsContent>

      <TabsContent value="attendance">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("attendancePlaceholder")}</p>
        </div>
      </TabsContent>

      <TabsContent value="followups">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("followupsPlaceholder")}</p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
