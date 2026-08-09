"use client";

import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import { SectionCard } from "@/components/layout/section-card";
import type { ProvisionChurchWizardValues } from "../schemas/provisioning.schema";

type ChurchProvisioningSummaryProps = {
  form: UseFormReturn<ProvisionChurchWizardValues>;
};

type SummaryRowProps = {
  label: string;
  value?: string;
  mono?: boolean;
};

function SummaryRow({ label, value, mono }: SummaryRowProps) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

export function ChurchProvisioningSummary({ form }: ChurchProvisioningSummaryProps) {
  const t = useTranslations("churches");
  const values = form.getValues();

  return (
    <div className="grid gap-4">
      <SectionCard className="p-4">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold tracking-tight">{t("wizard.summary.churchDetails")}</h3>
          <SummaryRow label={t("wizard.church.churchNameAr")} value={values.churchNameAr} />
          <SummaryRow label={t("wizard.church.slug")} value={values.slug} mono />
          <SummaryRow label={t("wizard.church.contactEmail")} value={values.contactEmail} />
          <SummaryRow label={t("wizard.church.contactPhone")} value={values.contactPhone} />
          <SummaryRow label={t("wizard.church.addressAr")} value={values.addressAr} />
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold tracking-tight">{t("wizard.summary.adminDetails")}</h3>
          <SummaryRow label={t("wizard.admin.fullNameAr")} value={values.fullNameAr} />
          <SummaryRow label={t("wizard.admin.fullNameEn")} value={values.fullNameEn} />
          <SummaryRow label={t("wizard.admin.email")} value={values.email} />
          <SummaryRow label={t("wizard.admin.phone")} value={values.phone} />
          <SummaryRow
            label={t("wizard.admin.password")}
            value={values.password ? "••••••••" : t("wizard.summary.inviteLinkNote")}
          />
        </div>
      </SectionCard>
    </div>
  );
}
