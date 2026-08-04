"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/layout/section-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExportData } from "../hooks/use-import-export";
import type { ExportEntityType, ExportFileFormat } from "../types/import-export.types";

export function ExportActions() {
  const t = useTranslations("importExport");
  const [entity, setEntity] = useState<ExportEntityType>("beneficiaries");
  const [format, setFormat] = useState<ExportFileFormat>("csv");
  const [error, setError] = useState<string | null>(null);

  const exportMutation = useExportData();

  const handleExport = async () => {
    setError(null);
    const result = await exportMutation.mutateAsync({ entity, format });

    if (!result.success || !result.data) {
      setError(result.message ?? t("export.error"));
      return;
    }

    const { fileName, content, mimeType } = result.data;
    const isBase64 = mimeType.includes("spreadsheetml");

    const blob = isBase64
      ? new Blob([Uint8Array.from(atob(content), (char) => char.charCodeAt(0))], { type: mimeType })
      : new Blob([content], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SectionCard>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-ministry/10 p-3 text-ministry">
            <Download className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{t("export.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("export.description")}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="export-entity" className="mb-1.5 block text-sm font-medium">{t("export.entity")}</label>
            <Select
              id="export-entity"
              value={entity}
              onValueChange={(value) => setEntity(value as ExportEntityType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beneficiaries">{t("export.entities.beneficiaries")}</SelectItem>
                <SelectItem value="attendance">{t("export.entities.attendance")}</SelectItem>
                <SelectItem value="followups">{t("export.entities.followups")}</SelectItem>
                <SelectItem value="servants">{t("export.entities.servants")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="export-format" className="mb-1.5 block text-sm font-medium">{t("export.format")}</label>
            <Select
              id="export-format"
              value={format}
              onValueChange={(value) => setFormat(value as ExportFileFormat)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <span className="flex items-center gap-2">
                    <FileText className="size-3" />
                    CSV
                  </span>
                </SelectItem>
                <SelectItem value="xlsx">
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="size-3" />
                    XLSX
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="w-full gap-2"
            >
              {exportMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {t("export.exportButton")}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </SectionCard>
  );
}