"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload, FileSpreadsheet, FileText, FileDown, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/layout/section-card";
import {
  usePreviewImport,
  useImportBeneficiaries,
  useExportBeneficiariesTemplate,
  useExportBeneficiariesImportErrors,
} from "../hooks/use-import-export";
import { MAX_IMPORT_FILE_BYTES } from "../constants";
import type { ImportPreviewResult, ImportSummary, ImportRowFailureReason, ImportFileFormat } from "../types/import-export.types";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function downloadFile(fileName: string, content: string, mimeType: string) {
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
}

export function ImportUploadArea({ churchId }: { churchId?: string }) {
  const t = useTranslations("importExport");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importFailureReasonLabel = (reason: ImportRowFailureReason): string => {
    switch (reason) {
      case "duplicate":
        return t("import.failure.duplicate");
      case "servant_not_found":
        return t("import.failure.servantNotFound");
      case "stage_not_found":
        return t("import.failure.stageNotFound");
      case "invalid_church_scope":
        return t("import.failure.invalidChurchScope");
      case "rpc_failure":
        return t("import.failure.rpcFailure");
      case "insert_failure":
        return t("import.failure.insertFailure");
    }
  };

  const previewMutation = usePreviewImport();
  const importMutation = useImportBeneficiaries();
  const templateMutation = useExportBeneficiariesTemplate();
  const errorsFileMutation = useExportBeneficiariesImportErrors();

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setImportSummary(null);

      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension !== "xlsx" && extension !== "csv") {
        setError(t("invalidFileType"));
        return;
      }

      if (file.size > MAX_IMPORT_FILE_BYTES) {
        setError(t("errors.fileTooLarge"));
        return;
      }

      const format = extension === "xlsx" ? "xlsx" : "csv";
      const content = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(content);

      const result = await previewMutation.mutateAsync({
        fileName: file.name,
        format,
        content: base64,
        churchId,
      });

      if (!result.success || !result.data) {
        setError(result.message ?? t("previewError"));
        return;
      }

      setPreview(result.data);
    },
    [previewMutation, t, churchId],
  );

  const handleImport = useCallback(async () => {
    if (!preview) return;
    setError(null);

    const result = await importMutation.mutateAsync({
      rows: preview.validation.validRows,
      churchId,
    });

    if (!result.success || !result.data) {
      setError(result.message ?? t("importError"));
      return;
    }

    setImportSummary(result.data);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [preview, importMutation, t, churchId]);

  const handleTemplateDownload = useCallback(
    async (format: ImportFileFormat) => {
      setError(null);
      const result = await templateMutation.mutateAsync({ format, churchId });
      if (!result.success || !result.data) {
        setError(result.message ?? t("export.error"));
        return;
      }
      downloadFile(result.data.fileName, result.data.content, result.data.mimeType);
    },
    [templateMutation, t, churchId],
  );

  const handleErrorsFileDownload = useCallback(
    async (format: ImportFileFormat) => {
      if (!preview?.validation.invalidRows.length) return;
      setError(null);
      const result = await errorsFileMutation.mutateAsync({
        format,
        rows: preview.validation.invalidRows.map((invalid) => ({
          rowNumber: invalid.row.rowNumber,
          values: {
            name: invalid.row.name,
            phone: invalid.row.phone ?? "",
            birth_date: invalid.row.birthDate ?? "",
            gender: invalid.row.gender ?? "",
            stage: invalid.row.stage ?? "",
            class: invalid.row.className ?? "",
            address: invalid.row.address ?? "",
            notes: invalid.row.notes ?? "",
          },
          messages: invalid.errors.map((err) => err.message),
        })),
      });
      if (!result.success || !result.data) {
        setError(result.message ?? t("export.error"));
        return;
      }
      downloadFile(result.data.fileName, result.data.content, result.data.mimeType);
    },
    [errorsFileMutation, preview, t],
  );

  const validation = preview?.validation;
  const summary = validation?.errorSummary;

  return (
    <SectionCard>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-ministry/10 p-3 text-ministry">
            <Upload className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{t("import.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("import.description")}</p>
          </div>
        </div>

        <div className="mt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={handleFileChange}
            aria-label={t("import.uploadLabel")}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={previewMutation.isPending}
            className="gap-2"
          >
            {previewMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            {t("import.chooseFile")}
          </Button>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTemplateDownload("csv")}
              disabled={templateMutation.isPending}
              className="gap-2 text-muted-foreground"
            >
              {templateMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileDown className="size-3.5" />
              )}
              {t("import.downloadTemplateCsv")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTemplateDownload("xlsx")}
              disabled={templateMutation.isPending}
              className="gap-2 text-muted-foreground"
            >
              {templateMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileDown className="size-3.5" />
              )}
              {t("import.downloadTemplateXlsx")}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("import.supportedFormats")}</p>
        </div>

        {error ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <XCircle className="size-4" />
            {error}
          </div>
        ) : null}

        {preview && validation && summary ? (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <FileText className="size-3" />
                {preview.fileName}
              </Badge>
              <Badge variant="outline">{preview.format.toUpperCase()}</Badge>
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="size-3" />
                {t("import.validCount", { count: summary.validCount })}
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <XCircle className="size-3" />
                {t("import.invalidCount", { count: summary.invalidCount })}
              </Badge>
            </div>

            {summary.invalidCount > 0 ? (
              <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="size-4" />
                  {t("import.validationReport")}
                </div>
                <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
                  {summary.duplicateNames > 0 ? (
                    <li>{t("import.duplicateNames", { count: summary.duplicateNames })}</li>
                  ) : null}
                  {summary.duplicatePhones > 0 ? (
                    <li>{t("import.duplicatePhones", { count: summary.duplicatePhones })}</li>
                  ) : null}
                  {summary.missingRequired > 0 ? (
                    <li>{t("import.missingRequired", { count: summary.missingRequired })}</li>
                  ) : null}
                  {summary.invalidDates > 0 ? (
                    <li>{t("import.invalidDates", { count: summary.invalidDates })}</li>
                  ) : null}
                  {summary.invalidGenders > 0 ? (
                    <li>{t("import.invalidGenders", { count: summary.invalidGenders })}</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {validation.validRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("import.table.caption")}</caption>
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th scope="col" className="px-3 py-2 font-medium">{t("import.table.row")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("import.table.name")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("import.table.phone")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("import.table.birthDate")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("import.table.gender")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("import.table.stage")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("import.table.class")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.validRows.slice(0, 10).map((row) => (
                      <tr key={row.rowNumber} className="border-b last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.phone ?? "—"}</td>
                        <td className="px-3 py-2">{row.birthDate ?? "—"}</td>
                        <td className="px-3 py-2">{row.gender ?? "—"}</td>
                        <td className="px-3 py-2">{row.stage ?? "—"}</td>
                        <td className="px-3 py-2">{row.className ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validation.validRows.length > 10 ? (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    {t("import.showingFirst", { count: validation.validRows.length - 10 })}
                  </p>
                ) : null}
              </div>
            ) : null}

            {validation.invalidRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-destructive/30">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("import.table.caption")}</caption>
                  <thead>
                    <tr className="border-b bg-destructive/5 text-left">
                      <th scope="col" className="px-3 py-2 font-medium">{t("import.table.row")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("import.table.name")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("import.table.errors")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.invalidRows.slice(0, 10).map((invalid) => (
                      <tr key={invalid.row.rowNumber} className="border-b last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{invalid.row.rowNumber}</td>
                        <td className="px-3 py-2">{invalid.row.name || "—"}</td>
                        <td className="px-3 py-2">
                          <ul className="space-y-1">
                            {invalid.errors.map((err, index) => (
                              <li key={index} className="text-destructive">
                                {err.message}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t bg-muted/20 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleErrorsFileDownload("csv")}
                      disabled={errorsFileMutation.isPending}
                      className="gap-2"
                    >
                      {errorsFileMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <FileDown className="size-3.5" />
                      )}
                      {t("import.downloadErrorsCsv")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleErrorsFileDownload("xlsx")}
                      disabled={errorsFileMutation.isPending}
                      className="gap-2"
                    >
                      {errorsFileMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <FileDown className="size-3.5" />
                      )}
                      {t("import.downloadErrorsXlsx")}
                    </Button>
                    {validation.invalidRows.length > 10 ? (
                      <span className="text-xs text-muted-foreground">
                        {t("import.invalidShown", { count: validation.invalidRows.length - 10 })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending || validation.validRows.length === 0}
                className="gap-2"
              >
                {importMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {t("import.importButton")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                {t("import.cancel")}
              </Button>
            </div>
          </div>
        ) : null}

        {importSummary ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
              <CheckCircle2 className="size-4" />
              {t("import.importSummary", {
                imported: importSummary.importedCount,
                skipped: importSummary.skippedCount,
              })}
            </div>
            {importSummary.failures.length > 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <XCircle className="size-4" />
                  {t("import.failure.title")}
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {importSummary.failures.slice(0, 10).map((failure) => (
                    <li key={`${failure.rowNumber}-${failure.reason}`} className="text-destructive">
                      {t("import.failure.row", {
                        row: failure.rowNumber,
                        name: failure.name || "—",
                      })}
                      {" — "}
                      {importFailureReasonLabel(failure.reason)}
                    </li>
                  ))}
                </ul>
                {importSummary.failures.length > 10 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("import.failure.more", { count: importSummary.failures.length - 10 })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}