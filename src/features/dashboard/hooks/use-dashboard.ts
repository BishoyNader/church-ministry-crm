"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardDataAction } from "../actions/dashboard.actions";

export const DASHBOARD_QUERY_KEYS = {
  all: ["dashboard"] as const,
  data: () => ["dashboard", "data"] as const,
};

export function useDashboardData() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.data(),
    queryFn: async () => {
      const result = await getDashboardDataAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load the dashboard.");
      }
      return result;
    },
    staleTime: 60_000,
  });
}
