"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { getTranslations } from "next-intl/server";
import { importPreviewSchema, importBeneficiariesSchema, exportOptionsSchema } from "../schemas/import-export.schema";
import type { ImportActionResult, ExportActionResult, ImportPreviewResult, ImportSummary, BeneficiaryImportRow } from "../types/import-export.types";
import * as importExportService from "../services/import-export.service";
import { ZodError } from "zod";

function handleZodError(error: unknown): ImportActionResult<never> {
  if (error instanceof ZodError) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
    };
  }
  return {
    success: false,
    message: "An unexpected validation error occurred.",
  };
}

export async function previewImportAction(
  values: { fileName: string; format: "xlsx" | "csv"; content: string },
  locale: string,
): Promise<ImportActionResult<ImportPreviewResult>> {
  try {
    importPreviewSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  if (!(await hasPermission(PERMISSION_CODES.IMPORT_EXECUTE))) {
    return { success: false, message: "You do not have permission to import data." };
  }

  // Hard server-side envelope check BEFORE any parsing: 10 MB ceiling and the
  // .csv/.xlsx allow-list. Oversized or unsupported files are rejected
  // immediately with a structured, localized error.
  const meta = importExportService.validateImportFileMeta(values.fileName, values.content);
  if (!meta.ok) {
    const t = await getTranslations({ locale, namespace: "importExport" });
    const message =
      meta.code === "FILE_TOO_LARGE"
        ? t("errors.fileTooLarge")
        : t("errors.invalidFileType");
    return { success: false, code: meta.code, message };
  }

  const result = importExportService.parseImportFile(values.content, values.format, values.fileName);
  if (result.error) return { success: false, message: result.error, code: result.code };

  return { success: true, data: result.data ?? undefined };
}

export async function importBeneficiariesAction(
  values: { rows: BeneficiaryImportRow[] },
): Promise<ImportActionResult<ImportSummary>> {
  try {
    importBeneficiariesSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  if (!(await hasPermission(PERMISSION_CODES.IMPORT_EXECUTE))) {
    return { success: false, message: "You do not have permission to import data." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { success: false, message: "Profile not found." };

  const result = await importExportService.importBeneficiaries(supabase, profile.church_id, values.rows);
  if (result.error) return { success: false, message: result.error };

  // Audit the import
  await writeAuditLog(
    supabase,
    "import",
    "beneficiaries",
    profile.church_id,
    null,
    {
      importedCount: result.data?.importedCount ?? 0,
      skippedCount: result.data?.skippedCount ?? 0,
    },
    { reason: "Bulk beneficiary import" },
  );

  return { success: true, data: result.data ?? undefined };
}

export async function exportDataAction(
  values: { entity: "beneficiaries" | "attendance" | "followups" | "servants"; format: "csv" | "xlsx" },
): Promise<ExportActionResult> {
  try {
    exportOptionsSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  if (!(await hasPermission(PERMISSION_CODES.EXPORT_EXECUTE))) {
    return { success: false, message: "You do not have permission to export data." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { success: false, message: "Profile not found." };

  const result = await importExportService.exportData(supabase, profile.church_id, values.entity, values.format);
  if (result.error) return { success: false, message: result.error };

  // Audit the export
  await writeAuditLog(
    supabase,
    "export",
    values.entity,
    profile.church_id,
    null,
    { format: values.format },
    { reason: "Data export" },
  );

  return { success: true, data: result.data ?? undefined };
}