"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  exportAuditCsvAction,
  getAuditFilterOptionsAction,
  getAuditPageAction,
} from "../actions/audit.actions";
import type { AuditFilters } from "../types/audit.types";

export const AUDIT_QUERY_KEYS = {
  all: ["audit"] as const,
  page: (filters: AuditFilters) => ["audit", "page", filters] as const,
  filterOptions: () => ["audit", "filter-options"] as const,
};

export function useAuditPage(filters: AuditFilters = {}) {
  const locale = useLocale();
  return useQuery({
    queryKey: AUDIT_QUERY_KEYS.page(filters),
    queryFn: async () => {
      const result = await getAuditPageAction(filters, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load the audit log.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}

export function useAuditFilterOptions() {
  const locale = useLocale();
  return useQuery({
    queryKey: AUDIT_QUERY_KEYS.filterOptions(),
    queryFn: async () => {
      const result = await getAuditFilterOptionsAction(locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load audit filters.");
      }
      return result;
    },
    staleTime: 60_000,
  });
}

export function useExportAuditCsv() {
  const locale = useLocale();
  return useMutation({
    mutationFn: (filters: AuditFilters) => exportAuditCsvAction(filters, locale),
  });
}
