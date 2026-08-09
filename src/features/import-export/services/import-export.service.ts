import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  MAX_IMPORT_FILE_BYTES,
  ALLOWED_IMPORT_EXTENSIONS,
} from "../constants";
import type {
  BeneficiaryImportRow,
  BeneficiaryExportFilters,
  DownloadableFile,
  ExportEntityType,
  ExportFileFormat,
  ImportActionErrorCode,
  ImportErrorFileRow,
  ImportErrorSummary,
  ImportFileFormat,
  ImportPreviewResult,
  ImportRowFailure,
  ImportRowFailureReason,
  ImportSummary,
  ImportValidationError,
  ImportValidationResult,
  InvalidImportRow,
} from "../types/import-export.types";

type ServiceResult<T> = {
  data: T | null;
  error: string | null;
  code?: ImportActionErrorCode;
};

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shape of a beneficiaries export row. The select list is built dynamically
 * (the assignment join only appears when a service/stage filter is set), so
 * supabase-js cannot statically infer the row type; the interface documents the
 * expected shape and the query result is cast to it at the call site.
 */
type BeneficiaryExportRow = {
  full_name_ar: string;
  full_name_en: string | null;
  mobile: string | null;
  date_of_birth: string;
  address: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  beneficiary_assignments?: Array<{ service_id: string; stage_id: string }>;
};

export type ImportFileMetaResult =
  | { ok: true }
  | { ok: false; code: "FILE_TOO_LARGE" | "INVALID_FILE_TYPE" };

function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

function isBase64Encoded(content: string): boolean {
  return (
    content.length > 0 &&
    content.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(content)
  );
}

function getDecodedByteLength(content: string): number {
  if (isBase64Encoded(content)) {
    return Buffer.byteLength(content, "base64");
  }
  return Buffer.byteLength(content, "utf8");
}

/**
 * Hard server-side gate applied BEFORE any CSV/XLSX parsing.
 *
 * Enforces the 10 MB upload ceiling and the .csv/.xlsx extension allow-list.
 * Rejects oversized files and unsupported types immediately so the parser is
 * never handed attacker-controlled content outside the accepted envelope.
 */
export function validateImportFileMeta(
  fileName: string,
  content: string,
): ImportFileMetaResult {
  const extension = getFileExtension(fileName);
  if (
    !ALLOWED_IMPORT_EXTENSIONS.includes(
      extension as (typeof ALLOWED_IMPORT_EXTENSIONS)[number],
    )
  ) {
    return { ok: false, code: "INVALID_FILE_TYPE" };
  }
  if (getDecodedByteLength(content) > MAX_IMPORT_FILE_BYTES) {
    return { ok: false, code: "FILE_TOO_LARGE" };
  }
  return { ok: true };
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function parseDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
    return null;
  }
  const str = String(value).trim();
  if (isoDateRegex.test(str)) return str;
  // Try common formats: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

function parseCsv(content: string): Record<string, unknown>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((header) => normalizeHeader(header.replace(/^"|"$/g, "")));

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((value) => value.replace(/^"|"$/g, "").trim());
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
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return json.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value;
    }
    return normalized;
  });
}

function mapRowToBeneficiary(row: Record<string, unknown>, rowNumber: number): BeneficiaryImportRow {
  return {
    rowNumber,
    name: String(row.name ?? "").trim(),
    phone: row.phone ? String(row.phone).trim() : null,
    birthDate: parseDateValue(row.birth_date),
    gender: row.gender ? String(row.gender).trim().toLowerCase() : null,
    stage: row.stage ? String(row.stage).trim() : null,
    className: row.class ? String(row.class).trim() : null,
    address: row.address ? String(row.address).trim() : null,
    notes: row.notes ? String(row.notes).trim() : null,
  };
}

