"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { ImportUploadArea } from "./import-upload-area";
import { ExportActions } from "./export-actions";

export function ImportExportPage() {
  const t = useTranslations("importExport");

  return (
    <section className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <ImportUploadArea />
      <ExportActions />
    </section>
  );
}