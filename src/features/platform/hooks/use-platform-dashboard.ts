"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getPlatformDashboardStatsAction,
  getPlatformRecentAuditAction,
} from "../actions/platform-dashboard.actions";

export const PLATFORM_DASHBOARD_QUERY_KEYS = {
  stats: ["platform", "dashboard", "stats"] as const,
  recentAudit: (limit: number) => ["platform", "dashboard", "audit", limit] as const,
};

export function usePlatformDashboardStats() {
  return useQuery({
    queryKey: PLATFORM_DASHBOARD_QUERY_KEYS.stats,
    queryFn: async () => {
      const result = await getPlatformDashboardStatsAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load platform dashboard.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}

export function usePlatformRecentAudit(limit = 8) {
  return useQuery({
    queryKey: PLATFORM_DASHBOARD_QUERY_KEYS.recentAudit(limit),
    queryFn: async () => {
      const result = await getPlatformRecentAuditAction(limit);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load recent activity.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}
