import * as XLSX from "xlsx";
import { validateImportFileMeta, toCsv } from "@/features/import-export/services/import-export.service";
import type {
  UserImportFileFormat,
  UserImportRow,
  UserImportValidationError,
  UserImportValidationResult,
  InvalidUserImportRow,
} from "../types/user-import.types";

export type UserImportRoleOption = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
};

export type UserImportStageOption = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
};

type ServiceResult<T> = {
  data: T | null;
  error: string | null;
  code?: "FILE_TOO_LARGE" | "INVALID_FILE_TYPE";
};

const USER_IMPORT_HEADERS = [
  "email",
  "password",
  "full_name_ar",
  "full_name_en",
  "phone",
  "role",
  "stage",
];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function parseCsv(content: string): Record<string, unknown>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((header) =>
    normalizeHeader(header.replace(/^"|"$/g, "")),
  );

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((value) =>
      value.replace(/^"|"$/g, "").trim(),
    );
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseXlsx(content: string): Record<string, unknown>[] {
  const workbook = XLSX.read(content, { type: "base64" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return json.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value;
    }
    return normalized;
  });
}

function mapRowToUser(row: Record<string, unknown>, rowNumber: number): UserImportRow {
  const email = String(row.email ?? "").trim();
  const password = String(row.password ?? "").trim();
  const fullNameAr = String(row.full_name_ar ?? "").trim();
  const fullNameEn = String(row.full_name_en ?? "").trim() || null;
  const phone = String(row.phone ?? "").trim() || null;
  const roleName = String(row.role ?? "").trim() || null;
  const stageName = String(row.stage ?? "").trim() || null;

  return {
    rowNumber,
    email,
    password,
    fullNameAr,
    fullNameEn,
    phone,
    roleName,
    stageName,
  };
}

/**
 * Envelope gate (mirrors import-export): 10 MB ceiling + .csv/.xlsx allow-list
 * are enforced before any parsing, then the content is structurally mapped to
 * UserImportRow entries. Role/stage name resolution and email-duplicate checks
 * require the target church's catalog, so they run in validateUserImportRows.
 */
