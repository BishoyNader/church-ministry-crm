"use server";

import { ZodError } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { toRegistrationError } from "@/types/registration";
import type { RegistrationFunctions } from "@/types/registration";
import * as userService from "../services/user.service";
import {
  previewUsersImportSchema,
  importUsersSchema,
} from "../schemas/user-import.schema";
import type {
  PreviewUsersImportFormValues,
  ImportUsersFormValues,
} from "../schemas/user-import.schema";
import {
  parseUserImportFile,
  validateUserImportRows,
  resolveUserImportRow,
  buildUserImportTemplate,
  type UserImportRoleOption,
  type UserImportStageOption,
} from "../services/user-import.service";
import type {
  UserImportFileFormat,
  UserImportPreviewResult,
  UserImportRow,
  UserImportRowFailure,
  UserImportSummary,
} from "../types/user-import.types";
import { UserActionResult } from "./user.actions";
import {
  resolveActorContext,
  dataClientFor,
  writeUserAudit,
  assertUserManagementPermission,
} from "./context";

async function loadChurchCatalog(
  churchId: string,
): Promise<{
  roleOptions: UserImportRoleOption[];
  stageOptions: UserImportStageOption[];
  existingEmails: string[];
} | null> {
  const ctx = await resolveActorContext();
  if (!ctx) return null;

  const db = dataClientFor(ctx);

  const [rolesResult, stagesResult, profilesResult] = await Promise.all([
    userService.listRoles(db, churchId),
    userService.listStages(db, churchId),
    db
      .from("profiles")
      .select("email")
      .eq("church_id", churchId)
      .is("deleted_at", null),
  ]);

  if (rolesResult.error || stagesResult.error) return null;

  const roleOptions: UserImportRoleOption[] = (rolesResult.data ?? []).map(
    (role) => ({
      id: role.id,
      name_ar: role.name_ar,
      name_en: role.name_en,
    }),
  );

  const stageOptions: UserImportStageOption[] = (stagesResult.data ?? []).map(
    (stage) => ({
      id: stage.id,
      name_ar: stage.name_ar ?? null,
      name_en: stage.name_en ?? null,
    }),
  );

  const existingEmails = (profilesResult.data ?? [])
    .map((p) => p.email)
    .filter((email): email is string => typeof email === "string" && email.length > 0);

  return { roleOptions, stageOptions, existingEmails };
}

export async function previewUsersImportAction(
  values: PreviewUsersImportFormValues,
): Promise<UserActionResult<UserImportPreviewResult>> {
  try {
    previewUsersImportSchema.parse(values);
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, message: "The upload data is invalid." };
    }
    throw error;
  }

  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  const gate = await assertUserManagementPermission(ctx);
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const catalog = await loadChurchCatalog(values.churchId);
  if (!catalog) {
    return { success: false, message: "Unable to load church roles and stages." };
  }

  const parsed = parseUserImportFile(values.content, values.format, values.fileName);
  if (parsed.error || !parsed.data) {
    return { success: false, message: parsed.error ?? "Failed to parse the file." };
  }

  const validation = validateUserImportRows(
    parsed.data.rows,
    catalog.roleOptions,
    catalog.stageOptions,
    catalog.existingEmails,
  );

  return {
    success: true,
    data: {
      fileName: values.fileName,
      format: values.format,
      validation,
    },
  };
}

export async function importUsersAction(
  values: ImportUsersFormValues,
): Promise<UserActionResult<UserImportSummary>> {
  try {
    importUsersSchema.parse(values);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "The import data is invalid. Maximum 200 users per import.",
      };
    }
    throw error;
  }

  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  const gate = await assertUserManagementPermission(ctx);
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const catalog = await loadChurchCatalog(values.churchId);
  if (!catalog) {
    return { success: false, message: "Unable to load church roles and stages." };
  }

  const admin = createAdminClient();
  const failures: UserImportRowFailure[] = [];
  let importedCount = 0;

  const rows: UserImportRow[] = values.rows.map((row) => ({
    rowNumber: row.rowNumber,
    email: row.email,
    password: row.password,
    fullNameAr: row.fullNameAr,
    fullNameEn: row.fullNameEn ?? null,
    phone: row.phone ?? null,
    roleName: row.roleName ?? null,
    stageName: row.stageName ?? null,
  }));

  for (const row of rows) {
    const { roleIds, stageIds } = resolveUserImportRow(
      row,
      catalog.roleOptions,
      catalog.stageOptions,
    );

    if (roleIds.length === 0) {
      failures.push({
        rowNumber: row.rowNumber,
        email: row.email,
        reason: "missing_role",
        message: "A role is required for each user.",
      });
      continue;
    }

    if (row.stageName && stageIds.length === 0) {
      failures.push({
        rowNumber: row.rowNumber,
        email: row.email,
        reason: "invalid_stage",
        message: `Stage "${row.stageName}" was not found in this church.`,
      });
      continue;
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: row.email,
      password: row.password,
      email_confirm: true,
      user_metadata: {
        full_name_ar: row.fullNameAr,
        full_name_en: row.fullNameEn,
      },
    });

    if (authError || !authData.user) {
      const message = authError?.message ?? "Failed to create auth user.";
      failures.push({
        rowNumber: row.rowNumber,
        email: row.email,
        reason: /already/i.test(message) ? "duplicate" : "auth_failed",
        message,
      });
      continue;
    }

    const userId = authData.user.id;

    const { error: rpcError } = await ctx.supabase.rpc<
      "create_church_user",
      RegistrationFunctions["create_church_user"]["Args"]
    >("create_church_user", {
      p_church_id: values.churchId,
      p_auth_user_id: userId,
      p_full_name_ar: row.fullNameAr,
      p_full_name_en: row.fullNameEn ?? null,
      p_email: row.email,
      p_phone: row.phone ?? null,
      p_preferred_locale: "ar",
      p_role_ids: roleIds,
      p_stage_ids: stageIds.length > 0 ? stageIds : null,
    });

    if (rpcError) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      const mapped = toRegistrationError(rpcError);
      const reason =
        mapped.code === "role_not_in_church"
          ? "invalid_role"
          : mapped.code === "stage_not_in_church"
            ? "invalid_stage"
            : "rpc_failure";
      failures.push({
        rowNumber: row.rowNumber,
        email: row.email,
        reason,
        message: mapped.message,
      });
      continue;
    }

    importedCount++;
  }

  await writeUserAudit(
    ctx,
    values.churchId,
    "import_users",
    "user",
    "batch",
    {
      importedCount,
      failedCount: failures.length,
      churchId: values.churchId,
    },
  );

  return {
    success: true,
    data: {
      importedCount,
      failedCount: failures.length,
      failures,
    },
  };
}

export async function exportUsersTemplateAction(
  format: UserImportFileFormat,
): Promise<UserActionResult<{ fileName: string; content: string; mimeType: string }>> {
  const ctx = await resolveActorContext();
  if (!ctx) {
    return { success: false, message: "You must be logged in." };
  }

  const gate = await assertUserManagementPermission(ctx);
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  return {
    success: true,
    data: buildUserImportTemplate(format),
  };
}
