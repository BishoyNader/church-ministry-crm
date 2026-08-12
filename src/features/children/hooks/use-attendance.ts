"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAttendanceAction,
  createAttendanceAction,
  batchAttendanceAction,
  toggleAttendanceAction,
} from "../actions/child.actions";
import type {
  CreateAttendanceFormValues,
  BatchAttendanceFormValues,
  ToggleAttendanceFormValues,
} from "../schemas/child.schema";
import { CHILD_QUERY_KEYS } from "./use-children";

export const ATTENDANCE_QUERY_KEYS = {
  all: ["attendance"] as const,
  list: (filters?: {
    beneficiary_id?: string;
    stage_id?: string;
    from_date?: string;
    to_date?: string;
  }) => ["attendance", "list", filters] as const,
};

export function useAttendanceList(
  filters?: {
    beneficiary_id?: string;
    stage_id?: string;
    from_date?: string;
    to_date?: string;
  },
  enabled?: boolean,
) {
  return useQuery({
    queryKey: ATTENDANCE_QUERY_KEYS.list(filters),
    queryFn: async () => {
      const result = await listAttendanceAction(filters);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load attendance records.");
      }
      return result;
    },
    staleTime: 30_000,
    enabled: enabled ?? true,
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreateAttendanceFormValues) =>
      createAttendanceAction(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHILD_QUERY_KEYS.all });
    },
  });
}

export function useBatchAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: BatchAttendanceFormValues) =>
      batchAttendanceAction(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHILD_QUERY_KEYS.all });
    },
  });
}

export function useToggleAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ToggleAttendanceFormValues) =>
      toggleAttendanceAction(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHILD_QUERY_KEYS.all });
    },
  });
}