export function parseUserImportFile(
  content: string,
  format: UserImportFileFormat,
  fileName: string,
): ServiceResult<{ rows: UserImportRow[] }> {
  const meta = validateImportFileMeta(fileName, content);
  if (!meta.ok) {
    return {
      data: null,
      error:
        meta.code === "FILE_TOO_LARGE"
          ? "File exceeds the 10 MB size limit."
          : "Only .csv and .xlsx files are allowed.",
      code: meta.code,
    };
  }

  try {
    const rawRows = format === "csv" ? parseCsv(content) : parseXlsx(content);

    if (rawRows.length === 0) {
      return { data: null, error: "The file contains no data rows." };
    }

    const rows = rawRows.map((row, index) => mapRowToUser(row, index + 2));
    return { data: { rows }, error: null };
  } catch {
    return {
      data: null,
      error:
        "Failed to parse the file. Please ensure it is a valid CSV or XLSX file.",
    };
  }
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Structural + catalog validation for the parsed rows. Validates email format,
 * password length, required names, in-file duplicate emails, email collisions
 * with existing church users, and role/stage names against the church catalog.
 */
export function validateUserImportRows(
  rows: UserImportRow[],
  roleOptions: UserImportRoleOption[],
  stageOptions: UserImportStageOption[],
  existingEmails: string[],
): UserImportValidationResult {
  const validRows: UserImportRow[] = [];
  const invalidRows: InvalidUserImportRow[] = [];
  const errorSummary: UserImportValidationResult["errorSummary"] = {
    totalRows: rows.length,
    validCount: 0,
    invalidCount: 0,
    duplicateEmails: 0,
    invalidEmails: 0,
    shortPasswords: 0,
    missingRequired: 0,
    unknownRoles: 0,
    unknownStages: 0,
  };

  const seenEmails = new Map<string, number>();
  const existingEmailsLower = new Set(existingEmails.map((e) => e.toLowerCase()));

  const roleMatches = (roleName: string, option: UserImportRoleOption): boolean =>
    option.name_ar?.trim().toLowerCase() === roleName.trim().toLowerCase() ||
    (option.name_en?.trim().toLowerCase() ?? "") === roleName.trim().toLowerCase();

  const stageMatches = (stageName: string, option: UserImportStageOption): boolean =>
    option.name_ar?.trim().toLowerCase() === stageName.trim().toLowerCase() ||
    (option.name_en?.trim().toLowerCase() ?? "") === stageName.trim().toLowerCase();

  for (const row of rows) {
    const errors: UserImportValidationError[] = [];
    const email = row.email.toLowerCase();
    const duplicateFlag = seenEmails.has(email);
    if (duplicateFlag) {
      errorSummary.duplicateEmails++;
      errors.push({
        rowNumber: row.rowNumber,
        field: "email",
        message: `Duplicate email "${row.email}" appears more than once in the file.`,
      });
    } else {
      seenEmails.set(email, row.rowNumber);
    }

    if (!emailRegex.test(row.email)) {
      errorSummary.invalidEmails++;
      errors.push({
        rowNumber: row.rowNumber,
        field: "email",
        message: `"${row.email}" is not a valid email address.`,
      });
    } else if (existingEmailsLower.has(email)) {
      errorSummary.duplicateEmails++;
      errors.push({
        rowNumber: row.rowNumber,
        field: "email",
        message: `A user already exists for "${row.email}".`,
      });
    }

    if (row.password.length < 8) {
      errorSummary.shortPasswords++;
      errors.push({
        rowNumber: row.rowNumber,
        field: "password",
        message: "Password must be at least 8 characters.",
      });
    }

    if (row.fullNameAr.length < 2) {
      errorSummary.missingRequired++;
      errors.push({
        rowNumber: row.rowNumber,
        field: "full_name_ar",
        message: "Arabic full name is required.",
      });
    }

    if (!row.roleName) {
      errorSummary.missingRequired++;
      errors.push({
        rowNumber: row.rowNumber,
        field: "role",
        message: "A role is required for each user.",
      });
    } else {
      const roleExists = roleOptions.some((option) => roleMatches(row.roleName!, option));
      if (!roleExists) {
        errorSummary.unknownRoles++;
        errors.push({
          rowNumber: row.rowNumber,
          field: "role",
          message: `Role "${row.roleName}" was not found in this church.`,
        });
      }
    }

    if (row.stageName) {
      const stageExists = stageOptions.some((option) => stageMatches(row.stageName!, option));
      if (!stageExists) {
        errorSummary.unknownStages++;
        errors.push({
          rowNumber: row.rowNumber,
          field: "stage",
          message: `Stage "${row.stageName}" was not found in this church.`,
        });
      }
    }

    if (errors.length > 0) {
      errorSummary.invalidCount++;
      invalidRows.push({ row, errors });
    } else {
      errorSummary.validCount++;
      validRows.push(row);
    }
  }

  return { validRows, invalidRows, errorSummary };
}

/**
 * Resolve the role/stage name strings in a row to catalog IDs so the row can be
 * handed to create_church_user. Returns null when the name has no match (callers
 * should only pass rows already validated against the same catalog).
 */
export function resolveUserImportRow(
  row: UserImportRow,
  roleOptions: UserImportRoleOption[],
  stageOptions: UserImportStageOption[],
): {
  roleIds: string[];
  stageIds: string[];
} {
  const roleMatches = (roleName: string, option: UserImportRoleOption): boolean =>
    option.name_ar?.trim().toLowerCase() === roleName.trim().toLowerCase() ||
    (option.name_en?.trim().toLowerCase() ?? "") === roleName.trim().toLowerCase();

  const stageMatches = (stageName: string, option: UserImportStageOption): boolean =>
    option.name_ar?.trim().toLowerCase() === stageName.trim().toLowerCase() ||
    (option.name_en?.trim().toLowerCase() ?? "") === stageName.trim().toLowerCase();

  const roleIds = row.roleName
    ? roleOptions.filter((option) => roleMatches(row.roleName!, option)).map((o) => o.id)
    : [];

  const stageIds = row.stageName
    ? stageOptions.filter((option) => stageMatches(row.stageName!, option)).map((o) => o.id)
    : [];

  return { roleIds, stageIds };
}

const EXAMPLE_ROW: Record<string, string> = {
  email: "user@example.com",
  password: "a-strong-password",
  full_name_ar: "اسم المستخدم",
  full_name_en: "User Name",
  phone: "01000000000",
  role: "super_admin",
  stage: "",
};

export function buildUserImportTemplate(
  format: UserImportFileFormat,
): { fileName: string; content: string; mimeType: string } {
  const fileName = `users-import-template.${format}`;

  if (format === "csv") {
    return {
      fileName,
      content: toCsv(USER_IMPORT_HEADERS, [EXAMPLE_ROW]),
      mimeType: "text/csv;charset=utf-8;",
    };
  }

  const worksheet = XLSX.utils.json_to_sheet([EXAMPLE_ROW], {
    header: USER_IMPORT_HEADERS,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "users");
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  return {
    fileName,
    content: base64,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
