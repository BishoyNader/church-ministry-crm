"use client";

import { useMutation } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  previewImportAction,
  importBeneficiariesAction,
  exportDataAction,
  exportBeneficiariesTemplateAction,
  exportBeneficiariesImportErrorsAction,
} from "../actions/import-export.actions";
import type {
  BeneficiaryImportRow,
  ExportEntityType,
  ExportFileFormat,
  BeneficiaryExportFilters,
  ImportErrorFileRow,
  ImportFileFormat,
} from "../types/import-export.types";

export const IMPORT_EXPORT_QUERY_KEYS = {
  all: ["import-export"] as const,
  preview: ["import-export", "preview"] as const,
  import: ["import-export", "import"] as const,
  export: ["import-export", "export"] as const,
};

export function usePreviewImport() {
  const locale = useLocale();
  return useMutation({
    mutationFn: (values: {
      fileName: string;
      format: "xlsx" | "csv";
      content: string;
      churchId?: string;
    }) => previewImportAction(values, locale),
  });
}

export function useImportBeneficiaries() {
  return useMutation({
    mutationFn: (values: { rows: BeneficiaryImportRow[]; churchId?: string }) =>
      importBeneficiariesAction(values),
  });
}

export function useExportData() {
  return useMutation({
    mutationFn: (values: {
      entity: ExportEntityType;
      format: ExportFileFormat;
      churchId?: string;
      filters?: BeneficiaryExportFilters;
    }) => exportDataAction(values),
  });
}

export function useExportBeneficiariesTemplate() {
  return useMutation({
    mutationFn: (values: { format: ImportFileFormat; churchId?: string }) =>
      exportBeneficiariesTemplateAction(values.format, values.churchId),
  });
}

export function useExportBeneficiariesImportErrors() {
  return useMutation({
    mutationFn: (values: { format: ImportFileFormat; rows: ImportErrorFileRow[] }) =>
      exportBeneficiariesImportErrorsAction(values.format, values.rows),
  });
}
