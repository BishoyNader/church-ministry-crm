"use client";

import { useQuery } from "@tanstack/react-query";
import {
  exportReportsCsvAction,
  getReportsDataAction,
  getReportsFilterOptionsAction,
} from "../actions/reports.actions";
import type { ReportsFilters } from "../types/reports.types";

export const REPORTS_QUERY_KEYS = {
  all: ["reports"] as const,
  data: (filters: ReportsFilters) => ["reports", "data", filters] as const,
  filterOptions: () => ["reports", "filter-options"] as const,
};

export function useReportsData(filters: ReportsFilters = {}) {
  return useQuery({
    queryKey: REPORTS_QUERY_KEYS.data(filters),
    queryFn: async () => {
      const result = await getReportsDataAction(filters);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load reports.");
      }
      return result;
    },
    staleTime: 60_000,
  });
}

export function useReportsFilterOptions() {
  return useQuery({
    queryKey: REPORTS_QUERY_KEYS.filterOptions(),
    queryFn: async () => {
      const result = await getReportsFilterOptionsAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load report filters.");
      }
      return result;
    },
    staleTime: 60_000,
  });
}

export async function exportReportsCsv(filters: ReportsFilters = {}) {
  return await exportReportsCsvAction(filters);
}
