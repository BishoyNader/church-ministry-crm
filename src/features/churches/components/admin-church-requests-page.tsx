"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";

export function AdminChurchRequestsPage() {
  const t = useTranslations("admin.churchRequests");

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />

      <SectionCard>
        <div className="py-10 text-center text-muted-foreground">
          {t("empty.title")}
        </div>
      </SectionCard>
    </section>
  );
}