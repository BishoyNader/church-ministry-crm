"use server";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { getTranslations } from "next-intl/server";
import * as auditService from "../services/audit.service";
import type {
  AuditActionResult,
  AuditFilterOptions,
  AuditFilters,
  AuditPageData,
} from "../types/audit.types";

export async function getAuditPageAction(
  filters: AuditFilters = {},
  locale: string,
): Promise<AuditActionResult<AuditPageData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.AUDIT_READ))) {
    return { success: false, message: "You do not have permission to view the audit log." };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const result = await auditService.getAuditPage(supabase, profile.church_id, filters);
  if (result.error) {
    const t = await getTranslations({ locale, namespace: "audit" });
    return { success: false, message: t("loadFailed"), data: undefined };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function getAuditFilterOptionsAction(
  locale: string,
): Promise<AuditActionResult<AuditFilterOptions>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.AUDIT_READ))) {
    return { success: false, message: "You do not have permission to view the audit log." };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const result = await auditService.getAuditFilterOptions(supabase, profile.church_id);
  if (result.error) {
    const t = await getTranslations({ locale, namespace: "audit" });
    return { success: false, message: t("loadFailed"), data: undefined };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function exportAuditCsvAction(
  filters: AuditFilters = {},
  locale: string,
): Promise<AuditActionResult<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.AUDIT_READ))) {
    return { success: false, message: "You do not have permission to export the audit log." };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const result = await auditService.getAuditPage(supabase, profile.church_id, {
    ...filters,
    page: 1,
    pageSize: 100,
  });
  if (result.error || !result.data) {
    const t = await getTranslations({ locale, namespace: "audit" });
    return { success: false, message: t("exportFailed"), data: undefined };
  }

  const csv = auditService.auditToCsv(result.data);
  return { success: true, data: csv };
}
