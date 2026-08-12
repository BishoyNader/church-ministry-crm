"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listServantAttendanceAction,
  batchServantAttendanceAction,
  listServantAttendanceHistoryAction,
} from "../actions/servant-attendance.actions";
import type {
  BatchServantAttendanceFormValues,
  ServantAttendanceListFormValues,
} from "../schemas/servant-attendance.schema";

export const SERVANT_ATTENDANCE_QUERY_KEYS = {
  all: ["servant-attendance"] as const,
  list: (filters?: ServantAttendanceListFormValues) =>
    ["servant-attendance", "list", filters] as const,
  history: (stageId: string) => ["servant-attendance", "history", stageId] as const,
};

export function useServantAttendanceList(
  filters?: ServantAttendanceListFormValues,
  enabled?: boolean,
) {
  return useQuery({
    queryKey: SERVANT_ATTENDANCE_QUERY_KEYS.list(filters),
    queryFn: async () => {
      const result = await listServantAttendanceAction(filters ?? {});
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load servant attendance.");
      }
      return result;
    },
    staleTime: 30_000,
    enabled: enabled ?? true,
  });
}

export function useBatchServantAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: BatchServantAttendanceFormValues) =>
      batchServantAttendanceAction(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVANT_ATTENDANCE_QUERY_KEYS.all });
    },
  });
}

export function useServantAttendanceHistory(stageId: string | null) {
  return useQuery({
    queryKey: SERVANT_ATTENDANCE_QUERY_KEYS.history(stageId ?? ""),
    queryFn: async () => {
      const result = await listServantAttendanceHistoryAction(stageId!);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load servant attendance history.");
      }
      return result;
    },
    enabled: !!stageId,
    staleTime: 60_000,
  });
}
