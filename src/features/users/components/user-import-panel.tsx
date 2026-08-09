"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  FileDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/layout/section-card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { MAX_IMPORT_FILE_BYTES } from "@/features/import-export/constants";
import { useActorChurch } from "../hooks/use-users";
import {
  usePreviewUsersImport,
  useImportUsers,
  useExportUsersTemplate,
  useExportUsersImportErrors,
} from "../hooks/use-user-import";
import type {
  UserImportPreviewResult,
  UserImportSummary,
  UserImportRowFailureReason,
  UserImportFileFormat,
} from "../types/user-import.types";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function triggerDownload(content: string, mimeType: string, fileName: string): void {
  const blob =
    mimeType === "text/csv;charset=utf-8;"
      ? new Blob([content], { type: mimeType })
      : new Blob([base64ToBytes(content).buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function UserImportPanel({ churchId }: { churchId: string | null }) {
  const t = useTranslations("users.userImport");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<UserImportPreviewResult | null>(null);
  const [importSummary, setImportSummary] = useState<UserImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateFormat, setTemplateFormat] = useState<UserImportFileFormat>("xlsx");

  const { data: actor } = useActorChurch();
  const scopeChurchId = churchId ?? actor?.churchId ?? null;

  const previewMutation = usePreviewUsersImport();
  const importMutation = useImportUsers();
  const templateMutation = useExportUsersTemplate();
  const errorsFileMutation = useExportUsersImportErrors();

  const importFailureReasonLabel = (reason: UserImportRowFailureReason): string => {
    switch (reason) {
      case "missing_role":
        return t("failure.missingRole");
      case "duplicate":
        return t("failure.duplicate");
      case "invalid_role":
        return t("failure.invalidRole");
      case "invalid_stage":
        return t("failure.invalidStage");
      case "manager_conflict":
        return t("failure.managerConflict");
      case "auth_failed":
        return t("failure.authFailed");
      case "rpc_failure":
        return t("failure.rpcFailure");
    }
  };

  const handleErrorsFileDownload = useCallback(
    async (format: UserImportFileFormat) => {
      if (!preview?.validation.invalidRows.length) return;
      setError(null);
      const result = await errorsFileMutation.mutateAsync({
        format,
        rows: preview.validation.invalidRows.map((invalid) => ({
          rowNumber: invalid.row.rowNumber,
          values: {
            email: invalid.row.email,
            password: invalid.row.password,
            full_name_ar: invalid.row.fullNameAr,
            full_name_en: invalid.row.fullNameEn ?? "",
            phone: invalid.row.phone ?? "",
            role: invalid.row.roleName ?? "",
            stage: invalid.row.stageName ?? "",
          },
          messages: invalid.errors.map((err) => err.message),
        })),
      });
      if (!result.success || !result.data) {
        setError(result.message ?? t("previewError"));
        return;
      }
      triggerDownload(result.data.content, result.data.mimeType, result.data.fileName);
    },
    [errorsFileMutation, preview, t],
  );

  const handleTemplateDownload = useCallback(async () => {
    setError(null);
    const result = await templateMutation.mutateAsync(templateFormat);
    if (!result.success || !result.data) {
      setError(result.message ?? t("templateError"));
      return;
    }
    triggerDownload(result.data.content, result.data.mimeType, result.data.fileName);
  }, [templateMutation, templateFormat, t]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setImportSummary(null);

      if (!scopeChurchId) {
        setError(t("churchRequired"));
        return;
      }

      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension !== "xlsx" && extension !== "csv") {
        setError(t("invalidFileType"));
        return;
      }

      if (file.size > MAX_IMPORT_FILE_BYTES) {
        setError(t("fileTooLarge"));
        return;
      }

      const format = extension === "xlsx" ? "xlsx" : "csv";
      const content = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(content);

      const result = await previewMutation.mutateAsync({
        fileName: file.name,
        format,
        content: base64,
        churchId: scopeChurchId,
      });

      if (!result.success || !result.data) {
        setError(result.message ?? t("previewError"));
        return;
      }

      setPreview(result.data);
    },
    [previewMutation, scopeChurchId, t],
  );

  const handleImport = useCallback(async () => {
    if (!preview || !scopeChurchId) return;
    setError(null);

    const result = await importMutation.mutateAsync({
      churchId: scopeChurchId,
      rows: preview.validation.validRows,
    });

    if (!result.success || !result.data) {
      setError(result.message ?? t("importError"));
      return;
    }

    setImportSummary(result.data);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [preview, importMutation, scopeChurchId, t]);

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
            <h2 className="text-base font-semibold">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleFileChange}
              aria-label={t("uploadLabel")}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={previewMutation.isPending || !scopeChurchId}
              className="gap-2"
            >
              {previewMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              {t("chooseFile")}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">{t("supportedFormats")}</p>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={templateFormat}
              onValueChange={(val) => setTemplateFormat(val as UserImportFileFormat)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">XLSX</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleTemplateDownload}
              disabled={templateMutation.isPending}
              className="gap-2"
            >
              {templateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {t("downloadTemplate")}
            </Button>
          </div>
        </div>

        {!scopeChurchId ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("churchRequired")}</p>
        ) : null}

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
                {t("validCount", { count: summary.validCount })}
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <XCircle className="size-3" />
                {t("invalidCount", { count: summary.invalidCount })}
              </Badge>
            </div>

            {summary.invalidCount > 0 ? (
              <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="size-4" />
                  {t("validationReport")}
                </div>
                <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
                  {summary.duplicateEmails > 0 ? (
                    <li>{t("duplicateEmails", { count: summary.duplicateEmails })}</li>
                  ) : null}
                  {summary.invalidEmails > 0 ? (
                    <li>{t("invalidEmails", { count: summary.invalidEmails })}</li>
                  ) : null}
                  {summary.shortPasswords > 0 ? (
                    <li>{t("shortPasswords", { count: summary.shortPasswords })}</li>
                  ) : null}
                  {summary.missingRequired > 0 ? (
                    <li>{t("missingRequired", { count: summary.missingRequired })}</li>
                  ) : null}
                  {summary.unknownRoles > 0 ? (
                    <li>{t("unknownRoles", { count: summary.unknownRoles })}</li>
                  ) : null}
                  {summary.unknownStages > 0 ? (
                    <li>{t("unknownStages", { count: summary.unknownStages })}</li>
                  ) : null}
                  {summary.managerConflicts > 0 ? (
                    <li>{t("managerConflicts", { count: summary.managerConflicts })}</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {validation.validRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("table.caption")}</caption>
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th scope="col" className="px-3 py-2 font-medium">{t("table.row")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("table.email")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("table.name")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("table.role")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("table.stage")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.validRows.slice(0, 10).map((row) => (
                      <tr key={row.rowNumber} className="border-b last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.email}</td>
                        <td className="px-3 py-2">{row.fullNameAr}</td>
                        <td className="px-3 py-2">{row.roleName ?? "—"}</td>
                        <td className="px-3 py-2">{row.stageName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validation.validRows.length > 10 ? (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    {t("showingFirst", { count: validation.validRows.length - 10 })}
                  </p>
                ) : null}
              </div>
            ) : null}

            {validation.invalidRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-destructive/30">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("table.caption")}</caption>
                  <thead>
                    <tr className="border-b bg-destructive/5 text-left">
                      <th scope="col" className="px-3 py-2 font-medium">{t("table.row")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("table.email")}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t("table.errors")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.invalidRows.slice(0, 10).map((invalid) => (
                      <tr key={invalid.row.rowNumber} className="border-b last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{invalid.row.rowNumber}</td>
                        <td className="px-3 py-2">{invalid.row.email || "—"}</td>
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
                      {t("downloadErrorsCsv")}
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
                      {t("downloadErrorsXlsx")}
                    </Button>
                    {validation.invalidRows.length > 10 ? (
                      <span className="text-xs text-muted-foreground">
                        {t("invalidShown", { count: validation.invalidRows.length - 10 })}
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
                {t("importButton")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : null}

        {importSummary ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
              <CheckCircle2 className="size-4" />
              {t("importSummary", {
                imported: importSummary.importedCount,
                failed: importSummary.failedCount,
              })}
            </div>
            {importSummary.failures.length > 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <XCircle className="size-4" />
                  {t("failure.title")}
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {importSummary.failures.slice(0, 10).map((failure) => (
                    <li key={`${failure.rowNumber}-${failure.reason}`} className="text-destructive">
                      {t("failure.row", { row: failure.rowNumber, email: failure.email })}
                      {" — "}
                      {importFailureReasonLabel(failure.reason)}
                    </li>
                  ))}
                </ul>
                {importSummary.failures.length > 10 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("failure.more", { count: importSummary.failures.length - 10 })}
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