export function parseImportFile(
  content: string,
  format: ImportFileFormat,
  fileName: string,
): ServiceResult<ImportPreviewResult> {
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

    const rows = rawRows.map((row, index) => mapRowToBeneficiary(row, index + 2));

    const validation = validateBeneficiaryRows(rows);

    return {
      data: {
        fileName,
        format,
        validation,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to parse the file. Please ensure it is a valid CSV or XLSX file." };
  }
}

export function validateBeneficiaryRows(rows: BeneficiaryImportRow[]): ImportValidationResult {
  const validRows: BeneficiaryImportRow[] = [];
  const invalidRows: InvalidImportRow[] = [];
  const errorSummary: ImportErrorSummary = {
    totalRows: rows.length,
    validCount: 0,
    invalidCount: 0,
    duplicateNames: 0,
    duplicatePhones: 0,
    missingRequired: 0,
    invalidDates: 0,
    invalidGenders: 0,
    unknownStages: 0,
    unknownClasses: 0,
  };

  const nameCounts = new Map<string, number>();
  const phoneCounts = new Map<string, number>();

  // First pass: count duplicates
  for (const row of rows) {
    const normalizedName = row.name.trim().toLowerCase();
    if (normalizedName) {
      nameCounts.set(normalizedName, (nameCounts.get(normalizedName) ?? 0) + 1);
    }
    if (row.phone) {
      const normalizedPhone = row.phone.replace(/[\s-]/g, "");
      phoneCounts.set(normalizedPhone, (phoneCounts.get(normalizedPhone) ?? 0) + 1);
    }
  }

  for (const row of rows) {
    const errors: ImportValidationError[] = [];
    const normalizedName = row.name.trim().toLowerCase();

    // Missing required fields
    if (!row.name.trim()) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "name",
        message: "Name is required.",
      });
      errorSummary.missingRequired += 1;
    }

    // Duplicate names
    if (normalizedName && (nameCounts.get(normalizedName) ?? 0) > 1) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "name",
        message: "Duplicate name found in the file.",
      });
      errorSummary.duplicateNames += 1;
    }

    // Duplicate phones
    if (row.phone) {
      const normalizedPhone = row.phone.replace(/[\s-]/g, "");
      if ((phoneCounts.get(normalizedPhone) ?? 0) > 1) {
        errors.push({
          rowNumber: row.rowNumber,
          field: "phone",
          message: "Duplicate phone number found in the file.",
        });
        errorSummary.duplicatePhones += 1;
      }
    }

    // Invalid dates
    if (row.birthDate && !isoDateRegex.test(row.birthDate)) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "birth_date",
        message: "Invalid date format. Use YYYY-MM-DD.",
      });
      errorSummary.invalidDates += 1;
    }

    // Invalid gender
    if (row.gender && row.gender !== "male" && row.gender !== "female") {
      errors.push({
        rowNumber: row.rowNumber,
        field: "gender",
        message: "Gender must be 'male' or 'female'.",
      });
      errorSummary.invalidGenders += 1;
    }

    if (errors.length > 0) {
      invalidRows.push({ row, errors });
      errorSummary.invalidCount += 1;
    } else {
      validRows.push(row);
      errorSummary.validCount += 1;
    }
  }

  return { validRows, invalidRows, errorSummary };
}

function classifyImportFailure(
  error: PostgrestError,
  phase: "rpc" | "insert",
): { reason: ImportRowFailureReason; message: string } {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "23505") {
    return { reason: "duplicate", message };
  }
  const lower = message.toLowerCase();
  if (lower.includes("servant_not_found")) {
    return { reason: "servant_not_found", message };
  }
  if (
    lower.includes("stage_not_found") ||
    lower.includes("service_not_found") ||
    lower.includes("service_and_stage_required")
  ) {
    return { reason: "stage_not_found", message };
  }
  if (
    lower.includes("not_admin") ||
    lower.includes("not_allowed") ||
    lower.includes("profile_not_found") ||
    lower.includes("church_not_found") ||
    lower.includes("church_id_required") ||
    lower.includes("not_authenticated")
  ) {
    return { reason: "invalid_church_scope", message };
  }
  return { reason: phase === "rpc" ? "rpc_failure" : "insert_failure", message };
}

