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
    queryFn: () => getReportsDataAction(filters),
    staleTime: 60_000,
  });
}

export function useReportsFilterOptions() {
  return useQuery({
    queryKey: REPORTS_QUERY_KEYS.filterOptions(),
    queryFn: () => getReportsFilterOptionsAction(),
    staleTime: 60_000,
  });
}

export async function exportReportsCsv(filters: ReportsFilters = {}) {
  return await exportReportsCsvAction(filters);
}
