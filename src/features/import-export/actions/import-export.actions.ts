"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { getTranslations } from "next-intl/server";
import {
  importPreviewSchema,
  importBeneficiariesSchema,
  exportOptionsSchema,
} from "../schemas/import-export.schema";
import type {
  ImportActionResult,
  ExportActionResult,
  ImportPreviewResult,
  ImportSummary,
  BeneficiaryImportRow,
  BeneficiaryExportFilters,
  ImportErrorFileRow,
  DownloadableFile,
  ImportFileFormat,
} from "../types/import-export.types";
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

type ImportExportContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  churchId: string | null;
};

/**
 * Resolves the acting user's identity. The profile is read through the admin
 * client so the PO (church_id NULL, no RLS path to their own profile) resolves
 * identically to a church super_admin (mirrors users/actions/context.ts).
 */
async function resolveImportExportContext(): Promise<ImportExportContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    admin,
    userId: user.id,
    churchId: profile?.church_id ?? null,
  };
}

/**
 * Authorization gate for import/export operations.
 * - Church-scoped users keep the existing IMPORT_EXECUTE / EXPORT_EXECUTE model.
 * - The Platform Owner has NO import.execute/export.execute/beneficiaries.*
 *   permissions, so platform tenant management (TENANTS_READ) is the gate. The
 *   target church is resolved below and the write RPC (042) re-validates with
 *   user_is_platform_owner() / user_is_super_admin().
 */
async function assertImportExportPermission(
  ctx: ImportExportContext,
  mode: "import" | "export",
): Promise<boolean> {
  if (ctx.churchId === null) {
    return hasPermission(PERMISSION_CODES.TENANTS_READ);
  }
  return hasPermission(
    mode === "import"
      ? PERMISSION_CODES.IMPORT_EXECUTE
      : PERMISSION_CODES.EXPORT_EXECUTE,
  );
}

/**
 * Resolves the target church for a bulk operation.
 * - Church-scoped users are hard-locked to their own church (the requested
 *   churchId is ignored — a church user can never target another tenant).
 * - The PO must pass an explicit churchId, which is validated to exist and be
 *   active through the admin client.
 */
async function resolveTargetChurch(
  ctx: ImportExportContext,
  requestedChurchId?: string,
): Promise<{ churchId: string | null; message: string | null }> {
  if (ctx.churchId !== null) {
    return { churchId: ctx.churchId, message: null };
  }

  if (!requestedChurchId) {
    return { churchId: null, message: "Select a church to import/export for." };
  }

  const { data: church } = await ctx.admin
    .from("churches")
    .select("id, status")
    .eq("id", requestedChurchId)
    .is("deleted_at", null)
    .single();

  if (!church || church.status !== "active") {
    return { churchId: null, message: "The selected church is not available." };
  }

  return { churchId: requestedChurchId, message: null };
}

/**
 * Audit writer that works for both the PO and church-scoped actors.
 * writeAuditLog (lib/audit.ts) derives church_id from the session profile,
 * which fails for the PO (NULL church_id, no RLS path), so the PO path writes
 * directly through the admin client with the explicit church scope.
 */
async function writeImportExportAudit(
  ctx: ImportExportContext,
  churchId: string,
  action: string,
  entityType: string,
  newValues: Record<string, unknown> | null,
): Promise<void> {
  try {
    if (ctx.churchId === null) {
      await ctx.admin.from("audit_logs").insert({
        church_id: churchId,
        actor_id: ctx.userId,
        action,
        entity_type: entityType,
        entity_id: null,
        old_values: null,
        new_values: newValues,
        metadata: {},
      });
      return;
    }
    await writeAuditLog(ctx.supabase, action, entityType, churchId, null, newValues);
  } catch (err) {
    console.error(`[import-export] Failed to write audit log ${action}:`, err);
  }
}