export async function importBeneficiaries(
  supabase: SupabaseClient,
  read: SupabaseClient,
  churchId: string,
  rows: BeneficiaryImportRow[],
): Promise<ServiceResult<ImportSummary>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "You must be logged in." };
    }

    // Fetch valid stages (with their service) and classes for this church.
    // `read` is the session client for church-scoped users and the admin client
    // for the Platform Owner (no RLS path to the church catalog).
    const [stagesResult, classesResult] = await Promise.all([
      read.from("stages").select("id, name_ar, name_en, service_id").eq("church_id", churchId).is("deleted_at", null),
      read.from("classes").select("id, name_ar, name_en").eq("church_id", churchId).is("deleted_at", null),
    ]);

    if (stagesResult.error) return { data: null, error: stagesResult.error.message };
    if (classesResult.error) return { data: null, error: classesResult.error.message };

    const stages = stagesResult.data ?? [];
    const classes = classesResult.data ?? [];

    const stageByName = new Map<string, { id: string; serviceId: string }>();
    for (const stage of stages) {
      if (!stage.service_id) continue;
      const ref = { id: stage.id, serviceId: stage.service_id };
      if (stage.name_ar) stageByName.set(stage.name_ar.trim().toLowerCase(), ref);
      if (stage.name_en) stageByName.set(stage.name_en.trim().toLowerCase(), ref);
    }

    const classByName = new Map<string, string>();
    for (const cls of classes) {
      if (cls.name_ar) classByName.set(cls.name_ar.trim().toLowerCase(), cls.id);
      if (cls.name_en) classByName.set(cls.name_en.trim().toLowerCase(), cls.id);
    }

    // Existing beneficiaries in this church (all active, so duplicate checks
    // are case-insensitive and not limited to the exact casing in the file)
    const { data: existing, error: existingError } = await read
      .from("beneficiaries")
      .select("id, full_name_ar, mobile")
      .eq("church_id", churchId)
      .is("deleted_at", null);

    if (existingError) return { data: null, error: existingError.message };

    const existingNames = new Set((existing ?? []).map((row) => row.full_name_ar.trim().toLowerCase()));
    const existingPhones = new Set(
      (existing ?? [])
        .map((row) => row.mobile?.trim().replace(/[\s-]/g, ""))
        .filter((phone): phone is string => Boolean(phone)),
    );

    let importedCount = 0;
    let skippedCount = 0;
    const failures: ImportRowFailure[] = [];

    for (const row of rows) {
      const normalizedName = row.name.trim().toLowerCase();
      const normalizedPhone = row.phone?.replace(/[\s-]/g, "");

      // Skip if already exists in the church
      if (existingNames.has(normalizedName) || (normalizedPhone && existingPhones.has(normalizedPhone))) {
        skippedCount += 1;
        continue;
      }

      // Validate class reference
      if (row.className && !classByName.has(row.className.trim().toLowerCase())) {
        skippedCount += 1;
        continue;
      }

      const stageRef = row.stage ? stageByName.get(row.stage.trim().toLowerCase()) : undefined;

      // Validate stage reference
      if (row.stage && !stageRef) {
        failures.push({
          rowNumber: row.rowNumber,
          name: row.name,
          reason: "stage_not_found",
          message: `Unknown stage: ${row.stage}`,
        });
        continue;
      }

      const beneficiaryFields = {
        full_name_ar: row.name.trim(),
        mobile: row.phone?.trim() || null,
        date_of_birth: row.birthDate ?? "2000-01-01",
        address: row.address?.trim() || null,
        notes: row.notes?.trim() || null,
        gender: row.gender ?? "male",
        status: "active",
      };

      // All writes run through the sanctioned RPC (042) so both a church
      // super_admin AND the Platform Owner (church_id NULL, no RLS path to
      // beneficiaries) can create the beneficiary for this church. When a
      // stage is provided the RPC also creates the current assignment
      // atomically (beneficiary_assignments is RLS-immutable); the internal
      // user_is_platform_owner() / user_is_super_admin(p_church_id) guard is
      // the hard authorization boundary.
      const { error: insertError } = await supabase.rpc("create_beneficiary_for_church", {
        p_church_id: churchId,
        p_full_name_ar: beneficiaryFields.full_name_ar,
        p_service_id: stageRef?.serviceId ?? null,
        p_stage_id: stageRef?.id ?? null,
        p_date_of_birth: beneficiaryFields.date_of_birth,
        p_gender: beneficiaryFields.gender,
        p_mobile: beneficiaryFields.mobile,
        p_address: beneficiaryFields.address,
        p_notes: beneficiaryFields.notes,
      });

      if (insertError) {
        const failure = classifyImportFailure(
          insertError,
          stageRef ? "rpc" : "insert",
        );
        failures.push({
          rowNumber: row.rowNumber,
          name: row.name,
          reason: failure.reason,
          message: failure.message,
        });
        continue;
      }

      importedCount += 1;
    }

    return { data: { importedCount, skippedCount, failures }, error: null };
  } catch {
    return { data: null, error: "Failed to import beneficiaries." };
  }
}

