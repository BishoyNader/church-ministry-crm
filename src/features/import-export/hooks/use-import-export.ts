"use client";

import { useMutation } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  previewImportAction,
  importBeneficiariesAction,
  exportDataAction,
} from "../actions/import-export.actions";
import type { BeneficiaryImportRow, ExportEntityType, ExportFileFormat } from "../types/import-export.types";

export const IMPORT_EXPORT_QUERY_KEYS = {
  all: ["import-export"] as const,
  preview: ["import-export", "preview"] as const,
  import: ["import-export", "import"] as const,
  export: ["import-export", "export"] as const,
};

export function usePreviewImport() {
  const locale = useLocale();
  return useMutation({
    mutationFn: (values: { fileName: string; format: "xlsx" | "csv"; content: string }) =>
      previewImportAction(values, locale),
  });
}

export function useImportBeneficiaries() {
  return useMutation({
    mutationFn: (values: { rows: BeneficiaryImportRow[] }) => importBeneficiariesAction(values),
  });
}

export function useExportData() {
  return useMutation({
    mutationFn: (values: { entity: ExportEntityType; format: ExportFileFormat }) =>
      exportDataAction(values),
  });
}