export async function previewImportAction(
  values: {
    fileName: string;
    format: "xlsx" | "csv";
    content: string;
    churchId?: string;
  },
  locale: string,
): Promise<ImportActionResult<ImportPreviewResult>> {
  try {
    importPreviewSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const ctx = await resolveImportExportContext();
  if (!ctx) return { success: false, message: "You must be logged in." };

  if (!(await assertImportExportPermission(ctx, "import"))) {
    return { success: false, message: "You do not have permission to import data." };
  }

  const target = await resolveTargetChurch(ctx, values.churchId);
  if (!target.churchId) {
    return { success: false, message: target.message ?? "Invalid church scope." };
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
  values: { rows: BeneficiaryImportRow[]; churchId?: string },
): Promise<ImportActionResult<ImportSummary>> {
  try {
    importBeneficiariesSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const ctx = await resolveImportExportContext();
  if (!ctx) return { success: false, message: "You must be logged in." };

  if (!(await assertImportExportPermission(ctx, "import"))) {
    return { success: false, message: "You do not have permission to import data." };
  }

  const target = await resolveTargetChurch(ctx, values.churchId);
  if (!target.churchId) {
    return { success: false, message: target.message ?? "Invalid church scope." };
  }

  // Catalog reads (stages/classes/existing beneficiaries) go through the
  // session client for church users and the admin client for the PO; writes
  // always flow through the session client so auth.uid() inside the RPC (042)
  // resolves to the acting user.
  const read = ctx.churchId ? ctx.supabase : ctx.admin;
  const result = await importExportService.importBeneficiaries(
    ctx.supabase,
    read,
    target.churchId,
    values.rows,
  );
  if (result.error) return { success: false, message: result.error };

  // Audit the import
  await writeImportExportAudit(
    ctx,
    target.churchId,
    "import",
    "beneficiaries",
    {
      importedCount: result.data?.importedCount ?? 0,
      skippedCount: result.data?.skippedCount ?? 0,
    },
  );

  return { success: true, data: result.data ?? undefined };
}

export async function exportDataAction(
  values: {
    entity: "beneficiaries" | "attendance" | "followups" | "servants";
    format: "csv" | "xlsx";
    churchId?: string;
    filters?: BeneficiaryExportFilters;
  },
): Promise<ExportActionResult> {
  try {
    exportOptionsSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const ctx = await resolveImportExportContext();
  if (!ctx) return { success: false, message: "You must be logged in." };

  if (!(await assertImportExportPermission(ctx, "export"))) {
    return { success: false, message: "You do not have permission to export data." };
  }

  const target = await resolveTargetChurch(ctx, values.churchId);
  if (!target.churchId) {
    return { success: false, message: target.message ?? "Invalid church scope." };
  }

  const read = ctx.churchId ? ctx.supabase : ctx.admin;
  const result = await importExportService.exportData(
    read,
    target.churchId,
    values.entity,
    values.format,
    values.filters,
  );
  if (result.error) return { success: false, message: result.error };

  // Audit the export
  await writeImportExportAudit(
    ctx,
    target.churchId,
    "export",
    values.entity,
    { format: values.format, filters: values.filters ?? null },
  );

  return { success: true, data: result.data ?? undefined };
}

export async function exportBeneficiariesTemplateAction(
  format: ImportFileFormat,
  churchId?: string,
): Promise<ImportActionResult<DownloadableFile>> {
  const ctx = await resolveImportExportContext();
  if (!ctx) return { success: false, message: "You must be logged in." };

  if (!(await assertImportExportPermission(ctx, "import"))) {
    return { success: false, message: "You do not have permission to import data." };
  }

  const target = await resolveTargetChurch(ctx, churchId);
  if (!target.churchId) {
    return { success: false, message: target.message ?? "Invalid church scope." };
  }

  return {
    success: true,
    data: importExportService.buildBeneficiariesTemplate(format),
  };
}

/**
 * Builds a downloadable children-import-errors file. The invalid rows were
 * already validated server-side during preview; this action merely renders them
 * into a spreadsheet. No data is written, but the same import permission gate
 * applies so the file cannot be generated by unauthorized users.
 */
export async function exportBeneficiariesImportErrorsAction(
  format: ImportFileFormat,
  rows: ImportErrorFileRow[],
): Promise<ImportActionResult<DownloadableFile>> {
  const ctx = await resolveImportExportContext();
  if (!ctx) return { success: false, message: "You must be logged in." };

  if (!(await assertImportExportPermission(ctx, "import"))) {
    return { success: false, message: "You do not have permission to import data." };
  }

  return {
    success: true,
    data: importExportService.buildImportErrorsFile(
      `children-import-errors.${format}`,
      format,
      rows,
    ),
  };
}