export async function exportData(
  read: SupabaseClient,
  churchId: string,
  entity: ExportEntityType,
  format: ExportFileFormat,
  filters: BeneficiaryExportFilters = {},
): Promise<ServiceResult<{ fileName: string; content: string; mimeType: string }>> {
  try {
    let headers: string[] = [];
    let rows: Record<string, unknown>[] = [];

    if (entity === "beneficiaries") {
      // The assignment join is only added when a service/stage filter is set so
      // beneficiaries without a current assignment still export in the unfiltered
      // case (mirrors the children list page's !inner join semantics).
      let select =
        "full_name_ar, full_name_en, mobile, date_of_birth, address, notes, status, created_at";
      if (filters.service_id || filters.stage_id) {
        select += ", beneficiary_assignments!inner(service_id, stage_id)";
      }

      let query = read
        .from("beneficiaries")
        .select(select)
        .eq("church_id", churchId)
        .is("deleted_at", null);

      if (filters.search) {
        const term = `%${filters.search}%`;
        query = query.or(
          `full_name_ar.ilike.${term},full_name_en.ilike.${term},mobile.ilike.${term}`,
        );
      }

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters.service_id) {
        query = query.eq(
          "beneficiary_assignments.service_id",
          filters.service_id,
        );
      }

      if (filters.stage_id) {
        query = query.eq("beneficiary_assignments.stage_id", filters.stage_id);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      headers = ["name", "phone", "birth_date", "address", "notes", "status", "created_at"];
      const exportRows = (data ?? []) as unknown as BeneficiaryExportRow[];
      rows = exportRows.map((row) => ({
        name: row.full_name_ar,
        phone: row.mobile ?? "",
        birth_date: row.date_of_birth,
        address: row.address ?? "",
        notes: row.notes ?? "",
        status: row.status,
        created_at: row.created_at,
      }));
    } else if (entity === "attendance") {
      const { data, error } = await read
        .from("attendance_records")
        .select(
          "status, created_at, attendance_sessions(session_date, stages(name_ar, name_en)), beneficiaries(full_name_ar)",
        )
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      headers = ["beneficiary", "stage", "session_date", "status", "recorded_at"];
      rows = (data ?? []).map((row) => {
        const session = (row.attendance_sessions as unknown) as
          | { session_date: string; stages?: { name_ar?: string | null; name_en?: string | null } | null }
          | null;
        const beneficiary = (row.beneficiaries as unknown) as { full_name_ar?: string | null } | null;
        return {
          beneficiary: beneficiary?.full_name_ar ?? "",
          stage: session?.stages?.name_ar ?? session?.stages?.name_en ?? "",
          session_date: session?.session_date ?? "",
          status: row.status,
          recorded_at: row.created_at,
        };
      });
    } else if (entity === "followups") {
      const { data, error } = await read
        .from("followups")
        .select("type, status, scheduled_at, completed_at, notes, outcome, beneficiaries(full_name_ar)")
        .eq("church_id", churchId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      headers = ["beneficiary", "type", "status", "scheduled_at", "completed_at", "notes", "outcome"];
      rows = (data ?? []).map((row) => {
        const beneficiary = (row.beneficiaries as unknown) as { full_name_ar?: string | null } | null;
        return {
          beneficiary: beneficiary?.full_name_ar ?? "",
          type: row.type,
          status: row.status,
          scheduled_at: row.scheduled_at ?? "",
          completed_at: row.completed_at ?? "",
          notes: row.notes ?? "",
          outcome: row.outcome ?? "",
        };
      });
    } else if (entity === "servants") {
      const { data, error } = await read
        .from("servants")
        .select("id, approval_status, join_date, notes, profiles!servants_id_fkey(full_name_ar, email, phone)")
        .eq("church_id", churchId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      headers = ["name", "email", "phone", "approval_status", "join_date", "notes"];
      rows = (data ?? []).map((row) => {
        const profile = (row.profiles as unknown) as
          | { full_name_ar?: string | null; email?: string | null; phone?: string | null }
          | null;
        return {
          name: profile?.full_name_ar ?? "",
          email: profile?.email ?? "",
          phone: profile?.phone ?? "",
          approval_status: row.approval_status,
          join_date: row.join_date ?? "",
          notes: row.notes ?? "",
        };
      });
    }

    const fileName = `${entity}-${new Date().toISOString().slice(0, 10)}.${format}`;

    if (format === "csv") {
      const csv = toCsv(headers, rows);
      return { data: { fileName, content: csv, mimeType: "text/csv;charset=utf-8;" }, error: null };
    }

    // XLSX
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, entity);
    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    return { data: { fileName, content: base64, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, error: null };
  } catch {
    return { data: null, error: "Failed to export data." };
  }
}

const BENEFICIARY_IMPORT_HEADERS = [
  "name",
  "phone",
  "birth_date",
  "gender",
  "stage",
  "class",
  "address",
  "notes",
];

const BENEFICIARY_TEMPLATE_ROW: Record<string, string> = {
  name: "اسم المستفيد",
  phone: "01000000000",
  birth_date: "2015-05-01",
  gender: "male",
  stage: "",
  class: "",
  address: "",
  notes: "",
};

/**
 * Downloadable template for the beneficiary/children bulk import. Mirrors the
 * headers the importer maps (mapRowToBeneficiary) and the exact values the
 * validator accepts (gender male/female, YYYY-MM-DD dates).
 */
export function buildBeneficiariesTemplate(
  format: ImportFileFormat,
): DownloadableFile {
  const fileName = `children-import-template.${format}`;

  if (format === "csv") {
    return {
      fileName,
      content: toCsv(BENEFICIARY_IMPORT_HEADERS, [BENEFICIARY_TEMPLATE_ROW]),
      mimeType: "text/csv;charset=utf-8;",
    };
  }

  const worksheet = XLSX.utils.json_to_sheet([BENEFICIARY_TEMPLATE_ROW], {
    header: BENEFICIARY_IMPORT_HEADERS,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "beneficiaries");
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  return {
    fileName,
    content: base64,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

/**
 * Builds a downloadable errors file (CSV or XLSX) for a bulk import. One row
 * per failed input row, echoing the original row values plus a human-readable
 * `errors` column so operators can fix and re-upload. Reused by both the users
 * import (users-import-errors) and the children import
 * (children-import-errors).
 */
export function buildImportErrorsFile(
  fileName: string,
  format: ImportFileFormat,
  rows: ImportErrorFileRow[],
): DownloadableFile {
  const headers = ["row", "errors"];

  const tableRows: Record<string, unknown>[] = rows.map((row) => {
    const values: Record<string, unknown> = { row: row.rowNumber };
    for (const [key, value] of Object.entries(row.values)) {
      const header = key.replace(/_/g, " ");
      if (!headers.includes(header)) headers.push(header);
      values[header] = value;
    }
    values.errors = row.messages.join("; ");
    return values;
  });

  if (format === "csv") {
    return {
      fileName,
      content: toCsv(headers, tableRows),
      mimeType: "text/csv;charset=utf-8;",
    };
  }

  const worksheet = XLSX.utils.json_to_sheet(tableRows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "errors");
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  return {
    fileName,
    content: base64,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (value: unknown): string => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(","));
  }
  return lines.join("\n");
}