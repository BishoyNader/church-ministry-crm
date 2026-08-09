import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildImportErrorsFile,
  toCsv,
} from "@/features/import-export/services/import-export.service";
import type {
  DownloadableFile,
  ImportErrorFileRow,
} from "@/features/import-export/types/import-export.types";
import type { UserImportFileFormat } from "../types/user-import.types";
import type { UserRoleType } from "../types/user.types";

const USER_EXPORT_HEADERS = [
  "email",
  "full_name_ar",
  "full_name_en",
  "phone",
  "roles",
  "status",
  "created_at",
];

export type UserExportOptions = {
  format: "csv" | "xlsx";
  search?: string;
  roleFilter?: UserRoleType;
};

type UserExportProfile = {
  id: string;
  email: string;
  full_name_ar: string | null;
  full_name_en: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  roles: { name_ar: string | null; role_type: string }[];
};

/**
 * Exports a church's users honouring the same search/role filters as the list
 * page. Reuses the listUsers join shape (literal selects so the untyped client
 * keeps the embedded role type), but returns the full row set instead of a page.
 */
export async function exportUsers(
  supabase: SupabaseClient,
  churchId: string,
  options: UserExportOptions,
): Promise<{ data: DownloadableFile | null; error: string | null }> {
  const { format, search, roleFilter } = options;

  try {
    let query = supabase
      .from("profiles")
      .select("id, church_id, email, full_name_ar, full_name_en, phone, is_active, created_at")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(
        `full_name_ar.ilike.%${search}%,full_name_en.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }

    const { data: profiles, error } = await query;
    if (error) return { data: null, error: error.message };

    let users = (profiles ?? []) as unknown as UserExportProfile[];

    if (users.length > 0) {
      const userIds = users.map((u) => u.id);

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, roles(name_ar, role_type)")
        .in("user_id", userIds)
        .is("end_date", null);

      const rolesByUser = new Map<string, UserExportProfile["roles"]>();
      for (const ur of userRoles ?? []) {
        const existing = rolesByUser.get(ur.user_id) ?? [];
        const role = (ur.roles as unknown as
          | { name_ar: string | null; role_type: string }
          | null);
        if (role) existing.push(role);
        rolesByUser.set(ur.user_id, existing);
      }

      users = users.map((u) => ({
        ...u,
        roles: rolesByUser.get(u.id) ?? [],
      }));
    }

    if (roleFilter) {
      users = users.filter((u) => u.roles.some((r) => r.role_type === roleFilter));
    }

    const fileName = `users-export.${format}`;
    const rows: Record<string, unknown>[] = users.map((u) => ({
      email: u.email,
      full_name_ar: u.full_name_ar ?? "",
      full_name_en: u.full_name_en ?? "",
      phone: u.phone ?? "",
      roles: u.roles.map((r) => r.name_ar ?? r.role_type).join(", "),
      status: u.is_active ? "active" : "inactive",
      created_at: u.created_at,
    }));

    if (format === "csv") {
      return {
        data: {
          fileName,
          content: toCsv(USER_EXPORT_HEADERS, rows),
          mimeType: "text/csv;charset=utf-8;",
        },
        error: null,
      };
    }

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: USER_EXPORT_HEADERS,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "users");
    return {
      data: {
        fileName,
        content: XLSX.write(workbook, { type: "base64", bookType: "xlsx" }),
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to export users." };
  }
}

/**
 * Renders a users-import-errors file for the rows that failed validation. The
 * original row values are echoed back alongside the human-readable messages so
 * operators can fix and re-upload.
 */
export function buildUserImportErrorsFile(
  format: UserImportFileFormat,
  rows: ImportErrorFileRow[],
): DownloadableFile {
  return buildImportErrorsFile(`users-import-errors.${format}`, format, rows);
}
